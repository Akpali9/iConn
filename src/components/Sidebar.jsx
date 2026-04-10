import { useState, useEffect } from 'react'
import { MessageCircle, Users, UserPlus, Search, LogOut, Trash2, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import NewChatModal from './NewChatModal'
import ConfirmDialog from './ConfirmDialog'
import { deleteConversation } from '../hooks/useChat'

export default function Sidebar({ convs, loading, activeId, onSelect, onShowProfile, onCloseSidebar }) {
  const { profile, signOut } = useAuth()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768)
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!profile) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }

  const filtered = convs.filter(c => {
    const name = c.type === 'group' ? (c.name || 'Group') : (c.members?.[0]?.display_name || c.members?.[0]?.username || 'Unknown')
    return name.toLowerCase().includes(q.toLowerCase())
  }).filter(c => tab === 'all' ? true : tab === 'groups' ? c.type === 'group' : c.type === 'direct')

  const handleDeleteClick = (convId, e) => {
    e.stopPropagation()
    setDeleteTarget(convId)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const ok = await deleteConversation(deleteTarget)
    if (ok) window.location.reload()
    else alert('Failed to delete conversation')
    setDeleteTarget(null)
  }

  return (
    <>
      <aside style={{
        width: isMobile ? '85%' : '320px',
        maxWidth: isMobile ? '300px' : 'none',
        background: '#18181b',
        borderRight: '1px solid #2a2a2f',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        color: '#ededee'
      }}>
        {isMobile && (
          <button onClick={onCloseSidebar} style={{ position: 'absolute', top: 16, right: 16, background: '#202024', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', zIndex: 10 }}>
            <X size={18} color="#9ca3af" />
          </button>
        )}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #2a2a2f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: '#3b82f6', width: 32, height: 32, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={18} color="#fff" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 18, color: '#ededee' }}>i<span style={{ fontWeight: 400, color: '#9ca3af' }}>Conn</span></span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setModal('direct')} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 6, borderRadius: 8 }}><UserPlus size={16} /></button>
              <button onClick={() => setModal('group')} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 6, borderRadius: 8 }}><Users size={16} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#202024', padding: '6px 12px', borderRadius: 40, border: '1px solid #2a2a2f' }}>
            <Search size={14} color="#9ca3af" />
            <input placeholder="Search conversations…" value={q} onChange={e => setQ(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#ededee', width: '100%', fontSize: 14 }} />
          </div>
        </div>

        {/* Profile section (top) */}
        <div onClick={() => onShowProfile(profile)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #2a2a2f', cursor: 'pointer', background: '#18181b' }}>
          <Avatar name={profile.display_name || ''} src={profile.avatar_url} size={48} />
          <div>
            <div style={{ fontWeight: 600, color: '#ededee' }}>{profile.display_name || 'You'}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>@{profile.username}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '12px 16px', borderBottom: '1px solid #2a2a2f' }}>
          {[['all','All'],['direct','Chats'],['groups','Groups']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, background: tab === k ? '#202024' : 'transparent', border: 'none', padding: '6px 0', borderRadius: 30, fontSize: 13, fontWeight: 500, color: tab === k ? '#ededee' : '#9ca3af', cursor: 'pointer' }}>{l}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading ? (
            Array(6).fill(0).map((_,i) => <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 16 }}><div style={{ width: 48, height: 48, borderRadius: '50%', background: '#202024' }} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ height: 13, width: '55%', background: '#202024', borderRadius: 8 }} /><div style={{ height: 11, width: '75%', background: '#202024', borderRadius: 8 }} /></div></div>)
          ) : filtered.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>{q ? 'No conversations match.' : 'No conversations yet.\nStart a new chat!'}</div>
          ) : (
            filtered.map(c => {
              const isGroup = c.type === 'group'
              const name = isGroup ? (c.name || 'Group') : (c.members?.[0]?.display_name || c.members?.[0]?.username || 'Unknown')
              const member = !isGroup ? c.members?.[0] : null
              const online = !isGroup && member?.is_online
              const ago = c.updated_at ? formatDistanceToNow(new Date(c.updated_at), { addSuffix: false }) : ''
              return (
                <div key={c.id} onClick={() => onSelect(c.id)} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 16, cursor: 'pointer', background: activeId === c.id ? '#202024' : 'transparent' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {isGroup ? (
                      <div style={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, overflow: 'hidden', background: '#202024' }}>
                        {c.members?.slice(0,4).map((m,i) => <div key={i} style={{ background: ['#e8501a','#1a6fe8','#1da462','#9333ea'][i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'white' }}>{(m.display_name?.[0]||'?').toUpperCase()}</div>)}
                        {Array(4 - (c.members?.slice(0,4).length || 0)).fill(0).map((_,i) => <div key={`empty-${i}`} style={{ background: '#2a2a2f' }} />)}
                      </div>
                    ) : (
                      <Avatar name={name} src={member?.avatar_url} size={48} />
                    )}
                    {online && <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, background: '#10b981', borderRadius: '50%', border: '2px solid #18181b' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ededee' }}>{name}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{ago}</span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isGroup ? `${(c.members?.length||0)+1} members` : online ? 'Online now' : 'Tap to chat'}</span>
                    </div>
                  </div>
                  <button onClick={(e) => handleDeleteClick(c.id, e)} style={{ opacity: 0.6, background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', marginLeft: 'auto', flexShrink: 0 }}><Trash2 size={14} /></button>
                </div>
              )
            })
          )}
        </div>

        <div onClick={() => onShowProfile(profile)} style={{ padding: '12px 16px', borderTop: '1px solid #2a2a2f', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: '#18181b' }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={profile.display_name || ''} src={profile.avatar_url} size={40} />
            <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, background: '#10b981', borderRadius: '50%', border: '2px solid #18181b' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 14, color: '#ededee' }}>{profile.display_name || 'You'}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>@{profile.username}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); signOut() }} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 6, borderRadius: 8 }}><LogOut size={15} /></button>
        </div>
      </aside>
      {modal && <NewChatModal mode={modal} onClose={() => setModal(null)} onCreated={(id) => { setModal(null); onSelect(id) }} />}
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete Conversation" message="Delete this conversation permanently? All messages will be lost for everyone." confirmText="Delete" cancelText="Cancel" />
    </>
  )
}
