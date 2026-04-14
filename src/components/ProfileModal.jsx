import { useState, useEffect } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar'
import { useAuth } from '../contexts/AuthContext'

export default function ProfileModal({ user: targetUser, onClose, currentUserId, onProfileUpdate }) {
  const [uploading, setUploading] = useState(false)
  const { refreshProfile, profile: currentProfile } = useAuth()
  const isSelf = targetUser?.id === currentUserId
  const [localUser, setLocalUser] = useState(targetUser)
  
  // ✅ Cache buster – forces image reload when avatar URL changes
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now())

  // Sync localUser when targetUser changes
  useEffect(() => {
    setLocalUser(targetUser)
  }, [targetUser])

  // For self profile, sync with context profile (more reliable)
  useEffect(() => {
    if (isSelf && currentProfile) {
      setLocalUser(currentProfile)
      // Also bump cache buster when avatar URL changes
      if (currentProfile?.avatar_url) {
        setAvatarTimestamp(Date.now())
      }
    }
  }, [isSelf, currentProfile])

  if (!targetUser) return null

  // Helper to add cache buster to avatar URL
  const getAvatarSrc = (url) => {
    if (!url) return null
    return `${url}?v=${avatarTimestamp}`
  }

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
      // Refresh AuthContext profile
      await refreshProfile()
      
      // Update local state
      setLocalUser(prev => ({ ...prev, avatar_url: publicUrl }))
      
      // ✅ Force cache buster to reload the image
      setAvatarTimestamp(Date.now())
      
      // Notify parent (e.g., to update sidebar's cache buster)
      if (onProfileUpdate) {
        onProfileUpdate({ avatar_url: publicUrl, timestamp: Date.now() })
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
              name={localUser?.display_name || localUser?.username || ''} 
              src={getAvatarSrc(localUser?.avatar_url)}  // ✅ cache-busted src
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
            {localUser?.display_name || localUser?.username}
          </div>
          <div style={{ color: 'var(--ink-40)', fontSize: 13 }}>@{localUser?.username}</div>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {localUser?.bio && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 3 }}>BIO</div>
              <div>{localUser.bio}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 3 }}>EMAIL</div>
            <div>{localUser?.email || 'Not shared'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 3 }}>JOINED</div>
            <div>{localUser?.created_at ? format(new Date(localUser.created_at), 'MMM d, yyyy') : 'Unknown'}</div>
          </div>
          {localUser?.is_online && (
            <div className="status-badge online" style={{ background:'var(--success)', color:'white', padding:'4px 12px', borderRadius:20, textAlign:'center', fontSize:12, width:'fit-content' }}>
              Online now
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
