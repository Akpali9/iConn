import { useState, useEffect } from 'react'
import { X, Users, UserPlus, UserMinus, Edit2, Trash2, LogOut, Upload, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import { useUsers } from '../hooks/useChat'

export default function GroupInfoModal({ conversation, onClose, onUpdate, currentUserId }) {
  const { user } = useAuth()
  const { search } = useUsers()
  const [members, setMembers] = useState(conversation.allMembers || [])
  const [groupName, setGroupName] = useState(conversation.name || '')
  const [groupAvatar, setGroupAvatar] = useState(conversation.avatar_url || '')
  const [isEditingName, setIsEditingName] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = members.find(m => m.id === currentUserId)?.role === 'admin'

  useEffect(() => {
    fetchMembers()
  }, [conversation.id])

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('conversation_members')
      .select(`
        user_id,
        role,
        profiles:user_id (id, username, display_name, avatar_url, is_online)
      `)
      .eq('conversation_id', conversation.id)
    if (!error && data) {
      const formatted = data.map(m => ({ ...m.profiles, role: m.role }))
      setMembers(formatted)
    }
  }

  const updateGroupName = async () => {
    if (!groupName.trim()) return
    const { error } = await supabase
      .from('conversations')
      .update({ name: groupName.trim() })
      .eq('id', conversation.id)
    if (!error) {
      setIsEditingName(false)
      onUpdate?.()
    } else {
      setError('Failed to update name')
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      return
    }
    setIsUploading(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `group_${conversation.id}_${Date.now()}.${fileExt}`
    const filePath = `groups/${fileName}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)
    if (uploadError) {
      setError('Upload failed: ' + uploadError.message)
      setIsUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ avatar_url: publicUrl })
      .eq('id', conversation.id)
    if (updateError) {
      setError('Failed to update avatar')
    } else {
      setGroupAvatar(publicUrl)
      onUpdate?.()
    }
    setIsUploading(false)
  }

  const addMember = async (userId) => {
    setLoading(true)
    const { error } = await supabase
      .from('conversation_members')
      .insert({ conversation_id: conversation.id, user_id: userId, role: 'member' })
    if (error) {
      setError(error.message)
    } else {
      await fetchMembers()
      setShowAddMember(false)
      setSearchQuery('')
      onUpdate?.()
    }
    setLoading(false)
  }

  const removeMember = async (userId) => {
    if (userId === currentUserId) {
      if (confirm('Leave this group?')) {
        await leaveGroup()
      }
      return
    }
    if (!confirm('Remove this member?')) return
    setLoading(true)
    const { error } = await supabase.rpc('remove_member', {
      conv_id: conversation.id,
      member_id: userId
    })
    if (error) {
      setError(error.message)
    } else {
      await fetchMembers()
      onUpdate?.()
    }
    setLoading(false)
  }

  const leaveGroup = async () => {
    setLoading(true)
    const { error } = await supabase.rpc('remove_member', {
      conv_id: conversation.id,
      member_id: currentUserId
    })
    if (error) {
      setError(error.message)
    } else {
      onClose(true) // true indicates conversation was left/deleted
    }
    setLoading(false)
  }

  const deleteGroup = async () => {
    if (!confirm('Delete this group permanently? All messages will be lost.')) return
    setLoading(true)
    const { error } = await supabase.rpc('delete_conversation', {
      conv_id: conversation.id
    })
    if (error) {
      setError(error.message)
    } else {
      onClose(true)
    }
    setLoading(false)
  }

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    const results = await search(query)
    const existingIds = members.map(m => m.id)
    setSearchResults(results.filter(u => !existingIds.includes(u.id) && u.id !== currentUserId))
  }

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  return (
    <div className="overlay" onClick={() => onClose(false)}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Group Info</div>
          <button className="icon-btn" onClick={() => onClose(false)}><X size={17} /></button>
        </div>
        <div className="modal-body">
          {/* Avatar & Name */}
          <div className="group-info-header">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Avatar name={groupName} src={groupAvatar} size={80} />
              {isAdmin && (
                <label htmlFor="group-avatar" style={{
                  position: 'absolute', bottom: 0, right: 0, background: 'var(--accent)',
                  borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--surface)'
                }}>
                  {isUploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                  <input id="group-avatar" type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              {isEditingName ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    className="search-inp"
                    style={{ padding: '6px 10px', fontSize: 14 }}
                    autoFocus
                  />
                  <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={updateGroupName}>Save</button>
                  <button className="icon-btn" onClick={() => setIsEditingName(false)}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{groupName}</h3>
                  {isAdmin && (
                    <button className="icon-btn" onClick={() => setIsEditingName(true)}><Edit2 size={14} /></button>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <div style={{ color: 'var(--error)', fontSize: 12, margin: '8px 0' }}>{error}</div>}

          {/* Members list */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>Members ({members.length})</h4>
              {isAdmin && (
                <button className="icon-btn" onClick={() => setShowAddMember(!showAddMember)}>
                  <UserPlus size={16} />
                </button>
              )}
            </div>

            {showAddMember && (
              <div style={{ marginBottom: 12 }}>
                <input
                  className="search-inp"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', marginBottom: 8 }}
                />
                {searchResults.map(u => (
                  <div key={u.id} className="user-row" onClick={() => addMember(u.id)}>
                    <Avatar name={u.display_name || u.username} src={u.avatar_url} size={36} />
                    <div><div>{u.display_name || u.username}</div><div className="ur-sub">@{u.username}</div></div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {members.map(m => (
                <div key={m.id} className="user-row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Avatar name={m.display_name || m.username} src={m.avatar_url} size={36} />
                    <div>
                      <div>{m.display_name || m.username} {m.id === currentUserId && '(You)'}</div>
                      <div className="ur-sub">{m.role === 'admin' ? 'Admin' : 'Member'}</div>
                    </div>
                  </div>
                  {(isAdmin && m.id !== currentUserId) && (
                    <button className="icon-btn" onClick={() => removeMember(m.id)}>
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ marginTop: 20, display: 'flex', gap: 12, flexDirection: 'column' }}>
            <button className="btn-primary" style={{ background: 'var(--error)' }} onClick={leaveGroup}>
              <LogOut size={16} style={{ marginRight: 8 }} /> Leave Group
            </button>
            {isAdmin && (
              <button className="btn-primary" style={{ background: 'var(--error)' }} onClick={deleteGroup}>
                <Trash2 size={16} style={{ marginRight: 8 }} /> Delete Group
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
