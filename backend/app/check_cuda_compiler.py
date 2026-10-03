"""Compile, link and load a CUDA extension the way FlashInfer does; no GPU is needed.

Runs during the worker image build and on pip-install pods before the worker starts.
"""
import ctypes
import os
from pathlib import Path
import re
import subprocess
import tempfile

# The libraries FlashInfer's JIT builds link against (flashinfer/jit).
LINKED = ('cudart', 'cuda', 'cublas', 'cublasLt', 'nvrtc')


def main():
    import torch
    from flashinfer.jit.cpp_ext import get_cuda_path

    cuda = Path(get_cuda_path())
    nvcc = cuda / 'bin/nvcc'
    version = subprocess.check_output([str(nvcc), '--version'], text=True)
    match = re.search(r'release (\d+\.\d+)', version)
    if not match or match.group(1) != torch.version.cuda:
        raise RuntimeError('CUDA compiler must match the PyTorch CUDA build')
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        source = root / 'check.cu'
        source.write_text('''#include <cuda_runtime.h>
__global__ void check_kernel(float* x) { x[0] = 1.0f; }
extern "C" int toolchain_check() { return CUDART_VERSION; }
''')
        target = root / 'check.so'
        subprocess.run([str(nvcc), '-shared', '-Xcompiler=-fPIC', '-arch=sm_86',
                        str(source), '-o', str(target)], check=True)
        module = ctypes.CDLL(str(target))
        assert module.toolchain_check() >= 13000
        # FlashInfer compiles objects with nvcc, then links them with the host compiler against
        # the shared CUDA libraries in lib64 and lib64/stubs.
        objects = root / 'check.o'
        subprocess.run([str(nvcc), '-c', '-Xcompiler=-fPIC', '-arch=sm_86', str(source), '-o', str(objects)], check=True)
        subprocess.run(['c++', str(objects), '-shared', f'-L{cuda}/lib64', f'-L{cuda}/lib64/stubs',
                        *(f'-l{name}' for name in LINKED), '-o', str(root / 'linked.so')], check=True)
    print('CUDA compiler, headers and runtime library: compile and load passed')
    print('CUDA libraries FlashInfer links (' + ', '.join(LINKED) + '): link passed')


if __name__ == '__main__':
    main()
