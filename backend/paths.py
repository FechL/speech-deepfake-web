"""Sibling repositories, configurable without moving or copying research artifacts."""
import os
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parents[1]
GLOTTAL_ROOT = Path(os.getenv('DEEPGUARD_GLOTTAL_ROOT', WEB_ROOT.parent/'speech-deepfake-glottal')).expanduser().resolve()
RESIDUAL_ROOT = Path(os.getenv('DEEPGUARD_RESIDUAL_ROOT', WEB_ROOT.parent/'speech-deepfake-residual-modulation')).expanduser().resolve()
RESIDUAL_PROJECT = RESIDUAL_ROOT/'skripsi_residual_modulasi'
RESIDUAL_SOURCES = ('extract_features.py','audio_io.py','spectral_features.py','lfcc.py','residual_features.py','modulation_features.py','reproducibility.py')
