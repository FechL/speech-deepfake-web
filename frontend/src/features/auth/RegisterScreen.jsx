import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import GlassCard from '../../components/GlassCard';

const RegisterScreen = ({ onLoginClick }) => {
  const { register, theme, toggleTheme } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!name) {
      newErrors.name = 'Harap masukkan nama lengkap';
    }
    
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
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Konfirmasi kata sandi tidak cocok';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      register(name, email);
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
            <h2 style={styles.formTitle}>Daftar Akun Baru</h2>
            <p style={styles.formSubtitle}>Buat akun investigasi baru untuk memulai deteksi manipulasi suara.</p>
            
            <div className="form-group">
              <label className="form-label">Nama Lengkap</label>
              <input
                type="text"
                className="form-input"
                placeholder="Masukkan nama lengkap Anda"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && <span style={styles.errorText}>{errors.name}</span>}
            </div>

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
              <label className="form-label">Kata Sandi</label>
              <input
                type="password"
                className="form-input"
                placeholder="Buat kata sandi baru"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && <span style={styles.errorText}>{errors.password}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Konfirmasi Kata Sandi</label>
              <input
                type="password"
                className="form-input"
                placeholder="Ulangi kata sandi baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {errors.confirmPassword && <span style={styles.errorText}>{errors.confirmPassword}</span>}
            </div>

            <button type="submit" className="btn-primary" style={styles.registerBtn}>
              <span>Daftar Akun</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </button>

            <div style={styles.footerText}>
              Sudah memiliki akun?{' '}
              <button type="button" onClick={onLoginClick} style={styles.linkBtn}>
                Masuk Sekarang
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
    marginBottom: '24px',
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
  errorText: {
    fontSize: '0.75rem',
    color: 'red',
    marginTop: '4px',
    fontWeight: '500',
  },
  registerBtn: {
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

export default RegisterScreen;
