import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Printer,
  Search,
  Folder,
  Tag,
  FileText,
  Columns2,
  Check,
  X,
} from 'lucide-react'
import type { NodeRow } from '../../db/db'
import { db } from '../../db/db'
import { pathTo, collectDescendantIds } from '../../domain/tree'
import {
  BaseModal,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
  PILL_INPUT_CLASS,
  CLINICAL_FIELD_CLASS,
} from '../common/DialogModal'

export interface BulkExportPdfOptions {
  columns: '1' | '2'
  includeHeader: boolean
  includeTags: boolean
  pageBreakBetween: boolean
  compilationTitle: string
}

export interface BulkExportPdfModalProps {
  isOpen: boolean
  onClose: () => void
  nodes: NodeRow[]
  initialFolderId?: string | null
  initialSelectedIds?: string[] | null
  onConfirmExport: (selectedNodeIds: string[], options: BulkExportPdfOptions) => void
}

const PDF_LAYOUT_KEY = 'sindecon_pdf_layout_columns'
const BULK_PAGE_BREAK_KEY = 'sindecon_bulk_pdf_page_break'

/**
 * Filtra los artículos según los criterios de búsqueda por texto, carpeta y etiqueta.
 */
export function filterArticlesForExport(
  articles: NodeRow[],
  searchQuery: string,
  folderFilter: string | 'all',
  tagFilter: string | 'all',
  liveNodes: NodeRow[],
  tagsByNode: Map<string, string[]>,
): NodeRow[] {
  const q = searchQuery.trim().toLowerCase()
  return articles.filter((art) => {
    if (q && !art.title.toLowerCase().includes(q)) {
      return false
    }
    if (folderFilter !== 'all') {
      const path = pathTo(liveNodes, art.id)
      const isInFolder = path.some((p) => p.id === folderFilter)
      if (!isInFolder) return false
    }
    if (tagFilter !== 'all') {
      const tags = tagsByNode.get(art.id) ?? []
      if (!tags.includes(tagFilter)) return false
    }
    return true
  })
}

/**
 * Calcula los IDs de notas preseleccionadas al abrir el modal.
 */
export function getInitialSelectedArticleIds(
  liveNodes: NodeRow[],
  articleNodes: NodeRow[],
  initialFolderId?: string | null,
  initialSelectedIds?: string[] | null,
): string[] {
  if (initialSelectedIds && initialSelectedIds.length > 0) {
    const validIds = new Set(articleNodes.map((a) => a.id))
    return Array.from(new Set(initialSelectedIds.filter((id) => validIds.has(id))))
  }
  if (initialFolderId) {
    const descendantIds = new Set(collectDescendantIds(liveNodes, initialFolderId))
    return articleNodes
      .filter((a) => a.parent_id === initialFolderId || descendantIds.has(a.id))
      .map((a) => a.id)
  }
  return articleNodes.map((a) => a.id)
}

