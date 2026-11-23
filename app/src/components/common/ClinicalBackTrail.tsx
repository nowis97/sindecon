import React from 'react'
import { ArrowLeft, ChevronRight, FileText, FolderOpen, Home } from 'lucide-react'
import type { NodeRow } from '../../db/db'

export interface ClinicalBackTrailProps {
  currentKind: 'article' | 'folder'
  currentTitle: string
  /** Ancestor folders ordered root -> immediate parent (e.g. pathTo(nodes, id).slice(0, -1)) */
  ancestors: NodeRow[]
  onNavigateFolder: (folderId: string) => void
  onNavigateHome: () => void
  trailing?: React.ReactNode
}

/**
 * High-contrast return trail rendered in explicit reverse exit order:
 * Artículo -> [Subcarpeta(s) -> Carpeta] -> Página principal
 * Highlights the immediate 1-step-back destination in primary teal while keeping
 * outer ancestor folders and Página principal prominent and clickable.
 */
export function ClinicalBackTrail({
  currentKind,
  currentTitle,
  ancestors,
  onNavigateFolder,
  onNavigateHome,
  trailing,
}: ClinicalBackTrailProps) {
  const reversedAncestors = [...ancestors].reverse()
  const isAtRoot = reversedAncestors.length === 0

  const primaryBackClass =
    'inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--cl-accent)] bg-[var(--cl-accent)] px-3.5 py-1 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[var(--cl-accent-hover)] cursor-pointer'
  const secondaryBackClass =
    'inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-[var(--cl-border)] bg-[var(--cl-surface)] px-3 py-1 text-xs font-bold text-[var(--cl-fg)] shadow-2xs transition-colors hover:border-[var(--cl-accent)] hover:bg-[var(--cl-accent-soft)] hover:text-[var(--cl-diagnostic)] cursor-pointer'

  return (
    <nav
      aria-label="Ruta de regreso en orden jerárquico"
      className="flex min-w-0 flex-wrap items-center gap-1.5"
    >
      <span
        className="inline-flex min-h-[34px] max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--cl-fg)]"
        title={
          currentKind === 'article'
            ? `Artículo actual: ${currentTitle}`
            : `Carpeta actual: ${currentTitle}`
        }
      >
        {currentKind === 'article' ? (
          <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--cl-diagnostic)]" />
        ) : (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--cl-diagnostic)]" />
        )}
        <span>{currentKind === 'article' ? 'Artículo' : 'Carpeta'}</span>
      </span>

      {reversedAncestors.map((folder, idx) => {
        const isImmediateBack = idx === 0
        return (
          <React.Fragment key={folder.id}>
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-[var(--cl-muted)]"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => onNavigateFolder(folder.id)}
              title={`Volver atrás a la carpeta «${folder.title}»`}
              className={isImmediateBack ? primaryBackClass : secondaryBackClass}
            >
              <ArrowLeft
                className={`h-3.5 w-3.5 shrink-0 ${
                  isImmediateBack ? '' : 'text-[var(--cl-diagnostic)]'
                }`}
              />
              <FolderOpen
                className={`h-3.5 w-3.5 shrink-0 ${
                  isImmediateBack ? 'opacity-90' : 'text-[var(--cl-diagnostic)]'
                }`}
              />
              <span className="max-w-[165px] truncate">{folder.title}</span>
            </button>
          </React.Fragment>
        )
      })}

      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-[var(--cl-muted)]"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={onNavigateHome}
        title="Volver a la Página principal (Mi Repositorio)"
        className={isAtRoot ? primaryBackClass : secondaryBackClass}
      >
        <ArrowLeft
          className={`h-3.5 w-3.5 shrink-0 ${isAtRoot ? '' : 'text-[var(--cl-diagnostic)]'}`}
        />
        <Home
          className={`h-3.5 w-3.5 shrink-0 ${isAtRoot ? 'opacity-90' : 'text-[var(--cl-diagnostic)]'}`}
        />
        <span>Página principal</span>
      </button>

      {trailing}
    </nav>
  )
}
