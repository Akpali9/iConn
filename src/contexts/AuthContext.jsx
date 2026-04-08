import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) setProfile(data)
    return data
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password, username, displayName) =>
    supabase.auth.signUp({ email, password, options: { data: { username, display_name: displayName } } })

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  const updateProfile = async (updates) => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single()
    if (data) setProfile(data)
    return { data, error }
  }

  return (
    <Ctx.Provider value={{ user, profile, loading, signUp, signIn, signOut, updateProfile, refreshProfile: () => loadProfile(user?.id) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
