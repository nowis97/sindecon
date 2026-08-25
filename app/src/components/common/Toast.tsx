import { useEffect, useState } from 'react'

export interface ToastProps {
  message: string | null
  duration?: number
  onClose: () => void
}

export function Toast({ message, duration = 3500, onClose }: ToastProps) {
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
