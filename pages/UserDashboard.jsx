import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, SuccessRatePie, LoginsOverTime, MetricCard, Button, SectionHeader, CardGrid } from '../src/components/index.jsx';

const API = "http://localhost:8000";
const mono = "'DM Mono', monospace";
const bebas = "'Bebas Neue', sans-serif";
const SETTINGS_KEY = "user_dashboard_settings";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("access_token")}` };
}

function captureFrameFromStream(stream) {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = async () => {
      try {
        await video.play();
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext("2d").drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to capture image"));
        }, "image/jpeg", 0.92);
      } catch (err) {
        reject(err);
      }
    };
    video.onerror = () => reject(new Error("Unable to load camera stream"));
  });
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
    const s = Math.max(-1, Math.min(1, input[i]));
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

  return await new Promise((resolve) => {
    let finished = false;
    processor.onaudioprocess = (event) => {
      chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
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
  });
}

/* ── Sidebar ── */
const Sidebar = React.memo(function Sidebar({ active, onNav, user, onLogout }) {
  const items = useMemo(() => [
    { id: "profile", icon: "◉", label: "My Profile" },
    { id: "history", icon: "▤",  label: "Login History" },
    { id: "stats", icon: "📊", label: "Stats" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ], []);

  return (
    <div style={{
      width: 220, flexShrink: 0, background: "rgba(6,6,6,0.98)",
      borderRight: "1px solid rgba(0,255,224,.08)",
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
    }}>
      <div style={{ padding: "28px 24px 24px", borderBottom: "1px solid rgba(0,255,224,.06)" }}>
        <div style={{ fontFamily: bebas, fontSize: 22, color: "#00ffe0", letterSpacing: "0.2em" }}>NEXUS</div>
        <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(0,255,224,.35)", letterSpacing: "0.2em", marginTop: 2 }}>ACCESS CONTROL</div>
      </div>

      <nav style={{ flex: 1, padding: "16px 12px" }}>
        {items.map(item => (
          <button key={item.id} onClick={() => onNav(item.id)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "10px 12px", marginBottom: 4, borderRadius: 4,
            background: active === item.id ? "rgba(0,255,224,.08)" : "transparent",
            border: `1px solid ${active === item.id ? "rgba(0,255,224,.2)" : "transparent"}`,
            color: active === item.id ? "#00ffe0" : "rgba(255,255,255,.35)",
            fontFamily: mono, fontSize: 10, letterSpacing: "0.15em",
            textTransform: "uppercase", cursor: "pointer", transition: "all .2s",
            textAlign: "left",
          }}>
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: "16px", borderTop: "1px solid rgba(0,255,224,.06)" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#00ffe0", marginBottom: 2 }}>{user?.name}</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(255,255,255,.2)", letterSpacing: "0.1em" }}>{user?.email}</div>
          <div style={{
            display: "inline-block", marginTop: 6, padding: "2px 8px",
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 2, fontFamily: mono, fontSize: 7,
            color: "rgba(255,255,255,.4)", letterSpacing: "0.2em", textTransform: "uppercase",
          }}>
            {user?.role === "supervisor" ? "Supervisor" : user?.role === "admin" ? "Admin" : "User"}
          </div>
        </div>
        <button onClick={onLogout} style={{
          width: "100%", padding: "8px", background: "rgba(255,45,120,.06)",
          border: "1px solid rgba(255,45,120,.2)", borderRadius: 3,
          color: "#ff2d78", fontFamily: mono, fontSize: 9,
          letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer",
        }}>
          Logout
        </button>
      </div>
    </div>
  );
});

/* ── Profile panel ── */
const Profile = React.memo(function Profile({ user, logs }) {
  const profileData = useMemo(() => ({
    lastLogin: logs.find(l => l.status === "success"),
    totalLogins: logs.filter(l => l.status === "success").length,
  }), [logs]);

  const formatAuthMethod = useCallback((method) => {
    if (method === "none") return "Password";
    if (method === "face") return "Face ID";
    if (method === "voice") return "Voice ID";
    return method || "Unknown";
  }, []);

  return (
    <div>
      <SectionHeader title="My Profile" subtitle="Your account details and most recent access information." />

      <div style={{
        background: "rgba(10,10,10,0.9)", border: "1px solid rgba(0,255,224,.1)",
        borderRadius: 6, padding: "32px", marginBottom: 24,
        display: "flex", alignItems: "center", gap: 32,
      }}>
        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "rgba(0,255,224,.08)", border: "2px solid rgba(0,255,224,.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: bebas, fontSize: 32, color: "#00ffe0", flexShrink: 0,
        }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: bebas, fontSize: 26, color: "#fff", letterSpacing: "0.1em", marginBottom: 4 }}>
            {user?.name}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 16 }}>
            {user?.email}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Role",         value: user?.role },
              { label: "Auth Method",  value: formatAuthMethod(user?.auth_method) },
              { label: "Total Logins", value: profileData.totalLogins },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: "8px 16px", background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.07)", borderRadius: 4,
              }}>
                <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(255,255,255,.25)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: mono, fontSize: 12, color: "#00ffe0", textTransform: "capitalize" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {profileData.lastLogin && (
        <div style={{
          background: "rgba(0,255,224,.04)", border: "1px solid rgba(0,255,224,.12)",
          borderRadius: 6, padding: "16px 24px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00ffe0", flexShrink: 0 }} />
          <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,.5)" }}>
            Last login: <span style={{ color: "#00ffe0" }}>{new Date(profileData.lastLogin.logged_at).toLocaleString()}</span>
            {" "}via <span style={{ color: "#00ffe0", textTransform: "uppercase" }}>{profileData.lastLogin.method}</span>
          </div>
        </div>
      )}
    </div>
  );
});

/* ── History log row ── */
const HistoryRow = React.memo(function HistoryRow({ log, index, total }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.5fr",
      columnGap: "12px",
      padding: "16px 24px", alignItems: "center",
      borderBottom: index < total - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
    }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{log.method}</div>
      <div>
        <span style={{
          padding: "4px 12px", borderRadius: 3,
          fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
          background: log.status === "success" || log.status === "registered" ? "rgba(0,255,224,.08)" : "rgba(255,45,120,.08)",
          color: log.status === "success" || log.status === "registered" ? "#00ffe0" : "#ff2d78",
          border: `1px solid ${log.status === "success" || log.status === "registered" ? "rgba(0,255,224,.2)" : "rgba(255,45,120,.2)"}`,
          display: "inline-block",
        }}>
          {log.status}
        </span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,.3)" }}>
        {new Date(log.logged_at).toLocaleString()}
      </div>
    </div>
  );
});

/* ── History panel ── */
const History = React.memo(function History({ logs, onSearch }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: bebas, fontSize: 28, color: "#fff", letterSpacing: "0.15em" }}>
            Login History
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,.35)", marginTop: 8 }}>
            Search personal login events and track your access behavior.
          </div>
        </div>
        <div style={{ minWidth: 280, flex: 1, maxWidth: 420 }}>
          <Search data={logs} keys={['method', 'status']} onFiltered={onSearch} placeholder="Search history..." />
        </div>
      </div>

      <div style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.5fr",
          columnGap: "12px",
          padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,.06)",
          fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.4)",
          letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          <div>Method</div><div>Status</div><div>Time</div>
        </div>

        {logs.length === 0 && (
          <div style={{ padding: 24, fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,.2)", textAlign: "center" }}>
            No login history yet
          </div>
        )}

        {logs.map((log, i) => (
          <HistoryRow key={log.id} log={log} index={i} total={logs.length} />
        ))}
      </div>
    </div>
  );
});

const SettingsPanel = React.memo(function SettingsPanel({ logs, user }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? JSON.parse(saved) : {
        emailAlerts: true,
        failedAttemptAlerts: true,
        weeklyDigest: false,
        reducedMotion: false,
        compactMode: false,
        autoLogoutMinutes: 30,
      };
    } catch {
      return {
        emailAlerts: true,
        failedAttemptAlerts: true,
        weeklyDigest: false,
        reducedMotion: false,
        compactMode: false,
        autoLogoutMinutes: 30,
      };
    }
  });

  const [saveNotice, setSaveNotice] = useState("");
  const [draftPassword, setDraftPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityNotice, setSecurityNotice] = useState("");
  const [updatingMethod, setUpdatingMethod] = useState("");
  const [enabledMethods, setEnabledMethods] = useState(user?.auth_methods || []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaveNotice(`Saved at ${new Date().toLocaleTimeString()}`);
  }, [settings]);

  const setToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const exportMyActivity = () => {
    if (!logs.length) {
      setSecurityNotice("No activity history available.");
      return;
    }
    const header = ["method", "status", "logged_at"];
    const rows = logs.map((log) => header.map((key) => `"${String(log[key] ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my-login-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSecurityNotice("Activity export complete.");
  };

  const updatePasswordPlaceholder = () => {
    if (!draftPassword || draftPassword.length < 8) {
      setSecurityNotice("Password must be at least 8 characters.");
      return;
    }
    if (draftPassword !== confirmPassword) {
      setSecurityNotice("Password confirmation does not match.");
      return;
    }
    setUpdatingMethod("password");
    const form = new FormData();
    form.append("method", "none");
    form.append("password", draftPassword);
    fetch(`${API}/auth/enroll-method`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "Failed to update password");
        setDraftPassword("");
        setConfirmPassword("");
        setEnabledMethods(data.auth_methods || []);
        const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...savedUser, auth_methods: data.auth_methods || [] }));
        setSecurityNotice("Password updated successfully.");
      })
      .catch((err) => setSecurityNotice(err.message))
      .finally(() => setUpdatingMethod(""));
  };

  const updateFace = async () => {
    try {
      setUpdatingMethod("face");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const blob = await captureFrameFromStream(stream);
      stream.getTracks().forEach((t) => t.stop());

      const form = new FormData();
      form.append("method", "face");
      form.append("file", blob, "face.jpg");
      const res = await fetch(`${API}/auth/enroll-method`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to update face");
      setEnabledMethods(data.auth_methods || []);
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...savedUser, auth_methods: data.auth_methods || [] }));
      setSecurityNotice("Face profile updated.");
    } catch (err) {
      setSecurityNotice(err.message || "Face update failed.");
    } finally {
      setUpdatingMethod("");
    }
  };

  const updateVoice = async () => {
    try {
      setUpdatingMethod("voice");
      const blob = await captureVoice(2600);
      const form = new FormData();
      form.append("method", "voice");
      form.append("file", blob, "voice.wav");
      const res = await fetch(`${API}/auth/enroll-method`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to update voice");
      setEnabledMethods(data.auth_methods || []);
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...savedUser, auth_methods: data.auth_methods || [] }));
      setSecurityNotice("Voice profile updated.");
    } catch (err) {
      setSecurityNotice(err.message || "Voice update failed.");
    } finally {
      setUpdatingMethod("");
    }
  };

  return (
    <div>
      <SectionHeader title="Settings" subtitle="Control notifications, session security, and account preferences." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(0,255,224,.1)", borderRadius: 6, padding: 20 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#00ffe0", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>
            Notifications
          </div>
          {[
            { key: "emailAlerts", label: "Email alerts for new sign-ins" },
            { key: "failedAttemptAlerts", label: "Notify on failed attempts" },
            { key: "weeklyDigest", label: "Weekly security digest" },
          ].map((item) => (
            <label key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,.75)" }}>
              {item.label}
              <input type="checkbox" checked={settings[item.key]} onChange={() => setToggle(item.key)} />
            </label>
          ))}
        </div>

        <div style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(0,255,224,.1)", borderRadius: 6, padding: 20 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#00ffe0", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>
            Experience
          </div>
          {[
            { key: "reducedMotion", label: "Reduced motion mode" },
            { key: "compactMode", label: "Compact dashboard layout" },
          ].map((item) => (
            <label key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,.75)" }}>
              {item.label}
              <input type="checkbox" checked={settings[item.key]} onChange={() => setToggle(item.key)} />
            </label>
          ))}
          <label style={{ display: "block", marginTop: 12, fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,.75)" }}>
            Auto logout (minutes)
            <input
              type="number"
              min={5}
              max={180}
              value={settings.autoLogoutMinutes}
              onChange={(e) => setSettings((prev) => ({ ...prev, autoLogoutMinutes: Math.max(5, Math.min(180, Number(e.target.value) || 30)) }))}
              style={{
                marginTop: 8,
                width: "100%",
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 4,
                color: "#fff",
                padding: "10px 12px",
                fontFamily: mono,
              }}
            />
          </label>
          <div style={{ marginTop: 10, fontFamily: mono, fontSize: 9, color: "rgba(0,255,224,.6)" }}>{saveNotice}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 6, padding: 20 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#fff", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>
            Security
          </div>
          <input
            type="password"
            value={draftPassword}
            onChange={(e) => setDraftPassword(e.target.value)}
            placeholder="New password"
            style={{ width: "100%", marginBottom: 10, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, color: "#fff", padding: "10px 12px", fontFamily: mono }}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            style={{ width: "100%", marginBottom: 10, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, color: "#fff", padding: "10px 12px", fontFamily: mono }}
          />
          <Button onClick={updatePasswordPlaceholder}>Update Password</Button>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <Button variant="secondary" onClick={updateFace} disabled={updatingMethod !== ""}>
              {updatingMethod === "face" ? "Updating Face..." : "Update Face Profile"}
            </Button>
            <Button variant="secondary" onClick={updateVoice} disabled={updatingMethod !== ""}>
              {updatingMethod === "voice" ? "Updating Voice..." : "Update Voice Profile"}
            </Button>
          </div>
          <div style={{ marginTop: 12, fontFamily: mono, fontSize: 9, color: "rgba(0,255,224,.6)" }}>
            Enabled methods: {enabledMethods.length ? enabledMethods.join(", ") : "none"}
          </div>
        </div>

        <div style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 6, padding: 20 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#fff", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>
            Data Controls
          </div>
          <Button variant="secondary" onClick={exportMyActivity}>Export My Login Activity</Button>
          <div style={{ marginTop: 12, fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.45)" }}>
            Download your personal login history for audits and backup.
          </div>
        </div>
      </div>

      {securityNotice && (
        <div style={{ marginTop: 14, padding: "10px 12px", border: "1px solid rgba(0,255,224,.2)", borderRadius: 4, color: "#00ffe0", fontFamily: mono, fontSize: 9, letterSpacing: "0.08em" }}>
          {securityNotice}
        </div>
      )}
    </div>
  );
});

