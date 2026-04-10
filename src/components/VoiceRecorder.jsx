import { useState, useRef } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'   

export default function VoiceRecorder({ onSend, disabled }) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await sendAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (err) {
      console.error('Microphone error:', err)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const sendAudio = async (audioBlob) => {
    setProcessing(true)
    try {
      const fileName = `voice_${Date.now()}.webm`
      const { data, error } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' })
      
      if (error) {
        console.error('Upload error:', error)
        alert(`Upload failed: ${error.message}`)
        setProcessing(false)
        return
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(fileName)
      
      await onSend(publicUrl)
    } catch (err) {
      console.error('Audio error:', err)
      alert(`Failed to send voice message: ${err.message}`)
    }
    setProcessing(false)
  }

  if (processing) {
    return (
      <button className="send-btn" disabled style={{ background: 'var(--surface-3)' }}>
        <Loader2 size={17} className="spin" />
      </button>
    )
  }

  if (recording) {
    return (
      <button className="send-btn" onClick={stopRecording} style={{ background: 'var(--error)' }}>
        <Square size={17} />
      </button>
    )
  }

  return (
    <button className="send-btn" onClick={startRecording} disabled={disabled}>
      <Mic size={17} />
    </button>
  )
}
