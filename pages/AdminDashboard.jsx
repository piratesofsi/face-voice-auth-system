import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, SuccessRatePie, LoginsOverTime, MetricCard, Button, SectionHeader, CardGrid } from '../src/components/index.jsx';

const API = "http://localhost:8000";
const mono = "'DM Mono', monospace";
const bebas = "'Bebas Neue', sans-serif";
const tableCardStyle = { background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6, overflow: "hidden" };

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
  const isAdmin = user?.role === "admin";
  const items = useMemo(() => [
    { id: "overview", icon: "◈", label: "Overview" },
    { id: "analytics", icon: "📊", label: "Analytics" },
    ...(isAdmin ? [{ id: "users", icon: "◉", label: "Users" }] : []),
    { id: "logs", icon: "▤", label: "Access Logs" },
    { id: "security", icon: "🛡", label: "Security" },
    { id: "operations", icon: "⚡", label: "Operations" },
    { id: "settings", icon: "⚙", label: "Settings" },
  ], [isAdmin]);

  return (
    <div style={{
      width: 220, flexShrink: 0, background: "rgba(6,6,6,0.98)",
      borderRight: "1px solid rgba(0,255,224,.08)",
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "28px 24px 24px", borderBottom: "1px solid rgba(0,255,224,.06)" }}>
        <div style={{ fontFamily: bebas, fontSize: 22, color: "#00ffe0", letterSpacing: "0.2em" }}>
          NEXUS
        </div>
        <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(0,255,224,.35)", letterSpacing: "0.2em", marginTop: 2 }}>
          ACCESS CONTROL
        </div>
      </div>

      {/* Nav */}
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

      {/* User info + logout */}
      <div style={{ padding: "16px", borderTop: "1px solid rgba(0,255,224,.06)" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#00ffe0", marginBottom: 2 }}>
            {user?.name}
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(255,255,255,.2)", letterSpacing: "0.1em" }}>
            {user?.email}
          </div>
          <div style={{
            display: "inline-block", marginTop: 6, padding: "2px 8px",
            background: "rgba(0,255,224,.1)", border: "1px solid rgba(0,255,224,.25)",
            borderRadius: 2, fontFamily: mono, fontSize: 7,
            color: "#00ffe0", letterSpacing: "0.2em", textTransform: "uppercase",
          }}>
            {user?.role === "supervisor" ? "Supervisor" : "Admin"}
          </div>
        </div>
        <button onClick={onLogout} style={{
          width: "100%", padding: "8px", background: "rgba(255,45,120,.06)",
          border: "1px solid rgba(255,45,120,.2)", borderRadius: 3,
          color: "#ff2d78", fontFamily: mono, fontSize: 9,
          letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer",
          transition: "all .2s",
        }}>
          Logout
        </button>
      </div>
    </div>
  );
});

