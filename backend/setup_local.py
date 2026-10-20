"""Create local-only registry from the existing frozen v5 metadata (no model unpickling)."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RUN=ROOT/'results/forensic_comparative_v5/2b3a5cec0fa4dcd9'
KEYS=['MFCC@lr','LFCC@lr','G0_prosody@lr','G1_perturb_hnr@lr','G2_harmonic@lr','G3_glottal@lr','MFCC_plus_G3@lr','LFCC_plus_G3@lr']

def main():
    models=[];evaluations=[]
    for seed in (2026,2027,2028):
        folder=RUN/f'seed_{seed}'
        meta=json.loads((folder/'models/frozen_selection.json').read_text())
        bundle=folder/'models/models_frozen_v5.joblib'
        digest=hashlib.sha256(bundle.read_bytes()).hexdigest()
        if digest!=meta['model_sha256']: raise ValueError('Frozen bundle checksum mismatch')
        if seed==2026:
            for key in KEYS:
                spec=meta['specs'][key]
                models.append(dict(id=key.replace('@','_'),path=str(bundle),sha256=digest,key=key,features=meta['context']['settings']['features'],family=spec['family'],kind=spec['kind'],dataset='ASVspoof2019_LA',seed=seed,packages=meta['context']['packages'],feature_hash=meta['context']['feature_hash'],run_id=RUN.name))
        for scenario,name in [('internal/internal_la','ASVspoof2019 LA — eval subset'),('external/external_mlaad','MLAAD tiny English'),('external/external_df','ASVspoof2021 DF — available subset')]:
            path=folder/scenario/'scores_utterance.csv'
            if path.exists(): evaluations.append(dict(id=f'{scenario.split("/")[-1]}_{seed}',title=f'{name} / seed {seed}',path=str(path),model_keys=KEYS,run_id=RUN.name))
    output=ROOT/'web-app/models/registry.json';output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(dict(models=models,evaluations=evaluations),indent=2)+'\n')
    print(f'{len(models)} models and {len(evaluations)} evaluations registered locally.')

if __name__=='__main__':main()
