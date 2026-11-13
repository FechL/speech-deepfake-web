import React, { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import { useApp } from '../../context/AppContext';

const AnalysisReportScreen = ({ 
  fileName, 
  fileFormat, 
  fileSize, 
  fileDuration, 
  aiModel, 
  isAuthentic, 
  score, 
  probAuthentic,
  probDeepfake,
  threshold,
  audioBytes,
  fileMimeType,
  onBackToDashboard,
  onTestAgain,
  onOpenWorkbench
}) => {
  const { theme } = useApp();
  const isDark = theme === 'dark';

  const [gaugeProgress, setGaugeProgress] = useState(0);
  const [audioUrl] = useState(() => {
    if (!audioBytes?.length) return '';
    const blob = new Blob([audioBytes], { type: fileMimeType || 'application/octet-stream' });
    return URL.createObjectURL(blob);
  });

  const validScore = Number.isFinite(score) ? score : (isAuthentic ? 0.95 : 0.85);
  const pAuth = Number.isFinite(probAuthentic) ? probAuthentic : (isAuthentic ? validScore : 1 - validScore);
  const pFake = Number.isFinite(probDeepfake) ? probDeepfake : (isAuthentic ? 1 - validScore : validScore);
  const pThresh = Number.isFinite(threshold) ? threshold : 0.38;

  useEffect(() => {
    let current = 0;
    const target = validScore;
    const interval = setInterval(() => {
      current += 0.02;
      if (current >= target) {
        setGaugeProgress(target);
        clearInterval(interval);
      } else {
        setGaugeProgress(current);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [validScore]);

  useEffect(() => {
    if (!audioUrl) return undefined;
    return () => {
      URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleDownloadReport = () => {
    const statusText = isAuthentic ? 'SUARA ASLI (AUTENTIK)' : 'TERINDIKASI DEEPFAKE (SUARA PALSU)';
    const reportText = `=====================================================
            LAPORAN FORENSIK AUDIO DEEPGUARD AI
=====================================================
Tanggal Analisis : ${new Date().toLocaleString('id-ID')}
Nama Berkas      : ${fileName}
Format Berkas    : ${fileFormat}
Ukuran Berkas    : ${fileSize}
Durasi Berkas    : ${fileDuration}
Mesin Detektor   : ${aiModel}
-----------------------------------------------------
HASIL KEPUTUSAN  : ${statusText}
Tingkat Keyakinan: ${(validScore * 100).toFixed(1)}%
Peluang Asli     : ${(pAuth * 100).toFixed(1)}%
Peluang Deepfake : ${(pFake * 100).toFixed(1)}%
Ambang Batas (Th): ${(pThresh * 100).toFixed(1)}%
-----------------------------------------------------
REKOMENDASI INVESTIGASI:
${
  isAuthentic
    ? '- KESIMPULAN: Audio teridentifikasi sebagai rekaman ASLI.\n- Pola spektral dan akustik alami suara manusia terpenuhi.\n- Tidak ditemukan anomali generative AI vokal.'
    : '- KESIMPULAN: Audio teridentifikasi sebagai SUARA PALSU / DEEPFAKE.\n- Ditemukan pola sintesis suara AI atau rekaman ulang (re-recording).\n- Amankan berkas asli untuk validasi forensik lebih lanjut.'
}
=====================================================
      DeepGuard AI Forensic Lab - Verifikasi Mandiri
=====================================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan_forensik_${fileName.replace(/\.[^/.]+$/, "")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // High contrast color styling
  const statusColor = isAuthentic 
    ? (isDark ? '#4EDEA3' : '#059669') 
    : (isDark ? '#FF6B6B' : '#DC2626');

  const statusBg = isAuthentic
    ? (isDark ? 'rgba(78, 222, 163, 0.16)' : '#D1FAE5')
    : (isDark ? 'rgba(255, 77, 77, 0.16)' : '#FEE2E2');

  const statusBorder = isAuthentic
    ? (isDark ? '#4EDEA3' : '#10B981')
    : (isDark ? '#FF4D4D' : '#EF4444');

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (gaugeProgress * circumference);

  return (
    <div style={styles.container} className="animate-fade-in">
      <header style={styles.header}>
        <button onClick={onBackToDashboard} style={styles.backBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span>Beranda</span>
        </button>
        <h2 style={styles.title}>Laporan Deteksi</h2>
        <div style={{ width: '80px' }} />
      </header>

      <div style={styles.fileNameRow}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        <span style={styles.fileNameText} title={fileName}>{fileName}</span>
      </div>

      {/* Prominent Decision Banner */}
      <div 
        style={{
          ...styles.decisionBanner,
          background: statusBg,
          borderColor: statusBorder,
          color: statusColor,
          boxShadow: isDark ? `0 0 25px ${statusColor}33` : '0 4px 12px rgba(0,0,0,0.06)'
        }}
      >
        <div style={styles.bannerIconBox}>
          {isAuthentic ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 11 11 13 15 9"/>
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2.5">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <circle cx="12" cy="17" r="1"/>
            </svg>
          )}
        </div>
        <div style={styles.bannerTextCol}>
          <div style={styles.bannerHeadline}>
            {isAuthentic ? 'SUARA ASLI (AUTENTIK)' : 'TERINDIKASI DEEPFAKE'}
          </div>
          <div style={{ ...styles.bannerSubtext, color: isDark ? 'var(--text)' : '#1F2937' }}>
            {isAuthentic
              ? 'Audio teridentifikasi sebagai rekaman suara asli manusia.'
              : 'Audio terindikasi memiliki pola sintesis atau manipulasi deepfake.'}
          </div>
        </div>
      </div>

      <div style={styles.grid} className="report-grid">
        {/* Left Column: Gauge and Probabilities */}
        <div style={styles.playerColumn}>
          <GlassCard padding="24px" borderColor={`${statusColor}44`} style={styles.playerCard}>
            <div style={styles.gaugeSection}>
              <div style={styles.gaugeWrapper}>
                <svg width="150" height="150" viewBox="0 0 120 120" style={styles.gaugeSvg}>
                  <circle 
                    cx="60" 
                    cy="60" 
                    r={radius} 
                    fill="none" 
                    stroke={isDark ? "rgba(255,255,255,0.06)" : "#E5E7EB"} 
                    strokeWidth="11" 
                  />
                  <circle 
                    cx="60" 
                    cy="60" 
                    r={radius} 
                    fill="none" 
                    stroke={statusColor} 
                    strokeWidth="11" 
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.1s ease' }}
                  />
                </svg>
                <div style={styles.scoreTextWrapper}>
                  <span style={{ ...styles.scoreNumber, color: statusColor }}>
                    {Math.round(gaugeProgress * 100)}%
                  </span>
                  <span style={styles.scoreLabel}>
                    {isAuthentic ? 'KEYAKINAN ASLI' : 'KEYAKINAN DEEPFAKE'}
                  </span>
                </div>
              </div>
              <span style={styles.gaugeCaption}>
                {isAuthentic ? 'Tingkat Keyakinan Suara Asli' : 'Tingkat Keyakinan Deepfake'}
              </span>
            </div>

            {/* Probability Breakdown Bars */}
            <div style={styles.probCard}>
              <div style={styles.probHeader}>PROBABILITAS KEPUTUSAN</div>
              
              <div style={styles.probRow}>
                <div style={styles.probMeta}>
                  <span style={styles.probTitle}>
                    <span style={{ color: isDark ? '#4EDEA3' : '#059669', marginRight: '6px' }}>●</span>
                    Peluang Suara Asli
                  </span>
                  <span style={{ ...styles.probVal, color: isDark ? '#4EDEA3' : '#059669' }}>
                    {(pAuth * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={styles.probTrack}>
                  <div style={{ ...styles.probFill, width: `${Math.min(100, Math.max(0, pAuth * 100))}%`, background: isDark ? '#4EDEA3' : '#059669' }} />
                </div>
              </div>

              <div style={styles.probRow}>
                <div style={styles.probMeta}>
                  <span style={styles.probTitle}>
                    <span style={{ color: isDark ? '#FF6B6B' : '#DC2626', marginRight: '6px' }}>●</span>
                    Peluang Deepfake (Palsu)
                  </span>
                  <span style={{ ...styles.probVal, color: isDark ? '#FF6B6B' : '#DC2626' }}>
                    {(pFake * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={styles.probTrack}>
                  <div style={{ ...styles.probFill, width: `${Math.min(100, Math.max(0, pFake * 100))}%`, background: isDark ? '#FF6B6B' : '#DC2626' }} />
                </div>
              </div>

              <div style={styles.thresholdNotice}>
                Ambang Batas Deteksi (Threshold): <strong>{(pThresh * 100).toFixed(1)}%</strong>
                <div style={{ fontSize: '0.72rem', marginTop: '2px', color: 'var(--text-muted)' }}>
                  {pFake >= pThresh 
                    ? `Peluang deepfake (${(pFake*100).toFixed(1)}%) melebihi ambang batas (${(pThresh*100).toFixed(1)}%) → PALSU`
                    : `Peluang deepfake (${(pFake*100).toFixed(1)}%) di bawah ambang batas (${(pThresh*100).toFixed(1)}%) → ASLI`}
                </div>
              </div>
            </div>

            {/* Audio Waveform Player */}
            <div style={styles.audioPlayer}>
              <div style={styles.playerLabel}>DENGARKAN AUDIO:</div>
              {audioUrl ? (
                <audio controls src={audioUrl} style={styles.audioElement}>
                  Browser Anda tidak mendukung pemutar audio.
                </audio>
              ) : (
                <span style={styles.audioUnavailable}>Audio tidak disimpan di riwayat lokal.</span>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Specifications & Recommendations */}
        <div style={styles.infoColumn}>
          <GlassCard padding="20px" style={styles.infoCard}>
            <h4 style={styles.sectionTitle}>Spesifikasi Berkas & Model</h4>
            <div style={styles.metaTable}>
              <div style={styles.tableRow}>
                <span style={styles.tableLabel}>Nama File</span>
                <span style={styles.tableValue} title={fileName}>{fileName}</span>
              </div>
              <div style={styles.tableRow}>
                <span style={styles.tableLabel}>Ukuran File</span>
                <span style={styles.tableValue}>{fileSize}</span>
              </div>
              <div style={styles.tableRow}>
                <span style={styles.tableLabel}>Format Audio</span>
                <span style={styles.tableValue}>{fileFormat}</span>
              </div>
              <div style={styles.tableRow}>
                <span style={styles.tableLabel}>Durasi</span>
                <span style={styles.tableValue}>{fileDuration}</span>
              </div>
              <div style={styles.tableRow}>
                <span style={styles.tableLabel}>Mesin Deteksi</span>
                <span style={{ ...styles.tableValue, color: 'var(--primary)', fontWeight: '700' }}>
                  {aiModel}
                </span>
              </div>
              <div style={styles.tableRow}>
                <span style={styles.tableLabel}>Status Klasifikasi</span>
                <span style={{ ...styles.tableValue, color: statusColor, fontWeight: '800' }}>
                  {isAuthentic ? 'ASLI' : 'DEEPFAKE'}
                </span>
              </div>
            </div>
          </GlassCard>

          <GlassCard padding="20px" style={{ ...styles.infoCard, marginTop: '16px' }}>
            <h4 style={styles.sectionTitle}>Catatan Analisis</h4>
            <div style={styles.recommendationContent}>
              <div 
                style={{
                  ...styles.recIconBox,
                  background: statusBg,
                  color: statusColor
                }}
              >
                {isAuthentic ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <polyline points="9 11 11 13 15 9"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                  </svg>
                )}
              </div>
              <div style={styles.recommendationText}>
                {isAuthentic ? (
                  <>
                    <strong style={{ color: statusColor, display: 'block', marginBottom: '4px' }}>
                      Suara Asli:
                    </strong>
                    Pola spektral dan akustik konsisten dengan rekaman suara alami.
                  </>
                ) : (
                  <>
                    <strong style={{ color: statusColor, display: 'block', marginBottom: '4px' }}>
                      Peringatan Deepfake:
                    </strong>
                    Terdeteksi pola sintesis AI vokal atau indikasi rekaman ulang (re-recording).
                  </>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Quick Model Comparison Box */}
          <div style={styles.compareBox}>
            <div style={styles.compareTitle}>Uji Pembanding</div>
            <div style={styles.compareDesc}>
              {aiModel.includes('Alvin') 
                ? 'Uji audio ini dengan Model Fawwas (KNN Forensik) untuk perbandingan.'
                : 'Uji audio ini dengan Model Alvin B4 (XGBoost) untuk perbandingan.'}
            </div>
            {onTestAgain && (
              <button onClick={onTestAgain} style={styles.switchModelBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                <span>Uji Ulang dengan Model Lain</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <footer style={styles.footerActions}>
        <button onClick={onBackToDashboard} style={styles.homeBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          <span>Kembali Ke Beranda</span>
        </button>

        {onOpenWorkbench && (
          <button onClick={onOpenWorkbench} style={styles.workbenchBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5M12 2L2 7l10 5 10-5-10-5z"/>
            </svg>
            <span>Kumpulan Hasil & Uji Ulang</span>
          </button>
        )}

        <button onClick={handleDownloadReport} className="btn-primary" style={styles.downloadBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 3v12"/>
          </svg>
          <span>UNDUH LAPORAN FORENSIK (.TXT)</span>
        </button>
      </footer>

      <style>{`
        .report-grid {
          display: flex;
          gap: 20px;
        }
        .report-grid > div:first-child {
          flex: 1.35;
        }
        .report-grid > div:last-child {
          flex: 1;
        }
        @media (max-width: 650px) {
          .report-grid {
            flex-direction: column;
          }
          .report-grid > div {
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
    maxWidth: '840px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
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
  fileNameRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    color: 'var(--text)',
    width: '100%',
  },
  fileNameText: {
    fontSize: '0.95rem',
    fontWeight: '700',
    maxWidth: '360px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: 'var(--font-label)',
  },
  decisionBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    borderRadius: '16px',
    borderWidth: '2px',
    borderStyle: 'solid',
    marginBottom: '24px',
  },
  bannerIconBox: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  bannerHeadline: {
    fontSize: '1.15rem',
    fontWeight: '900',
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-display)',
  },
  bannerSubtext: {
    fontSize: '0.82rem',
    lineHeight: '1.4',
    fontWeight: '500',
  },
  grid: {
    width: '100%',
  },
  playerColumn: {
    display: 'flex',
  },
  playerCard: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  gaugeSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
  },
  gaugeWrapper: {
    position: 'relative',
    width: '150px',
    height: '150px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  scoreTextWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: '2.4rem',
    fontWeight: '900',
    fontFamily: 'var(--font-display)',
    lineHeight: '1',
  },
  scoreLabel: {
    fontSize: '0.62rem',
    fontWeight: '800',
    color: 'var(--text-muted)',
    letterSpacing: '0.06em',
    fontFamily: 'var(--font-label)',
    marginTop: '4px',
  },
  gaugeCaption: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  probCard: {
    width: '100%',
    background: 'rgba(0, 0, 0, 0.15)',
    borderRadius: '14px',
    padding: '14px',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  probHeader: {
    fontSize: '0.68rem',
    fontWeight: '800',
    letterSpacing: '0.08em',
    color: 'var(--primary)',
    fontFamily: 'var(--font-label)',
  },
  probRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  probMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.8rem',
  },
  probTitle: {
    fontWeight: '600',
    color: 'var(--text)',
  },
  probVal: {
    fontWeight: '800',
    fontFamily: 'var(--font-label)',
  },
  probTrack: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  probFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
  thresholdNotice: {
    marginTop: '4px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '0.75rem',
    color: 'var(--text)',
  },
  audioPlayer: {
    width: '100%',
    background: 'rgba(0, 0, 0, 0.12)',
    borderRadius: '14px',
    padding: '12px',
    border: '1px solid var(--border)',
  },
  playerLabel: {
    fontSize: '0.68rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    marginBottom: '8px',
    fontFamily: 'var(--font-label)',
  },
  audioElement: {
    width: '100%',
  },
  audioUnavailable: {
    display: 'block',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    textAlign: 'center',
  },
  infoColumn: {
    display: 'flex',
    flexDirection: 'column',
  },
  infoCard: {
    width: '100%',
    background: 'var(--card-bg)',
  },
  sectionTitle: {
    fontSize: '0.95rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    marginBottom: '14px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '8px',
  },
  metaTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  tableRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.82rem',
  },
  tableLabel: {
    color: 'var(--text-muted)',
  },
  tableValue: {
    fontWeight: '600',
    color: 'var(--text)',
    maxWidth: '160px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  recommendationContent: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  recIconBox: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  recommendationText: {
    fontSize: '0.82rem',
    lineHeight: '1.45',
    color: 'var(--text)',
  },
  compareBox: {
    marginTop: '16px',
    padding: '16px',
    borderRadius: '14px',
    background: 'var(--card-bg)',
    border: '1px dashed var(--primary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  compareTitle: {
    fontSize: '0.85rem',
    fontWeight: '800',
    color: 'var(--primary)',
  },
  compareDesc: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  switchModelBtn: {
    marginTop: '4px',
    padding: '8px 14px',
    borderRadius: '8px',
    background: 'var(--primary-glow)',
    border: '1px solid var(--primary)',
    color: 'var(--primary)',
    fontSize: '0.78rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  },
  footerActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '28px',
    width: '100%',
    gap: '16px',
  },
  homeBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '14px 20px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  workbenchBtn: {
    background: 'var(--primary-glow)',
    border: '1px solid var(--primary)',
    color: 'var(--primary)',
    padding: '14px 20px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  },
  downloadBtn: {
    flex: 1,
  },
};

export default AnalysisReportScreen;
