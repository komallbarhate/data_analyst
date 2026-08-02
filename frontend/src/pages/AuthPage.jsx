import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Sparkles, User, Mail } from 'lucide-react'
import { login, register } from '../api/client'
import { useAuthStore } from '../store'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState('login')  // 'login' | 'register'
  const [loginField, setLoginField] = useState('email')  // 'email' | 'username'
  const [form, setForm] = useState({ email: '', username: '', password: '', loginValue: '' })
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
        // Backend accepts email field for both email and username lookup
        res = await login({ email: form.loginValue, password: form.password })
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

        {/* Mode Tab */}
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

            {mode === 'login' ? (
              // ── Login fields ──
              <div>
                {/* Email / Username toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${loginField === 'email' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, justifyContent: 'center', gap: 5 }}
                    onClick={() => setLoginField('email')}
                  >
                    <Mail size={13} /> Email
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${loginField === 'username' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, justifyContent: 'center', gap: 5 }}
                    onClick={() => setLoginField('username')}
                  >
                    <User size={13} /> Username
                  </button>
                </div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: 'var(--text-secondary)' }}>
                  {loginField === 'email' ? 'Email Address' : 'Username'}
                </label>
                <input
                  className="input"
                  type={loginField === 'email' ? 'email' : 'text'}
                  placeholder={loginField === 'email' ? 'you@example.com' : 'analyst42'}
                  value={form.loginValue}
                  onChange={(e) => setForm({ ...form, loginValue: e.target.value })}
                  required
                  autoComplete={loginField === 'email' ? 'email' : 'username'}
                />
              </div>
            ) : (
              // ── Register fields ──
              <>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: 'var(--text-secondary)' }}>
                    Email Address
                  </label>
                  <input
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    autoComplete="email"
                  />
                </div>
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
                    autoComplete="username"
                  />
                </div>
              </>
            )}

            {/* Password */}
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
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
