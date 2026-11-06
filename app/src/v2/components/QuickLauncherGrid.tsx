import React from 'react'

export interface QuickLauncherItem {
  id: string
  name: string
  url: string
  description: string
  icon: React.ReactNode
  badgeColor?: string
}

export interface QuickLauncherGridProps {
  className?: string
}

export const QUICK_LAUNCHERS: QuickLauncherItem[] = [
  {
    id: 'drive',
    name: 'Google Drive',
    url: 'https://drive.google.com',
    description: 'Nube institucional y archivos clínicos',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8.2 3.8 2.5 13.8l3.4 5.9 5.8-10.1L8.2 3.8Z" fill="#0066DA" />
        <path d="M15.8 3.8H8.2l3.5 6 7.6-.1-3.5-5.9Z" fill="#00AC47" />
        <path d="m11.7 9.8-5.8 10h12.3l5.8-10H11.7Z" fill="#EA4335" />
        <path d="M17.5 13.8 11.7 3.8h.1l5.8 10h-.1Z" fill="#FFBA00" />
      </svg>
    ),
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    description: 'Asistente de consulta y redacción',
    icon: (
      <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12" />
        <path d="M12 6a6 6 0 0 1 6 6 6 6 0 0 1-6 6" />
        <path d="M12 10a2 2 0 0 1 2 2 2 2 0 0 1-2 2" />
      </svg>
    ),
  },
  {
    id: 'outlook',
    name: 'Outlook',
    url: 'https://outlook.office.com',
    description: 'Correo hospitalario y reuniones',
    icon: (
      <svg className="w-6 h-6 text-sky-600 dark:text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="18" height="14" x="3" y="5" rx="2" />
        <circle cx="9" cy="12" r="2.5" />
        <path d="m13 14.5 4-4" />
        <path d="m17 14.5-4-4" />
      </svg>
    ),
  },
  {
    id: 'canvas',
    name: 'Canvas',
    url: 'https://canvas.instructure.com',
    description: 'Plataforma docente y cursos',
    icon: (
      <svg className="w-6 h-6 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="4" r="1.5" />
        <circle cx="18" cy="7" r="1.5" />
        <circle cx="20" cy="12" r="1.5" />
        <circle cx="18" cy="17" r="1.5" />
        <circle cx="12" cy="20" r="1.5" />
        <circle cx="6" cy="17" r="1.5" />
        <circle cx="4" cy="12" r="1.5" />
        <circle cx="6" cy="7" r="1.5" />
      </svg>
    ),
  },
  {
    id: 'curriculum',
    name: 'Mi Currículum',
    url: 'https://www.linkedin.com',
    description: 'Perfil académico y certificaciones',
    icon: (
      <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M7 7h.01" />
        <path d="M7 11v6" />
        <path d="M11 11v6" />
        <path d="M11 14a2.5 2.5 0 0 1 5 0v3" />
      </svg>
    ),
  },
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com',
    description: 'Bandeja de entrada personal',
    icon: (
      <svg className="w-6 h-6 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
]

export function QuickLauncherGrid({ className = '' }: QuickLauncherGridProps): React.JSX.Element {
  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 ${className}`}
      role="region"
      aria-label="Accesos rápidos"
    >
      {QUICK_LAUNCHERS.map((launcher) => (
        <a
          key={launcher.id}
          href={launcher.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${launcher.name} — ${launcher.description}`}
          aria-label={`Abrir ${launcher.name} en pestaña nueva`}
          className="group flex flex-col items-center justify-center p-3.5 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-700/50 group-hover:scale-110 transition-transform duration-200 mb-2">
            {launcher.icon}
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-1">
            {launcher.name}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block line-clamp-1 mt-0.5">
            {launcher.description}
          </span>
        </a>
      ))}
    </div>
  )
}
