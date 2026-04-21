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
  const isAdmin = user?.role === "admin";
  const items = useMemo(() => [
    { id: "overview", icon: "◈", label: "Overview" },
    { id: "analytics", icon: "📊", label: "Analytics" },
    ...(isAdmin ? [{ id: "users", icon: "◉", label: "Users" }] : []),
    { id: "logs", icon: "▤", label: "Access Logs" },
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
function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: "rgba(10,10,10,0.9)", border: `1px solid ${accent}22`,
      borderRadius: 6, padding: "20px 24px", flex: 1,
    }}>
      <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(255,255,255,.3)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontFamily: bebas, fontSize: 42, color: accent, letterSpacing: "0.05em", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

/* ── Overview panel ── */
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
      <div style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6, overflow: "hidden" }}>
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
      <div style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6, overflow: "hidden" }}>
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

      <div style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6, overflow: "hidden" }}>
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

/* ── Main ── */
export default function AdminDashboard({ user, onLogout }) {
  const [active, setActive] = useState("overview");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);

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
            </>
          )}
        </main>
      </div>
    </>
  );
}