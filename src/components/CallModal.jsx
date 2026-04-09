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
  const peerRef = useRef(null)
  const channelRef = useRef(null)
  const initiatorRef = useRef(true)  // we are the caller

  useEffect(() => {
    // 1. Get user media
    navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo })
      .then(stream => {
        setLocalStream(stream)
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        // 2. Initialize call only after stream is ready
        initializeCall(stream)
      })
      .catch(err => {
        console.error('Media error:', err)
        alert('Cannot access camera/microphone. Please check permissions.')
        onClose()
      })

    return () => {
      // Cleanup
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
      if (peerRef.current) {
        peerRef.current.destroy()
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [])

  const initializeCall = async (stream) => {
    // Create a realtime channel for signaling
    const channel = supabase.channel(`call:${conversationId}`, {
      config: { broadcast: { ack: true } }
    })
    channelRef.current = channel

    // Listen for incoming signals
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      if (peerRef.current && payload.signal) {
        try {
          peerRef.current.signal(payload.signal)
        } catch (err) {
          console.error('Signal error:', err)
        }
      }
    })

    await channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Signaling channel ready')
      }
    })

    // Create peer (initiator = true because we started the call)
    const peer = new Peer({ initiator: true, stream, trickle: false })
    peerRef.current = peer

    peer.on('signal', (signal) => {
      // Send signal to other peer via broadcast
      channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { signal }
      })
    })

    peer.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream)
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }
      setCallStatus('active')
    })

    peer.on('error', (err) => {
      console.error('Peer error:', err)
      setCallStatus('ended')
      setTimeout(() => onClose(), 2000)
    })

    peer.on('close', () => {
      setCallStatus('ended')
      setTimeout(() => onClose(), 1000)
    })
  }

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled)
      setIsMuted(!isMuted)
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled)
      setIsVideoOff(!isVideoOff)
    }
  }

  const endCall = () => {
    if (peerRef.current) {
      peerRef.current.destroy()
    }
    onClose()
  }

  return (
    <div className="overlay" onClick={endCall}>
      <div className="call-modal" onClick={e => e.stopPropagation()}>
        <div className="call-container">
          {/* Remote video (full size) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Local video (picture-in-picture) */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="local-video"
            style={{
              position: 'absolute',
              bottom: 80,
              right: 16,
              width: 120,
              height: 160,
              objectFit: 'cover',
              borderRadius: 12,
              border: '2px solid white',
              zIndex: 10,
              backgroundColor: '#000'
            }}
          />
          {/* Controls */}
          <div className="call-controls">
            <button className="call-btn" onClick={toggleMute}>
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            {isVideo && (
              <button className="call-btn" onClick={toggleVideo}>
                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}
            <button className="call-btn end-call" onClick={endCall}>
              <PhoneOff size={20} />
            </button>
          </div>
          <div className="call-status">
            {callStatus === 'connecting' && 'Connecting...'}
            {callStatus === 'active' && 'Call in progress'}
            {callStatus === 'ended' && 'Call ended'}
          </div>
        </div>
      </div>
    </div>
  )
}
