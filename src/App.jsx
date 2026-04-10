import { useEffect, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useConversations } from './hooks/useChat'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import ProfileModal from './components/ProfileModal'
import GroupInfoModal from './components/GroupInfoModal'
import Login from './components/Login'

function App() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const { convs, loading: convsLoading, refetch: refetchConvs } = useConversations()
  const [activeConvId, setActiveConvId] = useState(null)
  const [activeConv, setActiveConv] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(true)
      else setSidebarOpen(false)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (activeConvId === '__profile__') {
      setShowProfileModal(true)
      setProfileUser(profile)
      setActiveConvId(null)
    } else if (activeConvId) {
      const found = convs.find(c => c.id === activeConvId)
      setActiveConv(found)
      if (isMobile) setSidebarOpen(false)
    } else {
      setActiveConv(null)
    }
  }, [activeConvId, convs, profile, isMobile])

  const handleSelectConversation = (id) => {
    setActiveConvId(id)
    if (isMobile) setSidebarOpen(false)
  }

  const handleBackToList = () => {
    setActiveConvId(null)
    if (isMobile) setSidebarOpen(true)
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  if (authLoading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Login />

  return (
    <div className="app">
      {isMobile && (
        <div
          className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            opacity: sidebarOpen ? 1 : 0,
            visibility: sidebarOpen ? 'visible' : 'hidden',
            transition: 'opacity 0.3s ease'
          }}
        />
      )}

      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 1000,
        transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition: 'transform 0.3s ease'
      }}>
        <Sidebar
          convs={convs}
          loading={convsLoading}
          activeId={activeConvId}
          onSelect={handleSelectConversation}
          onShowProfile={(u) => { setProfileUser(u); setShowProfileModal(true) }}
          onCloseSidebar={() => setSidebarOpen(false)}
        />
      </div>

      <div className="chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0f12' }}>
        {activeConv ? (
          <ChatView
            conv={activeConv}
            onShowInfo={() => {
              if (activeConv.type === 'direct' && activeConv.members[0]) {
                setProfileUser(activeConv.members[0])
                setShowProfileModal(true)
              } else if (activeConv.type === 'group') {
                setShowGroupInfo(true)
              }
            }}
            onBack={isMobile ? handleBackToList : null}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#9ca3af' }}>
            <div style={{ fontSize: 64 }}>💬</div>
            <h2 style={{ color: '#ededee' }}>Welcome to iConn</h2>
            <p>Select a conversation or start a new chat</p>
            {isMobile && convs.length > 0 && (
              <button onClick={toggleSidebar} style={{ background: '#3b82f6', border: 'none', padding: '10px 16px', borderRadius: 40, fontWeight: 600, color: 'white', cursor: 'pointer', marginTop: 20 }}>
                Open Conversations
              </button>
            )}
          </div>
        )}
      </div>

      {showProfileModal && (
        <ProfileModal user={profileUser} onClose={() => setShowProfileModal(false)} currentUserId={user.id} onProfileUpdate={refreshProfile} />
      )}
      {showGroupInfo && activeConv && (
        <GroupInfoModal conversation={activeConv} onClose={(shouldRefresh) => { setShowGroupInfo(false); if (shouldRefresh) { setActiveConvId(null); refetchConvs(); if (isMobile) setSidebarOpen(true); } }} currentUserId={user.id} onUpdate={() => refetchConvs()} />
      )}
    </div>
  )
}

export default App