/* ── Stat card ── */
const Overview = React.memo(function Overview({ users, logs }) {
  const stats = useMemo(() => ({
    active: users.filter(u => u.is_active).length,
    failed: logs.filter(l => l.status === "failed").length,
    recent: logs.slice(0, 5),
  }), [users, logs]);

  return (
    <div>
      <SectionHeader title="System Overview" subtitle="Monitor active users and access health at a glance." />

      {/* Stats */}
      <CardGrid gap={16}>
        <MetricCard label="Total Users" value={users.length} accent="#00ffe0" />
        <MetricCard label="Active" value={stats.active} accent="#00ffe0" />
        <MetricCard label="Inactive" value={users.length - stats.active} accent="#ff2d78" />
        <MetricCard label="Failed Attempts" value={stats.failed} accent="#ff8c00" />
      </CardGrid>

      {/* Recent activity */}
      <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.3)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 14 }}>
        Recent Activity
      </div>
      <div style={tableCardStyle}>
        {stats.recent.length === 0 && (
          <div style={{ padding: 24, fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,.2)", textAlign: "center" }}>
            No activity yet
          </div>
        )}
        {stats.recent.map((log, i) => (
          <div key={log.id} style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "14px 20px",
            borderBottom: i < stats.recent.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: log.status === "success" || log.status === "registered" ? "#00ffe0"
                : log.status === "failed" ? "#ff2d78" : "#ff8c00",
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: "#fff" }}>{log.user_name}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.3)", marginTop: 2 }}>{log.email}</div>
            </div>
            <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {log.method}
            </div>
            <div style={{
              padding: "3px 10px", borderRadius: 2,
              fontFamily: mono, fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase",
              background: log.status === "success" || log.status === "registered" ? "rgba(0,255,224,.08)"
                : "rgba(255,45,120,.08)",
              color: log.status === "success" || log.status === "registered" ? "#00ffe0" : "#ff2d78",
              border: `1px solid ${log.status === "success" || log.status === "registered" ? "rgba(0,255,224,.2)" : "rgba(255,45,120,.2)"}`,
            }}>
              {log.status}
            </div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(255,255,255,.2)", minWidth: 140, textAlign: "right" }}>
              {new Date(log.logged_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/* ── User row component ── */
const UserRow = React.memo(function UserRow({ user, currentUserId, onToggle, onRoleChange, index, total }) {
  const formatAuthMethod = useCallback((method) => {
    if (method === "none") return "Password";
    if (method === "face") return "Face ID";
    if (method === "voice") return "Voice ID";
    return method || "Unknown";
  }, []);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr 1fr 1.2fr 1.2fr",
      columnGap: "12px",
      padding: "16px 24px", alignItems: "center",
      borderBottom: index < total - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
      background: !user.is_active ? "rgba(255,45,120,.02)" : "transparent",
    }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: user.id === currentUserId ? "#00ffe0" : "#fff" }}>
        {user.name} {user.id === currentUserId && <span style={{ fontSize: 8, color: "rgba(0,255,224,.5)" }}>(you)</span>}
      </div>
      <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,.4)" }}>{user.email}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.3)", textTransform: "capitalize", letterSpacing: "0.1em" }}>{formatAuthMethod(user.auth_method)}</div>
      <div>
        <select
          value={user.role}
          onChange={(e) => onRoleChange(user.id, e.target.value)}
          disabled={user.id === currentUserId}
          style={{
            background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 3, color: user.role === "admin" ? "#00ffe0" : "rgba(255,255,255,.5)",
            fontFamily: mono, fontSize: 8, padding: "3px 6px", cursor: "pointer",
            letterSpacing: "0.1em",
          }}
        >
          <option value="user">User</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div>
        <span style={{
          padding: "3px 10px", borderRadius: 2,
          fontFamily: mono, fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase",
          background: user.is_active ? "rgba(0,255,224,.08)" : "rgba(255,45,120,.08)",
          color: user.is_active ? "#00ffe0" : "#ff2d78",
          border: `1px solid ${user.is_active ? "rgba(0,255,224,.2)" : "rgba(255,45,120,.2)"}`,
        }}>
          {user.is_active ? "Active" : "Disabled"}
        </span>
      </div>
      <div>
        {user.id !== currentUserId && (
          <button onClick={() => onToggle(user.id)} style={{
            padding: "5px 12px", borderRadius: 3, cursor: "pointer",
            fontFamily: mono, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
            background: user.is_active ? "rgba(255,45,120,.08)" : "rgba(0,255,224,.08)",
            border: `1px solid ${user.is_active ? "rgba(255,45,120,.25)" : "rgba(0,255,224,.25)"}`,
            color: user.is_active ? "#ff2d78" : "#00ffe0",
            transition: "all .2s",
          }}>
            {user.is_active ? "Disable" : "Enable"}
          </button>
        )}
      </div>
    </div>
  );
});

/* ── Users panel ── */
const Users = React.memo(function Users({ users, onToggle, onRoleChange, currentUserId, onSearch, onRefresh }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Search data={users} keys={['name', 'email']} onFiltered={onSearch} />
        <Button variant="secondary" onClick={onRefresh} style={{ minWidth: 120, whiteSpace: 'nowrap' }}>
          Refresh
        </Button>
      </div>
      <div style={{ fontFamily: bebas, fontSize: 28, color: "#fff", letterSpacing: "0.15em", marginBottom: 24 }}>
        Registered Users
      </div>
      <div style={tableCardStyle}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr 1fr 1.2fr 1.2fr",
          columnGap: "12px",
          padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,.06)",
          fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.4)",
          letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          <div>Name</div><div>Email</div><div>Method</div><div>Role</div><div>Status</div><div>Actions</div>
        </div>

        {users.map((u, i) => (
          <UserRow 
            key={u.id} 
            user={u} 
            currentUserId={currentUserId} 
            onToggle={onToggle} 
            onRoleChange={onRoleChange}
            index={i}
            total={users.length}
          />
        ))}
      </div>
    </div>
  );
});

