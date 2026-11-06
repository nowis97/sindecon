import React from 'react'
import './styles/v2.css'
import { VersionSwitcher } from './components/VersionSwitcher'
import { VitruvianLogo } from './components/VitruvianLogo'

export interface V2AppProps {
  onSwitchToV1: () => void
}

export function V2App({ onSwitchToV1 }: V2AppProps): React.JSX.Element {
  return (
    <div className="sindecon-v2 min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <VitruvianLogo size={32} className="text-teal-600 dark:text-teal-400" />
          <h1 className="text-xl font-bold tracking-tight">SINDECON</h1>
        </div>
        <VersionSwitcher currentVersion="v2" onToggle={onSwitchToV1} />
      </header>
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Bienvenido a SINDECON V2</h2>
          <p className="text-slate-500 mt-2">Nueva interfaz en proceso de construcción.</p>
        </div>
      </main>
    </div>
  )
}
