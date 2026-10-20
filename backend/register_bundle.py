"""Register a trusted local v4/v5 model dictionary. Never use untrusted Joblib."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import joblib
import yaml


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', required=True, type=Path)
    parser.add_argument('--config', required=True, type=Path, help='Training config YAML containing features, or run_config.json with settings.features')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--dataset', required=True)
    parser.add_argument('--seed', required=True, type=int)
    args=parser.parse_args()
    bundle=args.bundle.resolve()
    config=yaml.safe_load(args.config.read_text())
    cfg=config.get('settings',config)['features']
    selected=joblib.load(bundle)
    if not isinstance(selected,dict): raise ValueError('Bundle harus berupa mapping key → spec v4/v5.')
    checksum=hashlib.sha256(bundle.read_bytes()).hexdigest()
    entries=[]
    for i,(key,spec) in enumerate(selected.items()):
        if not isinstance(spec,dict) or not {'model','cols','threshold','family','kind'}<=set(spec): raise ValueError(f'Spec tidak kompatibel: {key}')
        entries.append(dict(id=re.sub('[^a-zA-Z0-9_-]','_',str(key))+f'_{i}',path=str(bundle),sha256=checksum,key=key,features=cfg,family=spec['family'],kind=spec['kind'],dataset=args.dataset,seed=args.seed))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps({'models':entries},indent=2)+'\n')
    print(f'{len(entries)} model terdaftar dalam {args.output}.')

if __name__=='__main__': main()
