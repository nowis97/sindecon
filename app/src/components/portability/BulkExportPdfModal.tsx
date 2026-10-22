import React, { useState, useEffect, useMemo } from 'react'
import type { NodeRow } from '../../db/db'
import { db } from '../../db/db'
import { pathTo, collectDescendantIds } from '../../domain/tree'

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
    // Filtro de texto por título
    if (q && !art.title.toLowerCase().includes(q)) {
      return false
    }
    // Filtro por carpeta (artículo en esa carpeta o en alguna de sus subcarpetas)
    if (folderFilter !== 'all') {
      const path = pathTo(liveNodes, art.id)
      const isInFolder = path.some((p) => p.id === folderFilter)
      if (!isInFolder) return false
    }
    // Filtro por etiqueta
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
): string[] {
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

  // Filtrar notas activas y carpetas válidas
  const liveNodes = useMemo(() => nodes.filter((n) => n.deleted_at === null), [nodes])
  const articleNodes = useMemo(
    () => liveNodes.filter((n) => n.kind === 'article'),
    [liveNodes],
  )
  const folderNodes = useMemo(
    () => liveNodes.filter((n) => n.kind === 'folder' && n.system !== 'templates'),
    [liveNodes],
  )

  // Cargar etiquetas desde IndexedDB y opciones guardadas al abrir
  useEffect(() => {
    if (!isOpen) return

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

    // Configuración inicial de selección según initialFolderId
    if (initialFolderId) {
      setFolderFilter(initialFolderId)
      const folderNode = folderNodes.find((f) => f.id === initialFolderId)
      if (folderNode) {
        setCompilationTitle(`Compendio: ${folderNode.title}`)
      }
    } else {
      setFolderFilter('all')
      setCompilationTitle('Compendio Clínico - SINDECON')
    }
    const initialSelection = getInitialSelectedArticleIds(liveNodes, articleNodes, initialFolderId)
    setSelectedIds(new Set(initialSelection))

    setSearchQuery('')
    setTagFilter('all')

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      isMounted = false
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, initialFolderId, liveNodes, folderNodes, articleNodes])

  // Todas las etiquetas únicas disponibles en las notas
  const allUniqueTags = useMemo(() => {
    const set = new Set<string>()
    tagsByNode.forEach((tags) => {
      tags.forEach((t) => set.add(t))
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [tagsByNode])

  // Filtrado reactivo de artículos
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

  if (!isOpen) return null

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
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content bulk-export-pdf-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 840, width: '95%' }}
      >
        <div className="modal-header">
          <div className="header-title-group">
            <div className="topic-modal-title-line">
              <span className="topic-modal-icon">🖨️</span>
              <h3>Exportación Masiva a PDF (Compendio Clínico)</h3>
            </div>
            <span className="header-subtitle">
              Selecciona múltiples artículos médicos y combínalos en un único documento PDF de alta fidelidad.
            </span>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        <div className="bulk-export-pdf-body" style={{ maxHeight: 'calc(85vh - 130px)', overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Título del compendio */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-main-label" htmlFor="compilation-title-input">
              Título del Compendio (Nombre sugerido para el archivo PDF):
            </label>
            <input
              id="compilation-title-input"
              type="text"
              className="dialog-input"
              value={compilationTitle}
              onChange={(e) => setCompilationTitle(e.target.value)}
              placeholder="Ej. Compendio de Infectología Pediátrica"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}
            />
          </div>

          {/* Barra de Filtros y Búsqueda */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 10,
              background: 'var(--bg-muted)',
              padding: 12,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Buscador de artículos */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                🔍 Buscar por título:
              </label>
              <input
                type="text"
                className="dialog-input"
                placeholder="Escribe para filtrar…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
              />
            </div>

            {/* Filtro por carpeta */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                📁 Filtrar por carpeta:
              </label>
              <select
                className="dialog-input"
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
              >
                <option value="all">Todas las carpetas ({articleNodes.length})</option>
                {folderNodes.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por etiqueta */}
            {allUniqueTags.length > 0 && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  🏷️ Filtrar por etiqueta:
                </label>
                <select
                  className="dialog-input"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
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

          {/* Lista de Selección de Artículos */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {/* Cabecera de la lista con botones de acción masiva */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                background: 'var(--bg-muted)',
                borderBottom: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                  📑 Artículos ({filteredArticles.length} visibles)
                </span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    padding: '2px 8px',
                    borderRadius: 9999,
                    backgroundColor: selectedIds.size > 0 ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    color: selectedIds.size > 0 ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  {selectedIds.size} {selectedIds.size === 1 ? 'seleccionado' : 'seleccionados'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn-dialog-secondary"
                  onClick={handleSelectAllVisible}
                  style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                >
                  ✓ Seleccionar visibles
                </button>
                <button
                  type="button"
                  className="btn-dialog-secondary"
                  onClick={handleDeselectAllVisible}
                  style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                >
                  ✕ Deseleccionar visibles
                </button>
              </div>
            </div>

            {/* Listado de artículos con checkboxes */}
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {filteredArticles.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No se encontraron artículos con los filtros aplicados.
                </div>
              ) : (
                filteredArticles.map((art) => {
                  const isChecked = selectedIds.has(art.id)
                  const tags = tagsByNode.get(art.id) ?? []
                  const breadcrumbs = pathTo(liveNodes, art.id).slice(0, -1).map((n) => n.title).join(' › ')

                  return (
                    <label
                      key={art.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        backgroundColor: isChecked ? 'var(--accent-surface)' : 'transparent',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(art.id)}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                            📄 {art.title}
                          </span>
                          {breadcrumbs && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              📁 {breadcrumbs}
                            </span>
                          )}
                        </div>
                      </div>

                      {tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 8 }}>
                          {tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: '0.7rem',
                                padding: '1px 6px',
                                borderRadius: 9999,
                                background: 'var(--pill-bg)',
                                color: 'var(--pill-text)',
                              }}
                            >
                              #{t}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              +{tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* Opciones de Maquetación de Impresión */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-main-label">Diseño de Maquetación en Papel:</label>
            <div className="pdf-layout-grid">
              <button
                type="button"
                className={`pdf-layout-card ${columns === '1' ? 'active' : ''}`}
                onClick={() => handleSelectColumns('1')}
              >
                <div className="layout-badge-pill">Lectura Lineal</div>
                <div className="layout-card-icon">📄</div>
                <div className="layout-card-info">
                  <strong>1 Columna</strong>
                  <span>Diseño amplio y continuo. Ideal para lectura extensa.</span>
                </div>
              </button>

              <button
                type="button"
                className={`pdf-layout-card ${columns === '2' ? 'active' : ''}`}
                onClick={() => handleSelectColumns('2')}
              >
                <div className="layout-badge-pill recommended">Ficha Médica</div>
                <div className="layout-card-icon">📖</div>
                <div className="layout-card-info">
                  <strong>2 Columnas</strong>
                  <span>Diseño compacto estilo UptoDate/Word. Ahorra papel.</span>
                </div>
              </button>
            </div>
          </div>

          {/* Opciones del Compendio */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-main-label">Opciones del Compendio:</label>
            <div className="pdf-options-list">
              <label className="pdf-checkbox-row">
                <input
                  type="checkbox"
                  checked={pageBreakBetween}
                  onChange={(e) => handleTogglePageBreak(e.target.checked)}
                />
                <span>Separar cada artículo en una página nueva (Salto de página)</span>
              </label>

              <label className="pdf-checkbox-row">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                />
                <span>Incluir cabecera clínica en cada artículo (Título, fecha y ruta)</span>
              </label>

              <label className="pdf-checkbox-row">
                <input
                  type="checkbox"
                  checked={includeTags}
                  onChange={(e) => setIncludeTags(e.target.checked)}
                />
                <span>Incluir etiquetas en cada artículo</span>
              </label>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="modal-actions" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary btn-print-confirm"
            disabled={selectedIds.size === 0}
            onClick={handleConfirm}
          >
            🖨️ Imprimir / Guardar Compendio ({selectedIds.size} {selectedIds.size === 1 ? 'nota' : 'notas'})
          </button>
        </div>
      </div>
    </div>
  )
}
