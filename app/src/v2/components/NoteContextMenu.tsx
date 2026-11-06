import React, { useEffect } from 'react'

export type NoteStatusMarker = 'urgent' | 'pending' | 'completed' | null

export type NoteContextMenuAction =
  | 'delete'
  | 'move'
  | 'export_editor'
  | 'print'
  | 'tag'
  | 'select'
  | 'mark'

export interface NoteContextMenuProps {
  noteId: string
  noteTitle: string
  currentTags?: string[]
  currentStatus?: NoteStatusMarker | string | null
  onAction: (action: NoteContextMenuAction | string, payload?: any) => void
  position?: { x: number; y: number }
  onClose: () => void
  className?: string
}

export function NoteContextMenu({
  noteId: _noteId,
  noteTitle: _noteTitle,
  currentTags: _currentTags = [],
  currentStatus = null,
  onAction,
  position,
  onClose,
  className = '',
}: NoteContextMenuProps): React.JSX.Element {
  // Escape key closes the menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const menuStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: `${position.y}px`,
        left: `${Math.max(10, Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 220 : position.x))}px`,
      }
    : {}

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden ${className}`} role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/10 dark:bg-black/30 backdrop-blur-[0.5px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu dropdown */}
      <div
        style={menuStyle}
        className={`relative z-50 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 ${
          !position ? 'm-auto' : ''
        }`}
        role="menu"
        aria-orientation="vertical"
      >
        {/* 1. Eliminar */}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onAction('delete')
            onClose()
          }}
          className="w-full text-left px-3 py-2 text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
        >
          <span>- Eliminar</span>
          <span className="text-xs text-rose-400">🗑</span>
        </button>

        {/* 2. Mover A */}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onAction('move')
            onClose()
          }}
          className="w-full text-left px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
        >
          <span>- Mover A</span>
          <span className="text-xs text-slate-400">📁</span>
        </button>

        {/* 3. Exportar -> Editor */}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onAction('export_editor')
            onClose()
          }}
          className="w-full text-left px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
        >
          <span>- Exportar -&gt; Editor</span>
          <span className="text-xs text-slate-400">📝</span>
        </button>

        {/* 4. Imprimir */}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onAction('print')
            onClose()
          }}
          className="w-full text-left px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
        >
          <span>- Imprimir</span>
          <span className="text-xs text-slate-400">🖨</span>
        </button>

        {/* 5. Etiqueta */}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onAction('tag')
            onClose()
          }}
          className="w-full text-left px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
        >
          <span>- Etiqueta</span>
          <span className="text-xs text-slate-400">🏷</span>
        </button>

        {/* 6. Seleccionar */}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onAction('select')
            onClose()
          }}
          className="w-full text-left px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
        >
          <span>- Seleccionar</span>
          <span className="text-xs text-slate-400">☑</span>
        </button>

        {/* 7. Marcar */}
        <div className="relative pt-0.5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            role="menuitem"
            onClick={() => onAction('mark')}
            className="w-full text-left px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>- Marcar</span>
            <span className="text-xs text-slate-400">▼</span>
          </button>

          <div className="my-1 pl-2 pr-1 py-1 flex flex-col gap-1 border-l-2 border-teal-500 bg-slate-50/80 dark:bg-slate-800/60 rounded-r-lg">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onAction('mark', 'urgent')
                onClose()
              }}
              className="w-full text-left text-xs font-medium px-2.5 py-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="text-amber-500 font-bold">▲</span>
              <span>Urgente / Prioritario</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onAction('mark', 'pending')
                onClose()
              }}
              className="w-full text-left text-xs font-medium px-2.5 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="text-blue-500 font-bold">●</span>
              <span>En Proceso / Pendiente</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onAction('mark', 'completed')
                onClose()
              }}
              className="w-full text-left text-xs font-medium px-2.5 py-1.5 rounded hover:bg-teal-100 dark:hover:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="text-teal-600 font-bold">■</span>
              <span>Completado / Validado</span>
            </button>

            {currentStatus && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAction('mark', null)
                  onClose()
                }}
                className="w-full text-left text-xs px-2.5 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <span>✕ Desmarcar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
