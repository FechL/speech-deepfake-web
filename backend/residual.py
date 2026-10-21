"""Adapter for original residual/modulation features and checkpoint schema."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf


def extract_residual(raw,sr,entry):
    if len(raw)/sr<1:
        return {'n_segments':0,'analysis_status':'audio_shorter_than_1s'}
    if np.max(np.abs(raw))<1e-6:
        return {'n_segments':0,'analysis_status':'silent_audio'}
    source=Path(entry['source_dir'])
    for name,expected in entry.get('source_hashes',{}).items():
        if hashlib.sha256((source/name).read_bytes()).hexdigest()!=expected:
            raise ValueError(f'Source residual berubah: {name}. Jalankan setup_local ulang setelah memverifikasi config training.')
    # The original extractor takes a path and owns resampling, normalization,
    # segment padding, all feature families and aggregation. Never substitute v4.
    with tempfile.TemporaryDirectory(prefix='deepguard-residual-') as temp:
        audio=Path(temp)/'audio.wav'
        sf.write(audio,raw,sr,subtype='FLOAT')
        request=dict(source=str(source),audio=str(audio),config=entry['features'],lpc_order=entry.get('lpc_order',16))
        try:
            result=subprocess.run([sys.executable,str(Path(__file__).with_name('residual_worker.py'))],input=json.dumps(request),capture_output=True,text=True,timeout=150,check=False)
        except subprocess.TimeoutExpired as exc:
            raise ValueError('Ekstraksi residual melebihi batas 150 detik.') from exc
        if result.returncode:
            raise ValueError('Ekstraksi residual gagal. Periksa dependency dan konfigurasi source residual. '+result.stderr[-700:])
        return {**{k:np.nan if v is None else v for k,v in json.loads(result.stdout).items()},'analysis_status':'ok'}


def residual_score(checkpoint,features,entry):
    if not {'model','features','val_threshold','experiment_id','feature_group','model_type'}<=set(checkpoint):
        raise ValueError('Checkpoint residual tidak sesuai schema train_baseline.py.')
    if checkpoint['experiment_id']!=entry['key'] or checkpoint['feature_group']!=entry['family'] or checkpoint['model_type']!=entry['kind']:
        raise ValueError('Metadata checkpoint residual berbeda dari registry.')
    cols=checkpoint['features']
    if not cols or len(cols)!=len(set(cols)) or set(cols)-set(features):
        raise ValueError('Kolom checkpoint residual tidak tersedia/duplikat; periksa config training.')
    model=checkpoint['model']
    if list(model.classes_)!=[0,1]:raise ValueError('Orientasi kelas residual harus REAL=0 dan FAKE=1.')
    x=np.asarray([[features[c] for c in cols]],dtype=float)
    if not np.isfinite(x).any():raise ValueError('Semua fitur model residual missing; prediksi ditolak.')
    threshold=float(checkpoint['val_threshold'])
    score=float(model.predict_proba(x)[0,1])
    if not np.isfinite(threshold) or not np.isfinite(score) or not 0<=score<=1:
        raise ValueError('Skor atau threshold residual tidak valid.')
    return dict(score=score,threshold=threshold,score_type='class_probability',threshold_policy='checkpoint_val_threshold',feature_count=len(cols),missing_features=int(np.isnan(x).sum()))
