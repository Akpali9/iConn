import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    let error
    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      error = signUpError
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      error = signInError
    }
    if (error) alert(error.message)
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[var(--bg)]">
      <form onSubmit={handleSubmit} className="bg-[var(--surface)] p-8 rounded-2xl w-96 border border-[var(--border)]">
        <h1 className="text-2xl font-bold mb-6 text-center">iConn</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg mb-4 text-white"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg mb-6 text-white"
          required
        />
        <button type="submit" disabled={loading} className="w-full bg-[var(--accent)] py-3 rounded-lg font-semibold">
          {loading ? '...' : (isSignUp ? 'Sign Up' : 'Sign In')}
        </button>
        <p className="text-center text-sm mt-4 text-[var(--text-dim)]">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-[var(--accent)] ml-1">
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </form>
    </div>
  )
}
