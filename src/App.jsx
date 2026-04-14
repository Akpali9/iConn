
import { useEffect, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useConversations } from './hooks/useChat'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import ProfileModal from './components/ProfileModal'
import GroupInfoModal from './components/GroupInfoModal'
import AuthPage from './pages/AuthPage'

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

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(true)   // desktop always open
      else setSidebarOpen(false)          // mobile closed by default
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle conversation selection
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
  if (!user) return <AuthPage />

  return (
    <div className="app">
      {/* Mobile backdrop */}
      {isMobile && (
        <div
          className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar wrapper */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Sidebar
          convs={convs}
          loading={convsLoading}
          activeId={activeConvId}
          onSelect={handleSelectConversation}
          onShowProfile={(u) => { setProfileUser(u); setShowProfileModal(true) }}
          onCloseSidebar={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main chat area */}
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
              <button className="btn-primary" onClick={toggleSidebar} style={{ marginTop: 20 }}>
                Open Conversations
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
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
              if (isMobile) setSidebarOpen(true)
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
