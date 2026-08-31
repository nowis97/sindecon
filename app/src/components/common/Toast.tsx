import { useEffect, useState } from 'react'

export interface ToastProps {
  message: string | null
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
  onClose: () => void
}

export function Toast({ message, action, duration = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onClose, 300)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [message, duration, onClose])

  if (!message) return null

  return (
    <div className={`toast-container ${visible ? 'toast-show' : 'toast-hide'}`} role="status">
      <div className="toast-content">
        <span className="toast-message">{message}</span>
        {action && (
          <button
            type="button"
            className="toast-action-btn"
            onClick={() => {
              action.onClick()
              setVisible(false)
              setTimeout(onClose, 300)
            }}
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          className="toast-close"
          onClick={() => {
            setVisible(false)
            setTimeout(onClose, 300)
          }}
          aria-label="Cerrar notificación"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
