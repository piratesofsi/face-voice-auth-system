import { useState, useRef, useEffect, useCallback, useMemo } from "react";

const API = "http://localhost:8000";
const CORNER_POSITIONS = [
  { top: 20, left: 20, rotate: "0deg" },
  { top: 20, right: 20, rotate: "90deg" },
  { bottom: 20, right: 20, rotate: "180deg" },
  { bottom: 20, left: 20, rotate: "270deg" },
];

/* ── Capture a JPEG blob from a video element ── */
function captureFrame(videoEl) {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  canvas.getContext("2d").drawImage(videoEl, 0, 0);
  return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
}

function mergeAudioBuffers(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: "audio/wav" });
}

async function captureVoice(duration = 2600) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const chunks = [];

  source.connect(processor);
  processor.connect(audioContext.destination);

  return await new Promise((resolve, reject) => {
    let finished = false;

    processor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(channelData));
    };

    const done = async () => {
      if (finished) return;
      finished = true;
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close();
      const samples = mergeAudioBuffers(chunks);
      resolve(encodeWAV(samples, audioContext.sampleRate));
    };

    setTimeout(done, duration);
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (!stream.active) done();
      };
    });
  });
}

/* ── Noise texture ── */
function NoiseBg() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    c.width = 256; c.height = 256;
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 25;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 18;
    }
    ctx.putImageData(img, 0, 0);
  }, []);
  return (
    <canvas ref={ref} style={{
      position: "fixed", inset: 0, width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 1, imageRendering: "pixelated",
    }} />
  );
}

/* ── Glitch title ── */
function GlitchText({ text }) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span aria-hidden style={{
        position: "absolute", inset: 0, color: "#00ffe0", opacity: 0.7,
        clipPath: "polygon(0 30%,100% 30%,100% 50%,0 50%)",
        animation: "glitch1 4s infinite",
      }}>{text}</span>
      <span aria-hidden style={{
        position: "absolute", inset: 0, color: "#ff2d78", opacity: 0.6,
        clipPath: "polygon(0 62%,100% 62%,100% 76%,0 76%)",
        animation: "glitch2 4s infinite",
      }}>{text}</span>
      {text}
    </span>
  );
}

/* ── Biometric feed — exposes videoRef ── */
function BiometricFeed({ mode, videoRef }) {
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(false);
  const voiceBars = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        duration: `${(0.35 + ((i % 6) * 0.1)).toFixed(2)}s`,
        delay: `${(i * 0.04).toFixed(2)}s`,
        height: `${26 + ((i * 11) % 44)}%`,
      })),
    []
  );

  useEffect(() => {
    if (mode === "face") {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((s) => {
          streamRef.current = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play();
            setReady(true);
          }
        }).catch(() => setReady(false));
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [mode]);

  useEffect(() => {
    const id = setInterval(() => setTick((p) => !p), 850);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position: "relative", width: "100%", aspectRatio: "1",
      background: "#050505", borderRadius: 4, overflow: "hidden",
      border: "1px solid rgba(0,255,224,0.2)",
    }}>
      {mode === "face" && (
        <video ref={videoRef} muted playsInline style={{
          width: "100%", height: "100%", objectFit: "cover",
          opacity: ready ? 1 : 0, transition: "opacity .4s",
          transform: "scaleX(-1)",
        }} />
      )}
      {mode === "voice" && (
        <div style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 3, padding: "0 16px",
        }}>
          {voiceBars.map((bar) => (
            <div key={bar.id} style={{
              width: 3, borderRadius: 2, background: "rgba(0,255,224,0.7)",
              animation: `voicebar ${bar.duration} ease-in-out infinite alternate`,
              animationDelay: bar.delay,
              height: bar.height,
            }} />
          ))}
        </div>
      )}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,224,.03) 3px,rgba(0,255,224,.03) 4px)",
      }} />
      <div style={{
        position: "absolute", left: 0, right: 0, height: 1, opacity: 0.5,
        background: "linear-gradient(90deg,transparent,#00ffe0,transparent)",
        animation: "sweep 2s linear infinite",
      }} />
      {[
        { top: 8, left: 8, rotate: "0deg" },
        { top: 8, right: 8, rotate: "90deg" },
        { bottom: 8, right: 8, rotate: "180deg" },
        { bottom: 8, left: 8, rotate: "270deg" },
      ].map((pos, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 16 16"
          style={{ position: "absolute", ...pos, transform: `rotate(${pos.rotate})` }}>
          <path d="M2 10 L2 2 L10 2" fill="none" stroke="#00ffe0" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ))}
      <div style={{ position: "absolute", bottom: 8, left: 10, display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: tick ? "#00ffe0" : "rgba(0,255,224,.18)",
          boxShadow: tick ? "0 0 5px #00ffe0" : "none",
          transition: "all .3s",
        }} />
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 7,
          color: "rgba(0,255,224,.5)", letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          {mode === "face" ? "Face·Scan" : "Voice·Scan"}
        </span>
      </div>
    </div>
  );
}

