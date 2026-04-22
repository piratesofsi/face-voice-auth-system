import io
import os
import pickle
import wave

import numpy as np

VOICES_DIR = "embeddings/voices"
MAX_TEMPLATES = 5
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

    # Require enough active voice content to reduce false accepts on noise.
    if samples.size < sample_rate:
        return None

    rms = float(np.sqrt(np.mean(np.square(samples))))
    if rms < 0.015:
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

    frame_matrix = np.stack(frames).astype(np.float32)
    global_mean = np.mean(frame_matrix, axis=0)
    global_std = np.std(frame_matrix, axis=0)
    temporal_delta = np.mean(np.abs(np.diff(frame_matrix, axis=0)), axis=0) if frame_matrix.shape[0] > 1 else np.zeros_like(global_mean)

    # Concatenate static + dynamic features for stronger discrimination.
    signature = np.concatenate([global_mean, global_std, temporal_delta]).astype(np.float32)
    norm = np.linalg.norm(signature)
    if norm < 1e-8:
        return None

    return signature / norm


def _load_templates(path: str):
    with open(path, "rb") as f:
        stored = pickle.load(f)

    if isinstance(stored, dict):
        if "signatures" in stored:
            signatures = [np.asarray(sig, dtype=np.float32) for sig in stored["signatures"] if sig is not None]
        elif "signature" in stored:
            signatures = [np.asarray(stored["signature"], dtype=np.float32)]
        else:
            signatures = []
    else:
        signatures = [np.asarray(stored, dtype=np.float32)]

    return [sig for sig in signatures if sig.size > 0]


def _align_signature_pair(a: np.ndarray, b: np.ndarray):
    if a.shape[0] == b.shape[0]:
        return a, b

    min_len = min(a.shape[0], b.shape[0])
    if min_len < 64:
        return None, None

    a2 = np.asarray(a[:min_len], dtype=np.float32)
    b2 = np.asarray(b[:min_len], dtype=np.float32)
    a2 /= max(np.linalg.norm(a2), 1e-8)
    b2 /= max(np.linalg.norm(b2), 1e-8)
    return a2, b2


def register_voice(user_id: int, audio_bytes: bytes) -> bool:
    try:
        samples, rate = _read_wav_bytes(audio_bytes)
        signature = _voice_signature(samples, rate)
        if signature is None:
            return False

        path = f"{VOICES_DIR}/{user_id}.pkl"
        signatures = []
        if os.path.exists(path):
            try:
                signatures = _load_templates(path)
            except Exception:
                signatures = []

        signatures.append(signature)
        signatures = signatures[-MAX_TEMPLATES:]

        payload = {
            "version": 3,
            "signatures": signatures,
        }
        with open(path, "wb") as f:
            pickle.dump(payload, f)

        return True
    except Exception as e:
        print(f"Voice registration error: {e}")
        return False


def verify_voice(user_id: int, audio_bytes: bytes, threshold: float = 0.955) -> bool:
    path = f"{VOICES_DIR}/{user_id}.pkl"
    if not os.path.exists(path):
        print(f"No voice profile registered for user {user_id}")
        return False

    try:
        stored_templates = _load_templates(path)
        if not stored_templates:
            return False

        samples, rate = _read_wav_bytes(audio_bytes)
        signature = _voice_signature(samples, rate)
        if signature is None:
            return False

        similarities = []
        distances = []

        for template in stored_templates:
            stored_cmp, sig_cmp = _align_signature_pair(template, signature)
            if stored_cmp is None:
                continue
            similarities.append(float(np.dot(stored_cmp, sig_cmp)))
            distances.append(float(np.linalg.norm(stored_cmp - sig_cmp)))

        if not similarities:
            return False

        best_similarity = max(similarities)
        best_distance = min(distances)
        avg_similarity = float(np.mean(similarities))
        avg_distance = float(np.mean(distances))

        print(
            f"Voice similarity best/avg: {best_similarity:.3f}/{avg_similarity:.3f} "
            f"(threshold: {threshold}), distance best/avg: {best_distance:.3f}/{avg_distance:.3f}"
        )

        # Require strong best match and stable average closeness across templates.
        return (
            best_similarity >= threshold
            and avg_similarity >= max(0.9, threshold - 0.045)
            and best_distance <= 0.30
            and avg_distance <= 0.38
        )
    except Exception as e:
        print(f"Voice verification error: {e}")
        return False
