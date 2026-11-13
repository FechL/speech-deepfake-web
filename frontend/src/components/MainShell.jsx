import React from 'react';
import { useApp } from '../context/AppContext';

const MainShell = ({ children, currentIndex, onTabChange }) => {
  const { theme, toggleTheme, logout, user } = useApp();

  return (
    <div className="app-layout">
      {/* Top Header Bar */}
      <header style={styles.topHeader} className="top-header">
        <div style={styles.brand}>
          <svg 
            width="22" 
            height="22" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="var(--primary)" 
            strokeWidth="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span style={styles.brandText}>DeepGuard</span>
        </div>
        <div style={styles.headerActions}>
          <button 
            onClick={toggleTheme} 
            style={styles.headerBtn}
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>
          <div style={styles.profileBadge} title={`${user.name} (${user.id})`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        </div>
      </header>

      {/* Navigation Rail / Sidebar */}
      <nav style={styles.sidebar} className="desktop-nav">
        <div style={styles.sidebarLead}>
          <div style={styles.sidebarLogo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>

        <div style={styles.sidebarMenu}>
          <button 
            style={{...styles.navItem, ...(currentIndex === 0 ? styles.navItemActive : {})}}
            onClick={() => onTabChange(0)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span style={styles.navLabel}>Beranda</span>
          </button>

          <button 
            style={{...styles.navItem, ...(currentIndex === 1 ? styles.navItemActive : {})}}
            onClick={() => onTabChange(1)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            </svg>
            <span style={styles.navLabel}>Deteksi</span>
          </button>

          <button 
            style={{...styles.navItem, ...(currentIndex === 2 ? styles.navItemActive : {})}}
            onClick={() => onTabChange(2)}
            title="Kumpulan Hasil & Workbench Forensik"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5M12 2L2 7l10 5 10-5-10-5z"/>
            </svg>
            <span style={styles.navLabel}>Hasil & Uji</span>
          </button>

          <button 
            style={{...styles.navItem, ...(currentIndex === 3 ? styles.navItemActive : {})}}
            onClick={() => onTabChange(3)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span style={styles.navLabel}>Setelan</span>
          </button>
        </div>

        <div style={styles.sidebarFoot}>
          <button onClick={logout} style={styles.logoutBtn} title="Keluar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="app-content">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav style={styles.bottomBar} className="mobile-nav">
        <button 
          style={{...styles.bottomBtn, ...(currentIndex === 0 ? styles.bottomBtnActive : {})}}
          onClick={() => onTabChange(0)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          <span>Beranda</span>
        </button>

        <button 
          style={{...styles.bottomBtn, ...(currentIndex === 1 ? styles.bottomBtnActive : {})}}
          onClick={() => onTabChange(1)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Deteksi</span>
        </button>

        <button 
          style={{...styles.bottomBtn, ...(currentIndex === 2 ? styles.bottomBtnActive : {})}}
          onClick={() => onTabChange(2)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5M12 2L2 7l10 5 10-5-10-5z"/>
          </svg>
          <span>Hasil</span>
        </button>

        <button 
          style={{...styles.bottomBtn, ...(currentIndex === 3 ? styles.bottomBtnActive : {})}}
          onClick={() => onTabChange(3)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Setelan</span>
        </button>
      </nav>

      <style>{`
        .top-header {
          left: 0 !important;
          width: 100% !important;
        }
        .desktop-nav {
          display: flex !important;
        }
        .mobile-nav {
          display: none !important;
        }
        @media (min-width: 651px) {
          .top-header {
            left: 88px !important;
            width: calc(100% - 88px) !important;
          }
        }
        @media (max-width: 650px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-nav {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
};

const styles = {
  topHeader: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '60px',
    background: 'var(--card-bg)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 20px',
    zIndex: 99,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  brandText: {
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
    fontSize: '1.2rem',
    color: 'var(--primary)',
    letterSpacing: '-0.3px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'background 0.3s ease',
  },
  profileBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--primary-glow)',
    border: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'help',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '88px',
    background: 'var(--card-bg)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRight: '1px solid var(--border)',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 0',
    zIndex: 100,
  },
  sidebarLogo: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'var(--primary-glow)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
    padding: '0 8px',
  },
  navItem: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    width: '100%',
    padding: '12px 0',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  navItemActive: {
    color: 'var(--primary)',
    background: 'var(--primary-glow)',
    border: '1px solid var(--border)',
  },
  navLabel: {
    fontSize: '0.65rem',
    fontWeight: '700',
    fontFamily: 'var(--font-label)',
  },
  sidebarFoot: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: '#FF6B6B',
    cursor: 'pointer',
    padding: '12px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'background 0.3s ease',
  },
  bottomBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: 'var(--card-bg)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid var(--border)',
    boxShadow: '0 -4px 20px rgba(0, 218, 243, 0.05)',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: 100,
  },
  bottomBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.65rem',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: 'var(--font-label)',
  },
  bottomBtnActive: {
    color: 'var(--primary)',
  },
};

export default MainShell;
