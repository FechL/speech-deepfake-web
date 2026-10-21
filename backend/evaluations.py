"""Normalize existing research scores without combining different test populations."""
import csv
import hashlib
import math


def load_evaluation(entry,path):
    rows=[];excluded={};scopes=set()
    fmt=entry.get('format','glottal_long')
    if fmt not in ('glottal_long','residual_external'):raise ValueError('Format evaluasi tidak didukung.')
    with path.open() as handle:
        for row in csv.DictReader(handle):
            if fmt=='residual_external':
                for key in entry['model_keys']:
                    score=float(row['prob_fake_'+key])
                    threshold=float(entry['thresholds'][key])
                    if not math.isfinite(score) or not 0<=score<=1:raise ValueError('Probabilitas residual tidak valid.')
                    rows.append(dict(sample_id=row['rel_path'].replace('\\','/'),label=int(row['label']),score=score,model='Residual / '+key,dataset='Residual external / '+entry['threshold_policy'],threshold=threshold,seed='42',category=row.get('category'),scope='external_available_272_segments'))
                scopes.add('external_available_272_segments')
                continue
            key=row['key']
            if key not in entry['model_keys']:continue
            scopes.add(row.get('scope','unspecified'))
            if row.get('retained','True').lower()!='true':
                excluded[key]=excluded.get(key,0)+1;continue
            score=float(row['score']);threshold=float(row['threshold'])
            if not math.isfinite(score) or not math.isfinite(threshold):raise ValueError('Skor evaluasi tidak finite.')
            rows.append(dict(sample_id=row['utterance_id'],label=int(row['label']),score=score,model=key,dataset=row['dataset']+' / '+row['scenario'],threshold=threshold,seed=row['seed'],speaker_id=row.get('speaker_id'),attack_id=row.get('attack_id'),scope=row.get('scope')))
    return dict(rows=rows,title=entry['title'],run_id=entry.get('run_id'),scopes=sorted(scopes),excluded=excluded,source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),threshold_policy=entry.get('threshold_policy','train_dev_frozen'),note=entry.get('note','Evaluasi retained samples; model LR tetap untuk perbandingan fitur.'))
