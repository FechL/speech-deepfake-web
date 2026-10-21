"""Isolated execution of the original residual extractor's flat-module imports."""
import contextlib
import json
from pathlib import Path
import sys


def main():
    request=json.load(sys.stdin)
    source=Path(request['source']).resolve()
    sys.path.insert(0,str(source))
    with contextlib.redirect_stdout(sys.stderr):
        from extract_features import extract_utterance_features
        features=extract_utterance_features(request['audio'],request['config'],lpc_order=request['lpc_order'])
    if features is None:
        raise ValueError('Ekstraksi residual gagal; audio minimal 1 detik.')
    # JSON null preserves missing values without accepting non-standard NaN JSON.
    import math
    json.dump({k:None if isinstance(v,float) and not math.isfinite(v) else v for k,v in features.items()},sys.stdout,allow_nan=False)

if __name__=='__main__':main()
