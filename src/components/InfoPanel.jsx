import { useState } from 'react'
import { X, Edit2, LogOut } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'

export default function InfoPanel({ conv, isSelf, onClose }) {
  const { profile, updateProfile, signOut } = useAuth()
  const [editing, setEditing] = useState(false)
  const [f, setF]             = useState({ display_name: profile?.display_name||'', status_text: profile?.status_text||'', bio: profile?.bio||'' })
  const [saving, setSaving]   = useState(false)

  const isGroup  = conv?.type === 'group'
  const partner  = conv?.members?.[0]
  const target   = isSelf ? profile : (isGroup ? null : partner)
  const name     = isSelf ? (profile?.display_name||'You') : (isGroup ? conv?.name : (partner?.display_name||partner?.username))

  const save = async () => {
    setSaving(true); await updateProfile(f); setSaving(false); setEditing(false)
  }

  return (
    <div className="info-panel">
      <div className="ip-head">
        <span className="ip-head-title">{isSelf ? 'My Profile' : isGroup ? 'Group Info' : 'Contact Info'}</span>
        <button className="icon-btn" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="ip-body">
        <div className="ip-av-wrap">
          <div style={{ position: 'relative' }}>
            <Avatar name={name} src={isSelf ? profile?.avatar_url : target?.avatar_url} size={76}
              style={{ boxShadow: '0 0 0 4px var(--accent-bg)' }} />
            {!isGroup && !isSelf && target?.is_online && (
              <div className="av-dot" style={{ width:14, height:14, border:'2.5px solid #fff' }} />
            )}
            {isSelf && (
              <button onClick={() => setEditing(v => !v)} style={{
                position:'absolute', bottom:0, right:0,
                width:26, height:26, borderRadius:'50%',
                background:'var(--accent)', border:'2px solid #fff',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', color:'#fff'
              }}><Edit2 size={12} /></button>
            )}
          </div>
        </div>

        {editing ? (
          <div style={{ marginBottom: 16 }}>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Display name</label>
              <input value={f.display_name} onChange={e => setF(p=>({...p,display_name:e.target.value}))} />
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Status</label>
              <input value={f.status_text} onChange={e => setF(p=>({...p,status_text:e.target.value}))} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} style={{ background:'var(--canvas)', border:'1.5px solid var(--canvas-3)', borderRadius:'var(--r-sm)', padding:'0 16px', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="ip-name">{name}</div>
            <div className="ip-status">{isSelf ? (profile?.status_text||'No status') : (target?.status_text||'No status')}</div>
          </>
        )}

        {/* Info blocks */}
        {isSelf && (
          <>
            <div className="info-block"><div className="ib-label">Username</div><div className="ib-val">@{profile?.username}</div></div>
            <div className="info-block"><div className="ib-label">Member since</div><div className="ib-val">{profile?.created_at ? format(new Date(profile.created_at),'MMMM yyyy') : '—'}</div></div>
            <button onClick={signOut} style={{ width:'100%', marginTop:8, background:'rgba(232,26,26,.07)', border:'1.5px solid rgba(232,26,26,.2)', borderRadius:'var(--r-sm)', padding:'11px 0', color:'var(--red)', fontFamily:'inherit', fontWeight:600, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <LogOut size={15} /> Sign out
            </button>
          </>
        )}

        {!isSelf && !isGroup && target && (
          <>
            <div className="info-block"><div className="ib-label">Username</div><div className="ib-val">@{target.username}</div></div>
            <div className="info-block">
              <div className="ib-label">Last seen</div>
              <div className="ib-val">{target.is_online ? '🟢 Online now' : target.last_seen ? format(new Date(target.last_seen),'MMM d, yyyy · HH:mm') : '—'}</div>
            </div>
            {target.bio && <div className="info-block"><div className="ib-label">Bio</div><div className="ib-val">{target.bio}</div></div>}
          </>
        )}

        {isGroup && conv && (
          <>
            <div className="info-block">
              <div className="ib-label">Members — {(conv.members?.length||0)+1}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
                {conv.members?.map(m => (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ position:'relative' }}>
                      <Avatar name={m.display_name||m.username} src={m.avatar_url} size={34} />
                      {m.is_online && <div className="av-dot" style={{ width:9, height:9 }} />}
                    </div>
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:500 }}>{m.display_name||m.username}</div>
                      <div style={{ fontSize:12, color:'var(--ink-40)' }}>@{m.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="info-block"><div className="ib-label">Created</div><div className="ib-val">{conv.created_at ? format(new Date(conv.created_at),'MMMM d, yyyy') : '—'}</div></div>
          </>
        )}
      </div>
    </div>
  )
}
