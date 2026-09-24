"""Resolve public provider IDs to immutable, server-owned model references."""
import re
import time
from urllib.parse import quote

import httpx
from fastapi import HTTPException

_or_cache = (0, [])


def openrouter_models():
    global _or_cache
    if time.monotonic() - _or_cache[0] > 300 or not _or_cache[1]:
        try:
            response = httpx.get('https://openrouter.ai/api/v1/models', timeout=20)
            response.raise_for_status()
            models = [{'id': m['id'], 'label': m.get('name', m['id'])}
                      for m in response.json()['data']
                      if 'text' in m.get('architecture', {}).get('output_modalities', ['text'])]
            _or_cache = (time.monotonic(), models)
        except (httpx.HTTPError, KeyError, ValueError):
            raise HTTPException(503, 'OpenRouter model directory is unavailable; try again shortly') from None
    return _or_cache[1]


def hf_snapshot(repo, revision, subfolder='', adapter=False):
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', repo):
        raise HTTPException(422, 'Use a Hugging Face repository ID: owner/model')
    try:
        response = httpx.get(f'https://huggingface.co/api/models/{repo}/revision/{quote(revision, safe="")}', timeout=20)
        if response.status_code == 404: raise HTTPException(422, f'Model or revision not found: {repo}')
        response.raise_for_status()
        data = response.json()
        if data.get('private') or data.get('gated'):
            raise HTTPException(422, f'{repo} requires access approval. Choose a public, ungated model.')
        sha = data.get('sha', '')
        if not re.fullmatch('[a-f0-9]{40}', sha): raise HTTPException(422, 'Cannot pin model revision')
        prefix = subfolder+'/' if subfolder else ''
        files = {f['rfilename'] for f in data.get('siblings', [])}
        required = 'adapter_config.json' if adapter else 'config.json'
        if prefix+required not in files or not any(f.startswith(prefix) and f.endswith('.safetensors') for f in files):
            raise HTTPException(422, f'{repo}: expected {required} and safetensors weights in the selected folder')
        return sha
    except httpx.HTTPError:
        raise HTTPException(503, f'Unable to verify Hugging Face repository: {repo}') from None


def resolve_models(request, catalog):
    refs = {key: entry['ref'] for key, entry in catalog.items() if key in request.models}
    for model in request.custom_models:
        if model.id in catalog: raise HTTPException(422, 'Custom model ID conflicts with a preset')
        if model.provider == 'openrouter':
            if model.repo_id not in {m['id'] for m in openrouter_models()}:
                raise HTTPException(422, f'OpenRouter model is not available: {model.repo_id}')
            refs[model.id] = model.repo_id
        else:
            ref = {'provider': 'hf_local', 'kind': model.kind, 'repo_id': model.repo_id,
                   'revision': hf_snapshot(model.repo_id, model.revision, model.subfolder, model.kind == 'lora')}
            if model.subfolder: ref['subfolder'] = model.subfolder
            if model.kind == 'lora':
                ref.update(base_model_id=model.base_model_id,
                           base_revision=hf_snapshot(model.base_model_id, model.base_revision))
            refs[model.id] = ref
    if set(request.models) != set(refs): raise HTTPException(422, 'Select a preset or provide a model reference')
    return refs


def verify_provider_keys(keys):
    checks = [('OpenRouter', 'https://openrouter.ai/api/v1/auth/key', keys['openrouter_key']),
              ('RunPod', 'https://rest.runpod.io/v1/pods', keys['runpod_key'])]
    for provider, url, key in checks:
        try:
            response = httpx.get(url, headers={'Authorization': 'Bearer '+key}, timeout=20)
            if response.status_code in (401, 403):
                raise HTTPException(422, f'{provider} rejected that API key or its permissions')
            response.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(503, f'Could not verify {provider} credentials. Try again shortly.') from None
