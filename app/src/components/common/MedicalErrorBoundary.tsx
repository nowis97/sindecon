import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureMedicalException } from '../../observability/sentry'

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
    // Reportar a Sentry (sanitizado automáticamente)
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
        <div className="error-boundary-screen" role="alert">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">🩺</div>
            <h2>Algo no salió como esperábamos</h2>
            <p className="error-boundary-lead">
              Se produjo un error al renderizar esta vista. Tus datos y apuntes clínicos en el
              dispositivo <strong>permanecen seguros</strong>.
            </p>

            {this.state.error && (
              <div className="error-boundary-details">
                <code>{this.state.error.name}: {this.state.error.message}</code>
              </div>
            )}

            <div className="error-boundary-actions">
              <button
                type="button"
                className="btn-dialog-primary"
                onClick={this.handleReload}
              >
                🔄 Recargar aplicación
              </button>
              <button
                type="button"
                className="btn-dialog-secondary"
                onClick={this.handleReset}
              >
                Reintentar vista
              </button>
              <button
                type="button"
                className="btn-dialog-secondary btn-copy-error"
                onClick={this.handleCopyError}
              >
                {this.state.copied ? '✓ Reporte copiado' : '📋 Copiar diagnóstico'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
