"""Preprocessing / feature extraction, one self-contained package per model.

    preprocessing/audio_loading.py  shared: file -> mono float waveform
    preprocessing/alvin/            Alvin: 280 spectral features (MFCC + LFCC)
    preprocessing/fawwas/           Fawwas: glottal v8 features + frozen model loader
"""
