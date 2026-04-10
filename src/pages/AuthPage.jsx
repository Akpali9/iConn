import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { MessageCircle } from 'lucide-react'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', username: '', name: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const updateField = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password)
        if (error) setError(error.message)
      } else {
        if (!form.username.trim()) {
          setError('Username is required')
          setBusy(false)
          return
        }
        if (form.password.length < 6) {
          setError('Password must be at least 6 characters')
          setBusy(false)
          return
        }
        const { error } = await signUp(form.email, form.password, form.username.trim(), form.name || form.username)
        if (error) {
          setError(error.message)
        } else {
          setError('Check your email to confirm your account, then sign in.')
        }
      }
    } catch (err) {
      console.error('Submit error:', err)
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="auth-root">
      {/* Brand panel */}
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-logo">
            <div className="auth-brand-icon">
              <MessageCircle size={26} color="#fff" />
            </div>
            <span className="auth-brand-name">iConn</span>
          </div>
          <p className="auth-brand-tagline">
            Real‑time conversations that feel effortless. Connect with anyone, anywhere.
          </p>
        </div>
        <div className="auth-brand-dots">
          <span /><span /><span />
        </div>
      </div>

      {/* Form panel */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-title">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </div>
            <div className="auth-card-sub">
              {mode === 'login' ? 'Welcome back to iConn' : 'Join iConn today — it\'s free'}
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <div className="field">
                  <label>Username</label>
                  <input
                    value={form.username}
                    onChange={updateField('username')}
                    placeholder="your_handle"
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label>Display name</label>
                  <input
                    value={form.name}
                    onChange={updateField('name')}
                    placeholder="Your Name"
                  />
                </div>
              </>
            )}
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={updateField('email')}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={updateField('password')}
                placeholder="••••••••"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in to iConn' : 'Create my account'}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login'
              ? <>Don't have an account? <span onClick={() => { setMode('signup'); setError('') }}>Sign up free</span></>
              : <>Already have an account? <span onClick={() => { setMode('login'); setError('') }}>Sign in</span></>}
          </div>
        </div>
      </div>
    </div>
  )
}
