import hashlib
import hmac
import json
import tempfile
import time
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import ValidationError

from .auth import SupabaseAuth, bearer, worker_token
from .catalog import load_catalog
from .config import settings
from .db import ACTIVE, TERMINAL, Conflict, Forbidden, Store
from .models import EvaluationRequest, WorkerFinish, WorkerUpdate
from .storage import LocalStorage, SupabaseStorage


def public_job(job):
    return {key: job[key] for key in ('id', 'state', 'stage', 'created_at', 'started_at', 'finished_at',
            'reserved_credits', 'charged_credits', 'error_code')} | {
                'name': job['config']['name'], 'engine': job['config']['engine'],
                'has_artifacts': bool(job['artifact'])}


def create_app(config=None, store=None, auth=None, storage=None):
    cfg = config or settings()
    db = store or Store(cfg.database_url)
    auth = auth or SupabaseAuth(cfg)
    storage = storage or (SupabaseStorage(cfg) if cfg.environment == 'production' else LocalStorage(cfg.local_storage_path))
    catalog = load_catalog(cfg.model_catalog_path)
    app = FastAPI(title='ValueArena evaluation API', version='0.1.0')
    app.state.store = db
    app.add_middleware(CORSMiddleware, allow_origins=cfg.allowed_origins.split(','),
        allow_methods=['GET', 'POST', 'PUT'], allow_headers=['Authorization', 'Content-Type', 'Idempotency-Key'])

    @app.exception_handler(Conflict)
    async def conflict(_, exc): return JSONResponse({'detail': str(exc)}, status_code=409)

    @app.exception_handler(Forbidden)
    async def forbidden(_, exc): return JSONResponse({'detail': str(exc)}, status_code=403)

    def user(authorization: str | None = Header(default=None)):
        return auth.user(bearer(authorization))

    def owned(job_id, user_id):
        job = db.get(str(job_id))
        if not job or job['user_id'] != user_id:
            raise HTTPException(404, 'Evaluation not found')
        return job

    def worker(job_id: UUID, authorization: str | None = Header(default=None)):
        token = bearer(authorization)
        if not hmac.compare_digest(token, worker_token(cfg.worker_secret, job_id)):
            raise HTTPException(401, 'Invalid worker credentials')
        job = db.get(str(job_id))
        if not job: raise HTTPException(404, 'Evaluation not found')
        return job

    @app.get('/health')
    def health(): return {'status': 'ok'}

    @app.get('/models')
    def models():
        return {'models': [{'id': key, 'label': entry['label']} for key, entry in catalog.items()],
                'engines': ['native', 'inspect'], 'default_engine': 'native', 'evaluation_mode': 'direct_rating'}

    @app.get('/account')
    def account(user_id=Depends(user)):
        return db.balance(user_id) | {'credit_unit': 'reserved execution second; not currency'}

    @app.post('/evaluations', status_code=202)
    async def submit(request: Request, user_id=Depends(user), idempotency_key: str = Header(alias='Idempotency-Key')):
        if not 1 <= len(idempotency_key) <= 128: raise HTTPException(400, 'Invalid idempotency key')
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 2_000_000: raise HTTPException(413, 'Configuration too large')
        try:
            incoming = EvaluationRequest.model_validate_json(body)
        except ValidationError:
            raise HTTPException(422, 'Invalid evaluation configuration; see the request schema') from None
        missing = set(incoming.models) - set(catalog)
        if missing: raise HTTPException(422, 'Select models from /models')
        config = incoming.model_dump()
        digest = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()
        # Snapshot the catalog: queued jobs do not silently change if administrators update it.
        config['model_refs'] = {key: catalog[key]['ref'] for key in incoming.models}
        return public_job(db.submit(user_id, idempotency_key, digest, config))

    @app.get('/evaluation-schema')
    def schema(): return EvaluationRequest.model_json_schema()

    @app.get('/evaluations')
    def evaluations(user_id=Depends(user)):
        return [public_job(job) for job in db.list(user_id)]

    @app.get('/evaluations/{job_id}')
    def evaluation(job_id: UUID, user_id=Depends(user)):
        return public_job(owned(job_id, user_id))

    @app.post('/evaluations/{job_id}/cancel')
    def cancel(job_id: UUID, user_id=Depends(user)):
        job = owned(job_id, user_id)
        db.finish(job['id'], 'cancelled', 'user_cancelled')
        # Queued jobs never launched a pod and can release their reservation immediately.
        if job['state'] == 'queued':
            fresh = db.get(job['id'])
            if fresh['started_at'] is None: db.settle(job['id'])
        return public_job(db.get(job['id']))

    @app.get('/evaluations/{job_id}/artifacts')
    def artifacts(job_id: UUID, user_id=Depends(user)):
        job = owned(job_id, user_id)
        if not job['artifact']: raise HTTPException(404, 'Artifacts are not available yet')
        if isinstance(storage, LocalStorage):
            return FileResponse(storage.root / job['artifact'], filename='evaluation.tar.gz')
        return {'url': storage.download_url(job['artifact']), 'expires_in': 300}

    @app.get('/internal/jobs/{job_id}')
    def worker_config(job=Depends(worker)):
        if job['state'] not in ACTIVE: raise HTTPException(409, 'Job is no longer active')
        return {'id': job['id'], 'config': job['config'],
                'deadline_at': job['started_at'] + job['config']['max_runtime_seconds'],
                'max_artifact_bytes': cfg.max_artifact_bytes}

    @app.post('/internal/jobs/{job_id}/heartbeat')
    def heartbeat(update: WorkerUpdate, job=Depends(worker)):
        ok = db.patch(job['id'], ACTIVE, state='running', stage=update.stage, heartbeat_at=int(time.time()))
        if not ok: raise HTTPException(409, 'Job is no longer active')
        return {'cancelled': False}

    @app.put('/internal/jobs/{job_id}/artifacts')
    async def upload(request: Request, job=Depends(worker)):
        if job['state'] not in ACTIVE: raise HTTPException(409, 'Job is no longer active')
        size = 0
        with tempfile.NamedTemporaryFile() as out:
            async for chunk in request.stream():
                size += len(chunk)
                if size > cfg.max_artifact_bytes: raise HTTPException(413, 'Artifact exceeds configured storage limit')
                out.write(chunk)
            if size == 0: raise HTTPException(400, 'Empty artifact')
            out.flush()
            key = f"{job['user_id']}/{job['id']}/evaluation.tar.gz"
            # No archive extraction or executable user content on the API server.
            from starlette.concurrency import run_in_threadpool
            await run_in_threadpool(storage.put, key, out.name)
        if not db.patch(job['id'], ACTIVE, artifact=key):
            raise HTTPException(409, 'Job ended during upload')
        return {'bytes': size}

    @app.post('/internal/jobs/{job_id}/finish')
    def finish(result: WorkerFinish, job=Depends(worker)):
        if job['state'] in TERMINAL: return {'state': job['state']}
        if result.success and not job['artifact']: raise HTTPException(409, 'Upload results before completing')
        db.finish(job['id'], 'succeeded' if result.success else 'failed', result.error_code)
        return {'state': db.get(job['id'])['state']}

    return app
