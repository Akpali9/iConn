import { X } from 'lucide-react'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', cancelText = 'Cancel' }) {
  if (!isOpen) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          <p style={{ margin: '0 0 20px 0', lineHeight: 1.5 }}>{message}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={onClose} style={{ background: 'var(--surface-2)', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>
              {cancelText}
            </button>
            <button className="btn-primary" onClick={onConfirm} style={{ background: 'var(--error)', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', color: 'white' }}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
