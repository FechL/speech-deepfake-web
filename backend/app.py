"""DeepGuard local inference API. Only operator-configured, trusted models are loaded."""
import hashlib
import csv
import importlib.metadata
import io
import json
import math
import os
import sys
from pathlib import Path
import threading

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import soundfile as sf

from backend.paths import WEB_ROOT, GLOTTAL_ROOT
from backend.residual import extract_residual, residual_score
ROOT = GLOTTAL_ROOT  # Compatibility for callers that locate the research config.
sys.path.insert(0, str(GLOTTAL_ROOT))
app = FastAPI(title='DeepGuard Audio Lab', version='1.0.0')
origins = [x.strip() for x in os.getenv('DEEPGUARD_ORIGINS', 'http://127.0.0.1:5173,http://localhost:5173,https://deepguard-audio-lab-aliy.silly-elf-5047.chatgpt.site').split(',') if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
MAX_BYTES = 25 * 1024 * 1024
LOCK = threading.Lock()


def clean(value):
    if isinstance(value, dict): return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [clean(v) for v in value]
    if isinstance(value, np.generic): value = value.item()
    if isinstance(value, float) and not math.isfinite(value): return None
    return value


def configuration():
    path = os.getenv('DEEPGUARD_REGISTRY')
    p = Path(path).expanduser().resolve() if path else WEB_ROOT/'models/registry.json'
    return (json.loads(p.read_text()), p) if p.exists() else ({'models': [], 'evaluations': []}, p)

def registry():
    config, p = configuration()
    entries = config['models']
    for e in entries:
        for key in ['id', 'path', 'sha256', 'key', 'features', 'family', 'kind']:
            if key not in e: raise ValueError(f'Registry model kehilangan {key}')
        e['path'] = str((p.parent / e['path']).resolve())
    if len({e['id'] for e in entries}) != len(entries): raise ValueError('ID model duplikat')
    return entries


@app.get('/api/health')
def health():
    try:
        entries = registry()
    except (ValueError, OSError, KeyError):
        raise HTTPException(503, 'Registry tidak valid. Periksa konfigurasi operator.')
    return {'status': 'ok', 'model_count': len(entries), 'extractor': 'glottal_v4 + residual_modulation', 'available_model_count': sum(e.get('available',True) for e in entries), 'max_seconds': 60, 'max_bytes': MAX_BYTES}


@app.get('/api/models')
def models():
    try: entries = registry()
    except (ValueError, OSError, KeyError): raise HTTPException(503, 'Registry tidak valid.')
    return {'models': [{k: e.get(k) for k in ['id','family','kind','dataset','seed','description','pipeline','available','unavailable_reason']} for e in entries], 'evaluations': [{k:e[k] for k in ['id','title']} for e in configuration()[0].get('evaluations',[])]}


def score_spec(spec, frame):
    if spec.get('mode') == 'score_fusion':
        import pandas as pd
        x = pd.DataFrame({k: score_spec(v, frame) for k, v in spec['bases'].items()})
        model = spec['model']
        if list(model.classes_) != [0, 1]: raise ValueError('Orientasi kelas model salah.')
        score = model.decision_function(x[spec['meta_cols']])
    else:
        from src.pipeline_v4.evaluation import scores_v4
        score = scores_v4(spec, frame)
    if 'calibrator' in spec: score = spec['calibrator'].predict_proba(np.asarray(score).reshape(-1,1))[:,1]
    return np.asarray(score, dtype=float)


def infer(raw, sr, entries):
    import joblib
    import pandas as pd
    results=[]; features={}; bundles={}; environment={}
    for entry in entries:
        for package, expected in entry.get('packages',{}).items():
            actual=importlib.metadata.version(package)
            environment[package]={'training':expected,'runtime':actual,'match':actual==expected}
            if actual != expected:
                raise ValueError(f'Versi {package} harus {expected}; runtime {actual}. Pasang requirements-model.txt.')
        if entry.get('feature_hash') and hashlib.sha256((ROOT/'src/pipeline_v4/features.py').read_bytes()).hexdigest()!=entry['feature_hash']:
            raise ValueError('Source ekstraktor berbeda dari training bundle.')
        pipeline=entry.get('pipeline','glottal_v4')
        config_key = json.dumps([pipeline,entry['features'],entry.get('source_dir'),entry.get('lpc_order')], sort_keys=True)
        if config_key not in features:
            if pipeline=='residual_modulation':
                features[config_key]=extract_residual(raw,sr,entry)
            elif pipeline=='glottal_v4':
                from src.pipeline_v4.features import extract_audio_v4
                features[config_key]=extract_audio_v4(raw,sr,entry['features'])
            else:raise ValueError('Pipeline tidak didukung: '+pipeline)
            features[config_key]['_pipeline']=pipeline
        feat = features[config_key]
        base = dict(model_id=entry['id'], family=entry['family'], kind=entry['kind'], dataset=entry.get('dataset'), seed=entry.get('seed'),pipeline=pipeline,warnings=entry.get('load_warnings',[]))
        if not feat.get('n_segments' if pipeline=='residual_modulation' else 'n_windows'):
            results.append(dict(base, status='abstained', reason='Tidak ada jendela audio aktif yang memenuhi konfigurasi model.')); continue
        path=Path(entry['path'])
        if hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']: raise ValueError('Checksum model berbeda dari registry.')
        selected=bundles.get(str(path))
        if selected is None:
            selected=joblib.load(path)  # Trusted local operator input only; never a user upload.
            bundles[str(path)]=selected
        if pipeline=='residual_modulation':
            scored=residual_score(selected,feat,entry)
            results.append(dict(base,status='ok',**scored,prediction='FAKE' if scored['score']>=scored['threshold'] else 'REAL',model_sha256=entry['sha256']))
            continue
        spec=selected[entry['key']]
        if spec.get('family') != entry['family'] or spec.get('kind') != entry['kind']: raise ValueError('Metadata model berbeda dari registry.')
        if not np.isfinite(float(spec['threshold'])): raise ValueError('Threshold model tidak valid.')
        cols=spec['cols']
        if set(cols)-set(feat): raise ValueError('Fitur model tidak tersedia dalam ekstraktor.')
        frame=pd.DataFrame([feat])
        gate=spec.get('gate', {})
        if feat['n_windows'] < gate.get('min_windows', 0) or feat['active_fraction'] < gate.get('min_active_fraction', 0):
            results.append(dict(base, status='abstained', reason='Quality gate model menolak sampel.')); continue
        score=float(score_spec(spec, frame)[0])
        if not np.isfinite(score): raise ValueError('Skor model nonfinite.')
        results.append(dict(base, status='ok', score=score, threshold=float(spec['threshold']), prediction='FAKE' if score >= spec['threshold'] else 'REAL', score_type='calibrated_probability' if 'calibrator' in spec else 'model_score', feature_count=len(cols), missing_features=sum(not np.isfinite(feat[c]) for c in cols), model_sha256=entry['sha256']))
    return clean({'predictions':results,'features':list(features.values()),'environment':environment, 'notes':['Skor model tanpa kalibrator bukan persentase keyakinan.', 'Keputusan berlaku pada threshold training/dev; rekaman tunggal tidak menghasilkan metrik akurasi.', 'Fitur fonasi adalah proksi akustik, bukan pengukuran aliran glotal.']})


@app.post('/api/infer')
async def inference(audio: UploadFile = File(...), model_ids: str = Form(...), ground_truth: int | None = Form(None)):
    if ground_truth is not None and ground_truth not in (0,1):
        raise HTTPException(422,'Label ground truth harus REAL=0 atau FAKE=1.')
    blob=await audio.read(MAX_BYTES+1)
    if len(blob)>MAX_BYTES: raise HTTPException(413, 'Ukuran maksimum 25 MB.')
    try:
        requested=json.loads(model_ids)
        if not isinstance(requested,list) or not requested or len(requested)>18 or any(not isinstance(x,str) for x in requested) or len(set(requested))!=len(requested): raise ValueError('Pilih 1–18 ID model unik.')
        available={e['id']:e for e in registry()}
        if set(requested)-set(available): raise ValueError('Model tidak terdaftar.')
        unavailable=[key for key in requested if not available[key].get('available',True)]
        if unavailable:raise ValueError('Bobot model belum tersedia: '+', '.join(unavailable))
        with sf.SoundFile(io.BytesIO(blob)) as source:
            if source.samplerate < 8000 or source.samplerate > 192000 or source.channels>8: raise ValueError('Format audio tidak didukung.')
            if not .1 <= source.frames/source.samplerate <= 60: raise ValueError('Durasi audio harus 0,1–60 detik.')
            sr=source.samplerate; raw=source.read(dtype='float64',always_2d=True)
        if not np.isfinite(raw).all(): raise ValueError('Audio nonfinite.')
    except (ValueError, KeyError, OSError, RuntimeError) as exc: raise HTTPException(422, str(exc))
    if not LOCK.acquire(blocking=False): raise HTTPException(429,'Inferensi sedang berjalan. Coba lagi sebentar.')
    try:
        from starlette.concurrency import run_in_threadpool
        result=await run_in_threadpool(infer,raw,sr,[available[x] for x in requested])
        for prediction in result['predictions']:
            prediction['correct']=(prediction['prediction']==('FAKE' if ground_truth==1 else 'REAL')) if ground_truth is not None and prediction['status']=='ok' else None
        return dict(result,ground_truth=ground_truth,ground_truth_source='user_provided' if ground_truth is not None else None,audio_sha256=hashlib.sha256(blob).hexdigest(),original_sample_rate=sr,duration=len(raw)/sr)
    except (ValueError, KeyError, OSError, RuntimeError) as exc: raise HTTPException(422,str(exc))
    finally: LOCK.release()




@app.get('/api/evaluations/{evaluation_id}')
def evaluation(evaluation_id: str):
    config, p=configuration()
    choices={e['id']:e for e in config.get('evaluations',[])}
    if evaluation_id not in choices: raise HTTPException(404, 'Evaluasi tidak terdaftar.')
    e=choices[evaluation_id];path=(p.parent/e['path']).resolve()
    from backend.evaluations import load_evaluation
    return load_evaluation(e,path)


app.mount('/', StaticFiles(directory=WEB_ROOT/'dist', html=True), name='web')
