import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import GlassCard from '../../components/GlassCard';

const ALVIN_MODELS_INFO = {
  B4: {
    name: 'Model Alvin B4 (XGBoost)',
    tag: 'Baseline Utama (Skripsi)',
    algorithm: 'XGBoost Classifier',
    features: '280 Fitur (MFCC 20 stat + LFCC 20 mean/std)',
    desc: 'Baseline spektral terbaik skripsi. Fusi MFCC + LFCC dengan XGBoost.',
  },
  B0: {
    name: 'Model Alvin B0 (SVM RBF)',
    tag: 'MFCC Mel-Scale',
    algorithm: 'SVM (RBF Kernel)',
    features: '240 Fitur (MFCC static, delta, delta2)',
    desc: 'Representasi akustik skala Mel konvensional.',
  },
  B1: {
    name: 'Model Alvin B1 (SVM RBF)',
    tag: 'LFCC Frekuensi Tinggi',
    algorithm: 'SVM (RBF Kernel)',
    features: '40 Fitur (LFCC mean, std)',
    desc: 'Filterbank linier LFCC, sensitif spektral tinggi.',
  },
  B2: {
    name: 'Model Alvin B2 (SVM RBF)',
    tag: 'Fusi Spektral SVM',
    algorithm: 'SVM (RBF Kernel)',
    features: '280 Fitur (MFCC + LFCC)',
    desc: 'Fusi MFCC + LFCC dengan SVM RBF.',
  },
  B3: {
    name: 'Model Alvin B3 (Random Forest)',
    tag: 'Ensemble Spektral',
    algorithm: 'Random Forest (200 Trees)',
    features: '280 Fitur (MFCC + LFCC)',
    desc: 'Ensemble Random Forest (200 trees) spektral.',
  },
  E4c: {
    name: 'Model Alvin E4c (SVM Forensik)',
    tag: 'Forensik Fisik Utama',
    algorithm: 'SVM (RBF Kernel)',
    features: '22 Fitur (Residual + Modulasi)',
    desc: 'Bukti forensik LP residual vokal dan spektrum modulasi.',
  },
  E4a: {
    name: 'Model Alvin E4a (SVM LP Residual)',
    tag: 'Eksitasi Vokal',
    algorithm: 'SVM (RBF Kernel)',
    features: '15 Fitur (LP Residual p=16)',
    desc: 'Fitur LP residual eksitasi pita suara (p=16).',
  },
  E4b: {
    name: 'Model Alvin E4b (SVM Modulasi)',
    tag: 'Ritme Artikulasi',
    algorithm: 'SVM (RBF Kernel)',
    features: '7 Fitur (Modulasi 0.5–20 Hz)',
    desc: 'Fitur ritme artikulasi modulasi (0.5–20 Hz).',
  },
  E4e: {
    name: 'Model Alvin E4e (XGBoost Forensik)',
    tag: 'Gradient Boosting Fisik',
    algorithm: 'XGBoost Classifier',
    features: '22 Fitur (Residual + Modulasi)',
    desc: 'Gradient boosting pada fitur residual dan modulasi.',
  }
};

