import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Add this to useChat.js (after the other exports)

export function usePresence(userId) {
  const [isOnline, setIsOnline] = useState(false)
  const [lastSeen, setLastSeen] = useState(null)

  useEffect(() => {
    if (!userId) return

    // Subscribe to profile changes (online status)
    const channel = supabase
      .channel(`presence:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`
      }, (payload) => {
        setIsOnline(payload.new.is_online)
        setLastSeen(payload.new.last_seen)
      })
      .subscribe()

    // Initial fetch
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_online, last_seen')
        .eq('id', userId)
        .single()
      if (data) {
        setIsOnline(data.is_online)
        setLastSeen(data.last_seen)
      }
    }
    fetchStatus()

    // Update own online status periodically (every 30s)
    let interval
    if (userId === supabase.auth.user()?.id) {
      const updateOnline = async () => {
        await supabase
          .from('profiles')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('id', userId)
      }
      updateOnline()
      interval = setInterval(updateOnline, 30000)

      window.addEventListener('beforeunload', () => {
        supabase.from('profiles').update({ is_online: false }).eq('id', userId)
      })
    }

    return () => {
      supabase.removeChannel(channel)
      if (interval) clearInterval(interval)
      if (userId === supabase.auth.user()?.id) {
        supabase.from('profiles').update({ is_online: false }).eq('id', userId)
      }
    }
  }, [userId])

  return { isOnline, lastSeen }
}

export function useMessages(conversationId) {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState([])
  const bottomRef = useRef(null)

  // Fetch messages
  useEffect(() => {
    if (!conversationId) return
    setLoading(true)
    const fetchMsgs = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:sender_id (id, username, display_name, avatar_url),
          reply:messages!reply_to (
            id, content, profiles:sender_id (display_name, username)
          ),
          reactions (*, user_id)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (!error) setMsgs(data || [])
      setLoading(false)
    }
    fetchMsgs()

    // Real‑time subscription
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMsgs(prev => [...prev, payload.new])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMsgs(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMsgs(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Typing indicators real‑time
  useEffect(() => {
    if (!conversationId) return
    const typingChannel = supabase
      .channel(`typing:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_indicators', filter: `conversation_id=eq.${conversationId}` },
        async () => {
          const { data } = await supabase
            .from('typing_indicators')
            .select('user_id, profiles:user_id (display_name, username)')
            .eq('conversation_id', conversationId)
            .gt('updated_at', new Date(Date.now() - 5000).toISOString())
          setTyping(data?.filter(t => t.user_id !== user.id) || [])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(typingChannel) }
  }, [conversationId, user.id])

  const sendMessage = async (content, replyToId = null) => {
    if (!content.trim()) return false
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      reply_to: replyToId,
    })
    if (!error) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      return true
    }
    return false
  }

  const deleteMessage = async (msgId) => {
    await supabase.from('messages').update({ is_deleted: true, content: null }).eq('id', msgId)
  }

  const editMessage = async (msgId, newContent) => {
    await supabase.from('messages').update({ content: newContent, is_edited: true }).eq('id', msgId)
  }

  const reactToMessage = async (msgId, emoji) => {
    const existing = msgs.find(m => m.id === msgId)?.reactions?.find(r => r.user_id === user.id && r.emoji === emoji)
    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('reactions').insert({ message_id: msgId, user_id: user.id, emoji })
    }
  }

  const startTyping = useCallback(async () => {
    await supabase.from('typing_indicators').upsert({
      conversation_id: conversationId,
      user_id: user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'conversation_id, user_id' })
  }, [conversationId, user.id])

  return { msgs, loading, typing, sendMessage, deleteMessage, editMessage, reactToMessage, startTyping, bottomRef }
}

export function useConversations() {
  const { user } = useAuth()
  const [convs, setConvs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = async () => {
    const { data, error } = await supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        conversations:conversation_id (
          id, type, name, avatar_url, updated_at,
          members:conversation_members!inner (
            user_id, role,
            profiles:user_id (id, username, display_name, avatar_url, is_online, last_seen)
          )
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false, foreignTable: 'conversations' })

    if (error) {
      console.error(error)
      setConvs([])
    } else {
      // Transform to flat structure
      const formatted = data.map(item => ({
        id: item.conversations.id,
        type: item.conversations.type,
        name: item.conversations.name,
        updated_at: item.conversations.updated_at,
        members: item.conversations.members.filter(m => m.user_id !== user.id).map(m => m.profiles),
        allMembers: item.conversations.members.map(m => ({ ...m.profiles, role: m.role }))
      }))
      setConvs(formatted)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (user) fetchConversations()

    // Realtime for new conversations & updates
    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => fetchConversations())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => fetchConversations())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  return { convs, loading, refetch: fetchConversations }
}

export function useUsers() {
  const search = async (query) => {
    let q = supabase.from('profiles').select('*')
    if (query) q = q.ilike('username', `%${query}%`).or(`display_name.ilike.%${query}%`)
    const { data, error } = await q.limit(20)
    if (error) return []
    return data
  }
  return { search }
}

export async function startDirect(currentUserId, targetUserId) {
  // Check existing direct conversation
  const { data: existing } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', currentUserId)
    .filter('conversation_id', 'in', 
      supabase.from('conversation_members').select('conversation_id').eq('user_id', targetUserId)
    )
    .limit(1)
  
  if (existing?.length) return existing[0].conversation_id

  // Create new direct conversation
  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ type: 'direct', created_by: currentUserId })
    .select()
    .single()
  if (error) return null

  await supabase.from('conversation_members').insert([
    { conversation_id: conv.id, user_id: currentUserId, role: 'admin' },
    { conversation_id: conv.id, user_id: targetUserId, role: 'member' }
  ])
  return conv.id
}

export async function startGroup(creatorId, memberIds, groupName) {
  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ type: 'group', name: groupName, created_by: creatorId })
    .select()
    .single()
  if (error) return null

  const members = [{ user_id: creatorId, role: 'admin' }, ...memberIds.map(id => ({ user_id: id, role: 'member' }))]
  await supabase.from('conversation_members').insert(members.map(m => ({ conversation_id: conv.id, ...m })))
  return conv.id
}

export function avatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i)
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 65%, 55%)`
}
