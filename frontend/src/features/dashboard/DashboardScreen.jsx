import React from 'react';
import { useApp } from '../../context/AppContext';
import GlassCard from '../../components/GlassCard';
import GridBackground from '../../components/GridBackground';

const DashboardScreen = ({ onStartDetection, onViewReport, onViewAllHistory }) => {
  const { history, theme } = useApp();
  const isDark = theme === 'dark';

  const formatTimeAgo = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Beberapa saat lalu';
    }
  };

  const recentItems = history.slice(0, 10);

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.bentoGrid} className="bento-layout">
        <div style={styles.actionCardWrapper}>
          <div 
            onClick={onStartDetection} 
            style={styles.actionCard}
            className="glass-container"
          >
            <GridBackground showScanner={true} />
            <div style={styles.cardGlow} className="ambient-glow" />

            <div style={styles.actionCardContent}>
              <div style={styles.cardHeader}>
                <div style={styles.iconBox}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                  </svg>
                </div>
                <div style={styles.actionBadge}>AKSI UTAMA</div>
              </div>

              <div style={styles.cardTextGroup}>
                <h2 style={styles.cardTitle}>Mulai Deteksi</h2>
                <p style={styles.cardDesc}>
                  Unggah atau rekam audio untuk deteksi suara asli vs deepfake.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.statsCardWrapper}>
          <GlassCard padding="24px" style={styles.statsCard}>
            <div style={styles.statsHeader}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <path d="M3 3v18h18"/>
                <path d="m19 9-5 5-4-4-3 3"/>
              </svg>
              <span style={styles.statsTitle}>TOTAL DIANALISIS</span>
            </div>
            
            <div style={styles.statsValueRow}>
              <span style={styles.statsNum}>{history.length}</span>
              <span style={styles.statsUnit}>File</span>
            </div>

            <div style={styles.progressTrack}>
              <div 
                style={{
                  ...styles.progressIndicator,
                  width: `${history.length === 0 ? 0 : ((history.length % 10) / 10) * 100}%`
                }}
              />
            </div>

          </GlassCard>
        </div>
      </div>

      <section style={styles.historySection}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
              <path d="M8 11h6M11 8v6"/>
            </svg>
            <h3 style={styles.sectionTitleText}>Riwayat Deteksi</h3>
          </div>
          {history.length > 10 && (
            <button onClick={onViewAllHistory} style={styles.viewAllBtn}>
              LIHAT SEMUA ({history.length})
            </button>
          )}
        </div>

        <div style={styles.feedList}>
          {history.length === 0 ? (
            <div style={styles.emptyFeed} className="glass-container">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ opacity: 0.5 }}>
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <h4 style={styles.emptyTitle}>Belum ada riwayat deteksi</h4>
              <p style={styles.emptyDesc}>
                Unggah atau rekam audio untuk memulai analisis.
              </p>
            </div>
          ) : (
            recentItems.map((item) => {
              const statusColor = item.isAuthentic
                ? (isDark ? '#4EDEA3' : '#00A572')
                : '#FF4D4D';
              const cardBorder = item.isAuthentic
                ? 'rgba(78, 222, 163, 0.2)'
                : 'rgba(255, 77, 77, 0.25)';

              return (
                <GlassCard 
                  key={item.id} 
                  padding="14px 16px" 
                  borderColor={cardBorder}
                  onClick={() => onViewReport(item)}
                  style={styles.feedCard}
                >
                  <div style={styles.feedCardLeft}>
                    <div style={{ ...styles.statusIconBox, background: `${statusColor}1A`, border: `1px solid ${statusColor}33` }}>
                      {item.isAuthentic ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2.5">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                      )}
                    </div>
                    <div style={styles.fileDetails}>
                      <span style={styles.fileName}>{item.fileName}</span>
                      <span style={styles.timeAgo}>{formatTimeAgo(item.analyzedAt)}</span>
                    </div>
                  </div>
                  <div style={{ ...styles.statusBadge, color: statusColor, background: `${statusColor}1A`, borderColor: `${statusColor}66` }}>
                    {item.isAuthentic ? 'ASLI' : 'DEEPFAKE'}
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      </section>

      <style>{`
        .bento-layout {
          display: flex;
          gap: 16px;
        }
        .bento-layout > div {
          flex: 1;
        }
        .bento-layout > div:first-child {
          flex: 2;
        }
        @media (max-width: 650px) {
          .bento-layout {
            flex-direction: column;
          }
          .bento-layout > div {
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
  bentoGrid: {
    width: '100%',
    marginBottom: '32px',
  },
  actionCardWrapper: {
    display: 'flex',
  },
  actionCard: {
    width: '100%',
    minHeight: '240px',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  cardGlow: {
    position: 'absolute',
    bottom: '-50px',
    right: '-50px',
    width: '150px',
    height: '150px',
    background: 'var(--primary-glow)',
  },
  actionCardContent: {
    position: 'relative',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 1,
    padding: '24px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  iconBox: {
    width: '56px',
    height: '56px',
    background: 'var(--card-high)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.3s ease',
  },
  actionBadge: {
    fontSize: '0.65rem',
    fontWeight: '800',
    color: 'var(--primary)',
    background: 'var(--primary-glow)',
    border: '1px solid var(--border)',
    padding: '4px 10px',
    borderRadius: '12px',
    letterSpacing: '0.05em',
  },
  cardTextGroup: {
    marginTop: '24px',
  },
  cardTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    color: 'var(--primary)',
    marginBottom: '6px',
  },
  cardDesc: {
    fontSize: '0.9rem',
    lineHeight: '1.4',
    color: 'var(--text-muted)',
  },
  statsCardWrapper: {
    display: 'flex',
  },
  statsCard: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '240px',
  },
  statsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statsTitle: {
    fontSize: '0.7rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-label)',
  },
  statsValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    margin: '24px 0',
  },
  statsNum: {
    fontSize: '3.5rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    color: 'var(--primary)',
    lineHeight: '1',
  },
  statsUnit: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
  },
  progressTrack: {
    width: '100%',
    height: '6px',
    background: 'var(--card-highest)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressIndicator: {
    height: '100%',
    background: 'var(--primary)',
    borderRadius: '3px',
    transition: 'width 0.5s ease',
  },
  historySection: {
    width: '100%',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionTitleText: {
    fontSize: '1.25rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    color: 'var(--text)',
  },
  viewAllBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontFamily: 'var(--font-label)',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  emptyFeed: {
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    background: 'rgba(23, 31, 51, 0.2)',
  },
  emptyTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text)',
    marginTop: '12px',
    marginBottom: '4px',
  },
  emptyDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    maxWidth: '320px',
    lineHeight: '1.4',
  },
  feedCard: {
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  feedCardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flex: 1,
    minWidth: 0,
  },
  statusIconBox: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  fileDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  fileName: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  timeAgo: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  statusBadge: {
    fontSize: '0.65rem',
    fontWeight: '800',
    fontFamily: 'var(--font-label)',
    padding: '4px 10px',
    borderRadius: '20px',
    border: '1px solid currentColor',
    flexShrink: 0,
    letterSpacing: '0.05em',
  },
};

export default DashboardScreen;
