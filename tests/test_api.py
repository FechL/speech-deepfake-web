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

def test_sibling_layout_and_residual_availability():
    from backend.paths import WEB_ROOT,GLOTTAL_ROOT,RESIDUAL_PROJECT
    from backend.setup_local import build_registry
    assert (WEB_ROOT/'dist/index.html').is_file()
    assert (GLOTTAL_ROOT/'src/pipeline_v4/features.py').is_file()
    assert (RESIDUAL_PROJECT/'src/extract_features.py').is_file()
    config=build_registry()
    residual=[e for e in config['models'] if e.get('pipeline')=='residual_modulation']
    assert len(residual)==10
    assert next(e for e in residual if e['key']=='E4a')['family']=='residual'
    assert next(e for e in residual if e['key']=='B0')['family']=='mfcc'
    assert all(e['available'] for e in residual)
    assert all(e['feature_count']>0 for e in residual)
    assert {e['id'] for e in config['evaluations']} >= {'residual_external_standard','residual_external_reported'}


def test_missing_residual_checkpoint_rejected(tmp_path,monkeypatch):
    entry=dict(id='residual_E4a',pipeline='residual_modulation',available=False,path='missing.joblib',sha256=None,key='E4a',features={},family='residual',kind='svm_rbf')
    reg=tmp_path/'registry.json';reg.write_text(json.dumps({'models':[entry]}));monkeypatch.setenv('DEEPGUARD_REGISTRY',str(reg))
    response=client.post('/api/infer',files={'audio':('a.wav',wav(3))},data={'model_ids':'["residual_E4a"]'})
    assert response.status_code==422
    assert 'belum tersedia' in response.json()['detail']


def test_residual_external_threshold_policies():
    from backend.setup_local import build_registry
    from backend.evaluations import load_evaluation
    entries={e['id']:e for e in build_registry()['evaluations']}
    standard=load_evaluation(entries['residual_external_standard'],Path(entries['residual_external_standard']['path']))
    reported=load_evaluation(entries['residual_external_reported'],Path(entries['residual_external_reported']['path']))
    assert len(standard['rows'])==2720
    assert len({r['sample_id'] for r in standard['rows']})==272
    assert {r['threshold'] for r in standard['rows']}=={.5}
    assert standard['threshold_policy']=='standard_probability_0.5'
    assert reported['threshold_policy']=='source_reported_unverified_selection'
    frozen=load_evaluation(entries['residual_external_validation'],Path(entries['residual_external_validation']['path']))
    assert frozen['threshold_policy']=='train_dev_frozen'
    assert next(r for r in frozen['rows'] if r['model']=='Residual / E4a')['threshold']==pytest.approx(.40278870661289634)
    assert next(r for r in reported['rows'] if r['model']=='Residual / E4a')['threshold']==.65


def test_residual_original_extraction_and_checkpoint(tmp_path,monkeypatch):
    import joblib
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler
    from sklearn.svm import SVC
    from backend.setup_local import build_registry
    from backend.residual import extract_residual,residual_score
    entry=next(e for e in build_registry()['models'] if e['id']=='residual_E4a')
    raw,sr=sf.read(io.BytesIO(wav(3)),always_2d=True)
    features=extract_residual(raw,sr,entry)
    cols=[k for k in features if k.startswith('res_')]
    assert len(cols)==15
    assert len([k for k in features if k.startswith('mod_')])==7
    assert features['n_segments']==1
    assert all(np.isfinite(features[k]) for k in cols)
    # Flat modules imported by the legacy extractor must stay out of the API process.
    assert 'extract_features' not in sys.modules
    x=np.random.default_rng(42).normal(size=(20,len(cols)))
    model=Pipeline([('imputer',SimpleImputer()),('scaler',StandardScaler()),('clf',SVC(probability=True,random_state=42))]).fit(x,[0,1]*10)
    checkpoint=dict(model=model,features=cols,val_threshold=.87,experiment_id='E4a',feature_group='residual',model_type='svm_rbf',seed=42)
    scored=residual_score(checkpoint,features,entry)
    expected=model.predict_proba(np.asarray([[features[k] for k in cols]]))[0,1]
    assert scored['score']==pytest.approx(expected)
    assert scored['threshold']==.87
    assert scored['score_type']=='class_probability'
    path=tmp_path/'E4a_seed42.joblib';joblib.dump(checkpoint,path)
    entry.update(path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),available=True)
    reg=tmp_path/'registry.json';reg.write_text(json.dumps({'models':[entry]}));monkeypatch.setenv('DEEPGUARD_REGISTRY',str(reg))
    response=client.post('/api/infer',files={'audio':('tone.wav',wav(3))},data={'model_ids':'["residual_E4a"]'})
    assert response.status_code==200,response.text
    result=response.json()
    assert result['predictions'][0]['threshold']==.87
    assert result['predictions'][0]['pipeline']=='residual_modulation'
    assert result['features'][0]['_pipeline']=='residual_modulation'
    assert result['predictions'][0]['score']==pytest.approx(expected)
    bad=dict(entry,source_hashes={'audio_io.py':'bad'})
    with pytest.raises(ValueError,match='Source residual berubah'):extract_residual(raw,sr,bad)

def test_user_ground_truth_is_metadata_not_model_input(tmp_path,monkeypatch):
    import copy
    reg=tmp_path/'registry.json';reg.write_text(json.dumps({'models':[dict(id='m',path='fixture.joblib',sha256='x',key='m',features={},family='MFCC',kind='lr')]}));monkeypatch.setenv('DEEPGUARD_REGISTRY',str(reg))
    calls=[]
    def fake_infer(raw,sr,entries):
        calls.append((raw.copy(),sr,copy.deepcopy(entries)))
        return {'predictions':[dict(model_id='m',status='ok',prediction='FAKE',score=.8,threshold=.5),dict(model_id='gate',status='abstained',reason='short')],'features':[]}
    monkeypatch.setattr(a,'infer',fake_infer)
    responses=[]
    for label in [None,0,1]:
        data={'model_ids':'["m"]'}
        if label is not None:data['ground_truth']=str(label)
        response=client.post('/api/infer',files={'audio':('same.wav',wav())},data=data)
        assert response.status_code==200,response.text
        result=response.json();responses.append(result)
        assert result['ground_truth']==label
        assert result['ground_truth_source']==('user_provided' if label is not None else None)
        assert result['predictions'][1]['correct'] is None
    assert [r['predictions'][0]['correct'] for r in responses]==[None,False,True]
    assert [r['predictions'][0]['score'] for r in responses]==[.8,.8,.8]
    assert all(np.array_equal(call[0],calls[0][0]) and call[1:]==calls[0][1:] for call in calls)
    bad=client.post('/api/infer',files={'audio':('a.wav',wav())},data={'model_ids':'["m"]','ground_truth':'2'})
    assert bad.status_code==422
    assert len(calls)==3
