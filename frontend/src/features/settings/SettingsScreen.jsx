import React from 'react';
import { useApp } from '../../context/AppContext';
import GlassCard from '../../components/GlassCard';

const ALVIN_MODELS_INFO = {
  B4: {
    name: 'Model Alvin B4 (XGBoost)',
    tag: 'Baseline Utama (Skripsi)',
    algorithm: 'XGBoost Classifier',
    features: '280 Fitur (MFCC 20 stat + LFCC 20 mean/std)',
    threshold: '0.3793 (37.9%)',
    desc: 'Baseline spektral terbaik skripsi. Fusi MFCC + LFCC dengan XGBoost.',
  },
  B0: {
    name: 'Model Alvin B0 (SVM RBF)',
    tag: 'MFCC Mel-Scale',
    algorithm: 'SVM (RBF Kernel)',
    features: '240 Fitur (MFCC static, delta, delta2)',
    threshold: '0.4359 (43.6%)',
    desc: 'Representasi akustik skala Mel konvensional.',
  },
  B1: {
    name: 'Model Alvin B1 (SVM RBF)',
    tag: 'LFCC Frekuensi Tinggi',
    algorithm: 'SVM (RBF Kernel)',
    features: '40 Fitur (LFCC mean, std)',
    threshold: '0.3821 (38.2%)',
    desc: 'Filterbank linier LFCC, sensitif spektral tinggi.',
  },
  B2: {
    name: 'Model Alvin B2 (SVM RBF)',
    tag: 'Fusi Spektral SVM',
    algorithm: 'SVM (RBF Kernel)',
    features: '280 Fitur (MFCC + LFCC)',
    threshold: '0.4346 (43.5%)',
    desc: 'Fusi MFCC + LFCC dengan SVM RBF.',
  },
  B3: {
    name: 'Model Alvin B3 (Random Forest)',
    tag: 'Ensemble Spektral',
    algorithm: 'Random Forest (200 Trees)',
    features: '280 Fitur (MFCC + LFCC)',
    threshold: '0.4329 (43.3%)',
    desc: 'Ensemble Random Forest (200 trees) spektral.',
  },
  E4c: {
    name: 'Model Alvin E4c (SVM Forensik)',
    tag: 'Forensik Fisik Utama',
    algorithm: 'SVM (RBF Kernel)',
    features: '22 Fitur (Residual + Modulasi)',
    threshold: '0.4095 (41.0%)',
    desc: 'Bukti forensik LP residual vokal dan spektrum modulasi.',
  },
  E4a: {
    name: 'Model Alvin E4a (SVM LP Residual)',
    tag: 'Eksitasi Vokal',
    algorithm: 'SVM (RBF Kernel)',
    features: '15 Fitur (LP Residual p=16)',
    threshold: '0.4028 (40.3%)',
    desc: 'Fitur LP residual eksitasi pita suara (p=16).',
  },
  E4b: {
    name: 'Model Alvin E4b (SVM Modulasi)',
    tag: 'Ritme Artikulasi',
    algorithm: 'SVM (RBF Kernel)',
    features: '7 Fitur (Modulasi 0.5–20 Hz)',
    threshold: '0.4766 (47.7%)',
    desc: 'Fitur ritme artikulasi modulasi (0.5–20 Hz).',
  },
  E4e: {
    name: 'Model Alvin E4e (XGBoost Forensik)',
    tag: 'Gradient Boosting Fisik',
    algorithm: 'XGBoost Classifier',
    features: '22 Fitur (Residual + Modulasi)',
    threshold: '0.4249 (42.5%)',
    desc: 'Gradient boosting pada fitur residual dan modulasi.',
  }
};

