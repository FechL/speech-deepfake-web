import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import GlassCard from '../../components/GlassCard';
import { useApp } from '../../context/AppContext';

const ALVIN_OPTIONS = [
  { id: 'alvin_B4', label: 'B4 · XGBoost' },
  { id: 'alvin_B0', label: 'B0 · SVM RBF' },
  { id: 'alvin_B1', label: 'B1 · SVM RBF' },
  { id: 'alvin_B2', label: 'B2 · SVM RBF' },
  { id: 'alvin_B3', label: 'B3 · Random Forest' },
  { id: 'alvin_E4c', label: 'E4c · SVM RBF' },
  { id: 'alvin_E4a', label: 'E4a · SVM RBF' },
  { id: 'alvin_E4b', label: 'E4b · SVM RBF' },
  { id: 'alvin_E4e', label: 'E4e · XGBoost' },
];

const FAWWAS_OPTIONS = [
  { id: 'fawwas_rerec_knn_5', label: 'KNN · N=5' },
  { id: 'fawwas_rerec_knn_3', label: 'KNN · N=3' },
  { id: 'fawwas_rerec_knn_7', label: 'KNN · N=7' },
];

const ResultsCollectionScreen = ({ onStartNewDetection, onViewReport }) => {
  const { backendUrl, theme } = useApp();
  const isDark = theme === 'dark';

  const [samples, setSamples] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [retryModelSample, setRetryModelSample] = useState(null);
  const [retryFamily, setRetryFamily] = useState('alvin');
  const [selectedAlvinChoice, setSelectedAlvinChoice] = useState('alvin_B4');
  const [selectedFawwasChoice, setSelectedFawwasChoice] = useState('fawwas_rerec_knn_5');
  const [evaluatingSampleId, setEvaluatingSampleId] = useState(null);
  const [evaluatingAction, setEvaluatingAction] = useState('');

  const fetchSamples = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${backendUrl}/api/samples`);
      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      if (data.status === 'success') {
        setSamples(data.samples || []);
      }
    } catch {
      setErrorMessage('Tidak dapat memuat koleksi sampel dari server lokal.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSamples();
  }, [backendUrl]);

  const handleEvaluateSingle = async (sampleId, modelId) => {
    setEvaluatingSampleId(sampleId);
    setEvaluatingAction(modelId.startsWith('alvin') ? 'Menguji Alvin...' : 'Menguji Fawwas...');
    setErrorMessage('');
    try {
      const res = await fetch(`${backendUrl}/api/samples/${sampleId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Evaluasi gagal.');
      setSamples((prev) => prev.map((sample) => sample.id === sampleId ? data.sample : sample));
    } catch (error) {
      setErrorMessage(`Gagal menjalankan model: ${error.message}`);
    } finally {
      setEvaluatingSampleId(null);
      setEvaluatingAction('');
    }
  };

  const handleDeleteSample = async () => {
    if (!deleteTarget) return;
    const sampleId = deleteTarget.id;
    try {
      const res = await fetch(`${backendUrl}/api/samples/${sampleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSamples((prev) => prev.filter((s) => s.id !== sampleId));
        setDeleteTarget(null);
      } else {
        throw new Error('Gagal menghapus sampel.');
      }
    } catch {
      setErrorMessage('Gagal menghapus sampel.');
    }
  };

  const handleOpenReportFromEval = (sample, evalEntry) => {
    onViewReport({
      fileName: sample.fileName,
      fileFormat: sample.fileFormat,
      fileSize: sample.fileSize,
      fileDuration: sample.fileDuration,
      aiModel: evalEntry.modelName,
      isAuthentic: evalEntry.isAuthentic,
      score: evalEntry.confidenceScore,
      probAuthentic: evalEntry.prob_authentic,
      probDeepfake: evalEntry.prob_deepfake,
      threshold: evalEntry.threshold,
      audioUrl: `${backendUrl}/api/samples/${sample.id}/audio`,
    });
  };

  // Filtered samples
  const filteredSamples = samples.filter((sample) => {
    const matchesSearch = sample.fileName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    return true;
  });


  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <h2 style={styles.title}>Kumpulan Hasil</h2>

        <button onClick={onStartNewDetection} className="btn-primary" style={styles.newDetectBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Deteksi Audio Baru</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Cari berkas audio tersimpan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              ✕
            </button>
          )}
        </div>

        <button onClick={fetchSamples} style={styles.refreshBtn} title="Muat ulang">
          Muat ulang
        </button>
      </div>

      {errorMessage && (
        <div role="alert" style={styles.errorBanner}>
          {errorMessage}
        </div>
      )}

      {/* Audio Samples List */}
      {isLoading ? (
        <div style={styles.loadingContainer} className="glass-container">
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Memuat repositori sampel audio...</span>
        </div>
      ) : filteredSamples.length === 0 ? (
        <div style={styles.emptyContainer} className="glass-container">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" style={{ opacity: 0.5 }}>
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          <h3 style={styles.emptyTitle}>
            {searchQuery ? 'Tidak Ada Sampel yang Cocok' : 'Belum Ada Koleksi Sampel Audio'}
          </h3>
          <p style={styles.emptyDesc}>
            {searchQuery
              ? `Tidak ditemukan berkas audio dengan kata kunci "${searchQuery}".`
              : 'Lakukan deteksi pertama Anda melalui menu Deteksi atau rekaman mikrofon. Sampel audio akan otomatis tersimpan di sini sehingga Anda dapat menguji ulang lintas model kapan saja tanpa perlu mengunggah ulang.'}
          </p>
          {!searchQuery && (
            <button onClick={onStartNewDetection} className="btn-primary" style={{ marginTop: '16px' }}>
              Mulai Deteksi Audio Baru
            </button>
          )}
        </div>
      ) : (
        <div style={styles.samplesList}>
          {filteredSamples.map((sample) => {
            const evals = sample.evaluations ? Object.values(sample.evaluations) : [];

            return (
              <GlassCard key={sample.id} padding="20px 22px" style={styles.sampleCard}>
                {/* Sample Card Header */}
                <div style={styles.sampleHeader}>
                  <div style={styles.sampleHeaderLeft}>
                    <div>
                      <h4 style={styles.sampleFileName} title={sample.fileName}>
                        {sample.fileName}
                      </h4>
                      <div style={styles.sampleMetaRow}>
                        <span style={styles.metaBadge}>{sample.fileFormat}</span>
                        <span>{sample.fileDuration}</span>
                        <span>•</span>
                        <span>{sample.fileSize}</span>
                        <span>•</span>
                        <span>
                          {sample.uploadedAt ? new Date(sample.uploadedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.sampleHeaderRight}>
                    <button
                      onClick={() => setDeleteTarget(sample)}
                      style={styles.deleteBtn}
                      title="Hapus sampel dari koleksi"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Built-in Audio Player for Instant Preview */}
                <div style={styles.audioPlayerContainer}>
                  <audio
                    controls
                    preload="none"
                    src={`${backendUrl}/api/samples/${sample.id}/audio`}
                    style={styles.nativeAudio}
                  />
                </div>

                {/* Evaluations Matrix (Results per Model on this Audio) */}
                <div style={styles.evaluationsSection}>
                  <div style={styles.evalCardsGrid}>
                    {evals.map((entry, idx) => {
                      const isAuth = entry.isAuthentic;
                      const statusColor = isAuth ? (isDark ? '#4EDEA3' : '#059669') : '#FF4D4D';
                      const statusBorder = 'var(--border)';

                      return (
                        <div
                          key={idx}
                          style={{
                            ...styles.evalCard,
                            borderColor: statusBorder,
                          }}
                        >
                          <div style={styles.evalCardTop}>
                            <span style={styles.evalModelName}>{entry.modelName}</span>
                            <span
                              style={{
                                ...styles.evalBadge,
                                color: statusColor,
                                borderColor: statusBorder,
                              }}
                            >
                              {isAuth ? 'ASLI' : 'DEEPFAKE'}
                            </span>
                          </div>

                          <span style={{ ...styles.metricVal, color: statusColor }}>{Math.round((entry.confidenceScore || 0) * 100)}%</span>
                          <button onClick={() => handleOpenReportFromEval(sample, entry)} style={styles.openReportMiniBtn}>Laporan</button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={styles.actionToolbar}>
                  <button type="button" onClick={() => { setRetryModelSample(sample); setRetryFamily('alvin'); }} disabled={evaluatingSampleId === sample.id} style={styles.retryButton}>
                    {evaluatingSampleId === sample.id ? evaluatingAction : 'Uji dengan Model Lain'}
                  </button>
                </div>

              </GlassCard>
            );
          })}
        </div>
      )}

      {retryModelSample && createPortal(
        <div style={styles.modalOverlay} onClick={() => setRetryModelSample(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="retry-modal-title" style={styles.retryModal} onClick={(event) => event.stopPropagation()}>
            <h3 id="retry-modal-title" style={styles.modalTitle}>Uji dengan Model Lain</h3>
            <div style={styles.familyPicker}>
              <button type="button" aria-pressed={retryFamily === 'alvin'} onClick={() => setRetryFamily('alvin')} style={{ ...styles.familyButton, ...(retryFamily === 'alvin' ? styles.familyButtonAlvinActive : {}) }}>Alvin</button>
              <button type="button" aria-pressed={retryFamily === 'fawwas'} onClick={() => setRetryFamily('fawwas')} style={{ ...styles.familyButton, ...(retryFamily === 'fawwas' ? styles.familyButtonFawwasActive : {}) }}>Fawwas</button>
            </div>
            <select
              aria-label="Pilih varian model"
              value={retryFamily === 'alvin' ? selectedAlvinChoice : selectedFawwasChoice}
              onChange={(event) => retryFamily === 'alvin' ? setSelectedAlvinChoice(event.target.value) : setSelectedFawwasChoice(event.target.value)}
              style={styles.retrySelect}
            >
              {(retryFamily === 'alvin' ? ALVIN_OPTIONS : FAWWAS_OPTIONS).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <div style={styles.retryModalActions}>
              <button type="button" onClick={() => setRetryModelSample(null)} style={styles.confirmCancel}>Batal</button>
              <button type="button" onClick={() => {
                const sampleId = retryModelSample.id;
                const modelId = retryFamily === 'alvin' ? selectedAlvinChoice : selectedFawwasChoice;
                setRetryModelSample(null);
                handleEvaluateSingle(sampleId, modelId);
              }} className="btn-primary" style={styles.retryRunButton}>Uji Model</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteTarget && createPortal(
        <div style={styles.confirmOverlay} onClick={() => setDeleteTarget(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-sample-title" style={styles.confirmDialog} onClick={(event) => event.stopPropagation()}>
            <h3 id="delete-sample-title" style={styles.confirmTitle}>Hapus sampel?</h3>
            <p style={styles.confirmText}>{deleteTarget.fileName}</p>
            <div style={styles.confirmActions}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={styles.confirmCancel}>Batal</button>
              <button type="button" onClick={handleDeleteSample} style={styles.confirmDelete}>Hapus</button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    maxWidth: '920px',
    margin: '0 auto',
    paddingBottom: '50px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
  },
  headerIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'var(--primary-glow)',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: '700',
    fontFamily: 'var(--font-display)',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: '1.45',
    margin: 0,
    maxWidth: '560px',
  },
  newDetectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 18px',
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontWeight: '600',
  },
  statValue: {
    fontSize: '1.4rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: '260px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: 'var(--surface)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  filterTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  filterBtn: {
    padding: '7px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'rgba(255, 255, 255, 0.02)',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  filterBtnActive: {
    background: 'var(--primary)',
    color: '#FFFFFF',
    borderColor: 'var(--primary)',
  },
  refreshBtn: {
    padding: '7px 10px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    marginBottom: '16px',
    padding: '12px 16px',
    borderRadius: '12px',
    background: 'rgba(255, 77, 77, 0.1)',
    border: '1px solid rgba(255, 77, 77, 0.4)',
    color: '#ff8d8d',
    fontSize: '0.85rem',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 24px',
    gap: '14px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(0, 102, 255, 0.2)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    marginTop: '16px',
    marginBottom: '6px',
  },
  emptyDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    maxWidth: '520px',
    lineHeight: '1.5',
  },
  samplesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sampleCard: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sampleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  sampleHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
  },
  audioWaveIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'rgba(0, 102, 255, 0.12)',
    border: '1px solid rgba(0, 102, 255, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sampleFileName: {
    fontSize: '1rem',
    fontWeight: '700',
    margin: '0 0 4px 0',
  },
  sampleMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontFamily: 'inherit',
  },
  metaBadge: {
    padding: 0,
    border: 'none',
    color: 'var(--text-muted)',
  },
  sampleHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s ease',
  },
  audioPlayerContainer: {
    width: '100%',
    background: 'transparent',
    padding: 0,
  },
  nativeAudio: {
    width: '100%',
    height: '40px',
    outline: 'none',
  },
  evaluationsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  evalSectionTitle: {
    fontSize: '0.7rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  evalCardsGrid: {
    display: 'flex',
    flexDirection: 'column',
  },
  evalCard: {
    padding: '12px 0',
    borderBottom: '1px solid var(--border)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    alignItems: 'center',
    gap: '16px',
  },
  evalCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  evalModelName: {
    fontSize: '0.85rem',
    fontWeight: '700',
  },
  evalBadge: {
    fontSize: '0.7rem',
    fontWeight: '600',
    padding: '0',
    border: 'none',
    letterSpacing: 0,
  },
  evalCardMetrics: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    paddingTop: '8px',
  },
  metricItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricLabel: {
    fontSize: '0.66rem',
    color: 'var(--text-muted)',
  },
  metricVal: {
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  openReportMiniBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontSize: '0.74rem',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '4px 0',
    whiteSpace: 'nowrap',
  },
  actionToolbar: {
    background: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
  },
  retryButton: { padding: '9px 14px', borderRadius: '10px', border: '1px solid var(--primary)', background: 'var(--primary-glow)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' },
  actionToolbarHeader: {
    fontSize: '0.7rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    color: 'var(--primary)',
    letterSpacing: '0.05em',
  },
  actionControlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    minWidth: '220px',
  },
  actionSelect: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '0.78rem',
    outline: 'none',
    cursor: 'pointer',
  },
  runAlvinBtn: {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(0, 102, 255, 0.4)',
    background: 'rgba(0, 102, 255, 0.15)',
    color: 'var(--primary)',
    fontSize: '0.76rem',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  runFawwasBtn: {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(0, 165, 114, 0.4)',
    background: 'rgba(0, 165, 114, 0.15)',
    color: '#00A572',
    fontSize: '0.76rem',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  compareBtn: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid var(--primary)',
    background: 'var(--primary-glow)',
    color: 'var(--primary)',
    fontSize: '0.76rem',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  evaluatingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.78rem',
    color: 'var(--primary)',
    paddingTop: '6px',
  },
  smallSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(0, 102, 255, 0.3)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(11, 19, 38, 0.85)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  confirmOverlay: { position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(11, 19, 38, .68)', backdropFilter: 'blur(4px)' },
  confirmDialog: { width: '100%', maxWidth: '400px', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 24px 80px rgba(0,0,0,.28)' },
  confirmTitle: { margin: '0 0 8px', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text)' },
  confirmText: { margin: '0 0 22px', fontSize: '.88rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' },
  confirmActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  confirmCancel: { padding: '10px 16px', borderRadius: '9px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '.85rem', fontWeight: '600', cursor: 'pointer' },
  confirmDelete: { padding: '10px 18px', borderRadius: '9px', border: '1px solid #DC2626', background: '#DC2626', color: '#fff', fontSize: '.85rem', fontWeight: '700', cursor: 'pointer' },
  modalContent: {
    width: '100%',
    maxWidth: '680px',
    padding: '28px',
    background: 'var(--card-bg)',
    backdropFilter: 'blur(25px)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  retryModal: { width: '100%', maxWidth: '400px', padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 24px 80px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', gap: '14px' },
  familyPicker: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  familyButton: { padding: '10px', borderRadius: '9px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: '700' },
  familyButtonAlvinActive: { borderColor: 'var(--primary)', background: 'var(--primary-glow)', color: 'var(--primary)' },
  familyButtonFawwasActive: { borderColor: '#00A572', background: 'rgba(0,165,114,.1)', color: '#00A572' },
  retrySelect: { width: '100%', padding: '11px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.88rem' },
  retryModalActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' },
  retryRunButton: { flex: 1 },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    margin: '0 0 4px 0',
  },
  modalSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.2rem',
    cursor: 'pointer',
  },
  compareColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  },
  compareCol: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  compareColHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  badgePrimary: {
    alignSelf: 'flex-start',
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '10px',
    background: 'rgba(0, 102, 255, 0.2)',
    color: 'var(--primary)',
  },
  badgeSecondary: {
    alignSelf: 'flex-start',
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '10px',
    background: 'rgba(0, 165, 114, 0.2)',
    color: '#00A572',
  },
  colModelName: {
    fontSize: '0.95rem',
    fontWeight: '700',
    margin: 0,
  },
  decisionPill: {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid',
    fontSize: '0.82rem',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: '0.04em',
  },
  compareMetaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '0.8rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    paddingTop: '10px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'var(--text-muted)',
  },
  modalFooter: {
    paddingTop: '10px',
  },
};

export default ResultsCollectionScreen;
