# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import copy_metadata


a = Analysis(
    ['photo_scanner_cli.py'],
    pathex=[],
    binaries=[],
    datas=copy_metadata("pymatting") + copy_metadata("rembg"),
    hiddenimports=[
        "rembg",
        "rembg.bg",
        "rembg.session_factory",
        "rembg.sessions",
        "rembg.sessions.base",
        "rembg.sessions.u2net",
        "onnxruntime",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "torch",
        "torchvision",
        "torchaudio",
        "tensorflow",
        "keras",
        "tensorboard",
        "matplotlib",
        "pandas",
        "IPython",
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='PhotoScanner',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
