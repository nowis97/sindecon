import React, { useState, useEffect, useMemo } from 'react'
import {
  getFlashcardsByNode,
  createFlashcard,
  deleteFlashcard,
  updateFlashcard,
} from '../../db/flashcards'
import type { FlashcardRow } from '../../db/db'
import { GenerateFlashcardsModal } from './GenerateFlashcardsModal'
import { FlashcardMarkdown } from './FlashcardMarkdown'
import { FlashcardLivePreview } from './FlashcardLivePreview'
import { estimateFlashcardsFromWords } from '../../domain/cardExtractor'

interface ArticleFlashcardsModalProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string
  articleTitle: string
  bodyMd: string
  onStartStudy?: (cards: FlashcardRow[]) => void
  onOpenAiSettings?: () => void
}

export const ArticleFlashcardsModal: React.FC<ArticleFlashcardsModalProps> = ({
  isOpen,
  onClose,
  nodeId,
  articleTitle,
  bodyMd,
  onStartStudy,
  onOpenAiSettings,
}) => {
  const [cards, setCards] = useState<FlashcardRow[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [isCreatingManual, setIsCreatingManual] = useState(false)
  const [manualFront, setManualFront] = useState('')
  const [manualBack, setManualBack] = useState('')
  const [manualTab, setManualTab] = useState<'edit' | 'preview'>('edit')
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editTab, setEditTab] = useState<'edit' | 'preview'>('edit')

  const loadCards = async () => {
    const list = await getFlashcardsByNode(nodeId)
    setCards(list)
  }

  useEffect(() => {
    if (isOpen) {
      loadCards()
      setIsCreatingManual(false)
      setEditingCardId(null)
      setSearchFilter('')
    }
  }, [isOpen, nodeId])

  const now = Date.now()

  // Estadísticas rápidas del mazo
  const stats = useMemo(() => {
    const dueCount = cards.filter((c) => c.due_date <= now).length
    const masteredCount = cards.filter((c) => c.interval >= 21).length
    const newCount = cards.filter((c) => c.interval === 0).length
    return { dueCount, masteredCount, newCount, total: cards.length }
  }, [cards, now])

  // Estimación médica de flashcards según volumen de palabras
  const wordEstimate = useMemo(() => estimateFlashcardsFromWords(bodyMd), [bodyMd])

  // Filtrado de tarjetas por búsqueda
  const filteredCards = useMemo(() => {
    if (!searchFilter.trim()) return cards
    const q = searchFilter.toLowerCase()
    return cards.filter(
      (c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)
    )
  }, [cards, searchFilter])

  if (!isOpen) return null

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualFront.trim() || !manualBack.trim()) return

    await createFlashcard({
      nodeId,
      front: manualFront.trim(),
      back: manualBack.trim(),
      sourceType: 'manual',
    })

    setManualFront('')
    setManualBack('')
    setIsCreatingManual(false)
    await loadCards()
  }

  const handleDelete = async (id: string) => {
    await deleteFlashcard(id)
    await loadCards()
  }

  const handleSaveEdit = async (id: string) => {
    if (!editFront.trim() || !editBack.trim()) return
    await updateFlashcard(id, { front: editFront.trim(), back: editBack.trim() })
    setEditingCardId(null)
    await loadCards()
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content article-flashcards-modal"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado del Modal */}
          <div className="modal-header">
            <div className="header-title-group">
              <div className="topic-modal-title-line">
                <span className="topic-modal-icon">🧠</span>
                <h3>Flashcards del Tema</h3>
              </div>
              <span className="header-subtitle" title={articleTitle}>
                {articleTitle}
              </span>
            </div>
            <div className="modal-header-stats-group">
              {wordEstimate.wordCount >= 30 && (
                <span
                  className="topic-stat-chip words-estimate"
                  title={`Artículo de ${wordEstimate.wordCount} palabras (${wordEstimate.densityDescription}). Estimación: 1 flashcard clínica por cada ~60 palabras.`}
                >
                  📝 ~{wordEstimate.estimatedCards} estimadas ({wordEstimate.wordCount} palabras)
                </span>
              )}
              <span className="topic-stat-chip total" title="Total de tarjetas en este tema">
                📦 {stats.total} en mazo
              </span>
              {stats.dueCount > 0 && (
                <span className="topic-stat-chip due" title="Tarjetas listas para repasar hoy">
                  ⚡ {stats.dueCount} por repasar
                </span>
              )}
              <button className="btn-close" onClick={onClose} aria-label="Cerrar modal">
                ✕
              </button>
            </div>
          </div>

          {/* Barra de Acciones del Mazo */}
          <div className="article-flashcards-toolbar">
            <div className="toolbar-left-actions">
              <button
                type="button"
                className="btn-toolbar-generator btn-primary-action"
                onClick={() => setShowGenerateModal(true)}
              >
                <span className="btn-icon">✨</span>
                <span>Generar Flashcards con IA / Extractor</span>
              </button>
              <button
                type="button"
                className={`btn-toolbar-manual btn-secondary-action ${isCreatingManual ? 'active' : ''}`}
                onClick={() => setIsCreatingManual(!isCreatingManual)}
              >
                <span className="btn-icon">{isCreatingManual ? '✕' : '➕'}</span>
                <span>{isCreatingManual ? 'Cancelar' : '➕ Tarjeta Manual'}</span>
              </button>
            </div>

            {cards.length > 0 && onStartStudy && (
              <button
                type="button"
                className="btn-study-action-hero btn-study-action"
                onClick={() => {
                  onClose()
                  onStartStudy(cards)
                }}
              >
                <span className="study-pulse-dot" />
                <span className="btn-icon">🎯</span>
                <span>Repasar Ahora ({cards.length})</span>
              </button>
            )}
          </div>

          {/* Barra de Búsqueda / Filtro si hay 3 o más tarjetas */}
          {cards.length >= 3 && (
            <div className="flashcards-filter-bar">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Filtrar preguntas o conceptos de este tema..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="flashcards-filter-input"
              />
              {searchFilter && (
                <button
                  type="button"
                  className="btn-clear-search"
                  onClick={() => setSearchFilter('')}
                  title="Limpiar filtro"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Formulario de Creación Manual Desplegable */}
          {isCreatingManual && (
            <form onSubmit={handleCreateManual} className="manual-card-form">
              <div className="manual-card-form-header">
                <span className="form-title">📝 Añadir Nueva Flashcard</span>
                <div className="preview-tab-switcher">
                  <button
                    type="button"
                    className={`btn-preview-tab ${manualTab === 'edit' ? 'active' : ''}`}
                    onClick={() => setManualTab('edit')}
                  >
                    ✍️ Redactar
                  </button>
                  <button
                    type="button"
                    className={`btn-preview-tab ${manualTab === 'preview' ? 'active' : ''}`}
                    onClick={() => setManualTab('preview')}
                  >
                    👁️ Vista Previa (Flip 3D)
                  </button>
                </div>
              </div>

              {manualTab === 'edit' ? (
                <div className="form-group-duo">
                  <div className="form-group-card">
                    <label className="label-front">
                      <span>Pregunta / Anverso:</span>
                      <small>¿Qué síntoma, dosis o criterio evaluar?</small>
                    </label>
                    <textarea
                      rows={2}
                      value={manualFront}
                      onChange={(e) => setManualFront(e.target.value)}
                      placeholder="Ej. ¿Cuál es el tratamiento de primera línea en neumonía típica?"
                      autoFocus
                    />
                  </div>
                  <div className="form-group-card">
                    <label className="label-back">
                      <span>Respuesta / Reverso:</span>
                      <small>Respuesta clínica concisa y directa (soporta Markdown)</small>
                    </label>
                    <textarea
                      rows={2}
                      value={manualBack}
                      onChange={(e) => setManualBack(e.target.value)}
                      placeholder="Ej. Amoxicilina 1g c/8h vía oral por 5 a 7 días."
                    />
                  </div>
                </div>
              ) : (
                <div className="manual-card-preview-stage">
                  <FlashcardLivePreview
                    front={manualFront}
                    back={manualBack}
                    articleTitle={articleTitle}
                    sourceType="manual"
                  />
                </div>
              )}

              <div className="form-actions-inline">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreatingManual(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary btn-sm-primary"
                  disabled={!manualFront.trim() || !manualBack.trim()}
                >
                  Añadir al Mazo
                </button>
              </div>
            </form>
          )}

          {/* Lista de Tarjetas del Artículo */}
          <div className="article-cards-list">
            {cards.length === 0 && !isCreatingManual ? (
              <div className="empty-flashcards-placeholder">
                <div className="empty-icon-bubble">🧠</div>
                <h4>Sin Flashcards en este Tema</h4>
                <p>
                  Convierte tus apuntes en memoria a largo plazo. Puedes extraer automáticamente conceptos y dosis clave o redactar preguntas manuales.
                </p>
                <div className="empty-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowGenerateModal(true)}
                  >
                    ✨ Generar Flashcards Automáticas
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsCreatingManual(true)}
                  >
                    ➕ Crear Primera Tarjeta
                  </button>
                </div>
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="no-matches-box">
                <p>
                  No se encontraron tarjetas que coincidan con <strong>"{searchFilter}"</strong>.
                </p>
                <button type="button" className="btn-link" onClick={() => setSearchFilter('')}>
                  Mostrar todas las tarjetas
                </button>
              </div>
            ) : (
              filteredCards.map((card, idx) => (
                <div key={card.id} className="article-card-row">
                  {editingCardId === card.id ? (
                    <div className="edit-card-inline-form">
                      <div className="edit-card-form-header">
                        <span className="form-title">✏️ Editando Tarjeta #{idx + 1}</span>
                        <div className="preview-tab-switcher">
                          <button
                            type="button"
                            className={`btn-preview-tab ${editTab === 'edit' ? 'active' : ''}`}
                            onClick={() => setEditTab('edit')}
                          >
                            ✍️ Editar
                          </button>
                          <button
                            type="button"
                            className={`btn-preview-tab ${editTab === 'preview' ? 'active' : ''}`}
                            onClick={() => setEditTab('preview')}
                          >
                            👁️ Vista Previa (Flip 3D)
                          </button>
                        </div>
                      </div>

                      {editTab === 'edit' ? (
                        <>
                          <div className="edit-field-group">
                            <label>Pregunta / Anverso:</label>
                            <textarea
                              rows={2}
                              value={editFront}
                              onChange={(e) => setEditFront(e.target.value)}
                            />
                          </div>
                          <div className="edit-field-group">
                            <label>Respuesta / Reverso (soporta Markdown):</label>
                            <textarea
                              rows={2}
                              value={editBack}
                              onChange={(e) => setEditBack(e.target.value)}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="manual-card-preview-stage">
                          <FlashcardLivePreview
                            front={editFront}
                            back={editBack}
                            articleTitle={articleTitle}
                            sourceType={card.source_type}
                          />
                        </div>
                      )}

                      <div className="edit-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setEditingCardId(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn-primary btn-sm-primary"
                          onClick={() => handleSaveEdit(card.id)}
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="card-row-top-bar">
                        <div className="card-identifiers">
                          <span className="card-index-number">#{idx + 1}</span>
                          <span className={`source-badge ${card.source_type}`}>
                            {card.source_type === 'cloud_ai'
                              ? '✨ IA Cloud'
                              : card.source_type === 'structural'
                              ? '⚡ Extractor'
                              : '✏️ Manual'}
                          </span>
                        </div>
                        <div className="card-row-meta">
                          <span
                            className={`interval-badge ${
                              card.interval >= 21
                                ? 'mastered'
                                : card.interval > 0
                                ? 'learning'
                                : 'new'
                            }`}
                          >
                            {card.interval === 0
                              ? 'Nueva'
                              : card.interval >= 21
                              ? `Dominada (${card.interval}d)`
                              : `Repaso (${card.interval}d)`}
                          </span>
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-sm"
                            title="Editar"
                            onClick={() => {
                              setEditingCardId(card.id)
                              setEditFront(card.front)
                              setEditBack(card.back)
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-sm btn-delete"
                            title="Eliminar"
                            onClick={() => handleDelete(card.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div className="card-row-content">
                        <div className="card-side-block front-side">
                          <span className="card-side-label">PREGUNTA</span>
                          <div className="card-text-body">
                            <FlashcardMarkdown content={card.front} />
                          </div>
                        </div>
                        <div className="card-side-block back-side">
                          <span className="card-side-label">RESPUESTA CLÍNICA</span>
                          <div className="card-text-body">
                            <FlashcardMarkdown content={card.back} />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <GenerateFlashcardsModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        nodeId={nodeId}
        articleTitle={articleTitle}
        bodyMd={bodyMd}
        onCardsAdded={loadCards}
        onOpenAiSettings={onOpenAiSettings}
      />
    </>
  )
}
