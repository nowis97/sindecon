import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

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
    <div
      className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
      role="status"
    >
      <div className="inline-flex max-w-[92vw] items-center gap-3 rounded-full border border-slate-700/70 bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-xl backdrop-blur-md">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
        <span className="truncate">{message}</span>
        {action && (
          <button
            type="button"
            className="shrink-0 rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
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
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
          onClick={() => {
            setVisible(false)
            setTimeout(onClose, 300)
          }}
          aria-label="Cerrar notificación"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
