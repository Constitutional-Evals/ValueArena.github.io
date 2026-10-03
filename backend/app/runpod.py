import time
from pathlib import Path

import httpx
from .auth import worker_token
from . import agents


MIN_CUDA_VERSION = '13.0'
# Pip-install mode: the pod runs app/bootstrap.py, passed in an environment variable.
BOOTSTRAP = (Path(__file__).parent/'bootstrap.py').read_text()
LOADER = "import os;exec(os.environ['VA_BOOTSTRAP'])"


class GPUUnavailable(RuntimeError):
    pass


class AllocationRejected(RuntimeError):
    pass


def gpu_availability(disk_gb=100, gpu_count=1):
    # Public stock lookup: no user/provider credentials are sent or stored.
    query = """query($input: GpuLowestPriceInput!) {
        gpuTypes { id lowestPrice(input: $input) {
            stockStatus uninterruptablePrice
        } }
    }"""
    response = httpx.post('https://api.runpod.io/graphql', json={
        'query': query, 'variables': {'input': {'gpuCount': gpu_count, 'secureCloud': True,
        'minCudaVersion': MIN_CUDA_VERSION, 'minDisk': disk_gb}}}, timeout=15)
    response.raise_for_status()
    body = response.json()
    if body.get('errors') or not isinstance(body.get('data', {}).get('gpuTypes'), list):
        raise ValueError('RunPod availability unavailable')
    rows = []
    for gpu in body['data']['gpuTypes']:
        price = gpu.get('lowestPrice') or {}
        stock = price.get('stockStatus') if gpu.get('lowestPrice') is not None else 'None'
        rows.append({'id': gpu['id'], 'stock': stock if stock in ('High','Medium','Low','None') else 'Unknown',
                     'price_per_hour': price.get('uninterruptablePrice')})
    return {'gpus': rows, 'checked_at': int(time.time()), 'min_cuda_version': MIN_CUDA_VERSION,
            'disk_gb': disk_gb, 'gpu_count': gpu_count, 'cloud': 'SECURE'}


class RunPod:
    def __init__(self, settings):
        self.cfg = settings
        self.client = httpx.Client(base_url='https://rest.runpod.io/v1',
            headers={'Authorization': 'Bearer ' + settings.runpod_api_key}, timeout=45)

    @staticmethod
    def name(job_id): return 'valuearena-' + job_id

    def list(self):
        response = self.client.get('/pods')
        response.raise_for_status()
        return response.json()

    def create(self, job):
        env = {'VA_JOB_ID': job['id'], 'VA_API_URL': self.cfg.api_public_url,
               'VA_WORKER_TOKEN': worker_token(self.cfg.worker_secret, job['id']),
               'OPENROUTER_API_KEY': self.cfg.openrouter_api_key,
               'HF_TOKEN': self.cfg.hf_token,
               **agents.pod_env(job['config'].get('model_refs', {}))}
        config = job['config']
        cpu = config.get('compute_type') == 'cpu'
        pip = self.cfg.worker_install == 'pip'
        image = self.cfg.worker_image
        if pip:
            env.update(VA_BOOTSTRAP=BOOTSTRAP, VA_COMPUTE='cpu' if cpu else 'gpu')
            image = self.cfg.pod_cpu_base_image if cpu else self.cfg.pod_gpu_base_image
        if cpu:
            response = self.client.post('/pods', json={
                'name': self.name(job['id']), 'imageName': image,
                **({'dockerStartCmd': ['python3', '-c', LOADER]} if pip else {}),
                'computeType': 'CPU', 'cloudType': 'SECURE',
                'vcpuCount': config.get('cpu_count', 4),
                'cpuFlavorIds': [config.get('cpu_flavor', 'cpu3g')],
                'containerDiskInGb': config.get('disk_gb', self.cfg.runpod_disk_gb),
                'volumeInGb': config.get('volume_gb', 0), 'volumeMountPath': '/workspace',
                'env': env, 'ports': [],
            })
            response.raise_for_status()
            pod_id = response.json().get('id')
            if not pod_id: raise RuntimeError('RunPod did not confirm CPU allocation')
            return pod_id
        env['EIGENBENCH_TENSOR_PARALLEL_SIZE'] = str(config.get('gpu_count', 1))
        # GraphQL supports a minimum version; the REST enum omits newer CUDA versions.
        payload = {'name': self.name(job['id']), 'imageName': image,
            **({'dockerArgs': f'python3 -c "{LOADER}"'} if pip else {}),
            'cloudType': 'SECURE', 'computeType': 'GPU',
            'gpuTypeId': job['config'].get('gpu_type', self.cfg.runpod_gpu_type),
            'gpuCount': config.get('gpu_count', self.cfg.runpod_gpu_count),
            'containerDiskInGb': job['config'].get('disk_gb', self.cfg.runpod_disk_gb),
            'minCudaVersion': MIN_CUDA_VERSION, 'volumeInGb': config.get('volume_gb', 0), 'volumeMountPath': '/workspace', 'ports': '',
            'startSsh': False, 'startJupyter': False,
            'env': [{'key': key, 'value': value} for key, value in env.items()]}
        response = self.client.post('https://api.runpod.io/graphql', json={
            'query': 'mutation($input: PodFindAndDeployOnDemandInput!) { podFindAndDeployOnDemand(input: $input) { id } }',
            'variables': {'input': payload}})
        response.raise_for_status()
        body = response.json()
        result = (body.get('data') or {}).get('podFindAndDeployOnDemand')
        if not result and body.get('errors'):
            # Only known, definitive rejections are safe to retry. Never persist
            # provider messages, which can contain submitted environment values.
            messages = [str(e.get('message', '')).lower() for e in body['errors']]
            if messages and all(any(marker in m for marker in (
                'no available gpu', 'no gpu available', 'not enough free gpus',
                'does not have the resources to deploy', 'no instances available',
                'no longer any instances available with the requested specifications'
            )) for m in messages):
                raise GPUUnavailable('Selected GPU is unavailable')
            if messages and all(any(marker in m for marker in (
                'unauthorized', 'invalid api key', 'insufficient balance', 'invalid gpu type'
            )) for m in messages):
                raise AllocationRejected('RunPod rejected the credentials, balance, or configuration')
        if body.get('errors') or not result or not result.get('id'):

            # Do not expose provider messages: they may echo env secrets. Reconcile
            # by deterministic pod name, as with an uncertain REST response.
            raise RuntimeError('RunPod did not confirm GPU allocation')
        return result['id']

    def delete(self, pod_id):
        response = self.client.delete('/pods/' + pod_id)
        if response.status_code != 404: response.raise_for_status()
