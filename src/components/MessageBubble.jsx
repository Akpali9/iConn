import { useState } from 'react'
import { format } from 'date-fns'
import { Reply, Trash2, Pencil, SmilePlus, CheckCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const QUICK = ['👍','❤️','😂','😮','😢','🙏']

export default function MessageBubble({ msg, showSender, onReply, onDelete, onEdit, onReact }) {
  const { user } = useAuth()
  const isOwn = msg.sender_id === user?.id
  const [showRx, setShowRx] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(msg.content)

  const rxGroups = groupRx(msg.reactions || [])
  const hasRx = (e) => msg.reactions?.some(r => r.user_id === user.id && r.emoji === e)

  const saveEdit = async () => {
    if (editVal.trim() && editVal !== msg.content) await onEdit(msg.id, editVal.trim())
    setEditing(false)
  }

  // Deleted message
  if (msg.is_deleted) {
    return (
      <div className={`msg-wrap ${isOwn ? 'out' : 'in'}`}>
        <div className="msg-bubble deleted">This message was deleted</div>
      </div>
    )
  }

  // Audio message
  if (msg.type === 'audio' && msg.file_url) {
    return (
      <div className={`msg-wrap ${isOwn ? 'out' : 'in'}`}>
        {showSender && !isOwn && <div className="msg-sender">{msg.profiles?.display_name || msg.profiles?.username}</div>}
        <div className="msg-bubble" style={{ padding: '8px 12px' }}>
          <audio controls src={msg.file_url} style={{ maxWidth: '200px', height: '36px' }} />
        </div>
        <div className="msg-meta">
          <span className="msg-time">{format(new Date(msg.created_at), 'HH:mm')}</span>
          {isOwn && <CheckCheck size={13} className="check-icon" />}
        </div>
      </div>
    )
  }

  return (
    <div className={`msg-wrap ${isOwn ? 'out' : 'in'}`}>
      <div className="msg-actions">
        <button className="ma-btn" onClick={() => setShowRx(v => !v)}><SmilePlus size={13} /></button>
        <button className="ma-btn" onClick={() => onReply(msg)}><Reply size={13} /></button>
        {isOwn && (
          <>
            <button className="ma-btn" onClick={() => { setEditing(true); setEditVal(msg.content) }}><Pencil size={13} /></button>
            <button className="ma-btn del" onClick={() => onDelete(msg.id)}><Trash2 size={13} /></button>
          </>
        )}
      </div>

      {showRx && (
        <div className="quick-rx">
          {QUICK.map(e => (
            <button key={e} className="qr-btn" style={{ background: hasRx(e) ? 'var(--accent-bg)' : 'transparent', borderRadius: 8 }} onClick={() => { onReact(msg.id, e); setShowRx(false) }}>
              {e}
            </button>
          ))}
        </div>
      )}

      {showSender && !isOwn && <div className="msg-sender">{msg.profiles?.display_name || msg.profiles?.username}</div>}
      {msg.reply && (
        <div className="msg-reply-preview">
          <div className="mrp-name">{msg.reply.profiles?.display_name || 'Reply'}</div>
          <div className="mrp-text">{msg.reply.content?.slice(0, 70)}{msg.reply.content?.length > 70 ? '…' : ''}</div>
        </div>
      )}
      <div className="msg-bubble">
        {editing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }} style={{ flex:1, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:6, padding:'4px 8px', color:'inherit', fontSize:14, outline:'none' }} autoFocus />
            <button onClick={saveEdit} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:5, padding:'4px 10px', cursor:'pointer' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.5)', cursor:'pointer' }}>✕</button>
          </div>
        ) : (
          <div className="msg-text">{msg.content}</div>
        )}
      </div>
      <div className="msg-meta">
        {msg.is_edited && <span className="msg-edited">edited ·</span>}
        <span className="msg-time">{format(new Date(msg.created_at), 'HH:mm')}</span>
        {isOwn && <CheckCheck size={13} className="check-icon" />}
      </div>
      {rxGroups.length > 0 && (
        <div className="reactions-row">
          {rxGroups.map(({ emoji, count }) => (
            <div key={emoji} className="rx-chip" onClick={() => onReact(msg.id, emoji)}>
              <span>{emoji}</span>
              <span className="rx-chip-count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function groupRx(reactions) {
  const m = {}
  for (const r of reactions) m[r.emoji] = (m[r.emoji] || 0) + 1
  return Object.entries(m).map(([emoji, count]) => ({ emoji, count }))
}
