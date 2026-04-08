import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { MessageCircle } from 'lucide-react'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]    = useState('login')
  const [f, setF]          = useState({ email: '', password: '', username: '', name: '' })
  const [err, setErr]      = useState('')
  const [busy, setBusy]    = useState(false)

  const upd = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(f.email, f.password)
        if (error) setErr(error.message)
      } else {
        if (!f.username.trim()) { setErr('Username is required'); setBusy(false); return }
        if (f.password.length < 6) { setErr('Password must be at least 6 characters'); setBusy(false); return }
        const { error } = await signUp(f.email, f.password, f.username.trim(), f.name || f.username)
        if (error) setErr(error.message)
        else setErr('Check your email to confirm your account, then sign in.')
      }
    } catch { setErr('Something went wrong.') }
    setBusy(false)
  }

  return (
    <div className="auth-root">
      {/* Brand panel */}
      <div className="auth-brand">
        <div className="auth-brand-logo">
          <div className="auth-brand-icon">
            <MessageCircle size={26} color="#fff" />
          </div>
          <span className="auth-brand-name">iConn</span>
        </div>
        <p className="auth-brand-tagline">
          Real-time conversations that feel effortless. Connect with anyone, anywhere.
        </p>
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

          {err && <div className="auth-error">{err}</div>}

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <>
                <div className="field">
                  <label>Username</label>
                  <input value={f.username} onChange={upd('username')} placeholder="your_handle" required autoComplete="off" />
                </div>
                <div className="field">
                  <label>Display name</label>
                  <input value={f.name} onChange={upd('name')} placeholder="Your Name" />
                </div>
              </>
            )}
            <div className="field">
              <label>Email</label>
              <input type="email" value={f.email} onChange={upd('email')} placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={f.password} onChange={upd('password')} placeholder="••••••••" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in to iConn' : 'Create my account'}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login'
              ? <>Don't have an account? <span onClick={() => { setMode('signup'); setErr('') }}>Sign up free</span></>
              : <>Already have an account? <span onClick={() => { setMode('login'); setErr('') }}>Sign in</span></>}
          </div>
        </div>
      </div>
    </div>
  )
}
