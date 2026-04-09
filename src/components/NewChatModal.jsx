import { useState, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUsers, startDirect, startGroup } from '../hooks/useChat'
import Avatar from './Avatar'

export default function NewChatModal({ mode, onClose, onCreated }) {
  const { user } = useAuth()
  const { search } = useUsers()
  const [q, setQ] = useState('')
  const [results, setRes] = useState([])
  const [sel, setSel] = useState([])
  const [gName, setGName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { search('').then(setRes) }, [])
  useEffect(() => {
    const t = setTimeout(() => search(q).then(setRes), 250)
    return () => clearTimeout(t)
  }, [q])

  const toggle = (u) => {
    if (mode === 'direct') { create(u.id); return }
    setSel(p => p.find(x => x.id === u.id) ? p.filter(x => x.id !== u.id) : [...p, u])
  }

  const create = async (targetId) => {
    setBusy(true)
    let id
    if (mode === 'direct') id = await startDirect(user.id, targetId)
    else {
      if (!gName.trim() || sel.length === 0) { setBusy(false); return }
      id = await startGroup(user.id, sel.map(s => s.id), gName.trim())
    }
    setBusy(false)
    if (id) onCreated(id)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{mode === 'direct' ? 'New Chat' : 'New Group'}</div>
            <div className="modal-sub">{mode === 'direct' ? 'Select a person to message' : 'Pick members, then name your group'}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          {mode === 'group' && (
            <div style={{ marginBottom: 12 }}>
              <input className="search-inp" style={{ borderRadius:'var(--r-sm)', padding:'10px 14px', background:'var(--canvas)', border:'1.5px solid var(--canvas-3)', width:'100%' }}
                placeholder="Group name…" value={gName} onChange={e => setGName(e.target.value)} />
              {sel.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
                  {sel.map(u => (
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:5, background:'var(--canvas)', border:'1.5px solid var(--canvas-3)', borderRadius:99, padding:'3px 10px 3px 5px', fontSize:13 }}>
                      <Avatar name={u.display_name||u.username} size={22} />
                      <span>{u.display_name||u.username}</span>
                      <button onClick={() => toggle(u)} style={{ background:'none', border:'none', color:'var(--ink-40)', fontSize:15, padding:0, marginLeft:2 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="search-wrap" style={{ marginBottom: 10 }}>
            <Search size={14} />
            <input className="search-inp" placeholder="Search people…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          </div>
          {results.length === 0 ? (
            <div style={{ padding:'24px 0', textAlign:'center', color:'var(--ink-40)', fontSize:13.5 }}>No users found</div>
          ) : results.map(u => {
            const isSel = sel.find(s => s.id === u.id)
            return (
              <div key={u.id} className={`user-row ${isSel?'sel':''}`} onClick={() => toggle(u)}>
                <div className="av" style={{ position:'relative' }}>
                  <Avatar name={u.display_name||u.username} src={u.avatar_url} size={44} />
                  {u.is_online && <div className="av-dot" />}
                </div>
                <div className="ur-info">
                  <div className="ur-name">{u.display_name||u.username}</div>
                  <div className="ur-sub">@{u.username}</div>
                </div>
                {mode === 'group' && isSel && <div className="sel-check">✓</div>}
              </div>
            )
          })}
        </div>
        {mode === 'group' && (
          <div className="modal-foot">
            <button className="btn-primary" onClick={() => create()} disabled={busy || !gName.trim() || sel.length === 0}>
              {busy ? 'Creating…' : `Create group (${sel.length} member${sel.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
