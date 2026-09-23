"""One isolated subprocess per phase, releasing vLLM memory before analysis."""
import os
import sys
from pathlib import Path


def main():
    root = Path(os.environ.get('EIGENBENCH_ROOT', '/opt/eigenbench')).resolve()
    sys.path.insert(0, str(root)); sys.path.insert(0, str(root/'scripts'))
    engine, phase, spec = sys.argv[1:]
    if phase == 'collecting' and engine == 'inspect':
        from inspect_pipeline.collect import collect_direct_ratings_inspect
        collect_direct_ratings_inspect(spec)
    elif phase == 'collecting' and engine == 'native':
        from scripts.run_collect import main as collect
        collect(spec)
    elif phase == 'analyzing' and engine in {'native', 'inspect'}:
        from scripts.run_train import main as analyze
        analyze(spec)
    else:
        raise ValueError('Unsupported stage')


if __name__ == '__main__': main()
