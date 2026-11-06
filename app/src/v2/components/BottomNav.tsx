import React from 'react'

export interface BottomNavProps {
  onFabClick: () => void
  onNavigateHome?: () => void
  onOpenSearch?: () => void
  activeTab?: 'home' | 'search' | 'notes' | string
  className?: string
}

export function BottomNav({
  onFabClick,
  onNavigateHome,
  onOpenSearch,
  activeTab = 'home',
  className = '',
}: BottomNavProps): React.JSX.Element {
  return (
    <nav
      className={`fixed bottom-0 inset-x-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 transition-colors ${className}`}
      aria-label="Navegación principal"
    >
      <div className="max-w-lg mx-auto h-16 px-8 flex items-center justify-between relative">
        {/* Inicio */}
        <button
          type="button"
          onClick={onNavigateHome}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'home'
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          aria-label="Inicio"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={activeTab === 'home' ? 2.2 : 1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          <span>Inicio</span>
        </button>

        {/* Botón Central Flotante (FAB) --- ( O ) --- */}
        <div className="absolute left-1/2 -top-5 -translate-x-1/2 flex items-center justify-center">
          <button
            type="button"
            onClick={onFabClick}
            className="bg-teal-600 hover:bg-teal-500 active:scale-95 text-white rounded-full p-4 shadow-lg ring-4 ring-white dark:ring-slate-900 transition-all duration-200 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-4 focus:ring-teal-400"
            aria-label="Nueva nota o carpeta"
            title="Crear nueva nota o carpeta"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* Buscar */}
        <button
          type="button"
          onClick={onOpenSearch}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'search'
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          aria-label="Buscar"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={activeTab === 'search' ? 2.2 : 1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <span>Buscar</span>
        </button>
      </div>
    </nav>
  )
}
