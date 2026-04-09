import { useState, useRef, useEffect } from 'react'
import { Phone, Video, Search, Info, Smile, Paperclip, Send, Mic, X } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import EmojiPicker from 'emoji-picker-react'
import { useAuth } from '../contexts/AuthContext'
import { useMessages } from '../hooks/useChat'
import Avatar from './Avatar'
import MessageBubble from './MessageBubble'
import CallModal from './CallModal'

export default function ChatView({ conv, onShowInfo }) {
  const { user } = useAuth()
  const { msgs, loading, typing, sendMessage, deleteMessage, editMessage, reactToMessage, startTyping, bottomRef } = useMessages(conv?.id)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [sending, setSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showCallModal, setShowCallModal] = useState(false)
  const [isVideoCall, setIsVideoCall] = useState(false)
  const taRef = useRef(null)
  const emojiButtonRef = useRef(null)

  const isGroup = conv?.type === 'group'
  const partner = !isGroup ? conv?.members?.[0] : null
  const name = isGroup ? (conv?.name || 'Group') : (partner?.display_name || partner?.username || 'Chat')
  const online = partner?.is_online

  useEffect(() => { taRef.current?.focus() }, [conv?.id])
  useEffect(() => {
    const handleClickOutside = (e) => { if (emojiButtonRef.current && !emojiButtonRef.current.contains(e.target)) setShowEmojiPicker(false) }
    document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    const ok = await sendMessage(text, replyTo?.id || null)
    if (ok) { setText(''); setReplyTo(null); if (taRef.current) taRef.current.style.height = 'auto' }
    setSending(false)
    taRef.current?.focus()
  }

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }
  const onInput = (e) => {
    setText(e.target.value); startTyping()
    const ta = e.target; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }
  const onEmojiClick = (emojiObject) => { setText(prev => prev + emojiObject.emoji); setShowEmojiPicker(false); taRef.current?.focus() }

  const grouped = groupByDate(msgs)
  if (!conv) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chat-head">
        <div className="av" style={{ position: 'relative', cursor: 'pointer' }} onClick={onShowInfo}>
          <Avatar name={name} src={partner?.avatar_url} size={42} />
          {online && <div className="av-dot" />}
        </div>
        <div className="chat-head-info" style={{ cursor: 'pointer' }} onClick={onShowInfo}>
          <div className="chat-head-name">{name}</div>
          <div className={`chat-head-sub ${!online && !isGroup ? 'off' : ''}`}>
            {isGroup ? `${(conv?.members?.length||0)+1} members` : online ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="head-acts">
          <button className="icon-btn" onClick={() => { setIsVideoCall(false); setShowCallModal(true) }} title="Voice call"><Phone size={16} /></button>
          <button className="icon-btn" onClick={() => { setIsVideoCall(true); setShowCallModal(true) }} title="Video call"><Video size={16} /></button>
          <button className="icon-btn"><Search size={16} /></button>
          <button className="icon-btn" onClick={onShowInfo}><Info size={16} /></button>
        </div>
      </div>
      <div className="msgs-scroll">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner" /></div>
        ) : msgs.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:12, color:'var(--ink-40)', paddingTop:60 }}>
            <div style={{ fontSize:48 }}>💬</div><p style={{ fontSize:14, textAlign:'center' }}>No messages yet. Say hi to {name}!</p>
          </div>
        ) : (
          grouped.map(({ date, items }) => (
            <div key={date}>
              <div className="date-sep"><span>{dateLabel(date)}</span></div>
              {items.map((msg, i) => (
                <div key={msg.id} style={{ marginBottom: 3 }}>
                  <MessageBubble
                    msg={msg}
                    showSender={isGroup && msg.sender_id !== items[i-1]?.sender_id}
                    onReply={setReplyTo}
                    onDelete={deleteMessage}
                    onEdit={editMessage}
                    onReact={reactToMessage}
                  />
                </div>
              ))}
            </div>
          ))
        )}
        {typing.length > 0 && (
          <div className="typing-wrap">
            <div className="typing-bubble"><div className="td" /><div className="td" /><div className="td" /></div>
            <div style={{ fontSize:11, color:'var(--ink-40)', marginTop:3, paddingLeft:4 }}>{typing.map(t => t.profiles?.display_name).join(', ')} typing…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-zone">
        {replyTo && (
          <div className="reply-bar">
            <div className="rb-body"><div className="rb-name">↩ {replyTo.profiles?.display_name || 'Reply'}</div><div className="rb-text">{replyTo.content?.slice(0, 80)}</div></div>
            <button className="icon-btn" onClick={() => setReplyTo(null)}><X size={14} /></button>
          </div>
        )}
        <div className="input-row">
          <button className="icon-btn"><Paperclip size={17} /></button>
          <div className="input-box" style={{ position: 'relative' }}>
            <button ref={emojiButtonRef} className="icon-btn" style={{ width:28, height:28, flexShrink:0 }} onClick={() => setShowEmojiPicker(!showEmojiPicker)}><Smile size={17} /></button>
            {showEmojiPicker && <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, zIndex: 1000 }}><EmojiPicker onEmojiClick={onEmojiClick} /></div>}
            <textarea ref={taRef} className="msg-inp" placeholder="Type a message…" value={text} onChange={onInput} onKeyDown={onKey} rows={1} />
          </div>
          <button className="send-btn" onClick={handleSend} disabled={!text.trim() || sending}>{text.trim() ? <Send size={17} /> : <Mic size={17} />}</button>
        </div>
      </div>
      {showCallModal && <CallModal conversationId={conv?.id} currentUserId={user.id} targetUserId={partner?.id} onClose={() => setShowCallModal(false)} isVideo={isVideoCall} />}
    </div>
  )
}

function groupByDate(msgs) { const map = {}; for (const m of msgs) { const d = format(new Date(m.created_at), 'yyyy-MM-dd'); if (!map[d]) map[d] = []; map[d].push(m) } return Object.entries(map).map(([date, items]) => ({ date, items })) }
function dateLabel(str) { const d = new Date(str); if (isToday(d)) return 'Today'; if (isYesterday(d)) return 'Yesterday'; return format(d, 'MMMM d, yyyy') }
