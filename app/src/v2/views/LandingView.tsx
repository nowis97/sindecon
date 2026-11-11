import React, { useState } from 'react'
import { VitruvianLogo } from '../components/VitruvianLogo'
import { QuickLauncherGrid } from '../components/QuickLauncherGrid'
import {
  getStoredEmail,
  clearStoredToken,
  signInWithGoogle,
} from '../../pwa/googleDrive'

export interface LandingViewProps {
  onEnterRepository: (userName: string) => void
  onSwitchToV1?: () => void
}

export function LandingView({
  onEnterRepository,
  onSwitchToV1,
}: LandingViewProps): React.JSX.Element {
  const [userName, setUserName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('sindecon_user_name')
      if (saved) return saved
      const email = getStoredEmail()
      if (email) {
        return email.split('@')[0]
      }
    } catch {
      // Ignore if localStorage unavailable
    }
    return ''
  })

  const [password, setPassword] = useState<string>('')
  const [gdriveEmail, setGdriveEmail] = useState<string | null>(() => {
    try {
      return getStoredEmail()
    } catch {
      return null
    }
  })

  const handleConnectGoogle = () => {
    signInWithGoogle(
      (_token, email) => {
        if (email) {
          setGdriveEmail(email)
          setUserName((prev) => {
            if (!prev || prev.trim() === '') {
              return email.split('@')[0]
            }
            return prev
          })
        }
      },
      (err) => {
        console.warn('Google Drive auth warning:', err)
      },
    )
  }

  const handleDisconnectGoogle = () => {
    try {
      clearStoredToken(true)
    } catch {
      // Ignore
    }
    setGdriveEmail(null)
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }
    const finalName = userName.trim() || 'Colega'
    try {
      localStorage.setItem('sindecon_user_name', finalName)
    } catch {
      // Ignore
    }
    onEnterRepository(finalName)
  }

  return (
    <div className="sindecon-v2 min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Barra superior con botón discreto a V1 */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <span>V2 Mockup Design</span>
        </div>
        {onSwitchToV1 && (
          <button
            type="button"
            onClick={onSwitchToV1}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Cambiar a Vista Clásica V1"
            aria-label="Vista Clásica V1"
          >
            <span>⏪</span>
            <span>Vista Clásica V1</span>
          </button>
        )}
      </header>

      {/* Contenido principal: Hero y Formulario de Acceso */}
      <main className="w-full max-w-md mx-auto flex flex-col items-center my-auto">
        {/* Isotipo VitruvianLogo y Títulos */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3 flex items-center justify-center p-3.5 rounded-2xl bg-teal-50/90 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800/60 shadow-inner group">
            <VitruvianLogo
              size={64}
              className="text-teal-600 dark:text-teal-400 transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            SINDECON
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium max-w-sm">
            Sistema de Información y Notas para Decisiones Clínicas
          </p>
        </div>

        {/* Tarjeta de Formulario de Acceso */}
        <div className="w-full bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/40 p-6 sm:p-8 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Usuario */}
            <div>
              <label
                htmlFor="sindecon-user"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Usuario:
              </label>
              <input
                id="sindecon-user"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ej. Dr. Gregory House"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
              />
            </div>

            {/* Campo Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="sindecon-password"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                >
                  Contraseña:
                </label>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  PIN de privacidad opcional
                </span>
              </div>
              <input
                id="sindecon-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="PIN o clave de privacidad"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
              />
            </div>

            {/* Sección de Integración con Google Drive */}
            <div className="pt-1">
              {gdriveEmail ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-900 dark:text-teal-200">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M8.2 3.8 2.5 13.8l3.4 5.9 5.8-10.1L8.2 3.8Z" fill="#0066DA" />
                      <path d="M15.8 3.8H8.2l3.5 6 7.6-.1-3.5-5.9Z" fill="#00AC47" />
                      <path d="m11.7 9.8-5.8 10h12.3l5.8-10H11.7Z" fill="#EA4335" />
                      <path d="M17.5 13.8 11.7 3.8h.1l5.8 10h-.1Z" fill="#FFBA00" />
                    </svg>
                    <span className="truncate font-medium">{gdriveEmail}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 text-[11px] font-semibold underline underline-offset-2 ml-2 whitespace-nowrap cursor-pointer transition-colors"
                  >
                    Desconectar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M8.2 3.8 2.5 13.8l3.4 5.9 5.8-10.1L8.2 3.8Z" fill="#0066DA" />
                    <path d="M15.8 3.8H8.2l3.5 6 7.6-.1-3.5-5.9Z" fill="#00AC47" />
                    <path d="m11.7 9.8-5.8 10h12.3l5.8-10H11.7Z" fill="#EA4335" />
                    <path d="M17.5 13.8 11.7 3.8h.1l5.8 10h-.1Z" fill="#FFBA00" />
                  </svg>
                  <span>Conectar con Google Drive</span>
                </button>
              )}
            </div>

            {/* Botón Submit Entrar al Repositorio */}
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 cursor-pointer mt-2"
            >
              Entrar al Repositorio
            </button>
          </form>
        </div>
      </main>

      {/* Sección inferior: Rejilla de los 6 lanzadores rápidos */}
      <section className="w-full max-w-4xl mx-auto mt-10 mb-4" aria-label="Accesos rápidos del sistema">
        <div className="text-center mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Accesos Rápidos y Herramientas
          </h2>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Acceso directo a tus recursos clínicos, consulta con IA y correo hospitalario
          </p>
        </div>
        <QuickLauncherGrid />
      </section>

      {/* Pie de página sutil */}
      <footer className="w-full max-w-4xl mx-auto text-center py-2 text-[11px] text-slate-400 dark:text-slate-500">
        <p>SINDECON V2 · Cuaderno Médico Offline-first · Información y Decisiones Clínicas</p>
      </footer>
    </div>
  )
}
