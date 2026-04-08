import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import { useConversations, usePresence } from './hooks/useChat'
import AuthPage from './pages/AuthPage'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import InfoPanel from './components/InfoPanel'

function Shell() {
  const { user, loading }               = useAuth()
  const { convs, loading: convsLoading } = useConversations()
  const [activeId, setActiveId]          = useState(null)
  const [showInfo, setShowInfo]          = useState(false)
  usePresence()

  if (loading) return (
    <div className="loader-screen">
      <div style={{ width:52, height:52, background:'var(--accent)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px var(--accent-glow)' }}>
        <MessageCircle size={26} color="#fff" />
      </div>
      <div className="spinner" />
    </div>
  )

  if (!user) return <AuthPage />

  const activeConv = convs.find(c => c.id === activeId)
  const isSelfProfile = activeId === '__profile__'

  return (
    <div className="app-shell">
      <Sidebar
        convs={convs}
        loading={convsLoading}
        activeId={activeId}
        onSelect={(id) => { setActiveId(id); setShowInfo(false) }}
      />

      {/* Chat or welcome */}
      <div className="chat-main">
        {activeConv ? (
          <ChatView conv={activeConv} onShowInfo={() => setShowInfo(v => !v)} />
        ) : isSelfProfile ? (
          // self-profile shown via panel; main area shows welcome
          <div className="welcome-pane">
            <div className="welcome-icon"><MessageCircle size={34} /></div>
            <div className="welcome-title">Your Profile</div>
            <div className="welcome-sub">Edit your name, status and bio in the panel on the right.</div>
          </div>
        ) : (
          <div className="welcome-pane">
            <div className="welcome-icon"><MessageCircle size={34} /></div>
            <div className="welcome-title">Welcome to iConn</div>
            <div className="welcome-sub">Select a conversation from the sidebar or start a new chat to get connected.</div>
          </div>
        )}
      </div>

      {/* Info / profile panel */}
      {showInfo && activeConv && (
        <InfoPanel conv={activeConv} isSelf={false} onClose={() => setShowInfo(false)} />
      )}
      {isSelfProfile && (
        <InfoPanel conv={null} isSelf onClose={() => setActiveId(null)} />
      )}
    </div>
  )
}

export default function App() {
  return <Shell />
}