/* ── Main ── */
export default function UserDashboard({ user, onLogout }) {
  const [active, setActive] = useState("profile");
  const [logs, setLogs]     = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);

  useEffect(() => {
    fetch(`${API}/admin/my-logs`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLogs(data);
          setFilteredHistory(data);
        }
      })
      .catch(() => {});
  }, []);

  // Memoize stats calculations
  const stats = useMemo(() => ({
    totalLogins: logs.length,
    successRate: Math.round((logs.filter(l => l.status === "success").length / Math.max(logs.length, 1)) * 100),
    lastAttempt: logs[0] ? new Date(logs[0].logged_at).toLocaleDateString() : "N/A",
    successRatePieData: {
      success: logs.filter(l => l.status === "success").length,
      failed: logs.filter(l => l.status === "failed").length
    }
  }), [logs]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { background: #040404; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,224,.15); border-radius: 2px; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", background: "#040404" }}>
        <Sidebar active={active} onNav={setActive} user={user} onLogout={onLogout} />
        <main style={{ flex: 1, padding: "40px 40px", overflowY: "auto" }}>
          {active === "profile" && <Profile user={user} logs={logs} />}
          {active === "history" && <History logs={filteredHistory} onSearch={setFilteredHistory} />}
          {active === "stats" && (
            <div>
              <SectionHeader title="My Stats" subtitle="Quick insights into your account access performance." />
              <CardGrid gap={20}>
                <MetricCard label="Total Logins" value={stats.totalLogins} accent="#00ffe0" small />
                <MetricCard label="Success Rate" value={`${stats.successRate}%`} accent="#00ffe0" small />
                <MetricCard label="Last Attempt" value={stats.lastAttempt} accent="#59b3ff" small />
              </CardGrid>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 24 }}>
                <SuccessRatePie data={stats.successRatePieData} />
                <LoginsOverTime logs={logs} />
              </div>
            </div>
          )}
          {active === "settings" && (
            <SettingsPanel logs={logs} user={user} />
          )}
        </main>
      </div>
    </>
  );
}