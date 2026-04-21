import io
import os
import pickle
import wave

import numpy as np

VOICES_DIR = "embeddings/voices"
os.makedirs(VOICES_DIR, exist_ok=True)


def _read_wav_bytes(audio_bytes: bytes):
    with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
        channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        sample_rate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())

    if sample_width == 1:
        data = np.frombuffer(frames, dtype=np.uint8).astype(np.float32)
        data = (data - 128.0) / 128.0
    elif sample_width == 2:
        data = np.frombuffer(frames, dtype=np.int16).astype(np.float32)
        data = data / 32768.0
    else:
        raise ValueError("Unsupported audio format")

    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)

    return data, sample_rate


def _voice_signature(samples: np.ndarray, sample_rate: int):
    if samples.size < sample_rate // 2:
        return None

    energy = np.abs(samples)
    if energy.max() < 0.02:
        return None

    active = np.where(energy > 0.02)[0]
    if active.size:
        samples = samples[active[0]:active[-1] + 1]

    if samples.size < 512:
        return None

    window = np.hanning(512)
    hop = 256
    frames = []

    for start in range(0, samples.size - 512, hop):
        frame = samples[start:start + 512] * window
        spectrum = np.fft.rfft(frame)
        frames.append(np.log1p(np.abs(spectrum)))

    if not frames:
        return None

    signature = np.mean(frames, axis=0).astype(np.float32)
    norm = np.linalg.norm(signature)
    if norm < 1e-8:
        return None

    return signature / norm


def register_voice(user_id: int, audio_bytes: bytes) -> bool:
    try:
        samples, rate = _read_wav_bytes(audio_bytes)
        signature = _voice_signature(samples, rate)
        if signature is None:
            return False

        with open(f"{VOICES_DIR}/{user_id}.pkl", "wb") as f:
            pickle.dump(signature, f)

        return True
    except Exception as e:
        print(f"Voice registration error: {e}")
        return False


def verify_voice(user_id: int, audio_bytes: bytes, threshold: float = 0.88) -> bool:
    path = f"{VOICES_DIR}/{user_id}.pkl"
    if not os.path.exists(path):
        print(f"No voice profile registered for user {user_id}")
        return False

    try:
        with open(path, "rb") as f:
            stored = pickle.load(f)

        samples, rate = _read_wav_bytes(audio_bytes)
        signature = _voice_signature(samples, rate)
        if signature is None:
            return False

        similarity = float(np.dot(stored, signature))
        print(f"Voice similarity: {similarity:.3f} (threshold: {threshold})")
        return similarity >= threshold
    except Exception as e:
        print(f"Voice verification error: {e}")
        return False
