import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { login, register } from '../api/client'
import { useAuthStore } from '../store'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState('login')  // 'login' | 'register'
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      let res
      if (mode === 'login') {
        res = await login({ email: form.email, password: form.password })
      } else {
        res = await register({ email: form.email, username: form.username, password: form.password })
      }
      const { access_token, user } = res.data
      setAuth(user, access_token)
      toast.success(`Welcome, ${user.username}!`)
      navigate('/')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Something went wrong'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Guest mode - skip auth
  const handleGuest = () => navigate('/')

  return (
    <div className="auth-page">
      <div className="auth-bg-glow" />
      <div className="auth-bg-glow auth-bg-glow-2" />

      <div className="auth-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28,
            boxShadow: '0 0 30px rgba(139,92,246,0.35)',
          }}>🤖</div>
          <h1 style={{ fontSize: 26, marginBottom: 4 }} className="text-gradient">DataMind AI</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
          </p>
        </div>

        {/* Tab */}
        <div className="tab-bar" style={{ marginBottom: 24 }}>
          <button className={`tab-item ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>
            Sign In
          </button>
          <button className={`tab-item ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: 'var(--text-secondary)' }}>
                Email
              </label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Username
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="analyst42"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4 }}
              disabled={loading}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div className="divider" style={{ margin: '16px 0' }} />
          <button
            className="btn btn-ghost"
            onClick={handleGuest}
            style={{ width: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            <Sparkles size={14} /> Continue as Guest
          </button>
        </div>
      </div>
    </div>
  )
}
