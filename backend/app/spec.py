"""Compile validated JSON into a server-owned EigenBench spec; never accept Python."""
import json
import pprint
from pathlib import Path

from .models import EvaluationRequest


def write_spec(config, directory):
    request = EvaluationRequest.model_validate({k: v for k, v in config.items() if k != 'model_refs'})
    root = Path(directory).resolve()
    root.mkdir(parents=True, exist_ok=True)
    scenarios = request.scenarios
    if request.scenario_source == 'airiskdilemmas':
        import sys, os
        sys.path.insert(0, os.environ.get('EIGENBENCH_ROOT', '/opt/eigenbench'))
        from pipeline.config.airisk import load_airisk_scenarios
        scenarios = load_airisk_scenarios()[:request.scenario_count]
    (root/'scenarios.json').write_text(json.dumps(scenarios))
    (root/'constitution.json').write_text(json.dumps(request.criteria))
    spec = {
        'name': request.name,
        'models': {key: config['model_refs'][key] for key in request.models},
        'evaluation': {'mode': 'direct_rating', 'direct_rating': {
            'include_self': True, 'normalization': 'zscore_softmax'}},
        'dataset': {'path': str(root/'scenarios.json'), 'count': len(scenarios)},
        'constitution': {'path': str(root/'constitution.json'), 'num_criteria': len(request.criteria)},
        'collection': {'enabled': True, 'sampler_mode': 'all_to_all', 'sampler_seed': request.seed,
            'evaluations_path': str(root/'evaluations.jsonl'),
            'generation': {
                'response': {'max_tokens': request.response_tokens, 'temperature': 0.7},
                'reflection': {'max_tokens': 2048, 'temperature': 0.2},
                'direct_rating': {'max_tokens': 512, 'temperature': 0.0}},
            'inspect': {'cache': False, 'retry_on_error': 0, 'display': 'plain', 'max_connections': 4,
                        'log_dir': str(root/'inspect_logs')}},
        'training': {'enabled': True, 'output_dir': str(root/'analysis'),
            'bootstrap': {'enabled': True, 'n_bootstraps': 200, 'random_seed': request.seed}},
        'upload': {'enabled': False},
    }
    target = root/'spec.py'
    target.write_text('RUN_SPEC = '+pprint.pformat(spec, sort_dicts=False)+'\n')
    (root/'request.json').write_text(json.dumps(config, indent=2))
    return target
