"""Agent endpoints: administrator-approved, OpenAI-compatible services evaluated like models.

A catalog entry such as
    {"label": "NYCC agent (LAISR)", "ref": {"provider": "agent_endpoint", "service": "agent-nycc",
     "model": "nycc-agent", "base_url": "https://laisr-nycc.hf.space/v1", "key_env": "AGENT_NYCC_KEY"}}
runs through EigenBench's Inspect engine as ``inspect:openai-api/agent-nycc/nycc-agent``. Inspect reads
the endpoint from AGENT_NYCC_BASE_URL and AGENT_NYCC_API_KEY, which the scheduler sets on the pod.

Endpoints come only from the server catalog, never from a request, so a submission cannot point the
worker at an arbitrary URL. Service names must start with ``agent-`` and key variables with ``AGENT_``,
so an entry can neither overwrite the worker's own variables nor forward another server secret.
"""
import os
import re
from urllib.parse import urlparse

FIELDS = {'provider', 'service', 'model', 'base_url', 'key_env'}


def is_agent(ref) -> bool:
    return isinstance(ref, dict) and ref.get('provider') == 'agent_endpoint'


def is_local(ref) -> bool:
    return isinstance(ref, dict) and ref.get('provider') == 'hf_local'


def validate(ref):
    if set(ref) - FIELDS or not {'provider', 'service', 'model', 'base_url'} <= set(ref):
        raise ValueError('Agent endpoints need service, model and base_url')
    if not re.fullmatch(r'agent-[a-z0-9]{1,30}', str(ref['service'])):
        raise ValueError('Agent service names must look like agent-name')
    if not re.fullmatch(r'[a-zA-Z0-9_.:-]{1,100}', str(ref['model'])):
        raise ValueError('Invalid agent model name')
    url = urlparse(str(ref['base_url']))
    if url.scheme != 'https' or not url.hostname or url.username or url.password or len(ref['base_url']) > 300:
        raise ValueError('Agent endpoints must use a plain https:// URL')
    if 'key_env' in ref and not re.fullmatch(r'AGENT_[A-Z0-9_]{1,60}', str(ref['key_env'])):
        raise ValueError('Agent key variables must start with AGENT_')


def spec_ref(ref) -> str:
    return f"inspect:openai-api/{ref['service']}/{ref['model']}"


def env_prefix(ref) -> str:
    return ref['service'].upper().replace('-', '_')


def pod_env(refs) -> dict:
    """Variables Inspect's openai-api provider reads for each agent in a job."""
    env = {}
    for ref in refs.values():
        if is_agent(ref):
            prefix = env_prefix(ref)
            env[prefix + '_BASE_URL'] = ref['base_url']
            # Inspect requires a key variable even for open endpoints.
            env[prefix + '_API_KEY'] = os.environ.get(ref.get('key_env', ''), '') or 'none'
    return env
