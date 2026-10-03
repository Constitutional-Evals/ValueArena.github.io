"""One isolated subprocess per phase, releasing vLLM memory before analysis."""
import json
import os
import sys
import traceback
from collections import deque
from pathlib import Path

# Inspect starts `vllm serve` at the model's full context window. A 27B model with a 256k window
# cannot fit that KV cache on one GPU, so the server exits and every response fails. Use the
# native engine's vLLM settings instead; per-model arguments still take precedence.
VLLM_SERVER_ARGS = {'max_model_len': 8192, 'gpu_memory_utilization': 0.9, 'enforce_eager': True}
# The server's last lines, repeated in the failure summary.
vllm_tail = deque(maxlen=12)


def show_vllm_output():
    """Copy the `vllm serve` output Inspect captures into the run log.

    Inspect logs the server's stdout at debug and stderr at info, below its default level, so a
    server that exits at startup leaves only "exited unexpectedly with code 1" behind.
    """
    import logging
    server = logging.getLogger('inspect_ai._util.local_server')
    class Handler(logging.StreamHandler):
        def emit(self, record):
            vllm_tail.append(record.getMessage()); super().emit(record)
    handler = Handler(sys.stdout)
    handler.setFormatter(logging.Formatter('[vllm] %(message)s'))
    server.addHandler(handler); server.setLevel(logging.DEBUG); server.propagate = False


def response_failures(log_dir: Path) -> list[str]:
    """One line per model whose Inspect response samples failed, with the first error."""
    from inspect_ai.log import list_eval_logs, read_eval_log
    lines = []
    for info in list_eval_logs(str(log_dir)):
        log = read_eval_log(info)
        if not log.eval.task.startswith('eigenbench_responses'): continue
        model = log.eval.task_args.get('model_nick') or log.eval.task
        failed = [s for s in log.samples or [] if s.error]
        if failed:
            message = ' '.join(failed[0].error.message.strip().splitlines())
            lines.append(f'{model}: {len(failed)} of {len(log.samples)} responses failed. First error: {message[:600]}')
        elif getattr(log, 'error', None):
            lines.append(f'{model}: response task failed: {" ".join(log.error.message.strip().splitlines())[:600]}')
    return lines


def collect_inspect(spec):
    from inspect_pipeline.collect import collect_direct_ratings_inspect
    from pipeline.config import load_run_spec
    os.environ.setdefault('VLLM_DEFAULT_SERVER_ARGS', json.dumps(VLLM_SERVER_ARGS))
    show_vllm_output()
    try:
        collect_direct_ratings_inspect(spec)
    except Exception:
        # Upstream's phased runner raises a bare KeyError when a model produced no responses;
        # name the model and the actual error so the run log explains the failure.
        try:
            loaded, _ = load_run_spec(spec)
            collection = loaded.get('collection', {})
            log_dir = Path((collection.get('inspect') or {}).get('log_dir') or 'inspect_logs')
            if not log_dir.is_absolute(): log_dir = Path(collection['evaluations_path']).parent/log_dir
            failures = response_failures(log_dir)
        except Exception as e:
            failures = [f'(could not read Inspect logs: {e})']
        traceback.print_exc()
        if failures:
            # Printed last so the run's log tail ends with the cause rather than the traceback.
            print('\nResponse collection failed for:', *failures, sep='\n  ', file=sys.stderr, flush=True)
            if vllm_tail: print('Last vLLM server output:', *vllm_tail, sep='\n  ', file=sys.stderr, flush=True)
        raise SystemExit(1)


def main():
    root = Path(os.environ.get('EIGENBENCH_ROOT', '/opt/eigenbench')).resolve()
    sys.path.insert(0, str(root)); sys.path.insert(0, str(root/'scripts'))
    engine, phase, spec = sys.argv[1:]
    if phase == 'collecting' and engine == 'inspect':
        collect_inspect(spec)
    elif phase == 'collecting' and engine == 'native':
        from scripts.run_collect import main as collect
        collect(spec)
    elif phase == 'analyzing' and engine in {'native', 'inspect'}:
        from scripts.run_train import main as analyze
        analyze(spec)
    else:
        raise ValueError('Unsupported stage')


if __name__ == '__main__': main()
