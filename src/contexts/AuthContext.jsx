import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) setProfile(data)
    return data
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) await fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) await fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => listener?.subscription.unsubscribe()
  }, [])

  const refreshProfile = async () => {
    if (user) return await fetchProfile(user.id)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  // ✅ Improved signIn with error logging
  const signIn = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) console.error('SignIn error:', result.error)
    return result
  }

  // ✅ Improved signUp with fallback profile creation
  const signUp = async (email, password, username, displayName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase(),
            display_name: displayName || username
          }
        }
      })

      if (error) {
        console.error('SignUp error:', error)
        return { data, error }
      }

      // If user is created but profile wasn't (trigger may have failed), create it manually
      if (data?.user) {
        // Wait a moment for the trigger, then check
        setTimeout(async () => {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .single()

          if (!existingProfile) {
            // Manually create profile
            const { error: insertError } = await supabase.from('profiles').insert({
              id: data.user.id,
              username: username.toLowerCase(),
              display_name: displayName || username,
              email: email
            })
            if (insertError) console.error('Manual profile creation failed:', insertError)
          }
        }, 1000)
      }

      return { data, error }
    } catch (err) {
      console.error('SignUp exception:', err)
      return { data: null, error: err }
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
