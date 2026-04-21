import { useState, useEffect, useCallback } from 'react'
import AuthPage from '../pages/Auth'
import AdminDashboard from '../pages/AdminDashboard'
import UserDashboard from '../pages/UserDashboard'

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

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("user")
    setUser(null)
  }

  if (!authChecked) {
    return <div style={{ color: '#00ffe0', fontFamily: 'DM Mono, monospace', padding: 32 }}>Loading session…</div>
  }

  if (!user) {
    return <AuthPage onSuccess={(u) => setUser(u)} />
  }

  if (user.role === "admin" || user.role === "supervisor") {
    return <AdminDashboard user={user} onLogout={handleLogout} />
  }

  return <UserDashboard user={user} onLogout={handleLogout} />
}