"""Register sibling research repos. Missing checkpoints remain explicitly unavailable."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.paths import WEB_ROOT, GLOTTAL_ROOT, RESIDUAL_ROOT, RESIDUAL_PROJECT, RESIDUAL_SOURCES

KEYS=['MFCC@lr','LFCC@lr','G0_prosody@lr','G1_perturb_hnr@lr','G2_harmonic@lr','G3_glottal@lr','MFCC_plus_G3@lr','LFCC_plus_G3@lr']
RESIDUAL_MODELS={
    'B0':('mfcc','svm_rbf'), 'B1':('lfcc','svm_rbf'),
    'B2':('mfcc_lfcc','svm_rbf'), 'B3':('mfcc_lfcc','rf'), 'B4':('mfcc_lfcc','xgb'),
    'E4a':('residual','svm_rbf'), 'E4b':('modulation','svm_rbf'), 'E4c':('evidence','svm_rbf'),
    'E4d':('evidence','rf'), 'E4e':('evidence','xgb'),
}


_INSPECTIONS={}

def inspect_residual(path,digest,key,family,kind):
    """Only trusted operator-supplied local checkpoints; cache metadata, not estimators."""
    import joblib
    import math
    import warnings
    cache_key=(digest,key,family,kind)
    if cache_key in _INSPECTIONS:return _INSPECTIONS[cache_key]
    with warnings.catch_warnings(record=True) as caught:
        checkpoint=joblib.load(path)
    for field,expected in [('experiment_id',key),('feature_group',family),('model_type',kind),('seed',42)]:
        if checkpoint.get(field)!=expected:raise ValueError(f'Metadata {path.name}: {field} tidak sesuai training.')
    if list(checkpoint['model'].classes_)!=[0,1]:raise ValueError('Orientasi kelas checkpoint tidak sesuai.')
    cols=checkpoint['features'];threshold=float(checkpoint['val_threshold'])
    if not cols or len(set(cols))!=len(cols) or not math.isfinite(threshold):raise ValueError('Schema fitur/threshold checkpoint tidak valid.')
    messages=[]
    for warning in caught:
        message=str(warning.message)
        messages.append('Serialisasi XGBoost versi lama: inferensi berhasil dimuat, kesesuaian numerik dengan environment training belum diverifikasi.' if 'XGBoost' in message else message[:600])
    result=dict(feature_count=len(cols),checkpoint_threshold=threshold,load_warnings=sorted(set(messages)))
    _INSPECTIONS[cache_key]=result
    return result


def build_registry(checkpoints=None):
    import yaml
    models=[];evaluations=[]
    run=GLOTTAL_ROOT/'results/forensic_comparative_v5/2b3a5cec0fa4dcd9'
    for seed in (2026,2027,2028):
        folder=run/f'seed_{seed}';marker=folder/'models/frozen_selection.json'
        if not marker.exists():continue
        meta=json.loads(marker.read_text());bundle=folder/'models/models_frozen_v5.joblib'
        digest=hashlib.sha256(bundle.read_bytes()).hexdigest()
        if digest!=meta['model_sha256']:raise ValueError('Frozen glottal checksum mismatch')
        if seed==2026:
            for key in KEYS:
                spec=meta['specs'][key]
                models.append(dict(id=key.replace('@','_'),pipeline='glottal_v4',available=True,path=str(bundle),sha256=digest,key=key,features=meta['context']['settings']['features'],family=spec['family'],kind=spec['kind'],dataset='ASVspoof2019_LA',seed=seed,packages=meta['context']['packages'],feature_hash=meta['context']['feature_hash'],run_id=run.name))
        for scenario,name in [('internal/internal_la','ASVspoof2019 LA — eval subset'),('external/external_mlaad','MLAAD tiny English'),('external/external_df','ASVspoof2021 DF — available subset')]:
            path=folder/scenario/'scores_utterance.csv'
            if path.exists():evaluations.append(dict(id=f'{scenario.split("/")[-1]}_{seed}',title=f'Glotal / {name} / seed {seed}',path=str(path),model_keys=KEYS,run_id=run.name))
    config=RESIDUAL_PROJECT/'configs/baseline.yaml'
    if config.exists():
        cfg=yaml.safe_load(config.read_text());source=RESIDUAL_PROJECT/'src'
        hashes={name:hashlib.sha256((source/name).read_bytes()).hexdigest() for name in RESIDUAL_SOURCES}
        folders=[Path(checkpoints)] if checkpoints else [RESIDUAL_ROOT/'models_checkpoints',RESIDUAL_PROJECT/'checkpoints',RESIDUAL_ROOT/'web_cek/model']
        validation_thresholds={}
        for key,(family,kind) in RESIDUAL_MODELS.items():
            name=f'{key}_seed42.joblib';path=next((folder/name for folder in folders if (folder/name).is_file()),folders[0]/name)
            exists=path.is_file()
            digest=hashlib.sha256(path.read_bytes()).hexdigest() if exists else None
            inspection=inspect_residual(path,digest,key,family,kind) if exists else {}
            if exists:validation_thresholds[key]=inspection['checkpoint_threshold']
            models.append(dict(id='residual_'+key,pipeline='residual_modulation',available=exists,**inspection,unavailable_reason=None if exists else 'Checkpoint '+name+' belum tersedia.',path=str(path.resolve()),sha256=digest,key=key,features=cfg,source_dir=str(source),source_hashes=hashes,lpc_order=cfg['lpc_order'],family=family,kind=kind,dataset='Residual training (cek metadata checkpoint)',seed=42,description='Definisi sesuai train_baseline.py; threshold diambil dari checkpoint.val_threshold.'))
        predictions=RESIDUAL_ROOT/'hasil_validasi/validation_external_predictions.csv'
        metrics=RESIDUAL_ROOT/'hasil_validasi/validation_external_metrics.csv'
        if predictions.exists():
            common=dict(path=str(predictions),format='residual_external',model_keys=list(RESIDUAL_MODELS),run_id='residual_seed42_external')
            if len(validation_thresholds)==len(RESIDUAL_MODELS):
                evaluations.append(dict(common,id='residual_external_validation',title='Residual / eksternal · threshold validation checkpoint',thresholds=validation_thresholds,threshold_policy='train_dev_frozen',note='Threshold val_threshold dibaca dari checkpoint asli seed 42, tidak dituning pada data eksternal. Skor sumber dibulatkan 4 desimal. Metrik dihitung ulang; populasi berbeda dari glotal.'))
            evaluations.append(dict(common,id='residual_external_standard',title='Residual / eksternal · threshold standar 0.5',thresholds={k:.5 for k in RESIDUAL_MODELS},threshold_policy='standard_probability_0.5',note='Metrik dihitung ulang dari skor dibulatkan 4 desimal; EER interpolasi dapat berbeda dari ringkasan sumber yang tidak disalin sebagai hasil hitung. Threshold standar 0.5, bukan threshold validation checkpoint. Populasi berbeda dari evaluasi glotal; jangan bandingkan peringkat lintas dataset.'))
            if metrics.exists():
                import csv
                thresholds={r['model']:float(r['calibrated_thresh']) for r in csv.DictReader(metrics.open())}
                evaluations.append(dict(common,id='residual_external_reported',title='Residual / eksternal · threshold laporan sumber',thresholds=thresholds,threshold_policy='source_reported_unverified_selection',note='Threshold dilaporkan CSV sumber sebagai calibrated_thresh; asal seleksinya tidak diverifikasi dan bukan bukti probabilitas terkalibrasi. Tidak dipakai untuk inferensi. Metrik dihitung ulang dari skor dibulatkan 4 desimal; EER interpolasi dapat berbeda dari ringkasan sumber. Populasi berbeda dari glotal.'))
    return dict(models=models,evaluations=evaluations)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--residual-checkpoints',default=os.getenv('DEEPGUARD_RESIDUAL_CHECKPOINTS'))
    parser.add_argument('--output',type=Path,default=WEB_ROOT/'models/registry.json')
    args=parser.parse_args();data=build_registry(args.residual_checkpoints)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    temp=args.output.with_suffix('.tmp');temp.write_text(json.dumps(data,indent=2)+'\n');temp.replace(args.output)
    print(f"{len(data['models'])} registered; {sum(e['available'] for e in data['models'])} available; {len(data['evaluations'])} evaluations. Registry: {args.output}")

if __name__=='__main__':main()