const FAWWAS_MODELS_INFO = {
  rerec_knn_5: {
    name: 'Model Fawwas KNN Forensik (N=5)',
    tag: 'Model Stabil Utama',
    algorithm: 'KNN (N=5, Euclidean)',
    features: '204 Fitur Akustik (MFCC, LFCC, ZCR, RMS, Delta)',
    threshold: '0.5000 (50.0%)',
    desc: 'Deteksi re-recording vokal (204 fitur akustik) berbasis KNN N=5.',
  },
  rerec_knn_3: {
    name: 'Model Fawwas KNN Forensik (N=3)',
    tag: 'Sensitif Jarak Dekat',
    algorithm: 'KNN (N=3, Euclidean)',
    features: '204 Fitur Akustik Forensik',
    threshold: '0.5000 (50.0%)',
    desc: 'KNN N=3 dengan respons sensitif anomali jarak dekat.',
  },
  rerec_knn_7: {
    name: 'Model Fawwas KNN Forensik (N=7)',
    tag: 'Voting Konservatif',
    algorithm: 'KNN (N=7, Euclidean)',
    features: '204 Fitur Akustik Forensik',
    threshold: '0.5000 (50.0%)',
    desc: 'KNN N=7 dengan pembobotan mayoritas konservatif.',
  },
  glottal_g3: {
    name: 'Model Fawwas Glottal Waveform (G3)',
    tag: 'Inverse Filtering',
    algorithm: 'Glottal Inverse Filtering (G3)',
    features: 'Siklus Pembukaan/Penutupan Pita Suara',
    threshold: '0.5000 (50.0%)',
    desc: 'Inverse filtering gelombang aliran glotal vokal.',
  },
  glottal_lfcc_g3: {
    name: 'Model Fawwas Fusi LFCC + Glottal G3',
    tag: 'Fusi Filterbank & Glotal',
    algorithm: 'Linear Filterbank + Glottal G3',
    features: 'LFCC 40 + Glottal G3',
    threshold: '0.5000 (50.0%)',
    desc: 'Fusi multimodal filterbank linier dan glotal.',
  }
};

