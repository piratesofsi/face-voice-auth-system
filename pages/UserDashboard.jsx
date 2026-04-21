import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, SuccessRatePie, LoginsOverTime, MetricCard, Button, SectionHeader, CardGrid } from '../src/components/index.jsx';

const API = "http://localhost:8000";
const mono = "'DM Mono', monospace";
const bebas = "'Bebas Neue', sans-serif";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("access_token")}` };
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
            <div>
              <div style={{ fontFamily: bebas, fontSize: 28, color: "#fff", letterSpacing: "0.15em", marginBottom: 24 }}>
                Settings
              </div>
              <div style={{
                background: "rgba(10,10,10,0.9)", border: "1px solid rgba(0,255,224,.1)",
                borderRadius: 6, padding: "32px",
              }}>
                <h3 style={{ fontFamily: mono, fontSize: 14, color: "#00ffe0", marginBottom: 20, letterSpacing: "0.1em" }}>
                  Account Settings
                </h3>
                <p style={{ fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,.6)", marginBottom: 24 }}>
                  Change password, notification preferences, and more coming soon.
                </p>
                <Button variant="primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Update Password
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}