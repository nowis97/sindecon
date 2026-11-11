import React from 'react'

export interface VersionSwitcherProps {
  currentVersion: 'v1' | 'v2'
  onToggle: () => void
  className?: string
}

export function VersionSwitcher({
  currentVersion,
  onToggle,
  className = '',
}: VersionSwitcherProps): React.JSX.Element {
  const isV2 = currentVersion === 'v2'
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-sm cursor-pointer ${
        isV2
          ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
          : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
      } ${className}`}
      title={isV2 ? 'Cambiar a diseño clásico V1' : 'Probar nuevo diseño V2'}
      aria-label={isV2 ? 'Vista Clásica V1' : 'Probar Vista V2'}
    >
      <span>{isV2 ? '⏪' : '✨'}</span>
      <span>{isV2 ? 'Vista Clásica V1' : 'Probar Vista V2'}</span>
    </button>
  )
}
