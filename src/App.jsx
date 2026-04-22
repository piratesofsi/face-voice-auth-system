import { useState, useEffect, useCallback, lazy, Suspense } from 'react'

const AuthPage = lazy(() => import('../pages/Auth'))
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'))
const UserDashboard = lazy(() => import('../pages/UserDashboard'))
const API = "http://localhost:8000"

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user")
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [authChecked, setAuthChecked] = useState(false)
  const [broadcast, setBroadcast] = useState(null)
  const [dismissedBroadcastAt, setDismissedBroadcastAt] = useState("")

  const readBroadcast = useCallback(() => {
    fetch(`${API}/admin/broadcast/current`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch broadcast")
        return res.json()
      })
      .then((payload) => {
        if (!payload?.message || !payload?.sent_at) {
          setBroadcast(null)
          return
        }
        setBroadcast(payload)
      })
      .catch(() => {
      setBroadcast(null)
      })
  }, [])

  const refreshCurrentUser = useCallback(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      setAuthChecked(true)
      return
    }

    fetch("http://localhost:8000/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unable to refresh user")
        return res.json()
      })
      .then((freshUser) => {
        localStorage.setItem("user", JSON.stringify(freshUser))
        setUser(freshUser)
      })
      .catch(() => {
        localStorage.removeItem("user")
        setUser(null)
      })
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    refreshCurrentUser()
  }, [refreshCurrentUser])

  useEffect(() => {
    const handleFocus = () => refreshCurrentUser()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [refreshCurrentUser])

  useEffect(() => {
    readBroadcast()
    const interval = setInterval(readBroadcast, 4000)
    return () => {
      clearInterval(interval)
    }
  }, [readBroadcast])

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("user")
    setUser(null)
  }

  const loadingStyle = {
    color: '#00ffe0',
    fontFamily: 'DM Mono, monospace',
    padding: 32,
    letterSpacing: '0.08em',
    fontSize: 12
  }

  const bannerVisible = Boolean(
    broadcast &&
      broadcast.sent_at &&
      broadcast.message &&
      dismissedBroadcastAt !== broadcast.sent_at
  )

  const pageWrapStyle = {
    minHeight: "100vh",
    background: "#040404",
    position: "relative",
  }

  const renderWithBroadcast = (content) => (
    <div style={pageWrapStyle}>
      {bannerVisible && (
        <div style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "10px 14px",
          borderBottom: "1px solid rgba(0,255,224,.22)",
          background: "rgba(2,18,16,.95)",
          color: "#00ffe0",
          fontFamily: "DM Mono, monospace",
          fontSize: 10,
          letterSpacing: "0.08em",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <span>
            Broadcast: {broadcast.message} ({new Date(broadcast.sent_at).toLocaleString()})
          </span>
          <button
            onClick={() => setDismissedBroadcastAt(broadcast.sent_at)}
            style={{
              border: "1px solid rgba(0,255,224,.25)",
              background: "rgba(0,255,224,.08)",
              color: "#00ffe0",
              borderRadius: 4,
              padding: "4px 8px",
              fontFamily: "DM Mono, monospace",
              fontSize: 9,
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {content}
    </div>
  )

  if (!authChecked) {
    return <div style={loadingStyle}>Loading session...</div>
  }

  if (!user) {
    return renderWithBroadcast(
      <Suspense fallback={<div style={loadingStyle}>Loading interface...</div>}>
        <AuthPage onSuccess={(u) => setUser(u)} />
      </Suspense>
    )
  }

  if (user.role === "admin" || user.role === "supervisor") {
    return renderWithBroadcast(
      <Suspense fallback={<div style={loadingStyle}>Loading dashboard...</div>}>
        <AdminDashboard user={user} onLogout={handleLogout} />
      </Suspense>
    )
  }

  return renderWithBroadcast(
    <Suspense fallback={<div style={loadingStyle}>Loading dashboard...</div>}>
      <UserDashboard user={user} onLogout={handleLogout} />
    </Suspense>
  )
}