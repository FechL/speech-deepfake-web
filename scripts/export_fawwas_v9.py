"""Export a deployable Fawwas v9 checkpoint from the published feature cache.

The research runner saves scores and metrics but does not serialize estimators.
This script repeats its train/dev fitting recipe without touching eval data.
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RESEARCH = ROOT.parent / "speech-deepfake-glottal"
DEFAULT_RUN = "fe17e2b856dd5d6c"
SYSTEMS = {
    "glottal_g3": ("G3_glottal", "lr"),
    "glottal_g3_svm": ("G3_glottal", "svm_rbf"),
    "glottal_g3_rf": ("G3_glottal", "rf"),
    "glottal_g3_hgb": ("G3_glottal", "hgb"),
    "glottal_lfcc_g3": ("LFCC_plus_G3", "lr"),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--research", type=Path, default=DEFAULT_RESEARCH)
    parser.add_argument("--run-id", default=DEFAULT_RUN)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--out", type=Path, default=ROOT / "backend/checkpoints/fawwas/glottal_v9")
    args = parser.parse_args()

    sys.path.insert(0, str(args.research))
    from scripts.run_pipeline_v9 import make_model, model_scores
    from src.pipeline_v9.evaluation import eer_v9
    from src.pipeline_v9.features import FAMILIES_V9

    source = args.research / "results/forensic_whole_utterance_v9" / args.run_id
    settings = yaml.safe_load((source / "config.yaml").read_text())
    manifest = pd.read_csv(source / "manifests/asvspoof2019_la.csv")
    shards = sorted((source / "features/asvspoof2019_la").glob("shard_*/features.csv"))
    if not shards:
        raise FileNotFoundError("No v9 feature shards found")
    features = pd.concat((pd.read_csv(path, low_memory=False) for path in shards), ignore_index=True)
    if features.utterance_id.duplicated().any():
        raise ValueError("Duplicate v9 feature rows")
    data = manifest.merge(features, on="utterance_id", validate="1:1")
    data = data[data.analysis_status.ne("error")]
    train, dev = data[data.split.eq("train")], data[data.split.eq("dev")]
    if train.empty or dev.empty or set(train.speaker_id) & set(dev.speaker_id):
        raise ValueError("Invalid v9 train/dev split")

    exported = {}
    for variant, (family, kind) in SYSTEMS.items():
        if family not in settings["families"] or kind not in settings["models"]:
            raise ValueError(f"System absent from research configuration: {variant}")
        cols = FAMILIES_V9[family]
        model = make_model(kind, args.seed, settings.get("missing_indicators", False))
        model.fit(train[cols], train.label)
        dev_scores = model_scores(model, dev, cols)
        threshold = float(eer_v9(dev.label, dev_scores)[1])
        # A monotone sigmoid maps research margins into the web's [0, 1] score.
        # Its centre is the dev EER threshold, preserving the research decision.
        scale = float(np.std(dev_scores)) or 1.0
        exported[variant] = dict(model=model, cols=cols, kind=kind, family=family,
                                 raw_threshold=threshold, score_scale=scale)
        print(f"{variant}: {len(cols)} features, dev threshold {threshold:.5f}", flush=True)

    args.out.mkdir(parents=True, exist_ok=True)
    model_path = args.out / f"seed_{args.seed}.joblib"
    joblib.dump(exported, model_path, compress=3)
    config = dict(schema=9, run_id=args.run_id, seed=args.seed, features=settings["features"],
                  systems={name: dict(family=spec["family"], kind=spec["kind"],
                                      n_features=len(spec["cols"]), raw_threshold=spec["raw_threshold"])
                           for name, spec in exported.items()},
                  model_sha256=hashlib.sha256(model_path.read_bytes()).hexdigest())
    (args.out / f"seed_{args.seed}.json").write_text(json.dumps(config, indent=2) + "\n")
    print(model_path)


if __name__ == "__main__":
    main()
