# Worker environments for pip-install pods

`app/bootstrap.py` installs one of these on a stock RunPod image instead of pulling the
worker container. Both are fully pinned with hashes.

| File | Used for | Source |
| --- | --- | --- |
| `gpu.txt` | GPU pods | `gpu.in` (the package set of the verified worker image) with `cuda-toolkit.txt` as overrides |
| `cpu.txt` | API-only panels | `cpu.in` (EigenBench's requirements without vLLM), versions held to `gpu.in`, CPU PyTorch |

`gpu.in` lists every package installed in
`ghcr.io/valuearena/evaluation-worker@sha256:5875c8d2b1b047b124a816addee6a97a14412f14fbb0fb9b83f95ba575b4ecb3`
(vLLM 0.30.0, PyTorch 2.13.0 for CUDA 13.0, FlashInfer 0.6.18.post1). `cuda-toolkit.txt` pins the
CUDA 13.0 compiler, headers and runtime that the image took from `nvidia/cuda:13.0.2-devel`;
the version must match `torch.version.cuda`.

Regenerate after changing an input (uv 0.8 or later):

```bash
uv pip compile gpu.in --override cuda-toolkit.txt --python-version 3.11 \
  --python-platform x86_64-manylinux_2_28 --generate-hashes --no-header --no-annotate -o gpu.txt
uv pip compile cpu.in -c gpu.in --override cpu-torch.txt --python-version 3.11 \
  --python-platform x86_64-manylinux_2_28 --index-url https://pypi.org/simple \
  --extra-index-url https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match \
  --generate-hashes --no-header --no-annotate -o cpu.txt
```

When upgrading vLLM, update `requirements-worker.txt` as well; `tests/test_pip_install.py`
checks the two agree.
