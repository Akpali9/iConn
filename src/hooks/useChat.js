import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useMessages(conversationId) {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState([])
  const bottomRef = useRef(null)

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

    return () => supabase.removeChannel(channel)
  }, [conversationId])

  // Typing indicators
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
    return () => supabase.removeChannel(typingChannel)
  }, [conversationId, user.id])

  const sendMessage = async (content, replyToId = null) => {
    if (!content.trim() || !conversationId) return false
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      type: 'text',
      reply_to: replyToId || null,
    })
    if (error) {
      console.error('sendMessage error:', error)
      alert(`Failed to send: ${error.message}`)
      return false
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    return true
  }

  const editMessage = async (msgId, newContent) => {
    if (!newContent.trim()) return
    const { error } = await supabase
      .from('messages')
      .update({ content: newContent.trim(), is_edited: true })
      .eq('id', msgId)
    if (error) console.error('editMessage error:', error)
  }

  // ✅ CORRECTED: set content to '[deleted]' instead of null
  const deleteMessage = async (msgId) => {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true, content: '[deleted]' })
      .eq('id', msgId)
    if (error) console.error('deleteMessage error:', error)
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

// --------------------------------------------
//  useConversations – fetch & real‑time
// --------------------------------------------
export function useConversations() {
  const { user } = useAuth()
  const [convs, setConvs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = async () => {
    if (!user) return
    const { data: memberships, error: memErr } = await supabase
      .from('conversation_members')
      .select('conversation_id, role')
      .eq('user_id', user.id)
    if (memErr || !memberships?.length) {
      setConvs([])
      setLoading(false)
      return
    }
    const convIds = memberships.map(m => m.conversation_id)
    const { data: conversations, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .in('id', convIds)
      .order('updated_at', { ascending: false, nullsFirst: false })
    if (convErr) {
      console.error(convErr)
      setConvs([])
      setLoading(false)
      return
    }
    const convsWithMembers = await Promise.all(
      conversations.map(async (conv) => {
        const { data: members } = await supabase
          .from('conversation_members')
          .select(`
            user_id,
            role,
            profiles:user_id (
              id, username, display_name, avatar_url, is_online, last_seen, bio, created_at, email
            )
          `)
          .eq('conversation_id', conv.id)
        const allMembers = members?.map(m => ({ ...m.profiles, role: m.role })) || []
        const otherMembers = allMembers.filter(m => m.id !== user.id)
        return { ...conv, members: otherMembers, allMembers }
      })
    )
    setConvs(convsWithMembers)
    setLoading(false)
  }

  useEffect(() => {
    fetchConversations()
    const channel = supabase
      .channel('conversations-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => fetchConversations())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => fetchConversations())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])
  return { convs, loading, refetch: fetchConversations }
}

// --------------------------------------------
//  useUsers – search profiles
// --------------------------------------------
export function useUsers() {
  const search = async (query) => {
    let q = supabase.from('profiles').select('*')
    if (query) q = q.ilike('username', `%${query}%`).or(`display_name.ilike.%${query}%`)
    const { data, error } = await q.limit(20)
    if (error) return []
    return data || []
  }
  return { search }
}

// --------------------------------------------
//  startDirect – create or get existing DM
// --------------------------------------------
export async function startDirect(currentUserId, targetUserId) {
  try {
    const { data: myConvs } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', currentUserId)
    const convIds = myConvs.map(c => c.conversation_id)
    if (convIds.length) {
      const { data: existing } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', convIds)
        .limit(1)
      if (existing?.length) return existing[0].conversation_id
    }
    const { data: conv, error: createErr } = await supabase
      .from('conversations')
      .insert({ type: 'direct', created_by: currentUserId })
      .select()
      .single()
    if (createErr) throw createErr
    await supabase
      .from('conversation_members')
      .insert({ conversation_id: conv.id, user_id: targetUserId, role: 'member' })
    return conv.id
  } catch (err) {
    console.error('startDirect error:', err)
    return null
  }
}

// --------------------------------------------
//  startGroup – create group
// --------------------------------------------
export async function startGroup(creatorId, memberIds, groupName) {
  try {
    const { data: conv, error: createErr } = await supabase
      .from('conversations')
      .insert({ type: 'group', name: groupName, created_by: creatorId })
      .select()
      .single()
    if (createErr) throw createErr
    if (memberIds.length) {
      await supabase
        .from('conversation_members')
        .insert(memberIds.map(id => ({ conversation_id: conv.id, user_id: id, role: 'member' })))
    }
    return conv.id
  } catch (err) {
    console.error('startGroup error:', err)
    return null
  }
}

// --------------------------------------------
//  avatarColor helper
// --------------------------------------------
export function avatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i)
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 65%, 55%)`
}
