import React, { useState, useEffect, useMemo } from 'react'
import {
  extractCardsFromMarkdown,
  estimateFlashcardsFromWords,
  type ExtractedCard,
} from '../../domain/cardExtractor'
import { generateFlashcardsWithCloudAi } from '../../domain/ai/cloudAiClient'
import { getAiConfig, upsertFlashcards, type AiConfig } from '../../db/flashcards'
import { FlashcardLivePreview } from './FlashcardLivePreview'
import type { FlashcardRow } from '../../db/db'

interface GenerateFlashcardsModalProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string
  articleTitle: string
  bodyMd: string
  onCardsAdded?: () => void
  onOpenAiSettings?: () => void
}

type GeneratorMode = 'structural' | 'cloud_ai'

export const GenerateFlashcardsModal: React.FC<GenerateFlashcardsModalProps> = ({
  isOpen,
  onClose,
  nodeId,
  articleTitle,
  bodyMd,
  onCardsAdded,
  onOpenAiSettings,
}) => {
  const [mode, setMode] = useState<GeneratorMode>('structural')
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [previewCardIndex, setPreviewCardIndex] = useState<number | null>(null)

  const wordEstimate = useMemo(() => estimateFlashcardsFromWords(bodyMd), [bodyMd])
  const [targetCardCount, setTargetCardCount] = useState<number>(
    wordEstimate.estimatedCards > 0 ? wordEstimate.estimatedCards : 6
  )

  const [candidates, setCandidates] = useState<Array<ExtractedCard & { selected: boolean }>>([])

  useEffect(() => {
    if (isOpen) {
      getAiConfig().then((cfg) => {
        setAiConfig(cfg)
      })
      setErrorMsg(null)
      setProgressMsg('')
      setTargetCardCount(wordEstimate.estimatedCards > 0 ? wordEstimate.estimatedCards : 6)
      // Ejecutar automáticamente el extractor estructural al abrir
      runExtraction('structural')
    }
  }, [isOpen, nodeId])

  if (!isOpen) return null

  const runExtraction = async (selectedMode: GeneratorMode, countOverride?: number) => {
    setLoading(true)
    setErrorMsg(null)
    setCandidates([])
    setMode(selectedMode)

    const activeCount = countOverride || targetCardCount

    try {
      let extracted: ExtractedCard[] = []

      if (selectedMode === 'structural') {
        setProgressMsg('Analizando estructura clínica del artículo...')
        extracted = extractCardsFromMarkdown(articleTitle, bodyMd)
      } else if (selectedMode === 'cloud_ai') {
        if (!aiConfig || !aiConfig.apiKey) {
          throw new Error('Configura tu API Key de Gemini, Groq u OpenAI en Ajustes para usar este modo.')
        }
        setProgressMsg(`Consultando ${aiConfig.provider.toUpperCase()} para generar ${activeCount} flashcards clínicas...`)
        extracted = await generateFlashcardsWithCloudAi(articleTitle, bodyMd, aiConfig, activeCount)
      }

      if (extracted.length === 0) {
        setErrorMsg('No se detectaron preguntas en el artículo con este método.')
      } else {
        setCandidates(extracted.map((c) => ({ ...c, selected: true })))
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al generar flashcards.')
    } finally {
      setLoading(false)
      setProgressMsg('')
    }
  }

  const handleToggleSelect = (index: number) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    )
  }

  const handleEditCard = (index: number, field: 'front' | 'back', val: string) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: val } : c))
    )
  }

  const handleSaveToDeck = async () => {
    const selected = candidates.filter((c) => c.selected && c.front.trim() && c.back.trim())
    if (selected.length === 0) return

    const now = Date.now()
    const rows: FlashcardRow[] = selected.map((c) => ({
      id: crypto.randomUUID(),
      node_id: nodeId,
      front: c.front.trim(),
      back: c.back.trim(),
      source_type: c.sourceType,
      interval: 0,
      ease_factor: 2.5,
      reps: 0,
      lapses: 0,
      due_date: now,
      created_at: now,
      updated_at: now,
    }))

    await upsertFlashcards(rows)
    if (onCardsAdded) onCardsAdded()
    onClose()
  }

  const selectedCount = candidates.filter((c) => c.selected).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content generate-flashcards-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="header-title-group">
            <h3>✨ Generador de Flashcards</h3>
            <span className="header-subtitle">{articleTitle}</span>
          </div>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Selector de Modos de Generación */}
        <div className="generator-modes-bar">
          <button
            type="button"
            className={`btn-mode-tab ${mode === 'structural' ? 'active' : ''}`}
            onClick={() => runExtraction('structural')}
            disabled={loading}
          >
            ⚡ Extractor Rápido (Offline)
          </button>
          <button
            type="button"
            className={`btn-mode-tab ${mode === 'cloud_ai' ? 'active' : ''}`}
            onClick={() => runExtraction('cloud_ai')}
            disabled={loading}
          >
            ✨ IA Cloud (Gemini / Groq / OpenAI)
          </button>
        </div>

        {/* Banner de Estimación Médica según palabras del artículo */}
        {wordEstimate.wordCount >= 30 && (
          <div className="generator-word-estimate-banner">
            <span className="estimate-badge-icon">📊</span>
            <span className="estimate-badge-text">
              <strong>{wordEstimate.wordCount} palabras</strong> ({wordEstimate.densityDescription}) • Recomendadas: <strong>~{wordEstimate.estimatedCards} flashcards clínicas</strong> (~1 card / 60 palabras)
            </span>
          </div>
        )}

        {/* Selector de Cantidad Dinámica para IA Cloud */}
        {mode === 'cloud_ai' && (
          <div className="ai-target-stepper-panel">
            <div className="stepper-label-group">
              <span className="stepper-title">🎯 Cantidad a generar con IA:</span>
              <small className="stepper-subtext">Ajusta o mantén la recomendación calculada</small>
            </div>
            <div className="stepper-controls-group">
              <button
                type="button"
                className="btn-stepper-arrow"
                disabled={targetCardCount <= 2 || loading}
                onClick={() => {
                  const next = Math.max(2, targetCardCount - 1)
                  setTargetCardCount(next)
                  runExtraction('cloud_ai', next)
                }}
                aria-label="Disminuir cantidad"
              >
                −
              </button>
              <span className="stepper-count-badge">
                <strong>{targetCardCount}</strong> tarjetas
              </span>
              <button
                type="button"
                className="btn-stepper-arrow"
                disabled={targetCardCount >= 25 || loading}
                onClick={() => {
                  const next = Math.min(25, targetCardCount + 1)
                  setTargetCardCount(next)
                  runExtraction('cloud_ai', next)
                }}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
              <button
                type="button"
                className="btn-stepper-reload"
                disabled={loading}
                onClick={() => runExtraction('cloud_ai', targetCardCount)}
                title="Volver a generar con IA"
              >
                🔄 Re-generar
              </button>
            </div>
          </div>
        )}

        {/* Panel de Estado / Progreso */}
        {loading && (
          <div className="generation-loading-state">
            <div className="spinner-sm" />
            <p>{progressMsg || 'Procesando contenido...'}</p>
          </div>
        )}

        {errorMsg && (
          <div className="generation-error-box">
            <span>⚠️ {errorMsg}</span>
            {onOpenAiSettings && (
              <button
                type="button"
                className="btn-link-settings"
                onClick={() => {
                  onClose()
                  onOpenAiSettings()
                }}
              >
                Configurar IA ⚙️
              </button>
            )}
          </div>
        )}

        {/* Lista de Tarjetas Detectadas */}
        {!loading && candidates.length > 0 && (
          <div className="candidates-list-container">
            <div className="candidates-header-row">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={candidates.every((c) => c.selected)}
                  onChange={(e) =>
                    setCandidates((prev) =>
                      prev.map((c) => ({ ...c, selected: e.target.checked }))
                    )
                  }
                />
                Seleccionar todas ({candidates.length})
              </label>
              <span className="source-indicator-badge">
                Modo: {mode === 'structural' ? 'Estructural' : 'IA Cloud'}
              </span>
            </div>

            <div className="candidates-cards-scroll">
              {candidates.map((card, idx) => (
                <div
                  key={idx}
                  className={`candidate-card-item ${card.selected ? 'is-selected' : ''}`}
                >
                  <div className="candidate-card-top-bar">
                    <div className="candidate-card-select">
                      <input
                        type="checkbox"
                        checked={card.selected}
                        onChange={() => handleToggleSelect(idx)}
                      />
                      <span className="candidate-index-label">Tarjeta #{idx + 1}</span>
                    </div>
                    <button
                      type="button"
                      className={`btn-preview-candidate-toggle ${previewCardIndex === idx ? 'active' : ''}`}
                      onClick={() => setPreviewCardIndex(previewCardIndex === idx ? null : idx)}
                    >
                      {previewCardIndex === idx ? '✍️ Editar' : '👁️ Vista Previa'}
                    </button>
                  </div>

                  {previewCardIndex === idx ? (
                    <div className="candidate-preview-stage">
                      <FlashcardLivePreview
                        front={card.front}
                        back={card.back}
                        articleTitle={articleTitle}
                        sourceType={card.sourceType}
                      />
                    </div>
                  ) : (
                    <div className="candidate-card-fields">
                      <div className="field-row">
                        <span className="field-tag">Pregunta:</span>
                        <textarea
                          rows={2}
                          value={card.front}
                          onChange={(e) => handleEditCard(idx, 'front', e.target.value)}
                          placeholder="Enunciado de la pregunta..."
                        />
                      </div>
                      <div className="field-row">
                        <span className="field-tag">Respuesta:</span>
                        <textarea
                          rows={2}
                          value={card.back}
                          onChange={(e) => handleEditCard(idx, 'back', e.target.value)}
                          placeholder="Respuesta o explicación..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barra de Acciones */}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveToDeck}
            disabled={loading || selectedCount === 0}
          >
            💾 Guardar {selectedCount} Tarjeta{selectedCount === 1 ? '' : 's'} en el Mazo
          </button>
        </div>
      </div>
    </div>
  )
}
