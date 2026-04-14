import { useState, useEffect } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar'
import { useAuth } from '../contexts/AuthContext'

export default function ProfileModal({ user: targetUser, onClose, currentUserId, onProfileUpdate }) {
  const { refreshProfile, profile: currentProfile } = useAuth()
  const isSelf = targetUser?.id === currentUserId
  
  // ✅ Always use currentProfile for self, otherwise targetUser
  const [displayUser, setDisplayUser] = useState(isSelf ? currentProfile : targetUser)
  const [uploading, setUploading] = useState(false)
  const [avatarKey, setAvatarKey] = useState(0)

  // Update displayUser when props or context change
  useEffect(() => {
    if (isSelf) {
      setDisplayUser(currentProfile)
    } else {
      setDisplayUser(targetUser)
    }
  }, [isSelf, currentProfile, targetUser])

  // Force avatar re-render when displayUser.avatar_url changes
  useEffect(() => {
    if (displayUser?.avatar_url) {
      setAvatarKey(prev => prev + 1)
    }
  }, [displayUser?.avatar_url])

  if (!displayUser) return null

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB')
      return
    }

    setUploading(true)

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${currentUserId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', currentUserId)

    if (updateError) {
      alert('Failed to update profile: ' + updateError.message)
    } else {
      // ✅ Refresh the AuthContext profile
      await refreshProfile()
      
      // ✅ Immediately update local displayUser to avoid waiting for context
      setDisplayUser(prev => ({ ...prev, avatar_url: publicUrl }))
      
      // ✅ Force avatar component to re-mount
      setAvatarKey(prev => prev + 1)
      
      // ✅ Notify parent (e.g., sidebar) to also refresh
      if (onProfileUpdate) {
        onProfileUpdate({ avatar_url: publicUrl })
      }
    }

    setUploading(false)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{isSelf ? 'Your profile' : 'User details'}</div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>

        <div style={{ textAlign: 'center', padding: '16px 0 8px', position: 'relative' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Avatar 
              key={avatarKey}
              name={displayUser.display_name || displayUser.username || ''} 
              src={displayUser.avatar_url} 
              size={100} 
            />
            {isSelf && (
              <label 
                htmlFor="avatar-upload" 
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  background: 'var(--accent)',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '2px solid var(--surface)'
                }}
              >
                {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>
            {displayUser.display_name || displayUser.username}
          </div>
          <div style={{ color: 'var(--ink-40)', fontSize: 13 }}>@{displayUser.username}</div>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {displayUser.bio && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 3 }}>BIO</div>
              <div>{displayUser.bio}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 3 }}>EMAIL</div>
            <div>{displayUser.email || 'Not shared'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 3 }}>JOINED</div>
            <div>{displayUser.created_at ? format(new Date(displayUser.created_at), 'MMM d, yyyy') : 'Unknown'}</div>
          </div>
          {displayUser.is_online && (
            <div className="status-badge online" style={{ background:'var(--success)', color:'white', padding:'4px 12px', borderRadius:20, textAlign:'center', fontSize:12, width:'fit-content' }}>
              Online now
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
