import importlib.util
import io
import json
from pathlib import Path
import sys
import types
import hashlib
import numpy as np
import pandas as pd
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

APP_PATH=Path(__file__).resolve().parents[1]/'backend/app.py'
spec=importlib.util.spec_from_file_location('deepguard_app',APP_PATH)
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
client=TestClient(a.app)

def wav(seconds=1):
    b=io.BytesIO();sf.write(b,.3*np.sin(2*np.pi*140*np.arange(int(seconds*16000))/16000),16000,format='WAV');return b.getvalue()

def test_no_models(monkeypatch,tmp_path):
    empty=tmp_path/'empty.json';empty.write_text('{"models": []}')
    monkeypatch.setenv('DEEPGUARD_REGISTRY',str(empty))
    assert client.get('/api/health').json()['model_count']==0
    assert client.get('/api/models').json()=={'models':[],'evaluations':[]}
    assert client.get('/').status_code==200
    for ids in ['[]','["missing"]','{}','null']:
        assert client.post('/api/infer',files={'audio':('a.wav',wav())},data={'model_ids':ids}).status_code==422

def test_invalid_audio(tmp_path,monkeypatch):
    reg=tmp_path/'registry.json';reg.write_text(json.dumps({'models':[dict(id='m',path='m.joblib',sha256='x',key='m',features={},family='MFCC',kind='lr')]}));monkeypatch.setenv('DEEPGUARD_REGISTRY',str(reg))
    assert client.post('/api/infer',files={'audio':('a.wav',b'bad')},data={'model_ids':'["m"]'}).status_code==422
    assert client.post('/api/infer',files={'audio':('a.wav',wav(.05))},data={'model_ids':'["m"]'}).status_code==422

def test_fusion_orientation_and_calibration():
    class Model:
        classes_=np.array([0,1])
        def decision_function(self,x): return np.array([.7])
    base=dict(model=Model(),cols=['x'])
    # Adapter tests mock only base score; fusion uses real class validation.
    fake=types.ModuleType('src.pipeline_v4.evaluation');fake.scores_v4=lambda spec,frame:np.array([.3])
    old=sys.modules.get('src.pipeline_v4.evaluation');sys.modules['src.pipeline_v4.evaluation']=fake
    try:
        assert a.score_spec(dict(model=Model(),mode='score_fusion',bases={'b':base},meta_cols=['b']),pd.DataFrame([{'x':1}]))[0]==.7
    finally:
        if old: sys.modules['src.pipeline_v4.evaluation']=old
        else: del sys.modules['src.pipeline_v4.evaluation']

def test_clean_nonfinite():
    assert a.clean({'a':np.float64(np.nan),'b':[float('inf'),np.int64(2)]})=={'a':None,'b':[None,2]}

def test_real_extractor_and_model_adapter(tmp_path,monkeypatch):
    import joblib
    import yaml
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LogisticRegression
    from src.pipeline_v4.features import extract_audio_v4
    cfg=yaml.safe_load((a.ROOT/'configs/forensic_v5.yaml').read_text())['features']
    blob=wav(3)
    raw,sr=sf.read(io.BytesIO(blob),always_2d=True)
    feat=extract_audio_v4(raw,sr,cfg)
    col='mfcc_static_mean_01_median'
    assert np.isfinite(feat[col])
    train=pd.DataFrame({col:[-100.,-50.,50.,100.]})
    model=Pipeline([('scale',StandardScaler()),('clf',LogisticRegression())]).fit(train,[0,0,1,1])
    path=tmp_path/'model.joblib'
    joblib.dump({'fixture':dict(model=model,cols=[col],threshold=0.,family='MFCC',kind='lr')},path)
    entry=dict(id='fixture',path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),key='fixture',features=cfg,family='MFCC',kind='lr')
    registry=tmp_path/'registry.json';registry.write_text(json.dumps({'models':[entry]}));monkeypatch.setenv('DEEPGUARD_REGISTRY',str(registry))
    assert client.get('/api/models').json()['models'][0]['id']=='fixture'
    result=client.post('/api/infer',files={'audio':('tone.wav',blob)},data={'model_ids':'["fixture"]'})
    assert result.status_code==200,result.text
    actual=result.json()['predictions'][0]
    expected=float(model.decision_function(pd.DataFrame([{col:feat[col]}]))[0])
    assert actual['score']==pytest.approx(expected,rel=1e-8)
    assert actual['score_type']=='model_score'
    assert actual['prediction']==('FAKE' if expected>=0 else 'REAL')
    assert result.json()['audio_sha256']==hashlib.sha256(blob).hexdigest()
    path.write_bytes(path.read_bytes()+b'changed')
    bad=client.post('/api/infer',files={'audio':('tone.wav',blob)},data={'model_ids':'["fixture"]'})
    assert bad.status_code==422
    assert 'Checksum' in bad.json()['detail']

def test_evaluation_scope_retention_and_allowlist(tmp_path,monkeypatch):
    scores=tmp_path/'scores.csv'
    scores.write_text('key,utterance_id,label,score,threshold,dataset,scenario,seed,retained,scope\nMFCC@lr,a,0,.1,.5,test,eval,1,True,subset\nMFCC@lr,b,1,.8,.5,test,eval,1,False,subset\nLFCC@lr,a,0,.2,.5,test,eval,1,True,subset\n')
    reg=tmp_path/'registry.json';reg.write_text(json.dumps({'models':[],'evaluations':[dict(id='e',title='Eval fixture',path=str(scores),model_keys=['MFCC@lr'],run_id='r')]}));monkeypatch.setenv('DEEPGUARD_REGISTRY',str(reg))
    result=client.get('/api/evaluations/e');assert result.status_code==200
    data=result.json();assert len(data['rows'])==1;assert data['rows'][0]['sample_id']=='a'
    assert data['scopes']==['subset'];assert data['excluded']=={'MFCC@lr':1}
    assert data['source_sha256']==hashlib.sha256(scores.read_bytes()).hexdigest()
    assert client.get('/api/evaluations/unknown').status_code==404
