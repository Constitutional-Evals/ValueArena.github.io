import json
import sys
import types
from types import SimpleNamespace as NS

import pytest

from app import stage


def sample(error=None):
    return NS(error=NS(message=error) if error else None)


def log(task, nick, samples):
    return NS(eval=NS(task=task, task_args={'model_nick': nick}), samples=samples)


@pytest.fixture
def upstream(monkeypatch, tmp_path):
    """Fake EigenBench and Inspect modules: collection fails the way the phased runner does."""
    seen = {}
    def collect(spec):
        seen['vllm'] = json.loads(stage.os.environ['VLLM_DEFAULT_SERVER_ARGS'])
        raise KeyError('Qwen-Qwen3-8-27B')
    logs = {'a': log('eigenbench_responses_Qwen-Qwen3-8-27B', 'Qwen-Qwen3-8-27B',
                     [sample('RuntimeError: vLLM server process exited\nKV cache too small')] * 5),
            'b': log('eigenbench_responses_gemini', 'gemini', [sample()] * 5),
            'c': log('eigenbench_judge_gemini', 'gemini', [sample('ignored')])}
    modules = {
        'inspect_pipeline': types.ModuleType('inspect_pipeline'),
        'inspect_pipeline.collect': NS(collect_direct_ratings_inspect=collect),
        'pipeline': types.ModuleType('pipeline'),
        'pipeline.config': NS(load_run_spec=lambda spec: ({'collection': {'evaluations_path': str(tmp_path/'evaluations.jsonl')}}, tmp_path)),
        'inspect_ai': types.ModuleType('inspect_ai'),
        'inspect_ai.log': NS(list_eval_logs=lambda d: (seen.setdefault('log_dir', d), list(logs))[1], read_eval_log=logs.__getitem__),
    }
    for name, module in modules.items(): monkeypatch.setitem(sys.modules, name, module)
    monkeypatch.delenv('VLLM_DEFAULT_SERVER_ARGS', raising=False)
    return seen, tmp_path


def test_inspect_collection_caps_vllm_context_and_names_the_failed_model(upstream, capsys):
    seen, tmp_path = upstream
    with pytest.raises(SystemExit) as exit:
        stage.collect_inspect('spec.py')
    assert exit.value.code == 1
    assert seen['vllm']['max_model_len'] == 8192
    assert seen['log_dir'] == str(tmp_path/'inspect_logs')
    err = capsys.readouterr().err
    # The cause comes after the traceback, so it is the last thing in the run log.
    assert err.index("KeyError: 'Qwen-Qwen3-8-27B'") < err.index('Response collection failed for:')
    assert 'Qwen-Qwen3-8-27B: 5 of 5 responses failed. First error: RuntimeError: vLLM server process exited KV cache too small' in err
    assert 'gemini' not in err.split('Response collection failed for:')[1]


def test_explicit_vllm_server_args_are_kept(upstream, monkeypatch):
    seen, _ = upstream
    monkeypatch.setenv('VLLM_DEFAULT_SERVER_ARGS', '{"max_model_len": 32768}')
    with pytest.raises(SystemExit):
        stage.collect_inspect('spec.py')
    assert seen['vllm'] == {'max_model_len': 32768}