const FAWWAS_MODELS_INFO = {
  rerec_knn_5: {
    name: 'Model Fawwas KNN Forensik (N=5)',
    tag: 'Model Stabil Utama',
    algorithm: 'KNN (N=5, Euclidean)',
    features: '204 Fitur Akustik (MFCC, LFCC, ZCR, RMS, Delta)',
    desc: 'Deteksi re-recording vokal (204 fitur akustik) berbasis KNN N=5.',
  },
  rerec_knn_3: {
    name: 'Model Fawwas KNN Forensik (N=3)',
    tag: 'Sensitif Jarak Dekat',
    algorithm: 'KNN (N=3, Euclidean)',
    features: '204 Fitur Akustik Forensik',
    desc: 'KNN N=3 dengan respons sensitif anomali jarak dekat.',
  },
  rerec_knn_7: {
    name: 'Model Fawwas KNN Forensik (N=7)',
    tag: 'Voting Konservatif',
    algorithm: 'KNN (N=7, Euclidean)',
    features: '204 Fitur Akustik Forensik',
    desc: 'KNN N=7 dengan pembobotan mayoritas konservatif.',
  },
  glottal_g3: {
    name: 'Model Fawwas Glottal Waveform (G3)',
    tag: 'Inverse Filtering',
    algorithm: 'Glottal Inverse Filtering (G3)',
    features: 'Siklus Pembukaan/Penutupan Pita Suara',
    desc: 'Inverse filtering gelombang aliran glotal vokal.',
  },
  glottal_lfcc_g3: {
    name: 'Model Fawwas Fusi LFCC + Glottal G3',
    tag: 'Fusi Filterbank & Glotal',
    algorithm: 'Linear Filterbank + Glottal G3',
    features: 'LFCC 40 + Glottal G3',
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
    logout 
  } = useApp();
  const [expandedResearcher, setExpandedResearcher] = useState(null);

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

      {/* Model Alvin */}
      <GlassCard padding="20px 22px">
        <div style={styles.researcherHeader}>
          <h3 style={styles.researcherName}>Model Alvin · Alvin Rifky Wahyudi</h3>
        </div>
        <button type="button" aria-expanded={expandedResearcher === 'alvin'} onClick={() => setExpandedResearcher(expandedResearcher === 'alvin' ? null : 'alvin')} style={styles.dropdownTrigger}>
          <span><small>Model terpilih</small><strong>{ALVIN_MODELS_INFO[alvinModel]?.name || ALVIN_MODELS_INFO.B4.name}</strong></span>
          <span style={{ ...styles.chevron, transform: expandedResearcher === 'alvin' ? 'rotate(180deg)' : 'none' }}>⌄</span>
        </button>
        {expandedResearcher === 'alvin' && <div style={styles.modelCatalog}>
          {Object.entries(ALVIN_MODELS_INFO).map(([id, model]) => (
            <button key={id} type="button" aria-pressed={alvinModel === id} onClick={() => { setAlvinModel(id); setExpandedResearcher(null); }}
              style={{ ...styles.modelCatalogItem, ...(alvinModel === id ? styles.modelCatalogItemActive : {}) }}>
              <span style={styles.catalogRadio}>{alvinModel === id && <span style={styles.catalogRadioDot} />}</span>
              <span style={styles.catalogContent}>
                <strong>{model.name}</strong>
                <span style={styles.specRow}>{model.algorithm} · {model.features}</span>
              </span>
            </button>
          ))}
        </div>}
      </GlassCard>

      {/* Model Fawwas */}
      <GlassCard padding="20px 22px">
        <div style={styles.researcherHeader}>
          <h3 style={styles.researcherName}>Model Fawwas · Fawwas Aliy</h3>
        </div>
        <button type="button" aria-expanded={expandedResearcher === 'fawwas'} onClick={() => setExpandedResearcher(expandedResearcher === 'fawwas' ? null : 'fawwas')} style={{ ...styles.dropdownTrigger, ...styles.dropdownTriggerFawwas }}>
          <span><small>Model terpilih</small><strong>{FAWWAS_MODELS_INFO[fawwasModel]?.name || FAWWAS_MODELS_INFO.rerec_knn_5.name}</strong></span>
          <span style={{ ...styles.chevron, color: '#00A572', transform: expandedResearcher === 'fawwas' ? 'rotate(180deg)' : 'none' }}>⌄</span>
        </button>
        {expandedResearcher === 'fawwas' && <div style={styles.modelCatalog}>
          {Object.entries(FAWWAS_MODELS_INFO).map(([id, model]) => (
            <button key={id} type="button" aria-pressed={fawwasModel === id} onClick={() => { setFawwasModel(id); setExpandedResearcher(null); }}
              style={{ ...styles.modelCatalogItem, ...styles.modelCatalogItemFawwas, ...(fawwasModel === id ? styles.modelCatalogItemFawwasActive : {}) }}>
              <span style={{ ...styles.catalogRadio, borderColor: '#00A572' }}>{fawwasModel === id && <span style={{ ...styles.catalogRadioDot, background: '#00A572' }} />}</span>
              <span style={styles.catalogContent}>
                <strong>{model.name}</strong>
                <span style={styles.specRow}>{model.algorithm} · {model.features}</span>
              </span>
            </button>
          ))}
        </div>}
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
    maxWidth: '960px',
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
  modelGroupHint: { margin: '-4px 0 12px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 },
  dropdownTrigger: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: '11px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)', textAlign: 'left', cursor: 'pointer' },
  dropdownTriggerFawwas: { borderColor: 'rgba(0,165,114,0.35)' },
  chevron: { color: 'var(--primary)', fontSize: '1.3rem', transition: 'transform .18s ease' },
  modelCatalog: { display: 'flex', flexDirection: 'column', gap: '8px' },
  modelCatalogItem: { width: '100%', display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '13px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', transition: 'all .18s ease' },
  modelCatalogItemActive: { borderColor: 'var(--primary)', background: 'var(--primary-glow)', boxShadow: '0 0 0 1px var(--primary)' },
  modelCatalogItemFawwas: { borderColor: 'rgba(0,165,114,0.25)' },
  modelCatalogItemFawwasActive: { borderColor: '#00A572', background: 'rgba(0,165,114,0.08)', boxShadow: '0 0 0 1px #00A572' },
  catalogRadio: { width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid var(--primary)', flexShrink: 0, display: 'grid', placeItems: 'center', marginTop: '2px' },
  catalogRadioDot: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' },
  catalogContent: { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: 0 },
  catalogTitleRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px', fontSize: '0.85rem' },
  catalogThreshold: { display: 'flex', flexDirection: 'column', textAlign: 'right', color: 'var(--primary)', fontSize: '0.8rem', whiteSpace: 'nowrap' },
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
