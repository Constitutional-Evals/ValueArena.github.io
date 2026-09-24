import json
from pathlib import Path
import pytest
from app.spec import build_spec, write_spec
from test_backend import service, submit, payload, USER


def test_preview_matches_execution_and_preserves_overrides(service, tmp_path):
    _, db, api = service
    advanced = {
        'verbose': True,
        'dataset': {'start': 1, 'count': 1, 'shuffle': True, 'shuffle_seed': 7},
        'evaluation': {'direct_rating': {'include_self': False, 'normalization': 'raw_l1', 'eigentrust_alpha': .1}},
        'collection': {'sampler_mode': 'balanced_unique_judge', 'response_redundancy': 1,
            'generation': {'reflection': {'max_tokens': 4096, 'per_model': {'a': {'max_tokens': 2048, 'temperature': .4}}}},
            'inspect': {'max_connections': 2}},
        'training': {'bootstrap': {'n_bootstraps': 500, 'random_seed': 17}},
    }
    body = payload(scenarios=['first', 'second', 'third'], advanced_spec=advanced)
    preview = api.post('/spec-preview', json=body, headers={'Authorization': 'Bearer '+USER})
    assert preview.status_code == 200, preview.text
    job = submit(api, body).json(); config = db.get(job['id'])['config']
    assert config['advanced_spec'] == advanced
    scope = {}; exec(write_spec(config, tmp_path).read_text(), scope)
    actual = scope['RUN_SPEC']; expected = preview.json()['spec']
    for section, field in [('dataset', 'path'), ('constitution', 'path'), ('collection', 'evaluations_path'), ('training', 'output_dir')]:
        actual[section][field] = expected[section][field]
    actual['collection']['inspect']['log_dir'] = expected['collection']['inspect']['log_dir']
    assert actual == expected
    assert actual['collection']['generation']['reflection']['per_model']['a']['max_tokens'] == 2048
    assert 'response' not in actual['collection']['generation']
    assert actual['training']['bootstrap']['n_bootstraps'] == 500
    assert actual['dataset']['count'] == 1
    assert json.loads((tmp_path/'scenarios.json').read_text()) == ['first', 'second', 'third']
    assert job['scenario_count'] == 1


@pytest.mark.parametrize('advanced', [
    {'collection': {'evaluations_path': '/etc/passwd'}},
    {'upload': {'enabled': True}},
    {'models': {'a': 'inspect:evil/provider'}},
    {'training': {'output_dir': '../outside'}},
    {'evaluation': {'mode': 'pairwise_btd'}},
    {'collection': {'generation': {'reflection': {'per_model': {'unknown': {'max_tokens': 100}}}}}},
    {'collection': {'generation': {'reflection': {'max_tokens': -1}}}},
    {'dataset': {'start': 1}},
    {'evaluation': {'direct_rating': {'include_self': False}}, 'collection': {'response_redundancy': 2}},
    {'evaluation': {'direct_rating': {'include_self': False}}, 'collection': {'sampler_mode': 'partitioned_random_judge', 'group_size': 2}},
    {'constitution': {'num_criteria': 2}},
])
def test_invalid_or_managed_options_are_rejected_before_queue(service, advanced):
    _, db, api = service
    assert submit(api, payload(advanced_spec=advanced)).status_code == 422
    assert db.list() == []


def test_empty_overrides_do_not_replace_form_defaults(service):
    _, db, api = service
    job = submit(api, payload(seed=123, response_tokens=777)).json()
    spec = build_spec(db.get(job['id'])['config'], '.')
    assert spec['collection']['sampler_seed'] == 123
    assert spec['training']['bootstrap']['random_seed'] == 123
    assert spec['collection']['generation']['response']['max_tokens'] == 777
    assert api.post('/spec-preview', json=payload()).status_code == 401


def test_published_options_can_be_submitted(service):
    _, db, api = service
    defaults = api.get('/spec-options').json()['defaults']
    result = submit(api, payload(advanced_spec=defaults))
    assert result.status_code == 202, result.text
    spec = build_spec(db.get(result.json()['id'])['config'], '.')
    assert 'max_tokens' not in spec['collection']['generation']['reflection']
