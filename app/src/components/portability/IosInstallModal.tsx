import { useEffect } from 'react'

interface IosInstallModalProps {
  isOpen: boolean
  onClose: () => void
}

export function IosInstallModal({ isOpen, onClose }: IosInstallModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dialog-modal ios-install-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>📲 Instalar SINDECON en iPhone / iPad</h3>
          <button type="button" className="dialog-btn-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="dialog-body ios-install-body">
          <p className="ios-install-lead">
            Para instalar SINDECON en tu pantalla de inicio y usarla sin conexión en el hospital:
          </p>

          <div className="ios-install-steps">
            <div className="ios-step-card">
              <div className="ios-step-num">1</div>
              <div className="ios-step-content">
                <strong>Toca el botón Compartir</strong>
                <p>
                  En la barra inferior o superior de Safari, pulsa el icono de compartir{' '}
                  <span className="ios-icon-badge">⎋</span> / <span className="ios-icon-badge">⬆️</span>.
                </p>
              </div>
            </div>

            <div className="ios-step-card">
              <div className="ios-step-num">2</div>
              <div className="ios-step-content">
                <strong>Selecciona &quot;Añadir a pantalla de inicio&quot;</strong>
                <p>
                  Desplaza hacia abajo en el menú de opciones y toca{' '}
                  <span className="ios-icon-badge">➕ Añadir a pantalla de inicio</span>.
                </p>
              </div>
            </div>

            <div className="ios-step-card">
              <div className="ios-step-num">3</div>
              <div className="ios-step-content">
                <strong>Confirma &quot;Añadir&quot;</strong>
                <p>
                  Toca <strong>Añadir</strong> en la esquina superior derecha. ¡Listo! La app abrirá
                  a pantalla completa y funcionará 100% offline.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button type="button" className="btn-dialog-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
