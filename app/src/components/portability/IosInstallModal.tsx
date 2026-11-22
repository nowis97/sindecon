import { Smartphone, Share, PlusSquare, CheckCircle2 } from 'lucide-react'
import { BaseModal, PILL_BTN_PRIMARY } from '../common/DialogModal'

interface IosInstallModalProps {
  isOpen: boolean
  onClose: () => void
}

export function IosInstallModal({ isOpen, onClose }: IosInstallModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Instalar en iPhone / iPad"
      subtitle="Acceso instantáneo a pantalla completa y 100% offline en guardia."
      icon={<Smartphone className="h-5 w-5" />}
      maxWidthClass="max-w-md"
      footer={
        <button type="button" className={PILL_BTN_PRIMARY} onClick={onClose}>
          Entendido
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60 p-3.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ch-accent)] font-mono text-xs font-bold text-white">
            1
          </span>
          <div className="text-xs leading-relaxed text-[var(--ch-text-secondary)]">
            <strong className="flex items-center gap-1.5 text-sm text-[var(--ch-text-primary)]">
              <Share className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>Toca el botón Compartir</span>
            </strong>
            <p className="mt-1">En la barra de Safari, pulsa el ícono de compartir.</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60 p-3.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ch-accent)] font-mono text-xs font-bold text-white">
            2
          </span>
          <div className="text-xs leading-relaxed text-[var(--ch-text-secondary)]">
            <strong className="flex items-center gap-1.5 text-sm text-[var(--ch-text-primary)]">
              <PlusSquare className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>Añadir a pantalla de inicio</span>
            </strong>
            <p className="mt-1">
              Desplázate en el menú de opciones y selecciona{' '}
              <strong>«Añadir a pantalla de inicio»</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60 p-3.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ch-accent)] font-mono text-xs font-bold text-white">
            3
          </span>
          <div className="text-xs leading-relaxed text-[var(--ch-text-secondary)]">
            <strong className="flex items-center gap-1.5 text-sm text-[var(--ch-text-primary)]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>Confirma «Añadir»</span>
            </strong>
            <p className="mt-1">
              Toca <strong>Añadir</strong> arriba a la derecha. SINDECON abrirá sin conexión y a
              pantalla completa.
            </p>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}
