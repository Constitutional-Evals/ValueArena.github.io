import json
import re
from pathlib import Path


def load_catalog(path: Path):
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise ValueError('Catalog must be an object')
    for key, entry in data.items():
        if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', key):
            raise ValueError('Invalid catalog ID')
        if set(entry) != {'label', 'ref'} or not isinstance(entry['label'], str):
            raise ValueError('Catalog entries require label and ref')
        ref = entry['ref']
        if isinstance(ref, str):
            if not re.fullmatch(r'[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.:-]+', ref) or ref.startswith(('hf_local:', 'inspect:')):
                raise ValueError('Use OpenRouter IDs or structured HF references')
        elif isinstance(ref, dict):
            if set(ref) - {'provider', 'kind', 'repo_id', 'revision', 'subfolder', 'base_model_id', 'base_revision'}:
                raise ValueError('Unexpected model configuration')
            if ref.get('provider') != 'hf_local' or ref.get('kind') not in {'base', 'lora'}:
                raise ValueError('Unsupported local model')
            for field in ['repo_id'] + (['base_model_id'] if ref['kind'] == 'lora' else []):
                if not re.fullmatch(r'[\w.-]+/[\w.-]+', ref.get(field, '')):
                    raise ValueError('A model must identify its HF repository')
            for field in ['revision'] + (['base_revision'] if ref['kind'] == 'lora' else []):
                if not re.fullmatch(r'[a-f0-9]{40}', ref.get(field, '')):
                    raise ValueError('Pin local models and bases to full commit SHAs')
            if 'subfolder' in ref and any(p in {'', '.', '..'} for p in ref['subfolder'].split('/')):
                raise ValueError('Invalid subfolder')
        else:
            raise ValueError('Unsupported model reference')
    return data
