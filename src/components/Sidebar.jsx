import { useState } from 'react'
import { MessageCircle, Users, UserPlus, Search, LogOut } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import NewChatModal from './NewChatModal'

export default function Sidebar({ convs, loading, activeId, onSelect, onShowProfile }) {
  const { profile, signOut } = useAuth()

  // 🔒 Critical: prevent rendering before profile is loaded
  if (!profile) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [modal, setModal] = useState(null)

  const filtered = convs.filter(c => {
    const name = convName(c)
    return name.toLowerCase().includes(q.toLowerCase())
  }).filter(c => tab === 'all' ? true : tab === 'groups' ? c.type === 'group' : c.type === 'direct')

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="sidebar-top-row">
            <div className="iconn-logo">
              <div className="iconn-logo-mark"><MessageCircle size={18} color="#fff" /></div>
              <span className="iconn-logo-name">i<span>Conn</span></span>
            </div>
            <div className="sidebar-actions">
              <button className="icon-btn" onClick={() => setModal('direct')}><UserPlus size={16} /></button>
              <button className="icon-btn" onClick={() => setModal('group')}><Users size={16} /></button>
            </div>
          </div>
          <div className="search-wrap">
            <Search size={14} />
            <input className="search-inp" placeholder="Search conversations…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="sidebar-tabs">
          {[['all','All'],['direct','Chats'],['groups','Groups']].map(([k,l]) => (
            <button key={k} className={`stab ${tab===k?'on':''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="conv-list">
          {loading ? (
            Array(6).fill(0).map((_,i) => <SkelItem key={i} />)
          ) : filtered.length === 0 ? (
            <div className="empty-list">{q ? 'No conversations match.' : 'No conversations yet.\nStart a new chat!'}</div>
          ) : (
            filtered.map(c => (
              <ConvRow key={c.id} c={c} active={c.id === activeId} onClick={() => onSelect(c.id)} onShowProfile={onShowProfile} />
            ))
          )}
        </div>
        <div className="sidebar-foot" onClick={() => onShowProfile(profile)}>
          <div className="av" style={{ position: 'relative' }}>
            <Avatar name={profile.display_name || ''} src={profile.avatar_url} size={40} />
            <div className="av-dot" />
          </div>
          <div className="sf-info">
            <div className="sf-name">{profile.display_name || 'You'}</div>
            <div className="sf-handle">@{profile.username || ''}</div>
          </div>
          <button className="icon-btn" onClick={e => { e.stopPropagation(); signOut() }} title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      {modal && (
        <NewChatModal
          mode={modal}
          onClose={() => setModal(null)}
          onCreated={(id) => { setModal(null); onSelect(id) }}
        />
      )}
    </>
  )
}

// ========== Helper Components ==========

function ConvRow({ c, active, onClick, onShowProfile }) {
  const name = convName(c)
  const member = c.members?.[0]
  const online = c.type === 'direct' && member?.is_online
  const ago = c.updated_at ? formatDistanceToNow(new Date(c.updated_at), { addSuffix: false }) : ''
  return (
    <div className={`conv-item ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="av" style={{ position: 'relative', cursor: c.type === 'direct' ? 'pointer' : 'default' }} onClick={(e) => { e.stopPropagation(); if (c.type === 'direct' && member) onShowProfile(member); }}>
        {c.type === 'group' ? <GrpAv members={c.members} /> : <Avatar name={name} src={member?.avatar_url} size={48} />}
        {online && <div className="av-dot" />}
      </div>
      <div className="conv-body">
        <div className="conv-row1"><span className="conv-name">{name}</span><span className="conv-time">{ago}</span></div>
        <div className="conv-row2"><span className="conv-preview">{c.type === 'group' ? `${(c.members?.length||0)+1} members` : online ? 'Online now' : 'Tap to chat'}</span></div>
      </div>
    </div>
  )
}

function GrpAv({ members = [] }) {
  const show = members.slice(0, 4)
  const colors = ['#e8501a','#1a6fe8','#1da462','#9333ea']
  return (
    <div className="grp-av">
      {Array(4).fill(0).map((_,i) => (
        <div key={i} className="grp-av-cell" style={{ background: show[i] ? colors[i] : 'var(--canvas-3)' }}>
          {show[i] ? (show[i].display_name?.[0]||'?').toUpperCase() : ''}
        </div>
      ))}
    </div>
  )
}

function SkelItem() {
  return (
    <div className="conv-item" style={{ pointerEvents: 'none' }}>
      <div className="skel" style={{ width:48, height:48, borderRadius:'50%', flexShrink:0 }} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        <div className="skel" style={{ height:13, width:'55%' }} />
        <div className="skel" style={{ height:11, width:'75%' }} />
      </div>
    </div>
  )
}

function convName(c) {
  if (c.type === 'group') return c.name || 'Group'
  return c.members?.[0]?.display_name || c.members?.[0]?.username || 'Unknown'
}
