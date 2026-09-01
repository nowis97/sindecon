import React, { useState, useEffect, useMemo } from 'react'
import {
  extractCardsFromMarkdown,
  estimateFlashcardsFromWords,
  type ExtractedCard,
} from '../../domain/cardExtractor'
import { generateFlashcardsWithCloudAi } from '../../domain/ai/cloudAiClient'
import {
  generateFlashcardsWithWebLlm,
  checkWebGPUSupport,
  type LocalGenerationProgress,
  DEFAULT_LOCAL_MODEL,
  AVAILABLE_LOCAL_MODELS,
} from '../../domain/ai/webLlmClient'
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

type GeneratorMode = 'structural' | 'local_ai' | 'cloud_ai'

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
  const [localProgress, setLocalProgress] = useState<LocalGenerationProgress | null>(null)
  const [webGpuSupported, setWebGpuSupported] = useState<boolean | null>(null)
  const [webGpuReason, setWebGpuReason] = useState<string>('')
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
      checkWebGPUSupport().then((gpu) => {
        setWebGpuSupported(gpu.supported)
        if (gpu.reason) setWebGpuReason(gpu.reason)
      })
      setErrorMsg(null)
      setProgressMsg('')
      setLocalProgress(null)
      setCandidates([])
      setPreviewCardIndex(null)
      setTargetCardCount(wordEstimate.estimatedCards > 0 ? wordEstimate.estimatedCards : 6)
    }
  }, [isOpen, nodeId])

  if (!isOpen) return null

  const runExtraction = async (selectedMode: GeneratorMode, countOverride?: number) => {
    setLoading(true)
    setErrorMsg(null)
    setLocalProgress(null)
    setCandidates([])
    setMode(selectedMode)

    const activeCount = countOverride || targetCardCount

    try {
      let extracted: ExtractedCard[] = []

      if (selectedMode === 'structural') {
        setProgressMsg('Analizando estructura clínica del artículo...')
        extracted = extractCardsFromMarkdown(articleTitle, bodyMd)
      } else if (selectedMode === 'local_ai') {
        const localModel = aiConfig?.localModelId || DEFAULT_LOCAL_MODEL
        const modelMeta = AVAILABLE_LOCAL_MODELS.find(m => m.id === localModel)
        setProgressMsg(`Iniciando motor local WebLLM (${modelMeta?.name || 'Qwen 2.5'})...`)
        extracted = await generateFlashcardsWithWebLlm(
          articleTitle,
          bodyMd,
          activeCount,
          localModel,
          (prog) => {
            setLocalProgress(prog)
            setProgressMsg(prog.text)
          }
        )
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
            onClick={() => setMode('structural')}
            disabled={loading}
          >
            ⚡ Extractor Rápido (Offline)
          </button>
          <button
            type="button"
            className={`btn-mode-tab ${mode === 'local_ai' ? 'active' : ''}`}
            onClick={() => setMode('local_ai')}
            disabled={loading}
          >
            🧠 IA Local (Qwen 2.5 WebGPU)
          </button>
          <button
            type="button"
            className={`btn-mode-tab ${mode === 'cloud_ai' ? 'active' : ''}`}
            onClick={() => setMode('cloud_ai')}
            disabled={loading}
          >
            ✨ IA Cloud (Gemini / Groq / OpenAI)
          </button>
        </div>

        {/* Banner de Compatibilidad WebGPU si no está soportado */}
        {mode === 'local_ai' && webGpuSupported === false && (
          <div className="generator-webgpu-warning-box">
            <span className="warning-icon">⚠️</span>
            <div className="warning-content">
              <strong>WebGPU no disponible en este navegador</strong>
              <p>{webGpuReason || 'Se requiere un navegador compatible con WebGPU (Chrome/Edge 113+, Firefox Nightly o Safari 18+).'}</p>
              <div className="warning-actions">
                <button
                  type="button"
                  className="btn-link-action"
                  onClick={() => setMode('structural')}
                >
                  Cambiar a Extractor Rápido ⚡
                </button>
                <button
                  type="button"
                  className="btn-link-action"
                  onClick={() => setMode('cloud_ai')}
                >
                  Usar IA Cloud (Gemini) ✨
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Banner de Estimación Médica según palabras del artículo */}
        {wordEstimate.wordCount >= 30 && (
          <div className="generator-word-estimate-banner">
            <span className="estimate-badge-icon">📊</span>
            <span className="estimate-badge-text">
              <strong>{wordEstimate.wordCount} palabras</strong> ({wordEstimate.densityDescription}) • Recomendadas: <strong>~{wordEstimate.estimatedCards} flashcards clínicas</strong> (~1 card / 60 palabras)
            </span>
          </div>
        )}

        {/* Selector de Cantidad Dinámica para IA Local y Cloud */}
        {(mode === 'cloud_ai' || mode === 'local_ai') && (
          <div className="ai-target-stepper-panel">
            <div className="stepper-label-group">
              <span className="stepper-title">🎯 Cantidad de flashcards a generar:</span>
              <small className="stepper-subtext">
                {mode === 'local_ai' ? 'Qwen 2.5 segmentará el artículo en secciones clínicas' : 'Ajusta según la profundidad del repaso deseado'}
              </small>
            </div>
            <div className="stepper-controls-group">
              <button
                type="button"
                className="btn-stepper-arrow"
                disabled={targetCardCount <= 2 || loading}
                onClick={() => setTargetCardCount((prev) => Math.max(2, prev - 1))}
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
                onClick={() => setTargetCardCount((prev) => Math.min(25, prev + 1))}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Botón Principal para Disparar la Generación */}
        <div className="generator-trigger-action-row">
          <button
            type="button"
            className="btn-trigger-generate btn-primary"
            onClick={() => runExtraction(mode, targetCardCount)}
            disabled={loading || (mode === 'local_ai' && webGpuSupported === false)}
          >
            {loading ? (
              <>
                <span className="spinner-sm" />
                <span>{progressMsg || 'Generando flashcards...'}</span>
              </>
            ) : mode === 'local_ai' ? (
              <>
                <span className="btn-icon">🧠</span>
                <span>Generar {targetCardCount} Flashcards con Qwen 2.5 (Local WebGPU)</span>
              </>
            ) : mode === 'cloud_ai' ? (
              <>
                <span className="btn-icon">🚀</span>
                <span>Generar {targetCardCount} Flashcards con IA ({aiConfig?.provider ? aiConfig.provider.toUpperCase() : 'Cloud'})</span>
              </>
            ) : (
              <>
                <span className="btn-icon">⚡</span>
                <span>Extraer Flashcards del Artículo</span>
              </>
            )}
          </button>
        </div>

        {/* Panel de Estado / Progreso de Descarga e Inferencia */}
        {loading && (
          <div className="generation-loading-state">
            {localProgress && localProgress.stage === 'downloading' ? (
              <div className="local-download-progress-box">
                <div className="download-header-line">
                  <span>
                    📥 Descargando {AVAILABLE_LOCAL_MODELS.find(m => m.id === (aiConfig?.localModelId || DEFAULT_LOCAL_MODEL))?.name || 'Qwen 2.5'} ({AVAILABLE_LOCAL_MODELS.find(m => m.id === (aiConfig?.localModelId || DEFAULT_LOCAL_MODEL))?.size || '~350 MB'})...
                  </span>
                  <strong>{Math.round(localProgress.progress * 100)}%</strong>
                </div>
                <div className="download-progress-track">
                  <div
                    className="download-progress-bar"
                    style={{ width: `${Math.max(5, Math.round(localProgress.progress * 100))}%` }}
                  />
                </div>
                <small className="download-note">Solo se descarga una vez. Quedará guardado en el almacenamiento local.</small>
              </div>
            ) : (
              <>
                <div className="spinner-sm" />
                <p>{progressMsg || 'Procesando contenido clínico...'}</p>
              </>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="generation-error-box">
            <span>⚠️ {errorMsg}</span>
            {onOpenAiSettings && mode === 'cloud_ai' && (
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

        {/* Placeholder inicial antes de pulsar Generar */}
        {!loading && !errorMsg && candidates.length === 0 && (
          <div className="generator-ready-placeholder">
            <div className="ready-icon-circle">
              {mode === 'local_ai' ? '🧠' : mode === 'cloud_ai' ? '✨' : '⚡'}
            </div>
            <h4>Listo para Crear Flashcards</h4>
            <p>
              {mode === 'local_ai'
                ? `Pulsa el botón superior para ejecutar Qwen 2.5 localmente en tu GPU y generar exactamente ${targetCardCount} tarjetas clínicas offline.`
                : mode === 'cloud_ai'
                ? `Pulsa el botón superior para consultar ${aiConfig?.provider?.toUpperCase() || 'Gemini'} y generar exactamente ${targetCardCount} tarjetas clínicas.`
                : 'Pulsa el botón superior para analizar callouts, dosis y encabezados del artículo.'}
            </p>
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
                Modo: {mode === 'structural' ? 'Estructural' : mode === 'local_ai' ? 'IA Local Qwen 2.5' : 'IA Cloud'}
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
