import { useEffect, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useConversations } from './hooks/useChat'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import ProfileModal from './components/ProfileModal'
import Login from './components/Login'

function App() {
  const { user, profile, loading: authLoading } = useAuth()
  const { convs, loading: convsLoading } = useConversations()
  const [activeConvId, setActiveConvId] = useState(null)
  const [activeConv, setActiveConv] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileUser, setProfileUser] = useState(null)

  useEffect(() => {
    if (activeConvId === '__profile__') {
      setShowProfileModal(true)
      setProfileUser(profile)
      setActiveConvId(null)
    } else if (activeConvId) {
      const found = convs.find(c => c.id === activeConvId)
      setActiveConv(found)
    } else {
      setActiveConv(null)
    }
  }, [activeConvId, convs, profile])

  if (authLoading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Login />

  return (
    <div className="app">
      <Sidebar
        convs={convs}
        loading={convsLoading}
        activeId={activeConvId}
        onSelect={setActiveConvId}
        onShowProfile={(u) => { setProfileUser(u); setShowProfileModal(true) }}
      />
      <div className="chat-area">
        {activeConv ? (
          <ChatView
            conv={activeConv}
            onShowInfo={() => {
              if (activeConv.type === 'direct' && activeConv.members[0]) {
                setProfileUser(activeConv.members[0])
                setShowProfileModal(true)
              } else if (activeConv.type === 'group') {
                // Group info modal can be added later
                alert('Group info coming soon')
              }
            }}
          />
        ) : (
          <div className="welcome-placeholder">
            <div className="welcome-icon">💬</div>
            <h2>Welcome to iConn</h2>
            <p>Select a conversation or start a new chat</p>
          </div>
        )}
      </div>
      {showProfileModal && (
        <ProfileModal
          user={profileUser}
          onClose={() => setShowProfileModal(false)}
          currentUserId={user.id}
        />
      )}
    </div>
  )
}

export default App
