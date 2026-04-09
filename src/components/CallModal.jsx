import { useEffect, useRef, useState } from 'react'
import { X, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'
import Peer from 'simple-peer'
import { supabase } from '../lib/supabase'

export default function CallModal({ conversationId, currentUserId, targetUserId, onClose, isVideo = true }) {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [callStatus, setCallStatus] = useState('connecting')
  const localVideoRef = useRef()
  const remoteVideoRef = useRef()
  const peerRef = useRef()
  const channelRef = useRef()

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo })
      .then(stream => {
        setLocalStream(stream)
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        initializeCall(stream)
      })
      .catch(err => { console.error(err); alert('Cannot access camera/microphone'); onClose() })
    return () => {
      if (localStream) localStream.getTracks().forEach(track => track.stop())
      if (peerRef.current) peerRef.current.destroy()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const initializeCall = async (stream) => {
    const channel = supabase.channel(`call:${conversationId}`)
    channelRef.current = channel
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => { if (peerRef.current) peerRef.current.signal(payload.signal) })
    await channel.subscribe()
    const peer = new Peer({ initiator: true, stream, trickle: false })
    peerRef.current = peer
    peer.on('signal', (signal) => channel.send({ type: 'broadcast', event: 'signal', payload: { signal } }))
    peer.on('stream', (remoteStream) => { setRemoteStream(remoteStream); if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream; setCallStatus('active') })
    peer.on('error', (err) => { console.error(err); setCallStatus('ended') })
    peer.on('close', () => setCallStatus('ended'))
  }

  const toggleMute = () => { if (localStream) { localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled); setIsMuted(!isMuted) } }
  const toggleVideo = () => { if (localStream) { localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled); setIsVideoOff(!isVideoOff) } }
  const endCall = () => { if (peerRef.current) peerRef.current.destroy(); onClose() }

  return (
    <div className="overlay" onClick={endCall}>
      <div className="call-modal" onClick={e => e.stopPropagation()}>
        <div className="call-container">
          <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <video ref={localVideoRef} autoPlay playsInline muted className="local-video" style={{ position: 'absolute', bottom: 80, right: 16, width: 120, height: 160, objectFit: 'cover', borderRadius: 12, border: '2px solid white', zIndex: 10 }} />
          <div className="call-controls">
            <button className="call-btn" onClick={toggleMute}>{isMuted ? <MicOff size={20} /> : <Mic size={20} />}</button>
            {isVideo && <button className="call-btn" onClick={toggleVideo}>{isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}</button>}
            <button className="call-btn end-call" onClick={endCall}><PhoneOff size={20} /></button>
          </div>
          <div className="call-status">{callStatus === 'connecting' && 'Connecting...'}{callStatus === 'active' && 'Call in progress'}{callStatus === 'ended' && 'Call ended'}</div>
        </div>
      </div>
    </div>
  )
}
