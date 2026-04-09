import { X } from 'lucide-react'
import { format } from 'date-fns'
import Avatar from './Avatar'

export default function ProfileModal({ user: targetUser, onClose, currentUserId }) {
  const isSelf = targetUser?.id === currentUserId
  if (!targetUser) return null
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{isSelf ? 'Your profile' : 'User details'}</div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
          <Avatar name={targetUser.display_name || targetUser.username} src={targetUser.avatar_url} size={90} />
          <div style={{ fontSize:20, fontWeight:600, marginTop:12 }}>{targetUser.display_name || targetUser.username}</div>
          <div style={{ color:'var(--ink-40)', fontSize:13 }}>@{targetUser.username}</div>
        </div>
        <div style={{ padding:'0 20px 20px', display:'flex', flexDirection:'column', gap:14 }}>
          {targetUser.bio && <div><div style={{ fontSize:11, color:'var(--ink-40)', marginBottom:3 }}>BIO</div><div>{targetUser.bio}</div></div>}
          <div><div style={{ fontSize:11, color:'var(--ink-40)', marginBottom:3 }}>EMAIL</div><div>{targetUser.email || 'Not shared'}</div></div>
          <div><div style={{ fontSize:11, color:'var(--ink-40)', marginBottom:3 }}>JOINED</div><div>{format(new Date(targetUser.created_at), 'MMM d, yyyy')}</div></div>
          {targetUser.is_online && <div className="status-badge online">Online now</div>}
        </div>
      </div>
    </div>
  )
}