export const BulkExportPdfModal: React.FC<BulkExportPdfModalProps> = ({
  isOpen,
  onClose,
  nodes,
  initialFolderId = null,
  initialSelectedIds = null,
  onConfirmExport,
}) => {
  const [columns, setColumns] = useState<'1' | '2'>('2')
  const [includeHeader, setIncludeHeader] = useState(true)
  const [includeTags, setIncludeTags] = useState(true)
  const [pageBreakBetween, setPageBreakBetween] = useState(true)
  const [compilationTitle, setCompilationTitle] = useState('Compendio Clínico - SINDECON')

  const [searchQuery, setSearchQuery] = useState('')
  const [folderFilter, setFolderFilter] = useState<string | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | 'all'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [tagsByNode, setTagsByNode] = useState<Map<string, string[]>>(new Map())
  const lastOpenScopeRef = useRef<string | null>(null)

  const liveNodes = useMemo(() => nodes.filter((n) => n.deleted_at === null), [nodes])
  const articleNodes = useMemo(
    () =>
      liveNodes.filter(
        (n) =>
          n.kind === 'article' &&
          (initialFolderId === 'sys-folder-templates' || n.system !== 'templates'),
      ),
    [liveNodes, initialFolderId],
  )
  const folderNodes = useMemo(
    () => liveNodes.filter((n) => n.kind === 'folder' && n.system !== 'templates'),
    [liveNodes],
  )

  useEffect(() => {
    if (!isOpen) {
      lastOpenScopeRef.current = null
      return
    }

    let isMounted = true
    void db.articles.toArray().then((articles) => {
      if (!isMounted) return
      const map = new Map<string, string[]>()
      for (const a of articles) {
        if (a.tags && a.tags.length > 0) {
          map.set(a.node_id, a.tags)
        }
      }
      setTagsByNode(map)
    })

    const scopeKey = `${initialFolderId ?? 'all'}::${(initialSelectedIds ?? []).join(',')}`
    if (lastOpenScopeRef.current !== scopeKey) {
      lastOpenScopeRef.current = scopeKey
      try {
        const savedCol = localStorage.getItem(PDF_LAYOUT_KEY)
        if (savedCol === '1' || savedCol === '2') {
          setColumns(savedCol)
        }
        const savedBreak = localStorage.getItem(BULK_PAGE_BREAK_KEY)
        if (savedBreak !== null) {
          setPageBreakBetween(savedBreak === 'true')
        }
      } catch {}

      const initialSelection = getInitialSelectedArticleIds(
        liveNodes,
        articleNodes,
        initialFolderId,
        initialSelectedIds,
      )
      setSelectedIds(new Set(initialSelection))

      const selectionMatchesFolder =
        Boolean(initialFolderId) &&
        (initialSelection.length === 0 ||
          initialSelection.every((id) =>
            pathTo(liveNodes, id).some((ancestor) => ancestor.id === initialFolderId),
          ))

      if (initialFolderId && selectionMatchesFolder) {
        setFolderFilter(initialFolderId)
        const folderNode = folderNodes.find((f) => f.id === initialFolderId)
        setCompilationTitle(
          folderNode ? `Compendio: ${folderNode.title}` : 'Compendio Clínico - SINDECON',
        )
      } else {
        setFolderFilter('all')
        setCompilationTitle('Compendio Clínico - SINDECON')
      }

      setSearchQuery('')
      setTagFilter('all')
    }

    return () => {
      isMounted = false
    }
  }, [isOpen, initialFolderId, initialSelectedIds, liveNodes, folderNodes, articleNodes])

  const allUniqueTags = useMemo(() => {
    const set = new Set<string>()
    tagsByNode.forEach((tags) => {
      tags.forEach((t) => set.add(t))
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [tagsByNode])

  const filteredArticles = useMemo(() => {
    return filterArticlesForExport(
      articleNodes,
      searchQuery,
      folderFilter,
      tagFilter,
      liveNodes,
      tagsByNode,
    )
  }, [articleNodes, searchQuery, folderFilter, tagFilter, liveNodes, tagsByNode])

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredArticles.forEach((a) => next.add(a.id))
      return next
    })
  }

  const handleDeselectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredArticles.forEach((a) => next.delete(a.id))
      return next
    })
  }

  const handleSelectColumns = (col: '1' | '2') => {
    setColumns(col)
    try {
      localStorage.setItem(PDF_LAYOUT_KEY, col)
    } catch {}
  }

  const handleTogglePageBreak = (checked: boolean) => {
    setPageBreakBetween(checked)
    try {
      localStorage.setItem(BULK_PAGE_BREAK_KEY, String(checked))
    } catch {}
  }

  const handleConfirm = () => {
    if (selectedIds.size === 0) return
    onConfirmExport(Array.from(selectedIds), {
      columns,
      includeHeader,
      includeTags,
      pageBreakBetween,
      compilationTitle: compilationTitle.trim() || 'Compendio Clínico - SINDECON',
    })
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Exportación Masiva a PDF"
      subtitle="Combina múltiples protocolos médicos en un único compendio clínico."
      icon={<Printer className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <>
          <button type="button" className={PILL_BTN_SECONDARY} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={PILL_BTN_PRIMARY}
            disabled={selectedIds.size === 0}
            onClick={handleConfirm}
          >
            <Printer className="h-3.5 w-3.5" />
            <span>
              Imprimir Compendio ({selectedIds.size} {selectedIds.size === 1 ? 'nota' : 'notas'})
            </span>
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Compilation Title */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="compilation-title-input"
            className="text-xs font-semibold text-[var(--ch-text-secondary)]"
          >
            Título del compendio (nombre sugerido del PDF)
          </label>
          <input
            id="compilation-title-input"
            type="text"
            className={PILL_INPUT_CLASS}
            value={compilationTitle}
            onChange={(e) => setCompilationTitle(e.target.value)}
            placeholder="Ej. Compendio de Infectología Pediátrica"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60 p-3.5 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ch-text-secondary)]">
              <Search className="h-3 w-3 text-[var(--ch-accent)]" />
              <span>Buscar por título</span>
            </label>
            <input
              type="text"
              className={CLINICAL_FIELD_CLASS}
              placeholder="Escribe para filtrar…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ch-text-secondary)]">
              <Folder className="h-3 w-3 text-[var(--ch-accent)]" />
              <span>Carpeta</span>
            </label>
            <select
              className={CLINICAL_FIELD_CLASS}
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
            >
              <option value="all">Todas las carpetas ({articleNodes.length})</option>
              {folderNodes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>

          {allUniqueTags.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                <Tag className="h-3 w-3 text-[var(--ch-accent)]" />
                <span>Etiqueta</span>
              </label>
              <select
                className={CLINICAL_FIELD_CLASS}
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="all">Todas las etiquetas</option>
                {allUniqueTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Articles Selection List */}
        <div className="overflow-hidden rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/70 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--ch-text-primary)]">
                Artículos ({filteredArticles.length} visibles)
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                  selectedIds.size > 0
                    ? 'bg-[var(--ch-accent-solid)] text-white'
                    : 'bg-[var(--ch-bg-elevated)] text-[var(--ch-text-muted)]'
                }`}
              >
                {selectedIds.size} {selectedIds.size === 1 ? 'seleccionado' : 'seleccionados'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ch-text-secondary)] hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
              >
                <Check className="h-3 w-3" />
                <span>Seleccionar visibles</span>
              </button>
              <button
                type="button"
                onClick={handleDeselectAllVisible}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ch-text-secondary)] hover:border-red-400 hover:text-red-600"
              >
                <X className="h-3 w-3" />
                <span>Quitar visibles</span>
              </button>
            </div>
          </div>

          <div className="max-h-60 divide-y divide-[var(--ch-border-subtle)] overflow-y-auto">
            {filteredArticles.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[var(--ch-text-muted)]">
                No se encontraron artículos con los filtros aplicados.
              </div>
            ) : (
              filteredArticles.map((art) => {
                const isChecked = selectedIds.has(art.id)
                const tags = tagsByNode.get(art.id) ?? []
                const breadcrumbs = pathTo(liveNodes, art.id)
                  .slice(0, -1)
                  .map((n) => n.title)
                  .join(' › ')

                return (
                  <label
                    key={art.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition ${
                      isChecked
                        ? 'bg-[var(--ch-accent-soft)]/55'
                        : 'hover:bg-[var(--ch-bg-secondary)]/50'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelect(art.id)}
                        className="h-4 w-4 shrink-0 accent-[var(--ch-accent)]"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-primary)]">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                          <span className="truncate">{art.title}</span>
                        </div>
                        {breadcrumbs && (
                          <div className="truncate pl-5 font-mono text-[10px] text-[var(--ch-text-muted)]">
                            {breadcrumbs}
                          </div>
                        )}
                      </div>
                    </div>

                    {tags.length > 0 && (
                      <div className="hidden shrink-0 flex-wrap gap-1 sm:flex">
                        {tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2 py-0.5 font-mono text-[10px] text-[var(--ch-text-secondary)]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </label>
                )
              })
            )}
          </div>
        </div>

        {/* Layout Selector */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleSelectColumns('1')}
            className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
              columns === '1'
                ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
            }`}
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
            <div>
              <strong className="block font-display text-xs font-semibold text-[var(--ch-text-primary)]">
                1 Columna Continua
              </strong>
              <span className="text-[11px] text-[var(--ch-text-muted)]">
                Diseño amplio ideal para lectura extensa.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectColumns('2')}
            className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
              columns === '2'
                ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
            }`}
          >
            <Columns2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
            <div>
              <strong className="block font-display text-xs font-semibold text-[var(--ch-text-primary)]">
                2 Columnas Ficha Médica
              </strong>
              <span className="text-[11px] text-[var(--ch-text-muted)]">
                Diseño compacto estilo dossier que ahorra papel.
              </span>
            </div>
          </button>
        </div>

        {/* Compilation Options */}
        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[var(--ch-text-primary)]">
            <input
              type="checkbox"
              checked={pageBreakBetween}
              onChange={(e) => handleTogglePageBreak(e.target.checked)}
              className="h-4 w-4 accent-[var(--ch-accent)]"
            />
            <span>Separar cada artículo en una página nueva (salto de página)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[var(--ch-text-primary)]">
            <input
              type="checkbox"
              checked={includeHeader}
              onChange={(e) => setIncludeHeader(e.target.checked)}
              className="h-4 w-4 accent-[var(--ch-accent)]"
            />
            <span>Incluir cabecera clínica en cada artículo</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[var(--ch-text-primary)]">
            <input
              type="checkbox"
              checked={includeTags}
              onChange={(e) => setIncludeTags(e.target.checked)}
              className="h-4 w-4 accent-[var(--ch-accent)]"
            />
            <span>Incluir etiquetas en cada artículo</span>
          </label>
        </div>
      </div>
    </BaseModal>
  )
}
