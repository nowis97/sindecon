import { useMemo, useState } from 'react'
import type { NodeRow } from '../../db/db'
import { useAllTags, useArticlesWithTag } from '../../hooks/useSearch'
import { childrenOf } from '../../domain/tree'

interface DashboardProps {
  nodes: NodeRow[]
  templates: Array<{ node: NodeRow; body: string }>
  onSelectArticle: (id: string) => void
  onOpenQuickCapture: () => void
  onOpenSmartImport?: () => void
  onCreateNode: (kind: 'folder' | 'article') => void
  onCreateFromTemplate: (templateTitle: string) => void
}

export function Dashboard({
  nodes,
  templates,
  onSelectArticle,
  onOpenQuickCapture,
  onOpenSmartImport,
  onCreateNode,
  onCreateFromTemplate,
}: DashboardProps) {
  const allTags = useAllTags()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const taggedArticleIds = useArticlesWithTag(selectedTag)

  // Buscar carpeta Inbox
  const inboxFolder = nodes.find(
    (n) => n.kind === 'folder' && n.title === 'Inbox' && n.parent_id === null,
  )
  const inboxCount = inboxFolder ? childrenOf(nodes, inboxFolder.id).length : 0

  // Artículos totales y carpetas
  const totalArticles = useMemo(
    () => nodes.filter((n) => n.kind === 'article').length,
    [nodes],
  )
  const totalFolders = useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.kind === 'folder' &&
          n.title !== 'Plantillas' &&
          n.title !== 'Inbox',
      ).length,
    [nodes],
  )

  // Artículos recientes (ordenados por updated_at descendente)
  const recentArticles = useMemo(() => {
    return nodes
      .filter((n) => n.kind === 'article')
      .sort((a, b) => b.updated_at - a.updated_at)
      .slice(0, 6)
  }, [nodes])

  // Artículos filtrados por la etiqueta seleccionada
  const filteredByTagArticles = useMemo(() => {
    if (!selectedTag) return []
    return nodes.filter((n) => n.kind === 'article' && taggedArticleIds.includes(n.id))
  }, [nodes, selectedTag, taggedArticleIds])

  // Map para resolver nombres de carpetas
  const folderMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of nodes) {
      if (n.kind === 'folder') map.set(n.id, n.title)
    }
    return map
  }, [nodes])

  const formatDate = (timestamp: number) => {
    try {
      const d = new Date(timestamp)
      return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-hero">
        <div className="dashboard-hero-text">
          <h1>🩺 Cuaderno Médico Personal</h1>
          <p>
            Tu base de conocimiento clínico offline. Captura en planta, estudia en PC y consulta protocolos en segundos.
          </p>
        </div>
      </header>

      {/* Grid de Estadísticas */}
      <section className="dashboard-stats-grid">
        <div className="stat-card">
          <span className="stat-icon">📄</span>
          <div className="stat-info">
            <span className="stat-value">{totalArticles}</span>
            <span className="stat-label">Artículos y Fichas</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">📁</span>
          <div className="stat-info">
            <span className="stat-value">{totalFolders}</span>
            <span className="stat-label">Carpetas / Especialidades</span>
          </div>
        </div>

        <div
          className={`stat-card ${inboxCount > 0 ? 'stat-card-highlight' : ''}`}
          onClick={() => inboxFolder && onSelectArticle(inboxFolder.id)}
          style={{ cursor: inboxFolder ? 'pointer' : 'default' }}
          title={inboxFolder ? 'Ver capturas en Inbox' : undefined}
        >
          <span className="stat-icon">📥</span>
          <div className="stat-info">
            <span className="stat-value">{inboxCount}</span>
            <span className="stat-label">
              {inboxCount === 1 ? 'Captura en Inbox' : 'Capturas en Inbox'}
            </span>
          </div>
          {inboxCount > 0 && <span className="stat-badge">Pendiente</span>}
        </div>

        <div className="stat-card">
          <span className="stat-icon">🏷️</span>
          <div className="stat-info">
            <span className="stat-value">{allTags.length}</span>
            <span className="stat-label">Etiquetas / Síntomas</span>
          </div>
        </div>
      </section>

      {/* Acciones Rápidas */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">⚡ Acciones Rápidas</h2>
        <div className="dashboard-actions-grid">
          <button
            type="button"
            className="action-card action-capture"
            onClick={onOpenQuickCapture}
          >
            <div className="action-card-icon">📸</div>
            <div className="action-card-content">
              <strong>Captura Rápida a 1 toque</strong>
              <span>Foto clínica o nota directa al Inbox</span>
            </div>
          </button>

          {onOpenSmartImport && (
            <button
              type="button"
              className="action-card action-smart-import"
              onClick={onOpenSmartImport}
            >
              <div className="action-card-icon">🪄</div>
              <div className="action-card-content">
                <strong>Importar de ChatGPT o Word</strong>
                <span>Convierte tablas, callouts y resúmenes</span>
              </div>
            </button>
          )}

          <button
            type="button"
            className="action-card"
            onClick={() => onCreateNode('article')}
          >
            <div className="action-card-icon">📝</div>
            <div className="action-card-content">
              <strong>Nuevo Artículo en Blanco</strong>
              <span>Escribe apuntes, protocolos o resúmenes</span>
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onCreateNode('folder')}
          >
            <div className="action-card-icon">📁</div>
            <div className="action-card-content">
              <strong>Nueva Carpeta / Tema</strong>
              <span>Organiza por especialidad médica</span>
            </div>
          </button>
        </div>
      </section>

      {/* Exploración por Etiquetas Clínicas */}
      {allTags.length > 0 && (
        <section className="dashboard-section">
          <div className="dashboard-section-header-row">
            <h2 className="dashboard-section-title">🏷️ Etiquetas y Síntomas Clínicos</h2>
            {selectedTag && (
              <button
                type="button"
                className="btn-clear-tag-filter"
                onClick={() => setSelectedTag(null)}
              >
                ✕ Limpiar filtro
              </button>
            )}
          </div>
          <div className="dashboard-tags-cloud">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`dashboard-tag-chip ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>

          {selectedTag && (
            <div className="tag-filtered-results">
              <p className="tag-filter-lead">
                {filteredByTagArticles.length === 0
                  ? `No se encontraron artículos con la etiqueta #${selectedTag}`
                  : `Artículos etiquetados con #${selectedTag} (${filteredByTagArticles.length}):`}
              </p>
              <div className="recent-articles-list">
                {filteredByTagArticles.map((article) => {
                  const parentTitle = article.parent_id
                    ? folderMap.get(article.parent_id)
                    : null
                  return (
                    <div
                      key={article.id}
                      className="recent-article-item"
                      onClick={() => onSelectArticle(article.id)}
                    >
                      <div className="recent-article-main">
                        <span className="recent-article-icon">📄</span>
                        <div className="recent-article-text">
                          <strong className="recent-article-title">
                            {article.title}
                          </strong>
                          {parentTitle && (
                            <span className="recent-article-folder">
                              📁 {parentTitle}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="recent-article-date">
                        {formatDate(article.updated_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Plantillas Médicas Maestras */}
      {templates.length > 0 && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">📋 Crear desde Plantilla Médica</h2>
          <div className="dashboard-templates-grid">
            {templates.map((tpl) => (
              <button
                key={tpl.node.id}
                type="button"
                className="template-chip-button"
                onClick={() => onCreateFromTemplate(tpl.node.title)}
              >
                <span className="template-chip-icon">📄</span>
                <span className="template-chip-title">{tpl.node.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Artículos Recientes */}
      {recentArticles.length > 0 && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">🕒 Modificados Recientemente</h2>
          <div className="recent-articles-list">
            {recentArticles.map((article) => {
              const parentTitle = article.parent_id
                ? folderMap.get(article.parent_id)
                : null
              return (
                <div
                  key={article.id}
                  className="recent-article-item"
                  onClick={() => onSelectArticle(article.id)}
                >
                  <div className="recent-article-main">
                    <span className="recent-article-icon">📄</span>
                    <div className="recent-article-text">
                      <strong className="recent-article-title">
                        {article.title}
                      </strong>
                      {parentTitle && (
                        <span className="recent-article-folder">
                          📁 {parentTitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="recent-article-date">
                    {formatDate(article.updated_at)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
