interface UpdateToastProps {
  needRefresh: boolean
  onUpdate: () => void
  onDismiss: () => void
}

export function UpdateToast({ needRefresh, onUpdate, onDismiss }: UpdateToastProps) {
  if (!needRefresh) return null

  return (
    <div className="pwa-update-toast" role="alert" aria-live="polite">
      <div className="pwa-update-content">
        <span className="pwa-update-icon" aria-hidden="true">✨</span>
        <div className="pwa-update-text">
          <strong className="pwa-update-title">Nueva versión disponible</strong>
          <span className="pwa-update-desc">Actualiza para recibir las últimas mejoras.</span>
        </div>
      </div>
      <div className="pwa-update-actions">
        <button
          type="button"
          className="btn-pwa-update"
          onClick={onUpdate}
        >
          🔄 Actualizar ahora
        </button>
        <button
          type="button"
          className="btn-pwa-dismiss"
          onClick={onDismiss}
          aria-label="Cerrar aviso de actualización"
          title="Posponer actualización"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