/* ── Log row component ── */
const LogRow = React.memo(function LogRow({ log, index, total }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr 1.2fr 1.5fr",
      columnGap: "12px",
      padding: "16px 24px", alignItems: "center",
      borderBottom: index < total - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
    }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: "#fff" }}>{log.user_name}</div>
      <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,.4)" }}>{log.email}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.3)", textTransform: "uppercase" }}>{log.method}</div>
      <div>
        <span style={{
          padding: "3px 10px", borderRadius: 2,
          fontFamily: mono, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
          background: log.status === "success" || log.status === "registered" ? "rgba(0,255,224,.08)"
            : "rgba(255,45,120,.08)",
          color: log.status === "success" || log.status === "registered" ? "#00ffe0" : "#ff2d78",
          border: `1px solid ${log.status === "success" || log.status === "registered" ? "rgba(0,255,224,.2)" : "rgba(255,45,120,.2)"}`,
        }}>
          {log.status}
        </span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.25)" }}>
        {new Date(log.logged_at).toLocaleString()}
      </div>
    </div>
  );
});

/* ── Logs panel ── */
const Logs = React.memo(function Logs({ logs, onSearch, onRefresh }) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => 
    filter === "all" ? logs : logs.filter(l => l.status === filter),
    [filter, logs]
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Search data={logs} keys={['user_name', 'email', 'method', 'status']} onFiltered={onSearch} />
        <Button variant="secondary" onClick={onRefresh} style={{ minWidth: 120, whiteSpace: 'nowrap' }}>
          Refresh
        </Button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <SectionHeader title="Access Logs" subtitle="Filter the latest access events by user, method or status." />
        <div style={{ display: "flex", gap: 8, flexWrap: 'wrap' }}>
          {["all", "success", "failed", "registered"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: 3, cursor: "pointer",
              fontFamily: mono, fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase",
              background: filter === f ? "rgba(0,255,224,.1)" : "transparent",
              border: `1px solid ${filter === f ? "rgba(0,255,224,.3)" : "rgba(255,255,255,.08)"}`,
              color: filter === f ? "#00ffe0" : "rgba(255,255,255,.3)",
              transition: "all .2s",
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={tableCardStyle}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr 1.2fr 1.5fr",
          columnGap: "12px",
          padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,.06)",
          fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.4)",
          letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          <div>User</div><div>Email</div><div>Method</div><div>Status</div><div>Time</div>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: 24, fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,.2)", textAlign: "center" }}>
            No logs found
          </div>
        )}

        {filtered.map((log, i) => (
          <LogRow key={log.id} log={log} index={i} total={filtered.length} />
        ))}
      </div>
    </div>
  );
});

