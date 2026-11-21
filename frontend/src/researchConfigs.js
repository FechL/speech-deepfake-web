// Read-only summaries of the two research repositories' configuration files.
// Fawwas: configs/forensic_whole_utterance_v9.yaml
// Alvin: skripsi_residual_modulasi/configs/baseline.yaml
export const researchConfigs = [
  {
    id: 'fawwas',
    title: 'Fawwas · Glottal v9',
    repo: 'FechL/speech-deepfake-glottal',
    url: 'https://github.com/FechL/speech-deepfake-glottal',
    source: 'configs/forensic_whole_utterance_v9.yaml',
    groups: [
      { title: 'Audio', rows: [
        ['Sample rate', '16 kHz'], ['Maximum analyzed duration', '60 s · center segment'],
        ['Minimum duration', '0.30 s'], ['Silence trim', '35 dB'], ['Active frame threshold', '30 dB'],
      ] },
      { title: 'Phonation', rows: [
        ['Pitch range', '60–400 Hz'], ['Minimum voiced duration', '0.25 s'],
        ['Minimum stable voiced run', '0.08 s'], ['Pulses per run', '5'],
        ['Total pulses for jitter/shimmer', '20'], ['Harmonic frame step', '2'],
      ] },
      { title: 'Spectral and models', rows: [
        ['Cepstral coefficients', '20'], ['Filterbank filters', '40'],
        ['Spectral CMN', 'Disabled'], ['Research classifiers', 'LR · SVM-RBF · RF · HGB'],
        ['Research seeds', '2026 · 2027 · 2028'], ['Web checkpoint seed', '2026'],
        ['Web systems', '4 × G3 (19 features) · 1 × LFCC + G3 (99 features)'],
      ] },
    ],
  },
  {
    id: 'alvin',
    title: 'Alvin · Residual and modulation',
    repo: 'alvinrw/skripsi_final',
    url: 'https://github.com/alvinrw/skripsi_final',
    source: 'skripsi_residual_modulasi/configs/baseline.yaml',
    groups: [
      { title: 'Audio and labels', rows: [
        ['Sample rate', '16 kHz'], ['Segment / hop', '2.0 s / 2.0 s'],
        ['REAL / FAKE labels', '0 / 1'], ['Training seed', '42'],
        ['Split group', 'Speaker ID'], ['Test / validation split', '20% / 20% of training portion'],
      ] },
      { title: 'Spectral features', rows: [
        ['MFCC / LFCC coefficients', '20 / 20'], ['MFCC FFT / window / hop', '512 / 400 / 160 samples'],
        ['LFCC filters / maximum frequency', '40 / 8 kHz'],
      ] },
      { title: 'Residual and modulation', rows: [
        ['LPC order', '16'], ['LPC frame / hop', '25 / 10 ms'],
        ['LPC minimum frame energy', '1e-8'], ['Envelope sample rate', '100 Hz'],
        ['Modulation low-pass / maximum', '40 / 20 Hz'],
        ['Modulation bands', '0.5–2 · 2–4 · 4–8 · 8–20 Hz'],
      ] },
      { title: 'Research models', rows: [
        ['SVM kernel / C', 'RBF / 10'], ['Random forest estimators', '200'],
        ['XGBoost estimators / depth / learning rate', '200 / 6 / 0.05'],
        ['Web checkpoints', 'B0–B4 · E4a–E4e'],
      ] },
    ],
  },
];
