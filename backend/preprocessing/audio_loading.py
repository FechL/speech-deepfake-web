"""Shared first step for every model: audio file -> (mono float waveform, native sample rate)."""
import numpy as np
import librosa

MIN_SECONDS = 0.25


def load_audio(audio_path: str):
    """Load with librosa (native sample rate, mono); fall back to soundfile, then scipy wavfile."""
    try:
        audio, sample_rate = librosa.load(audio_path, sr=None, mono=True)
    except Exception as load_err:
        try:
            import soundfile as sf
            audio, sample_rate = sf.read(audio_path)
            if audio.ndim > 1:
                audio = np.mean(audio, axis=1)
            audio = audio.astype(np.float32)
        except Exception:
            try:
                from scipy.io import wavfile
                sample_rate, audio = wavfile.read(audio_path)
                if audio.ndim > 1:
                    audio = np.mean(audio, axis=1)
                if audio.dtype == np.int16:
                    audio = audio.astype(np.float32) / 32768.0
                else:
                    audio = audio.astype(np.float32)
            except Exception:
                raise ValueError(
                    f"Format audio tidak dapat dibaca: {load_err}. "
                    "Pastikan berkas adalah audio yang valid (WAV, MP3, M4A, OGG) dan durasi minimal 1 detik."
                )

    if audio is None or len(audio) < int(MIN_SECONDS * sample_rate):
        raise ValueError("Durasi audio terlalu singkat. Diperlukan rekaman minimal 0.5–1 detik.")
    return audio, sample_rate
