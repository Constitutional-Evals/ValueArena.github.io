"""RunPod entrypoint. Has only a job-scoped API token, never DB/storage admin keys."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tarfile
import threading
import time

import httpx

from .spec import write_spec


class WorkerClient:
    def __init__(self):
        self.root = os.environ['VA_API_URL'].rstrip('/') + '/internal/jobs/' + os.environ['VA_JOB_ID']
        self.headers = {'Authorization': 'Bearer '+os.environ['VA_WORKER_TOKEN']}

    def get(self):
        response = httpx.get(self.root, headers=self.headers, timeout=30)
        response.raise_for_status()
        return response.json()

    def post(self, endpoint, data):
        response = httpx.post(self.root+'/'+endpoint, headers=self.headers, json=data, timeout=30)
        response.raise_for_status()
        return response.json()

    def upload(self, path):
        with path.open('rb') as source:
            response = httpx.put(self.root+'/artifacts', headers={**self.headers, 'Content-Type': 'application/gzip'},
                content=source, timeout=180)
        response.raise_for_status()


def bundle(directory, target):
    # Archive only run artifacts, never model caches, parent directories, or symlinks.
    with tarfile.open(target, 'w:gz') as archive:
        for path in sorted(directory.rglob('*')):
            if path.is_file() and not path.is_symlink():
                archive.add(path, arcname=str(path.relative_to(directory)), recursive=False)


def execute_stage(command, directory, abort, deadline):
    env = {k: v for k, v in os.environ.items() if not k.startswith('VA_')}
    with (directory/'execution.log').open('ab') as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=env, start_new_session=True)
        try:
            while process.poll() is None:
                if abort.wait(1) or time.time() >= deadline:
                    raise RuntimeError('cancelled_or_timed_out')
                if (directory/'execution.log').stat().st_size > 20_000_000:
                    raise RuntimeError('log_size_limit')
            if process.returncode: raise RuntimeError('evaluation_failed')
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try: process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL); process.wait()


def run(client, workdir, execute=execute_stage):
    job = client.get(); config = job['config']
    directory = Path(workdir)/job['id']; spec = write_spec(config, directory)
    deadline = job['deadline_at']
    abort = threading.Event(); done = threading.Event()
    state = {'stage': 'starting'}

    def pulse():
        last_ok = time.monotonic()
        while not done.is_set():
            try:
                client.post('heartbeat', {'stage': state['stage']})
                last_ok = time.monotonic()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code in (401, 403, 404, 409): abort.set(); return
            except Exception:
                pass
            if time.monotonic()-last_ok > 90: abort.set(); return
            done.wait(15)

    pulse_thread = threading.Thread(target=pulse, daemon=True); pulse_thread.start()
    error = None
    try:
        for phase in ('collecting', 'analyzing'):
            state['stage'] = phase
            client.post('heartbeat', {'stage': phase})
            execute([sys.executable, '-m', 'app.stage', config['engine'], phase, str(spec)], directory, abort, deadline)
        if not (directory/'analysis'/'summary.json').is_file():
            raise RuntimeError('missing_analysis')
    except Exception:
        error = 'evaluation_failed'
    try:
        if not abort.is_set():
            state['stage'] = 'uploading'
            # Redact known provider secrets from plain logs before sharing artifacts.
            log = directory/'execution.log'
            if log.exists():
                value = log.read_text(errors='replace')
                for key in ('OPENROUTER_API_KEY', 'HF_TOKEN'):
                    secret = os.environ.get(key)
                    if secret: value = value.replace(secret, '[REDACTED]')
                log.write_text(value)
            (directory/'worker-result.json').write_text(json.dumps({'engine': config['engine'], 'error_code': error}))
            archive = directory.parent/(job['id']+'.tar.gz')
            bundle(directory, archive)
            if archive.stat().st_size > job['max_artifact_bytes']: raise RuntimeError('artifact_too_large')
            client.upload(archive)
            client.post('finish', {'success': error is None, 'error_code': error})
    except Exception:
        try: client.post('finish', {'success': False, 'error_code': 'artifact_upload_failed'})
        except Exception: pass  # Scheduler detects timeout and cleans up.
        error = 'artifact_upload_failed'
    finally:
        done.set(); pulse_thread.join(timeout=35)
    return 1 if error or abort.is_set() else 0


def main():
    try: return run(WorkerClient(), os.environ.get('VA_WORKDIR', '/workspace/jobs'))
    except Exception:
        # Startup failures are reconciled by the scheduler; do not print secrets.
        print('Worker startup failed', file=sys.stderr)
        return 1


if __name__ == '__main__': raise SystemExit(main())