/* ── Input field ── */
function Field({ label, type = "text", value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: "block", fontFamily: "'DM Mono', monospace",
        fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase",
        marginBottom: 6, transition: "color .2s",
        color: focused ? "#00ffe0" : "rgba(255,255,255,.28)",
      }}>
        {label}
      </label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", background: "rgba(255,255,255,.03)",
          border: `1px solid ${focused ? "rgba(0,255,224,.4)" : "rgba(255,255,255,.08)"}`,
          borderRadius: 3, padding: "10px 12px", color: "#fff",
          fontFamily: "'DM Mono', monospace", fontSize: 12, outline: "none",
          boxSizing: "border-box", transition: "border-color .2s, box-shadow .2s",
          boxShadow: focused ? "0 0 0 1px rgba(0,255,224,.1)" : "none",
        }}
      />
    </div>
  );
}

/* ── Method toggle ── */
function MethodToggle({ mode, onSelect }) {
  const opts = [
    { id: "face",  icon: "◉", label: "Face ID"  },
    { id: "voice", icon: "◎", label: "Voice ID" },
    { id: "none",  icon: "▪", label: "Password" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      {opts.map((o) => (
        <button key={o.id} onClick={() => onSelect(o.id)} style={{
          flex: 1, padding: "10px 4px", borderRadius: 3, cursor: "pointer",
          fontFamily: "'DM Mono', monospace", fontSize: 8,
          letterSpacing: "0.18em", textTransform: "uppercase", transition: "all .2s",
          background: mode === o.id ? "rgba(0,255,224,.08)" : "rgba(255,255,255,.02)",
          border: `1px solid ${mode === o.id ? "rgba(0,255,224,.32)" : "rgba(255,255,255,.07)"}`,
          color: mode === o.id ? "#00ffe0" : "rgba(255,255,255,.25)",
        }}>
          <div style={{ fontSize: 15, marginBottom: 3 }}>{o.icon}</div>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Action buttons ── */
function ActionButtons({ tab, mode, status, onSubmit, onSwitch, loading }) {
  return (
    <>
      {status && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 12px", borderRadius: 3, marginBottom: 14,
          animation: "statusIn .3s ease",
          background: status.type === "success" ? "rgba(0,255,224,.06)"
            : status.type === "error" ? "rgba(255,45,120,.06)"
            : "rgba(255,255,255,.025)",
          border: `1px solid ${status.type === "success" ? "rgba(0,255,224,.28)"
            : status.type === "error" ? "rgba(255,45,120,.28)"
            : "rgba(255,255,255,.07)"}`,
          color: status.type === "success" ? "#00ffe0"
            : status.type === "error" ? "#ff2d78"
            : "rgba(255,255,255,.36)",
          fontFamily: "'DM Mono', monospace", fontSize: 8,
          letterSpacing: "0.18em", textTransform: "uppercase",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
            background: status.type === "success" ? "#00ffe0"
              : status.type === "error" ? "#ff2d78"
              : "rgba(255,255,255,.3)",
            animation: status.type === "scanning" ? "pulseRing 1s infinite" : "none",
          }} />
          {status.msg}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={loading}
        onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = "rgba(0,255,224,.13)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(0,255,224,.1)"; } }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,255,224,.07)"; e.currentTarget.style.boxShadow = "none"; }}
        style={{
          width: "100%", padding: "12px", borderRadius: 3,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "'DM Mono', monospace", fontSize: 10,
          letterSpacing: "0.3em", textTransform: "uppercase",
          color: "#00ffe0", transition: "all .2s",
          background: "rgba(0,255,224,.07)",
          border: "1px solid rgba(0,255,224,.22)",
          opacity: loading ? 0.6 : 1,
          marginBottom: 14,
        }}
      >
        {loading ? "Processing..." : tab === "login"
          ? mode === "face" ? "Scan Face" : mode === "voice" ? "Scan Voice" : "Authenticate"
          : "Register Identity"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.05)" }} />
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,.15)", letterSpacing: "0.18em" }}>
          {tab === "login" ? "No account?" : "Have access?"}
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.05)" }} />
      </div>

      <button
        onClick={onSwitch}
        onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.15)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,.25)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.07)"; }}
        style={{
          width: "100%", padding: "10px", borderRadius: 3, cursor: "pointer",
          background: "none", fontFamily: "'DM Mono', monospace",
          fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
          color: "rgba(255,255,255,.25)", transition: "all .2s",
          border: "1px solid rgba(255,255,255,.07)",
        }}
      >
        {tab === "login" ? "Request access" : "Sign in"}
      </button>
    </>
  );
}

