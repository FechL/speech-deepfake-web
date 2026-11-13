import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import GlassCard from '../../components/GlassCard';

const LoginScreen = ({ onRegisterClick }) => {
  const { login, theme, toggleTheme } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!email) {
      newErrors.email = 'Harap masukkan email';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Format email tidak valid';
    }
    
    if (!password) {
      newErrors.password = 'Harap masukkan kata sandi';
    } else if (password.length < 6) {
      newErrors.password = 'Kata sandi minimal 6 karakter';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      login(email, password);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.glowTop} className="ambient-glow" />
      <div style={styles.glowBottom} className="ambient-glow" />

      <button 
        onClick={toggleTheme} 
        style={styles.themeToggle}
        title="Ubah Tema"
      >
        {theme === 'dark' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        )}
      </button>

      <div className="animate-fade-in" style={styles.content}>
        <header style={styles.header}>
          <svg 
            width="32" 
            height="32" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="var(--primary)" 
            strokeWidth="2"
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <h1 style={styles.brandTitle}>DeepGuard</h1>
        </header>

        <GlassCard blur={15} padding="32px">
          <form onSubmit={handleSubmit} style={styles.form}>
            <h2 style={styles.formTitle}>Masuk ke Akun</h2>
            <p style={styles.formSubtitle}>Masukkan detail masuk untuk melanjutkan deteksi forensik.</p>
            
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="Masukkan alamat email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && <span style={styles.errorText}>{errors.email}</span>}
            </div>

            <div className="form-group">
              <div style={styles.passwordLabelRow}>
                <label className="form-label">Kata Sandi</label>
                <span style={styles.localBadge}>Mode lokal</span>
              </div>
              <div style={styles.passwordInputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.revealBtn}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <span style={styles.errorText}>{errors.password}</span>}
            </div>

            <button type="submit" className="btn-primary" style={styles.loginBtn}>
              <span>Masuk Ke Akun</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
              </svg>
            </button>

            <div style={styles.footerText}>
              Belum punya akun?{' '}
              <button type="button" onClick={onRegisterClick} style={styles.linkBtn}>
                Daftar Sekarang
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: '-150px',
    left: '-150px',
    width: '400px',
    height: '400px',
    background: 'var(--primary-glow)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: '-150px',
    right: '-150px',
    width: '400px',
    height: '400px',
    background: 'var(--primary-glow)',
    opacity: 0.8,
  },
  themeToggle: {
    position: 'absolute',
    top: '24px',
    right: '24px',
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    zIndex: 10,
    transition: 'all 0.3s ease',
  },
  content: {
    width: '100%',
    maxWidth: '420px',
    padding: '24px',
    zIndex: 2,
  },
  header: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '32px',
  },
  brandTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
    fontSize: '2rem',
    letterSpacing: '-0.5px',
    color: 'var(--text)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  formTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
    fontSize: '1.5rem',
    marginBottom: '8px',
    textAlign: 'center',
    color: 'var(--text)',
  },
  formSubtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginBottom: '24px',
    lineHeight: '1.4',
  },
  passwordLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  localBadge: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  passwordInputWrapper: {
    position: 'relative',
    width: '100%',
  },
  revealBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: '0.75rem',
    color: 'red',
    marginTop: '4px',
    fontWeight: '500',
  },
  loginBtn: {
    marginTop: '16px',
    width: '100%',
  },
  footerText: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontWeight: '700',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: 'inherit',
    fontSize: 'inherit',
  },
};

export default LoginScreen;
