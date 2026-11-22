import React, { useState, useEffect, useMemo } from 'react'
import {
  Sparkles,
  Zap,
  Cpu,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  PenLine,
  Eye,
  Loader2,
  Check,
  Settings,
} from 'lucide-react'
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
import { newId } from '../../db/nodes'
import { FlashcardLivePreview } from './FlashcardLivePreview'
import type { FlashcardRow } from '../../db/db'
import { BaseModal, PILL_BTN_PRIMARY, PILL_BTN_SECONDARY } from '../common/DialogModal'

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
    wordEstimate.estimatedCards > 0 ? wordEstimate.estimatedCards : 6,
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
  }, [isOpen, nodeId, wordEstimate.estimatedCards])

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
        setProgressMsg('Analizando estructura clínica del artículo…')
        extracted = extractCardsFromMarkdown(articleTitle, bodyMd)
      } else if (selectedMode === 'local_ai') {
        const localModel = aiConfig?.localModelId || DEFAULT_LOCAL_MODEL
        const modelMeta = AVAILABLE_LOCAL_MODELS.find((m) => m.id === localModel)
        setProgressMsg(`Iniciando motor local WebLLM (${modelMeta?.name || 'Qwen 2.5'})…`)
        extracted = await generateFlashcardsWithWebLlm(
          articleTitle,
          bodyMd,
          activeCount,
          localModel,
          (prog) => {
            setLocalProgress(prog)
            setProgressMsg(prog.text)
          },
        )
      } else if (selectedMode === 'cloud_ai') {
        if (!aiConfig || !aiConfig.apiKey) {
          throw new Error(
            'Configura tu API Key de Gemini, Groq u OpenAI en Ajustes para usar este modo.',
          )
        }
        setProgressMsg(
          `Consultando ${aiConfig.provider.toUpperCase()} para generar ${activeCount} flashcards clínicas…`,
        )
        extracted = await generateFlashcardsWithCloudAi(articleTitle, bodyMd, aiConfig, activeCount)
      }

      if (extracted.length === 0) {
        setErrorMsg('No se detectaron preguntas en el artículo con este método.')
      } else {
        setCandidates(extracted.map((c) => ({ ...c, selected: true })))
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al generar flashcards.')
    } finally {
      setLoading(false)
      setProgressMsg('')
    }
  }

  const handleToggleSelect = (index: number) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c)),
    )
  }

  const handleEditCard = (index: number, field: 'front' | 'back', val: string) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: val } : c)),
    )
  }

  const handleSaveToDeck = async () => {
    const selected = candidates.filter((c) => c.selected && c.front.trim() && c.back.trim())
    if (selected.length === 0) return

    const now = Date.now()
    const rows: FlashcardRow[] = selected.map((c) => ({
      id: newId(),
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
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!loading}
      title="Generador de Flashcards"
      subtitle={articleTitle}
      icon={<Sparkles className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <>
          <button type="button" className={PILL_BTN_SECONDARY} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={PILL_BTN_PRIMARY}
            onClick={handleSaveToDeck}
            disabled={loading || selectedCount === 0}
          >
            <Check className="h-3.5 w-3.5" />
            <span>
              Guardar {selectedCount} Tarjeta{selectedCount === 1 ? '' : 's'} en Mazo
            </span>
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Generator Modes Pill Switcher */}
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-1.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setMode('structural')}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
              mode === 'structural'
                ? 'bg-[var(--ch-accent)] text-white shadow-xs'
                : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Extractor Rápido (Offline)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('local_ai')}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
              mode === 'local_ai'
                ? 'bg-[var(--ch-accent)] text-white shadow-xs'
                : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>IA Local (WebGPU)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('cloud_ai')}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
              mode === 'cloud_ai'
                ? 'bg-[var(--ch-accent)] text-white shadow-xs'
                : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>IA Cloud</span>
          </button>
        </div>

        {/* WebGPU Warning */}
        {mode === 'local_ai' && webGpuSupported === false && (
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>WebGPU no disponible en este navegador</span>
            </div>
            <p className="opacity-90">
              {webGpuReason ||
                'Se requiere un navegador compatible con WebGPU (Chrome/Edge 113+, Safari 18+).'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMode('structural')}
                className="rounded-full border border-amber-600/30 bg-white/70 px-3 py-1 font-semibold text-amber-900 dark:bg-slate-900/50 dark:text-amber-200"
              >
                Usar Extractor Rápido
              </button>
              <button
                type="button"
                onClick={() => setMode('cloud_ai')}
                className="rounded-full border border-amber-600/30 bg-white/70 px-3 py-1 font-semibold text-amber-900 dark:bg-slate-900/50 dark:text-amber-200"
              >
                Usar IA Cloud
              </button>
            </div>
          </div>
        )}

        {/* Word Count Estimate */}
        {wordEstimate.wordCount >= 30 && (
          <div className="flex items-center gap-2.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-4 py-2 text-xs text-[var(--ch-text-secondary)]">
            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
            <span>
              <strong>{wordEstimate.wordCount} palabras</strong> ({wordEstimate.densityDescription}) ·
              Recomendadas: <strong>~{wordEstimate.estimatedCards} flashcards clínicas</strong>
            </span>
          </div>
        )}

        {/* Card Count Stepper */}
        {(mode === 'cloud_ai' || mode === 'local_ai') && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-3.5">
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="h-4 w-4 text-[var(--ch-accent)]" />
              <div>
                <span className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                  Cantidad de flashcards a generar
                </span>
                <span className="text-[11px] text-[var(--ch-text-muted)]">
                  {mode === 'local_ai'
                    ? 'Qwen 2.5 segmentará el artículo en secciones clínicas'
                    : 'Ajusta la profundidad del mazo'}
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                disabled={targetCardCount <= 2 || loading}
                onClick={() => setTargetCardCount((prev) => Math.max(2, prev - 1))}
                aria-label="Disminuir cantidad"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] font-mono text-sm font-bold text-[var(--ch-text-primary)] disabled:opacity-40"
              >
                −
              </button>
              <span className="min-w-[82px] text-center font-mono text-xs font-semibold text-[var(--ch-text-primary)]">
                {targetCardCount} tarjetas
              </span>
              <button
                type="button"
                disabled={targetCardCount >= 25 || loading}
                onClick={() => setTargetCardCount((prev) => Math.min(25, prev + 1))}
                aria-label="Aumentar cantidad"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] font-mono text-sm font-bold text-[var(--ch-text-primary)] disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Primary Generate Action */}
        <button
          type="button"
          className={`${PILL_BTN_PRIMARY} w-full`}
          onClick={() => runExtraction(mode, targetCardCount)}
          disabled={loading || (mode === 'local_ai' && webGpuSupported === false)}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{progressMsg || 'Generando flashcards…'}</span>
            </>
          ) : mode === 'local_ai' ? (
            <>
              <Cpu className="h-4 w-4" />
              <span>Generar {targetCardCount} Flashcards Locales (WebGPU)</span>
            </>
          ) : mode === 'cloud_ai' ? (
            <>
              <Sparkles className="h-4 w-4" />
              <span>
                Generar {targetCardCount} Flashcards con{' '}
                {aiConfig?.provider ? aiConfig.provider.toUpperCase() : 'IA Cloud'}
              </span>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              <span>Extraer Flashcards del Artículo</span>
            </>
          )}
        </button>

        {/* Loading / Local Model Download */}
        {loading && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-4 text-center">
            {localProgress && localProgress.stage === 'downloading' ? (
              <div className="w-full space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span>
                    Descargando{' '}
                    {AVAILABLE_LOCAL_MODELS.find(
                      (m) => m.id === (aiConfig?.localModelId || DEFAULT_LOCAL_MODEL),
                    )?.name || 'Qwen 2.5'}
                    …
                  </span>
                  <span className="font-mono">{Math.round(localProgress.progress * 100)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ch-bg-elevated)]">
                  <div
                    className="h-full bg-[var(--ch-accent)] transition-all"
                    style={{
                      width: `${Math.max(5, Math.round(localProgress.progress * 100))}%`,
                    }}
                  />
                </div>
                <span className="block text-[11px] text-[var(--ch-text-muted)]">
                  Se descarga una única vez para uso offline.
                </span>
              </div>
            ) : (
              <p className="text-xs text-[var(--ch-text-secondary)]">
                {progressMsg || 'Procesando contenido clínico…'}
              </p>
            )}
          </div>
        )}

        {/* Error Box */}
        {errorMsg && (
          <div className="flex flex-col gap-2 rounded-2xl border border-red-500/35 bg-red-500/10 p-3.5 text-xs text-red-700 dark:text-red-300">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {mode === 'local_ai' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null)
                      void runExtraction('cloud_ai')
                    }}
                    className="rounded-full border border-red-500/30 bg-white/70 px-3 py-1 font-semibold dark:bg-slate-900/50"
                  >
                    Cambiar a IA Cloud
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null)
                      void runExtraction('structural')
                    }}
                    className="rounded-full border border-red-500/30 bg-white/70 px-3 py-1 font-semibold dark:bg-slate-900/50"
                  >
                    Usar Extractor Rápido
                  </button>
                </>
              )}
              {onOpenAiSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenAiSettings()
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-3 py-1 font-semibold text-[var(--ch-text-primary)]"
                >
                  <Settings className="h-3 w-3 text-[var(--ch-accent)]" />
                  <span>Configurar IA</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty Initial State */}
        {!loading && !errorMsg && candidates.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/35 p-6 text-center">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
              {mode === 'local_ai' ? (
                <Cpu className="h-5 w-5" />
              ) : mode === 'cloud_ai' ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
            </span>
            <h4 className="font-serif text-sm font-semibold text-[var(--ch-text-primary)]">
              Listo para crear flashcards clínicas
            </h4>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--ch-text-muted)]">
              {mode === 'local_ai'
                ? `Pulsa el botón superior para ejecutar Qwen 2.5 localmente y generar ${targetCardCount} tarjetas offline.`
                : mode === 'cloud_ai'
                  ? `Pulsa el botón superior para consultar ${aiConfig?.provider?.toUpperCase() || 'Gemini'} y generar ${targetCardCount} tarjetas.`
                  : 'Pulsa el botón superior para analizar callouts, dosis y encabezados del artículo.'}
            </p>
          </div>
        )}

        {/* Candidates List */}
        {!loading && candidates.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ch-text-primary)]">
                <input
                  type="checkbox"
                  checked={candidates.every((c) => c.selected)}
                  onChange={(e) =>
                    setCandidates((prev) =>
                      prev.map((c) => ({ ...c, selected: e.target.checked })),
                    )
                  }
                  className="h-4 w-4 accent-[var(--ch-accent)]"
                />
                <span>Seleccionar todas ({candidates.length})</span>
              </label>
              <span className="rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--ch-text-muted)]">
                {mode === 'structural'
                  ? 'Estructural'
                  : mode === 'local_ai'
                    ? 'IA Local Qwen 2.5'
                    : 'IA Cloud'}
              </span>
            </div>

            <div className="flex max-h-72 flex-col gap-2.5 overflow-y-auto pr-1">
              {candidates.map((card, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl border p-3.5 transition ${
                    card.selected
                      ? 'border-[var(--ch-accent)]/45 bg-[var(--ch-accent-soft)]/25'
                      : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/30 opacity-75'
                  }`}
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ch-text-primary)]">
                      <input
                        type="checkbox"
                        checked={card.selected}
                        onChange={() => handleToggleSelect(idx)}
                        className="h-4 w-4 accent-[var(--ch-accent)]"
                      />
                      <span className="font-mono">Tarjeta #{idx + 1}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPreviewCardIndex(previewCardIndex === idx ? null : idx)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                        previewCardIndex === idx
                          ? 'border-[var(--ch-accent)] bg-[var(--ch-accent)] text-white'
                          : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-secondary)]'
                      }`}
                    >
                      {previewCardIndex === idx ? (
                        <>
                          <PenLine className="h-3 w-3" />
                          <span>Editar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          <span>Vista Previa</span>
                        </>
                      )}
                    </button>
                  </div>

                  {previewCardIndex === idx ? (
                    <FlashcardLivePreview
                      front={card.front}
                      back={card.back}
                      articleTitle={articleTitle}
                      sourceType={card.sourceType}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <span className="mb-1 block font-mono text-[10px] font-semibold text-[var(--ch-text-muted)] uppercase">
                          Pregunta
                        </span>
                        <textarea
                          rows={2}
                          value={card.front}
                          onChange={(e) => handleEditCard(idx, 'front', e.target.value)}
                          placeholder="Enunciado…"
                          className="w-full rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-2 text-xs text-[var(--ch-text-primary)] outline-none focus:border-[var(--ch-accent)]"
                        />
                      </div>
                      <div>
                        <span className="mb-1 block font-mono text-[10px] font-semibold text-[var(--ch-text-muted)] uppercase">
                          Respuesta
                        </span>
                        <textarea
                          rows={2}
                          value={card.back}
                          onChange={(e) => handleEditCard(idx, 'back', e.target.value)}
                          placeholder="Respuesta clínica…"
                          className="w-full rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-2 text-xs text-[var(--ch-text-primary)] outline-none focus:border-[var(--ch-accent)]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  )
}