/* ── Page ── */
export default function AuthPage({ onSuccess }) {
  const [tab, setTab]           = useState("login");
  const [mode, setMode]         = useState("face");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [status, setStatus]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [visible, setVisible]   = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState(null);
  const [micSupported, setMicSupported] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const videoRef                = useRef(null);

  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicSupported(false);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePref = () => setReduceMotion(mediaQuery.matches);
    updatePref();
    mediaQuery.addEventListener("change", updatePref);
    return () => mediaQuery.removeEventListener("change", updatePref);
  }, []);

  useEffect(() => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  useEffect(() => {
    if (mode !== "voice") {
      setAudioBlob(null);
      setRecordError(null);
      setRecording(false);
    }
  }, [mode]);

  const switchTab = (t) => { setTab(t); setStatus(null); };

  const recordVoice = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordError("Microphone unsupported in this browser");
      setStatus({ type: "error", msg: "Microphone unavailable" });
      return null;
    }

    try {
      setRecordError(null);
      setRecording(true);
      const blob = await captureVoice(2600);
      setAudioBlob(blob);
      setStatus({ type: "success", msg: "Voice sample captured" });
      return blob;
    } catch (error) {
      setRecordError("Cannot access microphone — allow audio input and try again");
      setStatus({ type: "error", msg: "Voice capture failed" });
      return null;
    } finally {
      setRecording(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!email.trim()) {
      setStatus({ type: "error", msg: "Email is required" });
      return;
    }

    setLoading(true);
    setStatus({ type: "scanning", msg: mode === "none" ? "Authenticating…" : `Capturing ${mode} biometric…` });

    try {
      const form = new FormData();
      form.append("email", email.trim());
      form.append("auth_method", mode);

      if (tab === "register" && name.trim()) {
        form.append("name", name.trim());
      } else if (tab === "register") {
        form.append("name", email.trim().split("@")[0]);
      }

      if (mode === "face") {
        // capture frame from webcam
        if (!videoRef.current || !videoRef.current.videoWidth) {
          setStatus({ type: "error", msg: "Camera not ready — wait a moment" });
          setLoading(false);
          return;
        }
        const blob = await captureFrame(videoRef.current);
        form.append("file", blob, "face.jpg");
      } else if (mode === "voice") {
        let blob = audioBlob;
        if (!blob) {
          setStatus({ type: "scanning", msg: "Recording voice…" });
          blob = await recordVoice();
        }
        if (!blob) {
          setLoading(false);
          return;
        }
        form.append("file", blob, "voice.wav");
      } else if (mode === "none") {
        if (!password) {
          setStatus({ type: "error", msg: "Password is required" });
          setLoading(false);
          return;
        }
        form.append("password", password);
      }

      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const res = await fetch(`${API}${endpoint}`, { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: "error", msg: data.detail || "Something went wrong" });
        setLoading(false);
        return;
      }

      // store token
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setStatus({ type: "success", msg: `Welcome ${data.user.name} — access granted` });

      // redirect after short delay
      setTimeout(() => {
        if (onSuccess) onSuccess(data.user);
      }, 1200);

    } catch (err) {
      setStatus({ type: "error", msg: "Cannot reach server — is backend running?" });
    } finally {
      setLoading(false);
    }
  }, [email, password, name, mode, tab, onSuccess]);

  const isBiometric = mode === "face" || mode === "voice";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { background: #040404; }
        input::placeholder { color: rgba(255,255,255,.14); font-family: 'DM Mono', monospace; }
        button { border: none; }
        @keyframes glitch1 { 0%,89%,100%{transform:translateX(0)} 91%{transform:translateX(-3px)} 95%{transform:translateX(3px)} }
        @keyframes glitch2 { 0%,89%,100%{transform:translateX(0)} 92%{transform:translateX(3px)} 96%{transform:translateX(-2px)} }
        @keyframes sweep { 0%{top:0} 100%{top:100%} }
        @keyframes voicebar { from{transform:scaleY(.25)} to{transform:scaleY(1)} }
        @keyframes pulseRing { 0%{box-shadow:0 0 0 0 rgba(0,255,224,.4)} 70%{box-shadow:0 0 0 8px rgba(0,255,224,0)} 100%{box-shadow:0 0 0 0 rgba(0,255,224,0)} }
        @keyframes statusIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh", width: "100%", background: "#040404",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
        fontFamily: "'DM Mono', monospace",
      }}>
        {!reduceMotion && <NoiseBg />}
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: "linear-gradient(rgba(0,255,224,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,224,.022) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2,
          background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.06) 2px,rgba(0,0,0,.06) 4px)",
        }} />
        {CORNER_POSITIONS.map((pos, i) => (
          <svg key={i} width="36" height="36" viewBox="0 0 36 36" style={{
            position: "fixed", ...pos, zIndex: 2, opacity: 0.2,
            transform: `rotate(${pos.rotate})`,
          }}>
            <path d="M3 22 L3 3 L22 3" fill="none" stroke="#00ffe0" strokeWidth="1" />
          </svg>
        ))}

        <div style={{
          position: "relative", zIndex: 3, width: "100%",
          maxWidth: isBiometric ? 720 : 400,
          padding: "0 16px",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(22px)",
          transition: "opacity .6s ease, transform .6s ease, max-width .4s ease",
        }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44, border: "1px solid rgba(0,255,224,.3)",
              borderRadius: 4, marginBottom: 14, animation: "pulseRing 2.4s infinite",
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7" r="3" stroke="#00ffe0" strokeWidth="1.2" />
                <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#00ffe0" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="10" cy="10" r="9" stroke="rgba(0,255,224,.18)" strokeWidth=".8" />
              </svg>
            </div>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 36,
              letterSpacing: "0.2em", color: "#fff", lineHeight: 1, marginBottom: 8, display: "block",
            }}>
              <GlitchText text="NEXUS·ACCESS" />
            </h1>
            <p style={{
              fontFamily: "'DM Mono', monospace", fontSize: 9,
              color: "rgba(255,255,255,.2)", letterSpacing: "0.3em", textTransform: "uppercase",
            }}>
              Biometric Auth System v2.4
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: "rgba(8,8,8,0.95)",
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: 6, overflow: "hidden",
          }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              {["login", "register"].map((t) => (
                <button key={t} onClick={() => switchTab(t)} style={{
                  flex: 1, padding: "13px 0", background: "none", cursor: "pointer",
                  fontFamily: "'DM Mono', monospace", fontSize: 9,
                  letterSpacing: "0.3em", textTransform: "uppercase",
                  transition: "all .2s", marginBottom: -1,
                  borderBottom: `2px solid ${tab === t ? "#00ffe0" : "transparent"}`,
                  color: tab === t ? "#00ffe0" : "rgba(255,255,255,.22)",
                }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{ padding: "22px 22px 20px" }}>
              <p style={{
                fontFamily: "'DM Mono', monospace", fontSize: 8,
                color: "rgba(255,255,255,.2)", letterSpacing: "0.25em",
                textTransform: "uppercase", marginBottom: 10,
              }}>
                Auth method
              </p>
              <MethodToggle mode={mode} onSelect={(m) => { setMode(m); setStatus(null); }} />

              {isBiometric ? (
                <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
                  {/* Left — feed */}
                  <div style={{ flex: "0 0 46%", paddingRight: 20 }}>
                    <p style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 8,
                      color: "rgba(255,255,255,.2)", letterSpacing: "0.2em",
                      textTransform: "uppercase", marginBottom: 8,
                    }}>
                      {mode === "face" ? "Camera feed" : "Audio input"}
                    </p>
                    <BiometricFeed mode={mode} videoRef={videoRef} />
                    {mode === "voice" && (
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        <button
                          type="button"
                          onClick={recordVoice}
                          disabled={recording || !micSupported}
                          style={{
                            width: "100%", padding: "10px", borderRadius: 3,
                            background: recording ? "rgba(0,255,224,.12)" : "rgba(0,255,224,.08)",
                            color: recording || !micSupported ? "rgba(255,255,255,.6)" : "#00ffe0",
                            border: "1px solid rgba(0,255,224,.16)",
                            cursor: recording || !micSupported ? "not-allowed" : "pointer",
                            fontFamily: "'DM Mono', monospace", fontSize: 9,
                            letterSpacing: "0.2em", textTransform: "uppercase",
                          }}
                        >
                          {recording ? "Recording voice…" : audioBlob ? "Re-record voice" : "Record voice"}
                        </button>
                        {!micSupported && (
                          <div style={{ color: "#ff6b79", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
                            Microphone not supported by this browser.
                          </div>
                        )}
                        {audioUrl && (
                          <audio controls src={audioUrl} style={{ width: "100%", borderRadius: 4, background: "rgba(255,255,255,.03)" }} />
                        )}
                        {recordError && (
                          <div style={{ color: "#ff6b79", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
                            {recordError}
                          </div>
                        )}
                      </div>
                    )}
                    <p style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 8,
                      color: "rgba(255,255,255,.14)", letterSpacing: "0.05em",
                      lineHeight: 1.7, marginTop: 10,
                    }}>
                      {mode === "face"
                        ? "Centre your face in frame. Ensure good lighting."
                        : "Speak clearly for 2–3 sec. Reduce background noise."}
                    </p>
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, background: "rgba(255,255,255,.06)", flexShrink: 0 }} />

                  {/* Right — form */}
                  <div style={{ flex: 1, paddingLeft: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <p style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 8,
                        color: "rgba(255,255,255,.2)", letterSpacing: "0.2em",
                        textTransform: "uppercase", marginBottom: 8,
                      }}>
                        Credentials
                      </p>
                      {tab === "register" && (
                        <Field label="Full name" value={name} onChange={setName} placeholder="John Doe" />
                      )}
                      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="user@domain.com" />
                    </div>
                    <ActionButtons
                      tab={tab} mode={mode} status={status} loading={loading}
                      onSubmit={handleSubmit}
                      onSwitch={() => switchTab(tab === "login" ? "register" : "login")}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {tab === "register" && (
                    <Field label="Full name" value={name} onChange={setName} placeholder="John Doe" />
                  )}
                  <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="user@domain.com" />
                  <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••••" />
                  <ActionButtons
                    tab={tab} mode={mode} status={status} loading={loading}
                    onSubmit={handleSubmit}
                    onSwitch={() => switchTab(tab === "login" ? "register" : "login")}
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{
              borderTop: "1px solid rgba(255,255,255,.04)", padding: "9px 22px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 7,
                color: "rgba(255,255,255,.12)", letterSpacing: "0.2em", textTransform: "uppercase",
              }}>
                AES-256 · Encrypted
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ffe0", animation: "pulseRing 2.4s infinite" }} />
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 7,
                  color: "rgba(0,255,224,.4)", letterSpacing: "0.2em", textTransform: "uppercase",
                }}>
                  Secure
                </span>
              </div>
            </div>
          </div>

          {/* Sys info */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, padding: "0 4px" }}>
            {["Sys·Ver 2.4.1", "Node·Auth·01", "Status·Online"].map((s) => (
              <span key={s} style={{
                fontFamily: "'DM Mono', monospace", fontSize: 7,
                color: "rgba(255,255,255,.1)", letterSpacing: "0.15em",
              }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}