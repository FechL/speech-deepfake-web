import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import GlassCard from '../../components/GlassCard';

// Helper to encode Float32Array into standard 16-bit PCM WAV bytes
const pcmToWavBytes = (samples, sampleRate) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
};

const SelectMethodScreen = ({ onBack, onAudioSelected }) => {
  const [dragActive, setDragActive] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [waveAmplitudes, setWaveAmplitudes] = useState(Array(30).fill(15));
  const [errorMessage, setErrorMessage] = useState('');
  const [modalError, setModalError] = useState('');
  
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const animationRef = useRef(null);
  const isRecordingRef = useRef(false);
  const discardRecordingRef = useRef(false);
  const recordingStartTimeRef = useRef(0);

  const chooseRecorderMimeType = () => {
    const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  };

  const startRecording = async () => {
    setModalError('');
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mimeType = chooseRecorderMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      discardRecordingRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (discardRecordingRef.current || audioChunksRef.current.length === 0) return;

        try {
          const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
          const arrayBuffer = await audioBlob.arrayBuffer();

          let fileBytes;
          let fileFormat = 'WAV';
          let mimeType = 'audio/wav';
          let durationSeconds = recordSeconds;

          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
              const audioCtx = new AudioCtx();
              const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
              await audioCtx.close();

              durationSeconds = decodedBuffer.duration;
              if (durationSeconds < 0.6) {
                setModalError('Rekaman terlalu singkat (kurang dari 1 detik). Harap rekam suara minimal 1-2 detik.');
                return;
              }

              // Extract mono channel data
              const channelData = decodedBuffer.getChannelData(0);
              fileBytes = pcmToWavBytes(channelData, decodedBuffer.sampleRate);
            } else {
              fileBytes = new Uint8Array(arrayBuffer);
              fileFormat = actualMimeType.includes('ogg') ? 'OGG' : 'WEBM';
              mimeType = actualMimeType;
            }
          } catch {
            fileBytes = new Uint8Array(arrayBuffer);
            fileFormat = actualMimeType.includes('ogg') ? 'OGG' : 'WEBM';
            mimeType = actualMimeType;
          }

          if (durationSeconds < 0.5) {
            setModalError('Rekaman terlalu singkat (kurang dari 1 detik). Harap rekam suara minimal 1-2 detik.');
            return;
          }

          const mins = Math.floor(durationSeconds / 60);
          const secs = Math.floor(durationSeconds % 60);
          const durationStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          const sizeStr = `${(fileBytes.length / (1024 * 1024)).toFixed(2)} MB`;
          const fileName = `rekaman_${Date.now()}.${fileFormat.toLowerCase()}`;

          setIsRecordModalOpen(false);
          onAudioSelected(fileName, fileFormat, sizeStr, durationStr, fileBytes, mimeType);
        } catch (err) {
          setModalError(`Gagal memproses rekaman: ${err.message}`);
        }
      };

      mediaRecorder.start();
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordSeconds(0);
      recordingStartTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);

      animateWaveform();

    } catch {
      setModalError('Mikrofon tidak dapat diakses. Periksa izin browser lalu coba lagi.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    const elapsedMs = Date.now() - recordingStartTimeRef.current;
    if (elapsedMs < 900) {
      setModalError('Rekaman terlalu singkat. Harap rekam suara minimal 1-2 detik.');
      return;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
      clearInterval(timerRef.current);
      cancelAnimationFrame(animationRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      discardRecordingRef.current = true;
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsRecordModalOpen(false);
    setModalError('');
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
  };

  const animateWaveform = () => {
    if (!isRecordingRef.current) return;
    setWaveAmplitudes(
      Array.from({ length: 30 }, () => Math.floor(Math.random() * 50) + 10)
    );
    animationRef.current = setTimeout(animateWaveform, 120);
  };

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (mediaRecorderRef.current?.state === 'recording') {
        discardRecordingRef.current = true;
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file) => {
    setErrorMessage('');
    const extension = file.name.split('.').pop() || '';
    const format = extension.toUpperCase();
    const allowed = ['WAV', 'MP3', 'M4A', 'WEBM', 'OGG', 'FLAC'];

    if (!allowed.includes(format)) {
      setErrorMessage('Format tidak didukung. Gunakan WAV, MP3, M4A, WebM, OGG, atau FLAC.');
      return;
    }
    if (file.size === 0) {
      setErrorMessage('Berkas audio kosong. Pilih berkas lain.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas melebihi batas 25 MB.');
      return;
    }

    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    try {
      const duration = await readAudioDuration(file);
      const durationStr = formatTime(Math.max(1, Math.round(duration)));
      onAudioSelected(file.name, format, sizeStr, durationStr, fileBytes, file.type || `audio/${extension}`);
    } catch {
      setErrorMessage('Durasi audio tidak dapat dibaca. Pastikan berkas tidak rusak.');
    }
  };

  const readAudioDuration = (file) => new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const { duration } = audio;
      cleanup();
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error('Durasi tidak valid'));
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('Audio tidak dapat dibaca'));
    };
    audio.src = objectUrl;
  });

  const formatTime = (totalSecs) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span>Kembali</span>
        </button>
        <h2 style={styles.title}>Pilih Metode Deteksi</h2>
        <div style={{ width: '80px' }} />
      </header>

      <div style={styles.methodsRow} className="methods-layout">
        <div style={styles.optionBox}>
          <GlassCard 
            className={`dropzone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={styles.card}
            padding="40px 24px"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }}
              accept=".wav,.mp3,.m4a,.webm,.ogg,.flac,audio/*"
            />
            <div style={styles.iconContainer}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <h3 style={styles.methodTitle}>Unggah Audio</h3>
            <p style={styles.methodDesc}>
              Tarik & lepaskan file audio di sini, atau klik untuk memilih file.
            </p>
            <span style={styles.supportBadge}>WAV, MP3, M4A, WebM, OGG, FLAC · Maks. 25 MB</span>
          </GlassCard>
        </div>

        <div style={styles.optionBox}>
          <GlassCard 
            onClick={() => setIsRecordModalOpen(true)}
            style={styles.card}
            padding="40px 24px"
          >
            <div style={styles.iconContainer}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8"/>
              </svg>
            </div>
            <h3 style={styles.methodTitle}>Rekam Suara</h3>
            <p style={styles.methodDesc}>
              Rekam suara melalui mikrofon perangkat untuk langsung dianalisis.
            </p>
            <span style={styles.supportBadge}>Mikrofon Perangkat</span>
          </GlassCard>
        </div>
      </div>

      {errorMessage && <div role="alert" style={styles.errorBanner}>{errorMessage}</div>}

      {isRecordModalOpen && createPortal((
        <div style={styles.modalOverlay}>
          <div className="glass-container animate-fade-in" style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Rekam Audio</h3>
            <p style={styles.modalSubtitle}>Bicara di mikrofon untuk merekam sampel suara.</p>
            
            <div style={styles.visualizerContainer}>
              <div style={styles.timer}>{formatTime(recordSeconds)}</div>
              
              <div style={styles.waveGroup}>
                {waveAmplitudes.map((amp, idx) => (
                  <div 
                    key={idx} 
                    style={{
                      ...styles.waveBar,
                      height: `${isRecording ? amp : 4}px`,
                      background: isRecording ? 'var(--primary)' : 'var(--text-muted)',
                    }}
                  />
                ))}
              </div>
            </div>

            {modalError && (
              <div style={styles.modalErrorBanner}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{modalError}</span>
              </div>
            )}

            <div style={styles.modalActions}>
              {!isRecording ? (
                <>
                  <button onClick={cancelRecording} style={styles.cancelBtn}>Batal</button>
                  <button onClick={startRecording} className="btn-primary" style={styles.startBtn}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--bg)" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <span>Mulai Rekam</span>
                  </button>
                </>
              ) : (
                <button onClick={stopRecording} style={styles.stopBtn}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                  </svg>
                  <span>Selesai & Analisis</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ), document.body)}

      <style>{`
        .methods-layout {
          display: flex;
          gap: 20px;
        }
        .methods-layout > div {
          flex: 1;
        }
        .dropzone {
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .dropzone:hover, .dropzone.active {
          border-color: var(--primary) !important;
          box-shadow: 0 0 20px var(--primary-glow);
        }
        @media (max-width: 650px) {
          .methods-layout {
            flex-direction: column;
          }
          .methods-layout > div {
            width: 100%;
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
  methodsRow: {
    width: '100%',
  },
  optionBox: {
    display: 'flex',
  },
  card: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    minHeight: '260px',
    justifyContent: 'center',
  },
  iconContainer: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'var(--primary-glow)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '20px',
    border: '1px solid var(--border)',
    transition: 'transform 0.3s ease',
  },
  methodTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    marginBottom: '8px',
    fontFamily: 'var(--font-display)',
  },
  methodDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
    marginBottom: '16px',
    maxWidth: '280px',
  },
  supportBadge: {
    fontSize: '0.7rem',
    fontWeight: '600',
    fontFamily: 'var(--font-label)',
    color: 'var(--primary)',
    background: 'var(--primary-glow)',
    border: '1px solid var(--border)',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  errorBanner: {
    marginTop: '18px',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 77, 77, 0.45)',
    background: 'rgba(255, 77, 77, 0.1)',
    color: '#ff8d8d',
    fontSize: '0.85rem',
    textAlign: 'center',
  },
  modalErrorBanner: {
    width: '100%',
    marginBottom: '20px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 77, 77, 0.5)',
    background: 'rgba(255, 77, 77, 0.12)',
    color: '#ff8d8d',
    fontSize: '0.82rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    lineHeight: '1.4',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(11, 19, 38, 0.68)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    padding: '20px',
  },
  modalContent: {
    width: '100%',
    maxWidth: '460px',
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.28)',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    marginBottom: '8px',
  },
  modalSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginBottom: '28px',
    lineHeight: '1.4',
  },
  visualizerContainer: {
    width: '100%',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '16px',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '28px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  timer: {
    fontFamily: 'var(--font-label)',
    fontSize: '2rem',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  waveGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    height: '60px',
    width: '100%',
  },
  waveBar: {
    width: '4px',
    borderRadius: '2px',
    transition: 'height 0.1s ease, background 0.3s ease',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    width: '100%',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '12px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
    fontFamily: 'var(--font-label)',
  },
  startBtn: {
    flex: 1,
  },
  stopBtn: {
    background: '#FF4D4D',
    color: 'white',
    padding: '14px 24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '0.9rem',
    fontWeight: '700',
    fontFamily: 'var(--font-label)',
    width: '100%',
    boxShadow: '0 4px 12px rgba(255, 77, 77, 0.3)',
  },
};

export default SelectMethodScreen;
