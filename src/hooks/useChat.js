import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/* ─── avatar colour helper ────────────────────────────────────── */
const PALETTE = ['#e8501a','#1a6fe8','#1da462','#9333ea','#db2777','#d97706','#0891b2','#65a30d']
export function avatarColor(name = '') {
  return PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length]
}

/* ─── CONVERSATIONS ───────────────────────────────────────────── */
export function useConversations() {
  const { user } = useAuth()
  const [convs, setConvs]     = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        conversations (
          id, type, name, avatar_url, updated_at, created_at,
          conversation_members (
            user_id, role,
            profiles (id, display_name, username, avatar_url, is_online, last_seen, status_text)
          )
        )
      `)
      .eq('user_id', user.id)

    if (data) {
      const list = data.map(d => {
        const c = d.conversations
        const others = c.conversation_members.filter(m => m.user_id !== user.id).map(m => m.profiles)
        return { ...c, members: others }
      })
      list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      setConvs(list)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetch()
    const ch = supabase.channel('convs-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetch])

  return { convs, loading, refresh: fetch }
}

/* ─── MESSAGES ────────────────────────────────────────────────── */
export function useMessages(convId) {
  const { user }             = useAuth()
  const [msgs, setMsgs]      = useState([])
  const [loading, setLoading]= useState(true)
  const [typing, setTyping]  = useState([])
  const bottomRef            = useRef(null)
  const typingTimer          = useRef(null)

  const fetch = useCallback(async () => {
    if (!convId) return
    const { data } = await supabase
      .from('messages')
      .select(`
        id, content, type, is_edited, is_deleted, created_at, sender_id, reply_to,
        profiles:sender_id (id, display_name, username, avatar_url),
        reactions (id, emoji, user_id),
        reply:reply_to (id, content, profiles:sender_id(display_name))
      `)
      .eq('conversation_id', convId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
    if (data) setMsgs(data)
    setLoading(false)
  }, [convId])

  useEffect(() => {
    setLoading(true); setMsgs([])
    fetch()
    const ch = supabase.channel(`msgs:${convId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_indicators', filter: `conversation_id=eq.${convId}` }, async () => {
        const { data } = await supabase
          .from('typing_indicators')
          .select('user_id, profiles(display_name)')
          .eq('conversation_id', convId)
          .neq('user_id', user.id)
        setTyping(data || [])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [convId, fetch])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  const sendMessage = async (content, replyTo = null) => {
    if (!content.trim()) return false
    await stopTyping()
    const { error } = await supabase.from('messages').insert({
      conversation_id: convId, sender_id: user.id,
      content: content.trim(), type: 'text', reply_to: replyTo
    })
    return !error
  }

  const deleteMessage = (id) => supabase.from('messages').update({ is_deleted: true }).eq('id', id)
  const editMessage   = (id, content) => supabase.from('messages').update({ content, is_edited: true }).eq('id', id)

  const reactToMessage = async (msgId, emoji) => {
    const existing = msgs.find(m => m.id === msgId)?.reactions?.find(r => r.user_id === user.id && r.emoji === emoji)
    if (existing) await supabase.from('reactions').delete().eq('id', existing.id)
    else await supabase.from('reactions').insert({ message_id: msgId, user_id: user.id, emoji })
  }

  const startTyping = async () => {
    await supabase.from('typing_indicators').upsert({ conversation_id: convId, user_id: user.id }, { onConflict: 'conversation_id,user_id' })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(stopTyping, 3000)
  }
  const stopTyping = () => supabase.from('typing_indicators').delete().eq('conversation_id', convId).eq('user_id', user.id)

  return { msgs, loading, typing, sendMessage, deleteMessage, editMessage, reactToMessage, startTyping, bottomRef }
}

/* ─── USERS ───────────────────────────────────────────────────── */
export function useUsers() {
  const { user } = useAuth()
  const [all, setAll] = useState([])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').neq('id', user.id).then(({ data }) => { if (data) setAll(data) })
  }, [user])

  const search = async (q) => {
    const { data } = await supabase.from('profiles').select('*').neq('id', user.id)
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(20)
    return data || []
  }

  return { all, search }
}

/* ─── CREATE CONVERSATIONS ────────────────────────────────────── */
export async function startDirect(myId, theirId) {
  // check existing
  const { data } = await supabase.from('conversation_members').select('conversation_id, conversations(type)').eq('user_id', myId)
  if (data) {
    for (const row of data) {
      if (row.conversations?.type !== 'direct') continue
      const { data: match } = await supabase.from('conversation_members').select('user_id').eq('conversation_id', row.conversation_id).eq('user_id', theirId)
      if (match?.length) return row.conversation_id
    }
  }
  const { data: conv } = await supabase.from('conversations').insert({ type: 'direct', created_by: myId }).select().single()
  if (!conv) return null
  await supabase.from('conversation_members').insert([{ conversation_id: conv.id, user_id: myId }, { conversation_id: conv.id, user_id: theirId }])
  return conv.id
}

export async function startGroup(myId, memberIds, name) {
  const { data: conv } = await supabase.from('conversations').insert({ type: 'group', name, created_by: myId }).select().single()
  if (!conv) return null
  await supabase.from('conversation_members').insert([myId, ...memberIds].map(uid => ({ conversation_id: conv.id, user_id: uid, role: uid === myId ? 'admin' : 'member' })))
  return conv.id
}

/* ─── PRESENCE ────────────────────────────────────────────────── */
export function usePresence() {
  const { user } = useAuth()
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', user.id).then()
    const vis = () => supabase.from('profiles').update({ is_online: !document.hidden, last_seen: new Date().toISOString() }).eq('id', user.id).then()
    const bye = () => supabase.from('profiles').update({ is_online: false }).eq('id', user.id).then()
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('beforeunload', bye)
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('beforeunload', bye); bye() }
  }, [user])
}