/* ── Security panel ── */
const Security = React.memo(function Security({ users, logs }) {
  const riskSummary = useMemo(() => {
    const failedByEmail = logs.reduce((acc, log) => {
      if (log.status !== "failed") return acc;
      const key = log.email || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topRiskAccounts = Object.entries(failedByEmail)
      .map(([email, failedAttempts]) => ({
        email,
        failedAttempts,
        user: users.find((u) => u.email === email),
      }))
      .sort((a, b) => b.failedAttempts - a.failedAttempts)
      .slice(0, 5);

    const methodDistribution = logs.reduce((acc, log) => {
      const method = log.method || "unknown";
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});

    const today = new Date().toDateString();
    const todayAttempts = logs.filter((log) => new Date(log.logged_at).toDateString() === today).length;
    const failedToday = logs.filter((log) => log.status === "failed" && new Date(log.logged_at).toDateString() === today).length;

    return {
      topRiskAccounts,
      methodDistribution,
      todayAttempts,
      failedToday,
      inactiveUsers: users.filter((u) => !u.is_active).length,
    };
  }, [users, logs]);

  return (
    <div>
      <SectionHeader title="Security Center" subtitle="Monitor threats, suspicious activity, and authentication patterns." />
      <CardGrid gap={16}>
        <MetricCard label="Attempts Today" value={riskSummary.todayAttempts} accent="#00ffe0" />
        <MetricCard label="Failed Today" value={riskSummary.failedToday} accent="#ff2d78" />
        <MetricCard label="Inactive Users" value={riskSummary.inactiveUsers} accent="#ff8c00" />
      </CardGrid>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 20 }}>
        <div style={{ ...tableCardStyle, padding: 16 }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.35)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
            Top Risk Accounts (Failed Attempts)
          </div>
          {riskSummary.topRiskAccounts.length === 0 && (
            <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,.35)", padding: 10 }}>
              No failed attempts recorded.
            </div>
          )}
          {riskSummary.topRiskAccounts.map((entry) => (
            <div key={entry.email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 8px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 10, color: "#fff" }}>{entry.user?.name || "Unknown user"}</div>
                <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.35)", marginTop: 3 }}>{entry.email}</div>
              </div>
              <div style={{ fontFamily: bebas, fontSize: 24, color: "#ff2d78", letterSpacing: "0.06em" }}>{entry.failedAttempts}</div>
            </div>
          ))}
        </div>

        <div style={{ ...tableCardStyle, padding: 16 }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.35)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
            Authentication Mix
          </div>
          {Object.keys(riskSummary.methodDistribution).length === 0 && (
            <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,.35)", padding: 10 }}>
              No auth methods recorded yet.
            </div>
          )}
          {Object.entries(riskSummary.methodDistribution).map(([method, count]) => (
            <div key={method} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.65)", textTransform: "uppercase" }}>{method}</span>
                <span style={{ fontFamily: mono, fontSize: 9, color: "#00ffe0" }}>{count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,.07)" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    width: `${Math.max(8, (count / Math.max(logs.length, 1)) * 100)}%`,
                    background: "linear-gradient(90deg, rgba(0,255,224,.8), rgba(89,179,255,.8))",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/* ── Operations panel ── */
const Operations = React.memo(function Operations({ users, logs, onRefresh, onQuickDisable, onExportLogs, onSendBroadcast, currentBroadcast }) {
  const [announcement, setAnnouncement] = useState("");

  const opsStats = useMemo(() => {
    const activeUsers = users.filter((u) => u.is_active).length;
    const lastLog = logs[0];
    return { activeUsers, totalUsers: users.length, lastEvent: lastLog ? new Date(lastLog.logged_at).toLocaleString() : "No events" };
  }, [users, logs]);

  const sendBroadcast = async () => {
    if (!announcement.trim()) return;
    await onSendBroadcast(announcement.trim());
    setAnnouncement("");
  };

  return (
    <div>
      <SectionHeader title="Operations Hub" subtitle="Run quick operational actions and team communication." />
      <CardGrid gap={16}>
        <MetricCard label="Users Active Now" value={opsStats.activeUsers} accent="#00ffe0" small />
        <MetricCard label="Total Users" value={opsStats.totalUsers} accent="#59b3ff" small />
        <MetricCard label="Recent Event" value={opsStats.lastEvent} accent="#ff8c00" small />
      </CardGrid>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
        <div style={{ ...tableCardStyle, padding: 18 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#fff", marginBottom: 12, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Quick Actions
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <Button onClick={onRefresh}>Sync Data</Button>
            <Button variant="secondary" onClick={onExportLogs}>Export Logs (CSV)</Button>
            <Button variant="secondary" onClick={onQuickDisable}>Disable Highest-Risk Account</Button>
          </div>
        </div>

        <div style={{ ...tableCardStyle, padding: 18 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#fff", marginBottom: 12, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Broadcast Message
          </div>
          <textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Post a maintenance note for your team..."
            style={{
              width: "100%",
              minHeight: 90,
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 4,
              color: "#fff",
              padding: 10,
              resize: "vertical",
              fontFamily: mono,
              fontSize: 10,
              marginBottom: 10,
            }}
          />
          <Button onClick={sendBroadcast} disabled={!announcement.trim()}>Send Broadcast</Button>
          {currentBroadcast && (
            <div style={{ marginTop: 10, fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,.45)" }}>
              Last: "{currentBroadcast.message}" ({new Date(currentBroadcast.sent_at).toLocaleString()})
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const AdminSettings = React.memo(function AdminSettings({ user }) {
  const [draftPassword, setDraftPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [enabledMethods, setEnabledMethods] = useState(user?.auth_methods || []);
  const [status, setStatus] = useState("");
  const [updatingMethod, setUpdatingMethod] = useState("");

  const syncUserMethods = (methods) => {
    setEnabledMethods(methods || []);
    const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
    localStorage.setItem("user", JSON.stringify({ ...savedUser, auth_methods: methods || [] }));
  };

  const enrollMethod = async (method, opts = {}) => {
    const form = new FormData();
    form.append("method", method);
    if (opts.password) form.append("password", opts.password);
    if (opts.file) form.append("file", opts.file, opts.filename || "sample.bin");
    const res = await fetch(`${API}/auth/enroll-method`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || "Failed to update method");
    syncUserMethods(data.auth_methods || []);
  };

  const updatePassword = async () => {
    if (!draftPassword || draftPassword.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (draftPassword !== confirmPassword) {
      setStatus("Password confirmation does not match.");
      return;
    }
    try {
      setUpdatingMethod("password");
      await enrollMethod("none", { password: draftPassword });
      setDraftPassword("");
      setConfirmPassword("");
      setStatus("Password updated successfully.");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setUpdatingMethod("");
    }
  };

  const updateFace = async () => {
    try {
      setUpdatingMethod("face");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const blob = await captureFrameFromStream(stream);
      stream.getTracks().forEach((t) => t.stop());
      await enrollMethod("face", { file: blob, filename: "face.jpg" });
      setStatus("Face profile updated.");
    } catch (err) {
      setStatus(err.message || "Face update failed.");
    } finally {
      setUpdatingMethod("");
    }
  };

  const updateVoice = async () => {
    try {
      setUpdatingMethod("voice");
      const blob = await captureVoice(2600);
      await enrollMethod("voice", { file: blob, filename: "voice.wav" });
      setStatus("Voice profile updated.");
    } catch (err) {
      setStatus(err.message || "Voice update failed.");
    } finally {
      setUpdatingMethod("");
    }
  };

  return (
    <div>
      <SectionHeader title="Admin Settings" subtitle="Manage your own authentication credentials and biometric profiles." />
      <div style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 6, padding: 20, maxWidth: 640 }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: "#fff", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>
          Security Credentials
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
        <div style={{ display: "grid", gap: 8 }}>
          <Button onClick={updatePassword} disabled={updatingMethod !== ""}>
            {updatingMethod === "password" ? "Updating Password..." : "Update Password"}
          </Button>
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
      {status && (
        <div style={{ marginTop: 14, padding: "10px 12px", border: "1px solid rgba(0,255,224,.2)", borderRadius: 4, color: "#00ffe0", fontFamily: mono, fontSize: 9, letterSpacing: "0.08em" }}>
          {status}
        </div>
      )}
    </div>
  );
});

/* ── Main ── */
export default function AdminDashboard({ user, onLogout }) {
  const [active, setActive] = useState("overview");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [currentBroadcast, setCurrentBroadcast] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const logsRes = await fetch(`${API}/admin/logs`, { headers: authHeaders() });
      const logsData = await logsRes.json();
      setLogs(logsData);
      setFilteredLogs(logsData);

      if (user?.role === "admin") {
        const usersRes = await fetch(`${API}/admin/users`, { headers: authHeaders() });
        const usersData = await usersRes.json();
        setUsers(usersData);
        setFilteredUsers(usersData);
      } else {
        setUsers([]);
        setFilteredUsers([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const fetchCurrentBroadcast = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/broadcast/current`);
      if (!res.ok) return;
      const data = await res.json();
      setCurrentBroadcast(data || null);
    } catch {
      setCurrentBroadcast(null);
    }
  }, []);

  useEffect(() => {
    fetchCurrentBroadcast();
  }, [fetchCurrentBroadcast]);

  const handleToggle = useCallback(async (userId) => {
    await fetch(`${API}/admin/users/${userId}/toggle`, {
      method: "PATCH", headers: authHeaders(),
    });
    fetchData();
  }, [fetchData]);

  const handleRoleChange = useCallback(async (userId, role) => {
    try {
      const response = await fetch(`${API}/admin/users/${userId}/role?role=${role}`, {
        method: "PATCH", headers: authHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error("Role change failed:", error);
        alert(`Error: ${error.detail || 'Failed to change role'}`);
        return;
      }
      console.log(`Role changed to ${role} for user ${userId}`);
      await fetchData();
    } catch (err) {
      console.error("Role change error:", err);
      alert("Error changing role. Check console.");
    }
  }, [fetchData]);

  const exportLogsCsv = useCallback(() => {
    if (!logs.length) {
      setActionMessage("No logs to export.");
      return;
    }
    const header = ["id", "user_name", "email", "method", "status", "logged_at"];
    const rows = logs.map((log) => header.map((key) => `"${String(log[key] ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `access-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setActionMessage("Logs exported successfully.");
  }, [logs]);

  const disableHighestRiskAccount = useCallback(async () => {
    if (!users.length || !logs.length) {
      setActionMessage("Not enough data to run risk action.");
      return;
    }
    const failedByEmail = logs.reduce((acc, log) => {
      if (log.status !== "failed") return acc;
      const key = log.email || "";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topRisk = users
      .filter((u) => u.id !== user?.id && u.is_active)
      .map((u) => ({ userId: u.id, score: failedByEmail[u.email] || 0, email: u.email }))
      .sort((a, b) => b.score - a.score)[0];

    if (!topRisk || topRisk.score === 0) {
      setActionMessage("No risky active account found.");
      return;
    }

    try {
      await fetch(`${API}/admin/users/${topRisk.userId}/toggle`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      setActionMessage(`Disabled ${topRisk.email} (${topRisk.score} failed attempts).`);
      fetchData();
    } catch {
      setActionMessage("Failed to disable risky account.");
    }
  }, [users, logs, user?.id, fetchData]);

  const sendBroadcast = useCallback(async (message) => {
    try {
      const res = await fetch(`${API}/admin/broadcast`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data?.detail || "Failed to send broadcast.");
        return;
      }
      setCurrentBroadcast(data);
      setActionMessage("Broadcast sent to all users.");
    } catch {
      setActionMessage("Failed to send broadcast.");
    }
  }, []);

  // Memoize chart data
  const chartData = useMemo(() => ({
    successRate: {
      success: logs.filter(l => l.status === "success" || l.status === "registered").length,
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
        select option { background: #0a0a0a; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,224,.15); border-radius: 2px; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", background: "#040404" }}>
        <Sidebar active={active} onNav={setActive} user={user} onLogout={onLogout} />

        <main style={{ flex: 1, padding: "40px 40px", overflowY: "auto" }}>
          {loading ? (
            <div style={{ fontFamily: mono, color: "rgba(0,255,224,.4)", fontSize: 11, letterSpacing: "0.2em" }}>
              Loading...
            </div>
          ) : (
            <>
              {actionMessage && (
                <div style={{
                  marginBottom: 14,
                  padding: "10px 12px",
                  border: "1px solid rgba(0,255,224,.2)",
                  borderRadius: 4,
                  color: "#00ffe0",
                  fontFamily: mono,
                  fontSize: 9,
                  letterSpacing: "0.08em"
                }}>
                  {actionMessage}
                </div>
              )}
              {active === "overview" && <Overview users={users} logs={logs} />}
              {active === "analytics" && (
                <div>
                  <div style={{ fontFamily: bebas, fontSize: 28, color: "#fff", letterSpacing: "0.15em", marginBottom: 24 }}>
                    Analytics
                  </div>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <SuccessRatePie data={chartData.successRate} />
                    <LoginsOverTime logs={logs} />
                  </div>
                </div>
              )}
              {active === "users" && user?.role === "admin" && (
                <Users users={filteredUsers} onToggle={handleToggle} onRoleChange={handleRoleChange} currentUserId={user?.id} onSearch={setFilteredUsers} onRefresh={fetchData} />
              )}
              {active === "users" && user?.role !== "admin" && (
                <div style={{ padding: 24, borderRadius: 6, background: "rgba(10,10,10,.9)", border: "1px solid rgba(255,255,255,.06)" }}>
                  <div style={{ fontFamily: bebas, fontSize: 24, color: "#fff", marginBottom: 12 }}>
                    Management locked
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,.5)", lineHeight: 1.7 }}>
                    Supervisor users can review logs and analytics, but assigning users and changing roles is reserved for full administrators.
                  </div>
                </div>
              )}
              {active === "logs" && <Logs logs={filteredLogs} onSearch={setFilteredLogs} onRefresh={fetchData} />}
              {active === "security" && <Security users={users} logs={logs} />}
              {active === "operations" && (
                <Operations
                  users={users}
                  logs={logs}
                  onRefresh={fetchData}
                  onQuickDisable={disableHighestRiskAccount}
                  onExportLogs={exportLogsCsv}
                  onSendBroadcast={sendBroadcast}
                  currentBroadcast={currentBroadcast}
                />
              )}
              {active === "settings" && <AdminSettings user={user} />}
            </>
          )}
        </main>
      </div>
    </>
  );
}