import logging
import time

from .config import settings
from .db import ACTIVE, TERMINAL, Store
from .runpod import RunPod

log = logging.getLogger(__name__)


def tick(db, pods, cfg, now=None):
    now = int(time.time()) if now is None else now
    with db.scheduler_lock() as locked:
        if not locked: return
        observed = pods.list()  # If RunPod cannot be reached, do not launch more work.
        by_name = {}
        for pod in observed: by_name.setdefault(pod['name'], []).append(pod)
        current = db.list()
        for job in current:
            matches = by_name.get(pods.name(job['id']), [])
            if job['state'] in TERMINAL:
                # Reconcile by name even after cleanup, catching delayed create responses.
                targets = {p['id'] for p in matches}
                if not job['cleanup_done'] and job['pod_id']: targets.add(job['pod_id'])
                for pod_id in targets: pods.delete(pod_id)
                db.settle(job['id'])
                continue
            if job['state'] in ACTIVE:
                if matches and not job['pod_id']:
                    db.patch(job['id'], ACTIVE, pod_id=matches[0]['id'])
                if len(matches) > 1:
                    db.finish(job['id'], 'failed', 'duplicate_pods')
                elif now - job['started_at'] >= job['config']['max_runtime_seconds']:
                    db.finish(job['id'], 'failed', 'runtime_limit')
                elif job['heartbeat_at'] and now-job['heartbeat_at'] > cfg.heartbeat_timeout:
                    db.finish(job['id'], 'failed', 'worker_unresponsive')
                elif not job['heartbeat_at'] and now-job['started_at'] > cfg.startup_timeout:
                    db.finish(job['id'], 'failed', 'worker_start_timeout')
                # Never reissue a create request for provisioning jobs after a crash/timeout.
        current = db.list()
        occupied = sum(j['state'] in ACTIVE or (j['state'] in TERMINAL and not j['cleanup_done']) for j in current)
        for job in sorted(current, key=lambda j: j['created_at']):
            if occupied >= cfg.max_running_jobs: break
            if job['state'] != 'queued': continue
            if not db.patch(job['id'], ('queued',), state='provisioning', stage='starting', started_at=now): continue
            occupied += 1
            try:
                pod_id = pods.create(job)
                db.patch(job['id'], ('provisioning', 'running', *TERMINAL), pod_id=pod_id)
            except Exception:
                # The provider may have accepted the request before the connection failed.
                # Leave provisioning in place and reconcile its deterministic name next tick.
                log.warning('Pod create outcome unknown for job %s; awaiting reconciliation', job['id'])


def main():
    cfg = settings()
    if not cfg.runpod_api_key or not cfg.worker_image or not cfg.api_public_url:
        raise SystemExit('Set RUNPOD_API_KEY, WORKER_IMAGE, and API_PUBLIC_URL')
    db = Store(cfg.database_url); pods = RunPod(cfg)
    logging.basicConfig(level=logging.INFO)
    while True:
        try: tick(db, pods, cfg)
        except Exception:
            # Do not log provider response bodies: they may contain container env secrets.
            log.error('Scheduler tick failed; will retry without resubmitting active jobs')
        time.sleep(cfg.scheduler_interval)


if __name__ == '__main__': main()