const SettingsScreen = () => {
  const { 
    user, 
    alvinModel, 
    setAlvinModel, 
    fawwasModel, 
    setFawwasModel, 
    defaultResearcher, 
    setDefaultResearcher,
    logout 
  } = useApp();

  const currentAlvin = ALVIN_MODELS_INFO[alvinModel] || ALVIN_MODELS_INFO.B4;
  const currentFawwas = FAWWAS_MODELS_INFO[fawwasModel] || FAWWAS_MODELS_INFO.rerec_knn_5;

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Investigator Profile Card */}
      <GlassCard padding="18px 22px">
        <div style={styles.profileWrapper}>
          <div style={styles.avatar}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          
          <div style={styles.profileInfo}>
            <div style={styles.profileHeaderRow}>
              <h3 style={styles.profileName}>{user.name}</h3>
              <span style={styles.profileBadge}>INVESTIGATOR</span>
            </div>
            <span style={styles.profileMeta}>{user.id} • {user.email || 'alvinrifky81@gmail.com'}</span>
          </div>
        </div>
      </GlassCard>

      {/* Default Engine Selection */}
      <GlassCard padding="18px 22px">
        <h4 style={styles.cardTitle}>Mesin Deteksi Default</h4>
        <p style={styles.cardDesc}>Pilih model yang otomatis aktif saat membuka menu deteksi.</p>

        <div style={styles.engineToggleRow}>
          <button 
            type="button"
            onClick={() => setDefaultResearcher('alvin')}
            style={{
              ...styles.engineToggleBtn,
              borderColor: defaultResearcher === 'alvin' ? 'var(--primary)' : 'var(--border)',
              background: defaultResearcher === 'alvin' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={styles.engineRadioCircle}>
              {defaultResearcher === 'alvin' && <div style={styles.engineRadioDot} />}
            </div>
            <div style={styles.engineBtnText}>
              <div style={styles.engineBtnTitle}>Model Alvin Rifky Wahyudi</div>
              <div style={styles.engineBtnSub}>Aktif: {currentAlvin.name}</div>
            </div>
          </button>

          <button 
            type="button"
            onClick={() => setDefaultResearcher('fawwas')}
            style={{
              ...styles.engineToggleBtn,
              borderColor: defaultResearcher === 'fawwas' ? 'var(--primary)' : 'var(--border)',
              background: defaultResearcher === 'fawwas' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={styles.engineRadioCircle}>
              {defaultResearcher === 'fawwas' && <div style={styles.engineRadioDot} />}
            </div>
            <div style={styles.engineBtnText}>
              <div style={styles.engineBtnTitle}>Model Fawwas Aliy</div>
              <div style={styles.engineBtnSub}>Aktif: {currentFawwas.name}</div>
            </div>
          </button>
        </div>
      </GlassCard>

      {/* Peneliti 1: Alvin Rifky Wahyudi */}
      <GlassCard padding="20px 22px">
        <div style={styles.researcherHeader}>
          <div style={styles.researcherLeft}>
            <div style={styles.researcherAvatar}>AR</div>
            <div>
              <h3 style={styles.researcherName}>Peneliti: Alvin Rifky Wahyudi</h3>
              <p style={styles.researcherTopic}>Riset: Residual & Modulasi Spektral (10 Checkpoints)</p>
            </div>
          </div>
          <span style={styles.researcherTagPrimary}>Skripsi Utama</span>
        </div>

        <div style={styles.modelSelectorBox}>
          <label style={styles.inputLabel}>PILIH MODEL ALVIN:</label>
          <select 
            value={alvinModel} 
            onChange={(e) => setAlvinModel(e.target.value)}
            style={styles.selectInput}
          >
            <optgroup label="Model Baseline Spektral">
              <option value="B4">B4: XGBoost (280 Fitur) — ⭐ Rekomendasi Utama</option>
              <option value="B0">B0: SVM RBF (MFCC 240 Fitur)</option>
              <option value="B1">B1: SVM RBF (LFCC 40 Fitur)</option>
              <option value="B2">B2: SVM RBF (MFCC + LFCC 280 Fitur)</option>
              <option value="B3">B3: Random Forest (280 Fitur)</option>
            </optgroup>
            <optgroup label="Model Bukti Forensik Fisik">
              <option value="E4c">E4c: SVM RBF (Residual + Modulasi · 22 Fitur)</option>
              <option value="E4a">E4a: SVM RBF (LP Residual · 15 Fitur)</option>
              <option value="E4b">E4b: SVM RBF (Modulasi · 7 Fitur)</option>
              <option value="E4e">E4e: XGBoost (Residual + Modulasi · 22 Fitur)</option>
            </optgroup>
          </select>
        </div>

        <div style={styles.detailsCard}>
          <div style={styles.detailsHeader}>
            <div>
              <span style={styles.detailsTag}>{currentAlvin.tag}</span>
              <h4 style={styles.detailsTitle}>{currentAlvin.name}</h4>
            </div>
            <div style={styles.detailsThreshBox}>
              <span style={styles.detailsThreshLabel}>EER Thresh</span>
              <span style={styles.detailsThreshVal}>{currentAlvin.threshold}</span>
            </div>
          </div>
          <p style={styles.detailsDesc}>{currentAlvin.desc}</p>
          <div style={styles.specRow}>
            <span>{currentAlvin.algorithm}</span>
            <span>•</span>
            <span>{currentAlvin.features}</span>
          </div>
        </div>
      </GlassCard>

      {/* Peneliti 2: Fawwas Aliy */}
      <GlassCard padding="20px 22px">
        <div style={styles.researcherHeader}>
          <div style={styles.researcherLeft}>
            <div style={{ ...styles.researcherAvatar, background: 'rgba(0, 165, 114, 0.15)', color: '#00A572', borderColor: 'rgba(0, 165, 114, 0.3)' }}>
              FA
            </div>
            <div>
              <h3 style={styles.researcherName}>Peneliti: Fawwas Aliy</h3>
              <p style={styles.researcherTopic}>Riset: Forensik Rekaman Ulang (Re-recording) & Glotal</p>
            </div>
          </div>
          <span style={styles.researcherTagSecondary}>Komparator</span>
        </div>

        <div style={styles.modelSelectorBox}>
          <label style={styles.inputLabel}>PILIH MODEL FAWWAS:</label>
          <select 
            value={fawwasModel} 
            onChange={(e) => setFawwasModel(e.target.value)}
            style={styles.selectInput}
          >
            <option value="rerec_knn_5">KNN N=5 (204 Fitur Akustik) — ⭐ Model Stabil</option>
            <option value="rerec_knn_3">KNN N=3 (Sensitif Jarak Dekat)</option>
            <option value="rerec_knn_7">KNN N=7 (Konservatif Voting)</option>
            <option value="glottal_g3">Glottal G3 (Siklus Pita Suara)</option>
            <option value="glottal_lfcc_g3">Fusi LFCC + Glottal G3</option>
          </select>
        </div>

        <div style={styles.detailsCard}>
          <div style={styles.detailsHeader}>
            <div>
              <span style={{ ...styles.detailsTag, color: '#4EDEA3', background: 'rgba(78, 222, 163, 0.12)', borderColor: 'rgba(78, 222, 163, 0.3)' }}>
                {currentFawwas.tag}
              </span>
              <h4 style={styles.detailsTitle}>{currentFawwas.name}</h4>
            </div>
            <div style={styles.detailsThreshBox}>
              <span style={styles.detailsThreshLabel}>Threshold</span>
              <span style={styles.detailsThreshVal}>{currentFawwas.threshold}</span>
            </div>
          </div>
          <p style={styles.detailsDesc}>{currentFawwas.desc}</p>
          <div style={styles.specRow}>
            <span>{currentFawwas.algorithm}</span>
            <span>•</span>
            <span>{currentFawwas.features}</span>
          </div>
        </div>
      </GlassCard>

      {/* System Info */}
      <GlassCard padding="16px 20px">
        <div style={styles.aboutMetaRow}>
          <span>Penyimpanan: <strong>Lokal</strong></span>
          <span>Backend: <strong>http://127.0.0.1:5001</strong></span>
          <span>Versi: <strong>v2.0</strong></span>
        </div>
      </GlassCard>

      {/* Logout */}
      <button onClick={logout} style={styles.logoutBtn}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        <span>KELUAR DARI INVESTIGASI</span>
      </button>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    maxWidth: '780px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    paddingBottom: '36px',
  },
  profileWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  avatar: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'var(--primary-glow)',
    border: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
  },
  profileHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  profileName: {
    fontSize: '1.15rem',
    fontWeight: '800',
    margin: 0,
  },
  profileBadge: {
    fontSize: '0.62rem',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '20px',
    background: 'rgba(0, 102, 255, 0.15)',
    color: 'var(--primary)',
    fontFamily: 'var(--font-mono)',
  },
  profileMeta: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    margin: '0 0 4px 0',
  },
  cardDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: '0 0 12px 0',
  },
  engineToggleRow: {
    display: 'flex',
    gap: '10px',
  },
  engineToggleBtn: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  engineRadioCircle: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  engineRadioDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--primary)',
  },
  engineBtnText: {
    display: 'flex',
    flexDirection: 'column',
  },
  engineBtnTitle: {
    fontSize: '0.86rem',
    fontWeight: '700',
  },
  engineBtnSub: {
    fontSize: '0.74rem',
    color: 'var(--text-muted)',
  },
  researcherHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  researcherLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  researcherAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(0, 102, 255, 0.15)',
    border: '1px solid rgba(0, 102, 255, 0.3)',
    color: 'var(--primary)',
    fontWeight: '800',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  researcherName: {
    fontSize: '0.98rem',
    fontWeight: '700',
    margin: 0,
  },
  researcherTopic: {
    fontSize: '0.76rem',
    color: 'var(--text-muted)',
    margin: '2px 0 0 0',
  },
  researcherTagPrimary: {
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '10px',
    background: 'rgba(0, 102, 255, 0.15)',
    color: 'var(--primary)',
  },
  researcherTagSecondary: {
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '10px',
    background: 'rgba(0, 165, 114, 0.15)',
    color: '#00A572',
  },
  modelSelectorBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '12px',
  },
  inputLabel: {
    fontSize: '0.7rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  selectInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '0.84rem',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer',
  },
  detailsCard: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsTag: {
    fontSize: '0.62rem',
    fontWeight: '700',
    color: 'var(--primary)',
    background: 'rgba(0, 102, 255, 0.12)',
    padding: '2px 6px',
    borderRadius: '6px',
    display: 'inline-block',
    marginBottom: '2px',
  },
  detailsTitle: {
    fontSize: '0.92rem',
    fontWeight: '700',
    margin: 0,
  },
  detailsThreshBox: {
    textAlign: 'right',
  },
  detailsThreshLabel: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    display: 'block',
  },
  detailsThreshVal: {
    fontSize: '0.84rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: 'var(--primary)',
  },
  detailsDesc: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  specRow: {
    display: 'flex',
    gap: '8px',
    fontSize: '0.74rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  aboutMetaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  logoutBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 77, 77, 0.25)',
    background: 'rgba(255, 77, 77, 0.06)',
    color: '#FF6B6B',
    fontSize: '0.8rem',
    fontWeight: '700',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
};

export default SettingsScreen;
