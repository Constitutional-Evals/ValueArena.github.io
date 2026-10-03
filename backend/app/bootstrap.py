"""Pod startup without the worker image: install the pinned worker environment with pip, then run it.

The scheduler starts a stock image that RunPod hosts usually have cached (runpod/pytorch for GPU,
python:3.11-slim for CPU) and passes this file's source in VA_BOOTSTRAP. It runs on the image's own
python3 and uses only the standard library:

1. download the worker code and lock files from the API (the same version the scheduler runs),
2. install uv, a Python 3.11 virtual environment and the hash-pinned packages from
   worker-env/gpu.txt or cpu.txt (the exact set of the verified worker image),
3. on GPU, point CUDA_HOME at the pip-installed CUDA 13.0 compiler and check it compiles and loads,
4. replace itself with `python -m app.worker`.

While installing it reports stage "installing" with its log, so the run page shows progress. A
failure is reported as worker_install_failed with the log tail.
"""
import hashlib
import io
import json
import os
import subprocess
import sys
import tarfile
import threading
import time
import urllib.request
from pathlib import Path

UV_VERSION = '0.8.17'
UV_SHA256 = '920cbcaad514cc185634f6f0dcd71df5e8f4ee4456d440a22e0f8c0f142a8203'
UV_URL = f'https://github.com/astral-sh/uv/releases/download/{UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz'
EIGENBENCH_URL = 'https://codeload.github.com/jchang153/EigenBench/tar.gz/{revision}'
CPU_INDEX = ['--index-url', 'https://pypi.org/simple', '--extra-index-url', 'https://download.pytorch.org/whl/cpu',
             '--index-strategy', 'unsafe-best-match']
ROOT = Path(os.environ.get('VA_BOOTSTRAP_ROOT', '/opt/valuearena')).resolve()
LOG = ROOT/'install.log'
# A stuck download must not keep a paid pod alive: the heartbeats would hide it from the scheduler.
DEADLINE = time.monotonic() + int(os.environ.get('VA_INSTALL_TIMEOUT', '1500'))


class Reporter:
    """Heartbeats with stage "installing" and the install log, so the scheduler sees progress."""

    def __init__(self):
        self.root = os.environ['VA_API_URL'].rstrip('/') + '/internal/jobs/' + os.environ['VA_JOB_ID']
        self.headers = {'Authorization': 'Bearer ' + os.environ['VA_WORKER_TOKEN'], 'Content-Type': 'application/json'}
        self.done = threading.Event()

    def request(self, path, body=None, timeout=60):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.root + path, data=data, headers=self.headers, method='POST' if data else 'GET')
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()

    def tail(self):
        try: return LOG.read_text(errors='replace')[-64000:]
        except OSError: return ''

    def beat(self):
        try: self.request('/heartbeat', {'stage': 'installing', 'log': self.tail()}, timeout=30)
        except Exception: pass  # The next beat retries; the scheduler times out a silent pod.

    def start(self):
        def loop():
            while not self.done.wait(15): self.beat()
        self.beat(); threading.Thread(target=loop, daemon=True).start()

    def fail(self):
        self.done.set(); self.beat()
        try: self.request('/finish', {'success': False, 'error_code': 'worker_install_failed'}, timeout=30)
        except Exception: pass


def log(message):
    with LOG.open('a') as out: out.write(message.rstrip() + '\n')


def run(command, env=None):
    log('$ ' + ' '.join(str(part) for part in command))
    with LOG.open('a') as out:
        subprocess.run([str(part) for part in command], stdout=out, stderr=subprocess.STDOUT, env=env, check=True,
                       timeout=max(1, DEADLINE - time.monotonic()))


def download(url, headers=None, timeout=600):
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request, timeout=min(timeout, max(1, DEADLINE - time.monotonic()))) as response:
        return response.read()


def extract(data, target, strip=0):
    """Unpack a tar.gz without following links out of the target directory."""
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for member in archive.getmembers():
            parts = Path(member.name).parts[strip:]
            if not parts or member.issym() or member.islnk() or '..' in parts or Path(member.name).is_absolute():
                continue
            member.name = str(Path(*parts))
            archive.extract(member, target)


def install(reporter, compute):
    started = time.monotonic()
    log(f'Installing the {compute.upper()} worker with pip (no container download).')
    extract(reporter.request('/worker-bundle', timeout=120), ROOT/'worker')
    worker = ROOT/'worker'
    revision = (worker/'worker-env'/'eigenbench-revision.txt').read_text().strip()
    log(f'Worker code from the API. EigenBench {revision}.')
    extract(download(EIGENBENCH_URL.format(revision=revision)), ROOT/'eigenbench', strip=1)

    uv_archive = download(UV_URL)
    if hashlib.sha256(uv_archive).hexdigest() != UV_SHA256: raise RuntimeError('uv download failed its checksum')
    extract(uv_archive, ROOT/'uv', strip=1)
    uv = ROOT/'uv'/'uv'; uv.chmod(0o755)

    venv = ROOT/'venv'; python = venv/'bin'/'python'
    env = {**os.environ, 'UV_PYTHON_INSTALL_DIR': str(ROOT/'python'), 'UV_CACHE_DIR': str(ROOT/'uv-cache')}
    run([uv, 'venv', '--python', '3.11', '--managed-python', venv], env)
    lock = worker/'worker-env'/(compute + '.txt')
    run([uv, 'pip', 'sync', '--python', python, '--require-hashes', *(CPU_INDEX if compute == 'cpu' else []), lock], env)
    log(f'Packages installed in {time.monotonic() - started:.0f} s.')

    # The environment's executables come first: Inspect starts `vllm serve` from PATH.
    runtime = {'EIGENBENCH_ROOT': str(ROOT/'eigenbench'), 'PYTHONUNBUFFERED': '1',
               'HF_HOME': '/workspace/hf', 'MPLBACKEND': 'Agg', 'VIRTUAL_ENV': str(venv),
               'PATH': f"{venv/'bin'}:{os.environ.get('PATH', '')}"}
    if compute == 'gpu':
        site = subprocess.check_output([str(python), '-c', 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], text=True).strip()
        cuda = Path(site)/'nvidia'/'cu13'
        # nvcc's profile looks for libraries in lib64; the wheels install them in lib.
        if not (cuda/'lib64').exists(): (cuda/'lib64').symlink_to('lib')
        runtime.update(CUDA_HOME=str(cuda), PATH=f"{venv/'bin'}:{cuda/'bin'}:{os.environ.get('PATH', '')}")
        checks = {**os.environ, **runtime}
        for check in ('app.check_compiler', 'app.check_cuda_compiler'):
            run([python, '-m', check], {**checks, 'PYTHONPATH': str(worker)})
    return python, worker, runtime


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    compute = os.environ.get('VA_COMPUTE', 'gpu')
    reporter = Reporter(); reporter.start()
    try:
        python, worker, runtime = install(reporter, compute)
    except Exception as error:
        log(f'Install failed: {type(error).__name__}: {error}')
        reporter.fail()
        sys.stdout.write(reporter.tail()); sys.exit(1)
    reporter.done.set()
    os.chdir(worker)
    env = {key: value for key, value in os.environ.items() if key != 'VA_BOOTSTRAP'}
    os.execve(str(python), [str(python), '-m', 'app.worker'], {**env, **runtime})


if __name__ == '__main__': main()
