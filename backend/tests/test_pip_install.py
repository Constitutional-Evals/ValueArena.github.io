"""Pip-install pods: stock base image, bootstrap start command, worker bundle from the API."""
import io
import json
import re
import shlex
import tarfile
from pathlib import Path
from uuid import uuid4

import httpx

from app import bootstrap
from app.config import Settings
from app.progress import progress
from app.runpod import BOOTSTRAP, LOADER, RunPod
from app.upstream import REVISION
from test_backend import service, submit, tick, Pods, worker_headers  # noqa: F401

BACKEND = Path(__file__).resolve().parent.parent


def create(cfg, config):
    sent = {}
    def handle(request):
        sent['url'] = str(request.url); sent['body'] = json.loads(request.content)
        if 'graphql' in sent['url']: return httpx.Response(200, json={'data': {'podFindAndDeployOnDemand': {'id': 'pod'}}})
        return httpx.Response(200, json={'id': 'pod'})
    pods = RunPod(cfg)
    with httpx.Client(transport=httpx.MockTransport(handle), base_url='https://rest.runpod.io/v1') as client:
        pods.client.close(); pods.client = client
        assert pods.create({'id': str(uuid4()), 'config': config}) == 'pod'
    return sent['body'].get('variables', {}).get('input') or sent['body']


def env_of(payload):
    env = payload['env']
    return env if isinstance(env, dict) else {item['key']: item['value'] for item in env}


def test_pip_mode_starts_cached_base_images_with_the_bootstrap():
    cfg = Settings(environment='test', worker_secret='x'*40, worker_image='ghcr.io/valuearena/evaluation-worker@sha256:'+'a'*64)
    assert cfg.worker_install == 'pip'
    gpu = create(cfg, {})
    assert gpu['imageName'] == 'runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04'
    # RunPod splits dockerArgs like a shell; the loader must come through as one argument.
    assert shlex.split(gpu['dockerArgs']) == ['python3', '-c', LOADER]
    assert env_of(gpu)['VA_BOOTSTRAP'] == BOOTSTRAP and env_of(gpu)['VA_COMPUTE'] == 'gpu'
    assert gpu['minCudaVersion'] == '13.0'

    cpu = create(cfg, {'compute_type': 'cpu'})
    assert cpu['imageName'] == 'python:3.11-slim'
    assert cpu['dockerStartCmd'] == ['python3', '-c', LOADER]
    assert env_of(cpu)['VA_COMPUTE'] == 'cpu'


def test_image_mode_is_unchanged():
    image = 'ghcr.io/valuearena/evaluation-worker@sha256:'+'a'*64
    cfg = Settings(environment='test', worker_secret='x'*40, worker_image=image, worker_install='image')
    for config in ({}, {'compute_type': 'cpu'}):
        payload = create(cfg, config)
        assert payload['imageName'] == image
        assert 'dockerArgs' not in payload and 'dockerStartCmd' not in payload
        assert 'VA_BOOTSTRAP' not in env_of(payload)


def test_worker_bundle_needs_the_job_token_and_carries_code_and_locks(service):
    cfg, db, client = service
    job_id = submit(client).json()['id']
    tick(db, Pods(), cfg)
    root = f'/internal/jobs/{job_id}'
    assert client.get(root+'/worker-bundle').status_code == 401
    response = client.get(root+'/worker-bundle', headers=worker_headers(cfg, job_id))
    assert response.status_code == 200
    with tarfile.open(fileobj=io.BytesIO(response.content), mode='r:gz') as archive:
        names = set(archive.getnames())
        revision = archive.extractfile('worker-env/eigenbench-revision.txt').read().decode().strip()
    assert {'app/worker.py', 'app/stage.py', 'app/bootstrap.py', 'worker-env/gpu.txt', 'worker-env/cpu.txt'} <= names
    assert not any('__pycache__' in name for name in names)
    assert revision == REVISION

    # The install reports progress as its own stage.
    beat = client.post(root+'/heartbeat', json={'stage': 'installing', 'log': 'Installing'}, headers=worker_headers(cfg, job_id))
    assert beat.status_code == 200
    job = db.get(job_id)
    assert (job['state'], job['stage']) == ('running', 'installing')
    assert progress(job)['title'] == 'Installing the worker'


def test_locks_pin_the_worker_requirements_with_hashes():
    pinned = dict(re.findall(r'^([a-z0-9-]+)==(\S+) \\$', (BACKEND/'worker-env/gpu.txt').read_text(), re.M))
    for line in (BACKEND/'requirements-worker.txt').read_text().splitlines():
        if line and not line.startswith('#'):
            name, version = line.split('==')
            assert pinned[name] == version
    # The CUDA compiler must match torch's CUDA build (app/check_cuda_compiler.py).
    assert pinned['torch'] == '2.13.0' and pinned['nvidia-cuda-nvcc'].startswith('13.0.')
    cpu = (BACKEND/'worker-env/cpu.txt').read_text()
    assert 'torch==2.13.0+cpu' in cpu and 'vllm==' not in cpu and 'nvidia-' not in cpu
    for lock in (cpu, (BACKEND/'worker-env/gpu.txt').read_text()):
        requirements = re.findall(r'^[a-z0-9-]+==', lock, re.M)
        assert requirements and len(re.findall(r'^[a-z0-9-]+==\S+ \\\n    --hash=sha256:', lock, re.M)) == len(requirements)


def test_bootstrap_extract_ignores_links_and_paths_outside_the_target(tmp_path):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w:gz') as archive:
        def add(name, data=b'x', kind=tarfile.REGTYPE, link=''):
            info = tarfile.TarInfo(name); info.type = kind; info.linkname = link; info.size = len(data) if kind == tarfile.REGTYPE else 0
            archive.addfile(info, io.BytesIO(data) if kind == tarfile.REGTYPE else None)
        add('top/ok.txt'); add('top/../../escape.txt'); add('top/link', kind=tarfile.SYMTYPE, link='/etc/passwd')
    bootstrap.extract(buffer.getvalue(), tmp_path/'out', strip=1)
    assert (tmp_path/'out'/'ok.txt').read_text() == 'x'
    assert not (tmp_path/'escape.txt').exists() and not (tmp_path/'out'/'link').exists()
