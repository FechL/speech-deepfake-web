import React, { useState, useEffect, useRef } from 'react';
import GlassCard from '../../components/GlassCard';
import { useApp } from '../../context/AppContext';

const SelectModelScreen = ({ 
  fileName, 
  fileFormat, 
  fileSize, 
  fileDuration, 
  realFileBytes,
  fileMimeType,
  onBack, 
  onAnalysisFinished 
}) => {
  const { backendUrl, sensitivity, defaultResearcher, alvinModel, fawwasModel } = useApp();
  const [selectedResearcher, setSelectedResearcher] = useState(() => defaultResearcher || 'alvin');
  const currentAlvinModel = alvinModel || 'B4';
  const currentFawwasModel = fawwasModel || 'rerec_knn_5';
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logIndex, setLogIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const logsTimerRef = useRef(null);
  const progressTimerRef = useRef(null);

  const alvinModelName = {
    B4: 'B4 · XGBoost',
    B0: 'B0 · SVM RBF',
    B1: 'B1 · SVM RBF',
    B2: 'B2 · SVM RBF',
    B3: 'B3 · Random Forest',
    E4c: 'E4c · SVM RBF',
    E4a: 'E4a · SVM RBF',
    E4b: 'E4b · SVM RBF',
    E4e: 'E4e · XGBoost'
  }[currentAlvinModel] || `${currentAlvinModel} (XGBoost)`;

  const fawwasModelName = {
    rerec_knn_5: 'KNN Forensik · N=5',
    rerec_knn_3: 'KNN Forensik · N=3',
    rerec_knn_7: 'KNN Forensik · N=7',
    glottal_g3: 'Glottal Waveform (G3)',
    glottal_lfcc_g3: 'Fusi LFCC + Glottal G3'
  }[currentFawwasModel] || 'KNN Forensik (N=5)';

  const alvinLogs = [
    'Menginisialisasi mesin deteksi forensik...',
    `Memuat checkpoint Model Alvin ${alvinModelName}...`,
    'Mengekstrak koefisien spektral MFCC & filterbank linier LFCC...',
    'Menghitung matriks normalisasi & statistik turunan fitur...',
    'Mengeksekusi inferensi model machine learning skripsi...',
    'Menerapkan ambang batas keputusan validasi checkpoint...',
    'Menyusun laporan analisis forensik audio...'
  ];

  const fawwasLogs = [
    'Menginisialisasi mesin deteksi forensik...',
    `Memuat konfigurasi Model Fawwas ${fawwasModelName}...`,
    'Mengekstrak koefisien akustik re-recording (MFCC, LFCC, ZCR, RMS)...',
    'Menjalankan standardisasi 204 fitur dengan StandardScaler...',
    'Menghitung jarak tetangga terdekat vokal re-recording...',
    'Mengestimasi probabilitas keaslian suara rekaman...',
    'Menyusun laporan analisis forensik audio...'
  ];

  const forensicLogs = selectedResearcher === 'fawwas' ? fawwasLogs : alvinLogs;

  useEffect(() => {
    return () => {
      if (logsTimerRef.current) clearInterval(logsTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const handleStartAnalysis = async () => {
    if (!realFileBytes?.length) {
      setErrorMessage('Data audio tidak tersedia. Kembali dan pilih ulang berkas.');
      return;
    }

    setErrorMessage('');
    setIsAnalyzing(true);
    setProgress(0);
    setLogIndex(0);

    let currentLogIdx = 0;
    logsTimerRef.current = setInterval(() => {
      if (currentLogIdx < forensicLogs.length - 1) {
        currentLogIdx++;
        setLogIndex(currentLogIdx);
      } else {
        clearInterval(logsTimerRef.current);
      }
    }, 700);

    let visualProgress = 0;
    progressTimerRef.current = setInterval(() => {
      visualProgress = Math.min(0.9, visualProgress + 0.025);
      setProgress(visualProgress);
    }, 150);

    try {
      const blob = new Blob([realFileBytes], { type: fileMimeType || 'application/octet-stream' });
      const targetModelParam = selectedResearcher === 'alvin' 
        ? `alvin_${currentAlvinModel}` 
        : `fawwas_${currentFawwasModel}`;

      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('model', targetModelParam);
      formData.append('threshold', sensitivity.toString());

      // Try main backendUrl first, with fallback to port 5001
      let response;
      const targetUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
      
      try {
        response = await fetch(`${targetUrl}/detect`, { method: 'POST', body: formData });
      } catch (fetchErr) {
        if (targetUrl !== 'http://127.0.0.1:5001') {
          response = await fetch('http://127.0.0.1:5001/detect', { method: 'POST', body: formData });
        } else {
          throw fetchErr;
        }
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || data.detail || `Server mengembalikan status ${response.status}.`);
      }

      clearInterval(progressTimerRef.current);
      clearInterval(logsTimerRef.current);
      setProgress(1);
      setTimeout(() => {
        onAnalysisFinished(data.isAuthentic, data.confidenceScore, data.modelName, data);
      }, 450);
    } catch (error) {
      clearInterval(progressTimerRef.current);
      clearInterval(logsTimerRef.current);
      setIsAnalyzing(false);
      setProgress(0);
      setErrorMessage(
        error instanceof TypeError
          ? 'Backend lokal tidak dapat dihubungi. Pastikan server Python backend berjalan (port 5001) lalu coba lagi.'
          : error.message
      );
    }
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backBtn} disabled={isAnalyzing}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span>Kembali</span>
        </button>
        <h2 style={styles.title}>Konfigurasi Analisis</h2>
        <div style={{ width: '80px' }} />
      </header>

      <div style={styles.grid} className="config-grid">
        <div style={styles.specsColumn}>
          <GlassCard padding="24px" style={styles.specsCard}>
            <div style={styles.specsHeader}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              <h3 style={styles.specsTitle}>Berkas Terpilih</h3>
            </div>
            
            <div style={styles.metaList}>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Nama Berkas</span>
                <span style={styles.metaValue} title={fileName}>{fileName}</span>
              </div>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Format</span>
                <span style={styles.metaValue}>{fileFormat}</span>
              </div>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Ukuran</span>
                <span style={styles.metaValue}>{fileSize}</span>
              </div>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Durasi</span>
                <span style={styles.metaValue}>{fileDuration}</span>
              </div>
            </div>
          </GlassCard>
        </div>

        <div style={styles.modelsColumn}>
          {!isAnalyzing ? (
            <div style={styles.nonActiveContent}>
              <h3 style={styles.sectionHeading}>Pilih Mesin Deteksi AI</h3>
              
              <div style={styles.modelsList}>
                {/* Model Alvin */}
                <div 
                  onClick={() => setSelectedResearcher('alvin')}
                  style={{
                    ...styles.modelItem,
                    ...(selectedResearcher === 'alvin' ? styles.modelItemActive : {})
                  }}
                  className="glass-container"
                >
                  <div style={styles.modelHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={styles.modelName}>Model Alvin</h4>
                    </div>
                    {selectedResearcher === 'alvin' && <div style={styles.activeCheck} />}
                  </div>

                  <div style={styles.configuredModel}>
                    <span style={styles.configuredLabel}>Model aktif dari Pengaturan</span>
                    <strong>{alvinModelName}</strong>
                  </div>
                </div>

                {/* Model Fawwas */}
                <div 
                  onClick={() => setSelectedResearcher('fawwas')}
                  style={{
                    ...styles.modelItem,
                    ...(selectedResearcher === 'fawwas' ? styles.modelItemActive : {})
                  }}
                  className="glass-container"
                >
                  <div style={styles.modelHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={styles.modelName}>Model Fawwas</h4>
                    </div>
                    {selectedResearcher === 'fawwas' && <div style={styles.activeCheck} />}
                  </div>

                  <div style={styles.configuredModel}>
                    <span style={styles.configuredLabel}>Model aktif dari Pengaturan</span>
                    <strong>{fawwasModelName}</strong>
                  </div>
                </div>
              </div>

              {errorMessage && <div role="alert" style={styles.errorBanner}>{errorMessage}</div>}

              <button onClick={handleStartAnalysis} className="btn-primary" style={styles.startBtn} disabled={!selectedResearcher}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>MULAI DETEKSI</span>
              </button>
            </div>
          ) : (
            <GlassCard padding="32px 24px" style={styles.scanningCard}>
              <div style={styles.scanningHeader}>
                <div style={styles.radarContainer}>
                  <div style={styles.radarWave} />
                  <div style={styles.radarWaveDelay} />
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ zIndex: 2 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <h3 style={styles.scanningTitle}>Memindai Anomali Audio...</h3>
              </div>

              <div style={styles.progressSection}>
                <div style={styles.progressMeta}>
                  <span style={styles.percentText}>{Math.round(progress * 100)}%</span>
                  <span style={styles.modelLabel}>
                    Inference: {selectedResearcher === 'fawwas' ? `Model Fawwas (${fawwasModelName})` : `Model Alvin ${alvinModelName}`}
                  </span>
                </div>
                <div style={styles.progressBarBg}>
                  <div style={{ ...styles.progressBarIndicator, width: `${progress * 100}%` }} />
                </div>
              </div>

              <div style={styles.logsConsole}>
                <div style={styles.consoleHeader}>LOG PEMINDAIAN ELEKTRONIK</div>
                <div style={styles.consoleBody}>
                  {forensicLogs.slice(0, logIndex + 1).map((log, index) => (
                    <div 
                      key={index} 
                      style={{
                        ...styles.logLine,
                        color: index === logIndex ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: index === logIndex ? '700' : '400'
                      }}
                    >
                      <span style={styles.logBullet}>&gt;</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  <div style={styles.logCursor} />
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      <style>{`
        .config-grid {
          display: flex;
          gap: 20px;
        }
        .config-grid > div:first-child {
          flex: 1;
        }
        .config-grid > div:last-child {
          flex: 1.5;
        }
        @media (max-width: 650px) {
          .config-grid {
            flex-direction: column;
          }
          .config-grid > div {
            width: 100% !important;
            flex: none !important;
          }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    maxWidth: '820px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
    fontSize: '1.25rem',
  },
  grid: {
    width: '100%',
  },
  specsColumn: {
    display: 'flex',
  },
  specsCard: {
    width: '100%',
    background: 'var(--card-bg)',
    display: 'flex',
    flexDirection: 'column',
    height: 'fit-content',
  },
  specsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '12px',
  },
  specsTitle: {
    fontSize: '1.1rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
  },
  metaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  metaLabel: {
    fontSize: '0.7rem',
    fontFamily: 'var(--font-label)',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  metaValue: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  modelsColumn: {
    display: 'flex',
    flexDirection: 'column',
  },
  nonActiveContent: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  sectionHeading: {
    fontSize: '1.1rem',
    fontWeight: '800',
    marginBottom: '16px',
    fontFamily: 'var(--font-display)',
  },
  modelsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  modelItem: {
    padding: '16px',
    borderRadius: '16px',
    cursor: 'pointer',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border)',
    transition: 'all 0.3s ease',
  },
  modelItemActive: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 15px var(--primary-glow)',
    background: 'rgba(0, 218, 243, 0.03)',
  },
  modelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  modelName: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text)',
  },
  modelBadgePrimary: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    background: 'var(--primary-glow)',
    color: 'var(--primary)',
    fontSize: '0.62rem',
    fontWeight: '700',
    letterSpacing: '0.04em',
  },
  modelBadgeSecondary: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    background: 'rgba(78, 222, 163, 0.15)',
    color: 'var(--secondary)',
    fontSize: '0.62rem',
    fontWeight: '700',
    letterSpacing: '0.04em',
  },
  activeCheck: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    boxShadow: '0 0 8px var(--primary)',
  },
  modelDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
    margin: '0 0 10px 0',
  },
  configuredModel: { marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' },
  configuredLabel: { color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '600' },
  startBtn: {
    width: '100%',
  },
  errorBanner: {
    marginBottom: '14px',
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 77, 77, 0.45)',
    background: 'rgba(255, 77, 77, 0.1)',
    color: '#ff8d8d',
    fontSize: '0.8rem',
    lineHeight: '1.4',
  },
  scanningCard: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  scanningHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '28px',
  },
  radarContainer: {
    position: 'relative',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'var(--primary-glow)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
  },
  radarWave: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '1px solid var(--primary)',
    animation: 'radarWave 2s linear infinite',
  },
  radarWaveDelay: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '1px solid var(--primary)',
    animation: 'radarWave 2s linear infinite',
    animationDelay: '1s',
  },
  scanningTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
  },
  progressSection: {
    width: '100%',
    marginBottom: '24px',
  },
  progressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '8px',
  },
  percentText: {
    fontSize: '1.5rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    color: 'var(--primary)',
  },
  modelLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-label)',
  },
  progressBarBg: {
    width: '100%',
    height: '6px',
    background: 'var(--card-highest)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressBarIndicator: {
    height: '100%',
    backgroundColor: 'var(--primary)',
    borderRadius: '3px',
    transition: 'width 0.2s ease',
  },
  logsConsole: {
    width: '100%',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  consoleHeader: {
    fontSize: '0.65rem',
    fontFamily: 'var(--font-label)',
    fontWeight: '700',
    letterSpacing: '0.1em',
    color: 'var(--primary)',
    marginBottom: '12px',
    opacity: 0.8,
  },
  consoleBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: '140px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  logLine: {
    fontSize: '0.8rem',
    fontFamily: 'var(--font-label)',
    lineHeight: '1.4',
    display: 'flex',
    gap: '6px',
    alignItems: 'flex-start',
    transition: 'color 0.3s ease',
  },
  logBullet: {
    color: 'var(--primary)',
    fontWeight: '800',
  },
};

export default SelectModelScreen;
