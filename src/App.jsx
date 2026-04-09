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
  const [sidebarOpen, setSidebarOpen] = useState(true) // for desktop

  // Detect mobile screen
  const isMobile = window.innerWidth <= 768
  const [mobileView, setMobileView] = useState('list') // 'list' or 'chat'

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      if (!mobile) {
        setMobileView('list')
        setSidebarOpen(true)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (activeConvId === '__profile__') {
      setShowProfileModal(true)
      setProfileUser(profile)
      setActiveConvId(null)
      if (isMobile) setMobileView('list')
    } else if (activeConvId) {
      const found = convs.find(c => c.id === activeConvId)
      setActiveConv(found)
      if (isMobile) setMobileView('chat')
    } else {
      setActiveConv(null)
      if (isMobile) setMobileView('list')
    }
  }, [activeConvId, convs, profile, isMobile])

  const handleSelectConversation = (id) => {
    setActiveConvId(id)
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const handleBackToList = () => {
    setActiveConvId(null)
    setMobileView('list')
  }

  if (authLoading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Login />

  return (
    <div className="app">
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Sidebar
          convs={convs}
          loading={convsLoading}
          activeId={activeConvId}
          onSelect={handleSelectConversation}
          onShowProfile={(u) => { setProfileUser(u); setShowProfileModal(true) }}
          onCloseSidebar={() => isMobile && setSidebarOpen(false)}
        />
      </div>
      <div className="chat-area">
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
          <div className="welcome-placeholder">
            <div className="welcome-icon">💬</div>
            <h2>Welcome to iConn</h2>
            <p>Select a conversation or start a new chat</p>
            {isMobile && convs.length > 0 && (
              <button className="btn-primary" onClick={() => setSidebarOpen(true)} style={{ marginTop: 20 }}>
                Open Conversations
              </button>
            )}
          </div>
        )}
      </div>

      {showProfileModal && (
        <ProfileModal
          user={profileUser}
          onClose={() => setShowProfileModal(false)}
          currentUserId={user.id}
          onProfileUpdate={refreshProfile}
        />
      )}

      {showGroupInfo && activeConv && (
        <GroupInfoModal
          conversation={activeConv}
          onClose={(shouldRefresh) => {
            setShowGroupInfo(false)
            if (shouldRefresh) {
              setActiveConvId(null)
              refetchConvs()
              if (isMobile) setMobileView('list')
            }
          }}
          currentUserId={user.id}
          onUpdate={() => refetchConvs()}
        />
      )}
    </div>
  )
}

export default App
