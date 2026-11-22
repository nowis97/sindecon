import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Stethoscope, RefreshCw, RotateCcw, Copy, Check } from 'lucide-react'
import { captureMedicalException } from '../../observability/sentry'
import { PILL_BTN_PRIMARY, PILL_BTN_SECONDARY } from './DialogModal'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  copied: boolean
}

export class MedicalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    copied: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureMedicalException(error, errorInfo.componentStack || undefined)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false })
  }

  private handleCopyError = async () => {
    if (!this.state.error) return
    const report = [
      `[Sindecon Error Report]`,
      `Fecha: ${new Date().toISOString()}`,
      `Error: ${this.state.error.name}: ${this.state.error.message}`,
      `Stack: ${this.state.error.stack || 'No stack disponible'}`,
      `URL: ${window.location.href}`,
      `Dispositivo: ${navigator.userAgent}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(report)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 3000)
    } catch {
      // Ignorar fallo de portapapeles
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          className="clinical-home flex min-h-screen items-center justify-center bg-[var(--ch-bg-primary)] p-4"
          role="alert"
        >
          <div className="flex w-full max-w-lg flex-col gap-5 rounded-[22px] border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-6 text-center shadow-[var(--ch-shadow-modal)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
              <Stethoscope className="h-7 w-7" />
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--ch-text-primary)]">
                Algo no salió como esperábamos
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ch-text-secondary)]">
                Se produjo un error al renderizar esta vista. Tus apuntes clínicos guardados en el
                dispositivo <strong>permanecen seguros</strong>.
              </p>
            </div>

            {this.state.error && (
              <div className="overflow-x-auto rounded-xl border border-red-500/25 bg-red-500/8 px-3.5 py-2.5 text-left font-mono text-xs text-red-700 dark:text-red-300">
                <code>
                  {this.state.error.name}: {this.state.error.message}
                </code>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button type="button" className={PILL_BTN_PRIMARY} onClick={this.handleReload}>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Recargar aplicación</span>
              </button>
              <button type="button" className={PILL_BTN_SECONDARY} onClick={this.handleReset}>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reintentar vista</span>
              </button>
              <button
                type="button"
                className={PILL_BTN_SECONDARY}
                onClick={this.handleCopyError}
              >
                {this.state.copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Reporte copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar diagnóstico</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
