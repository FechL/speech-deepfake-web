# DEEPFORENSIC — Forensic Speech Deepfake

DEEPFORENSIC is a web app for trying speech deepfake detection models and inspecting their predictions and extracted audio features. The models come from two independent research repositories: Fawwas's glottal analysis and Alvin's residual and modulation analysis. Follow the research links below for the methods, training, and evaluation; this web app provides an interface for testing the exported models with audio files.

## Research repositories

### 01 / Glottal analysis — Fawwas

[FechL/speech-deepfake-glottal](https://github.com/FechL/speech-deepfake-glottal) studies phonation evidence for speech deepfake detection. It measures pitch and voicing, jitter, shimmer, harmonics, and harmonic-to-noise ratio. The `src/pipeline_v9/` pipeline extracts whole-utterance features and measurement-quality flags; `configs/forensic_whole_utterance_v9.yaml` defines its settings. The repository also contains earlier experiments, manifests, evaluation results, and reports.

The web app tests five exported v9 classifiers: four 19-feature G3 glottal models (logistic regression, SVM, random forest, and histogram gradient boosting) and one 99-feature LFCC + G3 logistic-regression model. Their checkpoint and metadata are in `backend/checkpoints/fawwas/glottal_v9/`. See the linked research repository for training and evaluation details.

### 02 / Residual and modulation analysis — Alvin

[alvinrw/skripsi_final](https://github.com/alvinrw/skripsi_final) studies spectral features alongside forensic evidence from linear-prediction residuals and modulation spectrum. Its `skripsi_residual_modulasi/` directory contains the experiment: `src/` for extraction, training, evaluation, and statistical analysis, and `configs/baseline.yaml` for settings.

The web app tests ten saved classifiers: spectral baselines B0–B4 and evidence models E4a–E4e. It shows their MFCC, LFCC, residual LPC, and modulation features in separate tables. Checkpoints are stored in `backend/checkpoints/alvin/`; see the linked research repository for model design and experiment results.

## Analysis modes

- **01 / Single:** Choose or drop one audio file, play it back, and select Run. The model table shows P(fake), decision threshold, REAL/FAKE decision, and confidence; feature tables show the extracted values.
- **02 / Batch Unlabeled:** Add several files to review prediction counts, average scores, and per-file model and feature results.
- **03 / Batch Labeled:** Add REAL and FAKE files separately. The batch table reports accuracy, precision, recall, F1, balanced accuracy, AUC, EER, and confusion counts for each model.
- **99 / Configuration:** Choose a dark or light terminal color scheme, font family, and text size, then inspect read-only parameter summaries from both research repositories. Appearance choices are saved in the browser.

Supported files: WAV, MP3, M4A, WEBM, OGG, and FLAC, up to 25 MB per file and 50 files per batch. File drag and drop works across the analysis page. A batch can be stopped while it is running; its completed results remain visible in the current browser session.

Confidence is the score assigned to the predicted class, not forensic certainty. Fawwas v9 scores are transformed model outputs and are not calibrated probabilities. AUC and EER require both REAL and FAKE reference files.

## Repositories

- [Glottal research · FechL](https://github.com/FechL/speech-deepfake-glottal)
- [Residual and modulation research · alvinrw](https://github.com/alvinrw/skripsi_final)

## Contributors

- [FechL](https://github.com/FechL) — glottal research and the DEEPFORENSIC testing interface.
- [alvinrw](https://github.com/alvinrw) — residual and modulation research.

## Credits and sources

- [ASVspoof 2019: A large-scale public database of synthesized, converted and replayed speech](https://arxiv.org/abs/1911.01601) — dataset used by the glottal research.
- [DEEP-VOICE paper](https://arxiv.org/abs/2308.12734) — dataset reference in the residual and modulation research.
- Model architecture, feature definitions, and evaluation details: the two research repositories linked above.
