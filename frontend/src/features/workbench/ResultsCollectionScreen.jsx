import React, { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import { useApp } from '../../context/AppContext';

const ALVIN_OPTIONS = [
  { id: 'alvin_B4', label: 'B4: XGBoost (280 Fitur) — Rekomendasi' },
  { id: 'alvin_B0', label: 'B0: SVM RBF (MFCC 240 Fitur)' },
  { id: 'alvin_B1', label: 'B1: SVM RBF (LFCC 40 Fitur)' },
  { id: 'alvin_B2', label: 'B2: SVM RBF (MFCC + LFCC 280 Fitur)' },
  { id: 'alvin_B3', label: 'B3: Random Forest (280 Fitur)' },
  { id: 'alvin_E4c', label: 'E4c: SVM RBF (Residual + Modulasi · 22 Fitur)' },
];

const FAWWAS_OPTIONS = [
  { id: 'fawwas_rerec_knn_5', label: 'KNN N=5 (204 Fitur Akustik) — Stabil' },
  { id: 'fawwas_rerec_knn_3', label: 'KNN N=3 (Sensitif Jarak Dekat)' },
  { id: 'fawwas_rerec_knn_7', label: 'KNN N=7 (Konservatif Voting)' },
];

const ResultsCollectionScreen = ({ onStartNewDetection, onViewReport }) => {
  const { backendUrl, theme, alvinModel, fawwasModel } = useApp();
  const isDark = theme === 'dark';

  const [samples, setSamples] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'real', 'fake'
  const [evaluatingSampleId, setEvaluatingSampleId] = useState(null);
  const [evaluatingAction, setEvaluatingAction] = useState('');
  const [selectedAlvinChoice, setSelectedAlvinChoice] = useState(() => `alvin_${alvinModel || 'B4'}`);
  const [selectedFawwasChoice, setSelectedFawwasChoice] = useState(() => `fawwas_${fawwasModel || 'rerec_knn_5'}`);
  const [errorMessage, setErrorMessage] = useState('');
  const [compareModalData, setCompareModalData] = useState(null);

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
    setEvaluatingAction(modelId.startsWith('alvin') ? 'Menguji Model Alvin...' : 'Menguji Model Fawwas...');
    setErrorMessage('');

    try {
      const res = await fetch(`${backendUrl}/api/samples/${sampleId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Evaluasi gagal.');
      }

      setSamples((prev) =>
        prev.map((s) => (s.id === sampleId ? data.sample : s))
      );
    } catch (err) {
      setErrorMessage(`Gagal mengeksekusi model: ${err.message}`);
    } finally {
      setEvaluatingSampleId(null);
      setEvaluatingAction('');
    }
  };

  const handleCompareBoth = async (sample) => {
    setEvaluatingSampleId(sample.id);
    setEvaluatingAction('Membandingkan Model Alvin vs Fawwas secara paralel...');
    setErrorMessage('');

    try {
      const res = await fetch(`${backendUrl}/api/samples/${sample.id}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alvin_model: selectedAlvinChoice,
          fawwas_model: selectedFawwasChoice,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Komparasi gagal.');
      }

      setSamples((prev) =>
        prev.map((s) => (s.id === sample.id ? data.sample : s))
      );
      setCompareModalData({
        fileName: sample.fileName,
        alvin: data.alvin,
        fawwas: data.fawwas,
      });
    } catch (err) {
      setErrorMessage(`Gagal melakukan komparasi model: ${err.message}`);
    } finally {
      setEvaluatingSampleId(null);
      setEvaluatingAction('');
    }
  };

  const handleDeleteSample = async (sampleId) => {
    if (!window.confirm('Hapus sampel ini dari kumpulan hasil?')) return;
    try {
      const res = await fetch(`${backendUrl}/api/samples/${sampleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSamples((prev) => prev.filter((s) => s.id !== sampleId));
      }
    } catch {
      alert('Gagal menghapus sampel.');
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

    if (filterTab === 'real') return sample.lastIsAuthentic === true;
    if (filterTab === 'fake') return sample.lastIsAuthentic === false;
    return true;
  });

  const totalCount = samples.length;
  const realCount = samples.filter((s) => s.lastIsAuthentic === true).length;
  const fakeCount = samples.filter((s) => s.lastIsAuthentic === false).length;

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Header with Title and Quick Stats */}
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <div style={styles.headerIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5M12 2L2 7l10 5 10-5-10-5z"/>
              </svg>
            </div>
            <div>
              <h2 style={styles.title}>Kumpulan Hasil & Uji</h2>
              <p style={styles.subtitle}>
                Daftar audio teruji. Uji ulang lintas Model Alvin atau Model Fawwas tanpa perlu upload lagi.
              </p>
            </div>
          </div>
        </div>

        <button onClick={onStartNewDetection} className="btn-primary" style={styles.newDetectBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Deteksi Audio Baru</span>
        </button>
      </div>

      {/* Quick Statistics Bar */}
      <div style={styles.statsGrid}>
        <GlassCard padding="14px 18px" style={styles.statCard}>
          <span style={styles.statLabel}>Total Sampel Tersimpan</span>
          <span style={styles.statValue}>{totalCount}</span>
        </GlassCard>
        <GlassCard padding="14px 18px" style={styles.statCard}>
          <span style={{ ...styles.statLabel, color: '#4EDEA3' }}>Terverifikasi Asli</span>
          <span style={{ ...styles.statValue, color: '#4EDEA3' }}>{realCount}</span>
        </GlassCard>
        <GlassCard padding="14px 18px" style={styles.statCard}>
          <span style={{ ...styles.statLabel, color: '#FF6B6B' }}>Terindikasi Deepfake</span>
          <span style={{ ...styles.statValue, color: '#FF6B6B' }}>{fakeCount}</span>
        </GlassCard>
        <GlassCard padding="14px 18px" style={styles.statCard}>
          <span style={styles.statLabel}>Mesin Tersedia</span>
          <span style={{ ...styles.statValue, fontSize: '1rem', color: 'var(--primary)' }}>
            Alvin (9) & Fawwas (5)
          </span>
        </GlassCard>
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

        <div style={styles.filterTabs}>
          <button
            onClick={() => setFilterTab('all')}
            style={{
              ...styles.filterBtn,
              ...(filterTab === 'all' ? styles.filterBtnActive : {}),
            }}
          >
            Semua ({totalCount})
          </button>
          <button
            onClick={() => setFilterTab('real')}
            style={{
              ...styles.filterBtn,
              ...(filterTab === 'real' ? styles.filterBtnActive : {}),
            }}
          >
            Suara Asli ({realCount})
          </button>
          <button
            onClick={() => setFilterTab('fake')}
            style={{
              ...styles.filterBtn,
              ...(filterTab === 'fake' ? styles.filterBtnActive : {}),
            }}
          >
            Deepfake ({fakeCount})
          </button>
          <button onClick={fetchSamples} style={styles.refreshBtn} title="Sinkronkan dengan server">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </button>
        </div>
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
            const isCurrentlyEvaluating = evaluatingSampleId === sample.id;

            return (
              <GlassCard key={sample.id} padding="20px 22px" style={styles.sampleCard}>
                {/* Sample Card Header */}
                <div style={styles.sampleHeader}>
                  <div style={styles.sampleHeaderLeft}>
                    <div style={styles.audioWaveIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      </svg>
                    </div>
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
                      onClick={() => handleDeleteSample(sample.id)}
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
                  <div style={styles.evalSectionTitle}>
                    <span>HASIL DETEKSI TERSIMPAN ({evals.length} MODEL TELAH DIUJI)</span>
                  </div>

                  <div style={styles.evalCardsGrid}>
                    {evals.map((entry, idx) => {
                      const isAuth = entry.isAuthentic;
                      const statusColor = isAuth ? (isDark ? '#4EDEA3' : '#059669') : '#FF4D4D';
                      const statusBg = isAuth ? 'rgba(78, 222, 163, 0.12)' : 'rgba(255, 77, 77, 0.12)';
                      const statusBorder = isAuth ? 'rgba(78, 222, 163, 0.3)' : 'rgba(255, 77, 77, 0.3)';

                      return (
                        <div
                          key={idx}
                          style={{
                            ...styles.evalCard,
                            borderColor: statusBorder,
                            background: statusBg,
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

                          <div style={styles.evalCardMetrics}>
                            <div style={styles.metricItem}>
                              <span style={styles.metricLabel}>Keyakinan</span>
                              <span style={{ ...styles.metricVal, color: statusColor }}>
                                {Math.round((entry.confidenceScore || 0) * 100)}%
                              </span>
                            </div>
                            <div style={styles.metricItem}>
                              <span style={styles.metricLabel}>Peluang Deepfake</span>
                              <span style={styles.metricVal}>
                                {Math.round((entry.prob_deepfake || 0) * 100)}%
                              </span>
                            </div>
                            <div style={styles.metricItem}>
                              <span style={styles.metricLabel}>Ambang Batas</span>
                              <span style={styles.metricVal}>
                                {Math.round((entry.threshold || 0.38) * 100)}%
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenReportFromEval(sample, entry)}
                            style={styles.openReportMiniBtn}
                          >
                            <span>Laporan</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="5" y1="12" x2="19" y2="12"/>
                              <polyline points="12 5 19 12 12 19"/>
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Instant Re-run Bar (NO RE-UPLOAD REQUIRED) */}
                <div style={styles.actionToolbar}>
                  <div style={styles.actionToolbarHeader}>
                    <span>⚡ UJI ULANG TANPA UPLOAD:</span>
                  </div>

                  <div style={styles.actionControlsRow}>
                    {/* Alvin Quick Run */}
                    <div style={styles.actionGroup}>
                      <select
                        value={selectedAlvinChoice}
                        onChange={(e) => setSelectedAlvinChoice(e.target.value)}
                        style={styles.actionSelect}
                        disabled={isCurrentlyEvaluating}
                      >
                        {ALVIN_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleEvaluateSingle(sample.id, selectedAlvinChoice)}
                        disabled={isCurrentlyEvaluating}
                        style={styles.runAlvinBtn}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        <span>Uji Alvin</span>
                      </button>
                    </div>

                    {/* Fawwas Quick Run */}
                    <div style={styles.actionGroup}>
                      <select
                        value={selectedFawwasChoice}
                        onChange={(e) => setSelectedFawwasChoice(e.target.value)}
                        style={styles.actionSelect}
                        disabled={isCurrentlyEvaluating}
                      >
                        {FAWWAS_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleEvaluateSingle(sample.id, selectedFawwasChoice)}
                        disabled={isCurrentlyEvaluating}
                        style={styles.runFawwasBtn}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        <span>Uji Fawwas</span>
                      </button>
                    </div>

                    {/* Compare Both (One Click) */}
                    <button
                      onClick={() => handleCompareBoth(sample)}
                      disabled={isCurrentlyEvaluating}
                      style={styles.compareBtn}
                      title="Jalankan Model Alvin dan Model Fawwas sekaligus pada audio ini"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="20" x2="18" y2="10"/>
                        <line x1="12" y1="20" x2="12" y2="4"/>
                        <line x1="6" y1="20" x2="6" y2="14"/>
                      </svg>
                      <span>⚡ Bandingkan Keduanya</span>
                    </button>
                  </div>

                  {isCurrentlyEvaluating && (
                    <div style={styles.evaluatingIndicator}>
                      <div style={styles.smallSpinner} />
                      <span>{evaluatingAction}</span>
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Comparative Modal */}
      {compareModalData && (
        <div style={styles.modalOverlay}>
          <div className="glass-container animate-fade-in" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Komparasi Lintas Model Alvin vs Fawwas</h3>
                <span style={styles.modalSubtitle}>Berkas: {compareModalData.fileName}</span>
              </div>
              <button onClick={() => setCompareModalData(null)} style={styles.closeModalBtn}>
                ✕
              </button>
            </div>

            <div style={styles.compareColumns}>
              {/* Alvin Result Card */}
              <div style={styles.compareCol}>
                <div style={styles.compareColHeader}>
                  <span style={styles.badgePrimary}>Model Alvin (Skripsi)</span>
                  <h4 style={styles.colModelName}>{compareModalData.alvin.modelName}</h4>
                </div>

                <div
                  style={{
                    ...styles.decisionPill,
                    background: compareModalData.alvin.isAuthentic
                      ? 'rgba(78, 222, 163, 0.15)'
                      : 'rgba(255, 77, 77, 0.15)',
                    color: compareModalData.alvin.isAuthentic ? '#4EDEA3' : '#FF4D4D',
                    borderColor: compareModalData.alvin.isAuthentic ? '#4EDEA3' : '#FF4D4D',
                  }}
                >
                  {compareModalData.alvin.isAuthentic ? 'SUARA ASLI (AUTENTIK)' : 'TERINDIKASI DEEPFAKE'}
                </div>

                <div style={styles.compareMetaList}>
                  <div style={styles.metaRow}>
                    <span>Keyakinan:</span>
                    <strong>{Math.round(compareModalData.alvin.confidenceScore * 100)}%</strong>
                  </div>
                  <div style={styles.metaRow}>
                    <span>Peluang Deepfake:</span>
                    <strong>{Math.round(compareModalData.alvin.prob_deepfake * 100)}%</strong>
                  </div>
                  <div style={styles.metaRow}>
                    <span>Threshold:</span>
                    <strong>{Math.round(compareModalData.alvin.threshold * 100)}%</strong>
                  </div>
                </div>
              </div>

              {/* Fawwas Result Card */}
              <div style={styles.compareCol}>
                <div style={styles.compareColHeader}>
                  <span style={styles.badgeSecondary}>Model Fawwas (Komparator)</span>
                  <h4 style={styles.colModelName}>{compareModalData.fawwas.modelName}</h4>
                </div>

                <div
                  style={{
                    ...styles.decisionPill,
                    background: compareModalData.fawwas.isAuthentic
                      ? 'rgba(78, 222, 163, 0.15)'
                      : 'rgba(255, 77, 77, 0.15)',
                    color: compareModalData.fawwas.isAuthentic ? '#4EDEA3' : '#FF4D4D',
                    borderColor: compareModalData.fawwas.isAuthentic ? '#4EDEA3' : '#FF4D4D',
                  }}
                >
                  {compareModalData.fawwas.isAuthentic ? 'SUARA ASLI (AUTENTIK)' : 'TERINDIKASI DEEPFAKE'}
                </div>

                <div style={styles.compareMetaList}>
                  <div style={styles.metaRow}>
                    <span>Keyakinan:</span>
                    <strong>{Math.round(compareModalData.fawwas.confidenceScore * 100)}%</strong>
                  </div>
                  <div style={styles.metaRow}>
                    <span>Peluang Deepfake:</span>
                    <strong>{Math.round(compareModalData.fawwas.prob_deepfake * 100)}%</strong>
                  </div>
                  <div style={styles.metaRow}>
                    <span>Threshold:</span>
                    <strong>{Math.round(compareModalData.fawwas.threshold * 100)}%</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setCompareModalData(null)} className="btn-primary" style={{ width: '100%' }}>
                Tutup Komparasi
              </button>
            </div>
          </div>
        </div>
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
    alignItems: 'flex-start',
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
    fontSize: '1.35rem',
    fontWeight: '800',
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
    gap: '18px',
  },
  sampleCard: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
    gap: '14px',
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
    fontFamily: 'var(--font-mono)',
  },
  metaBadge: {
    padding: '2px 6px',
    borderRadius: '6px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--primary)',
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
    background: 'rgba(0, 0, 0, 0.15)',
    borderRadius: '12px',
    padding: '8px 12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  nativeAudio: {
    width: '100%',
    height: '36px',
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
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '10px',
  },
  evalCard: {
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
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
    fontSize: '0.65rem',
    fontWeight: '800',
    padding: '3px 8px',
    borderRadius: '12px',
    border: '1px solid',
    letterSpacing: '0.04em',
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
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    padding: '4px 0',
  },
  actionToolbar: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
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
