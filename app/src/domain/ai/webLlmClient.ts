import {
  CreateWebWorkerMLCEngine,
  CreateMLCEngine,
  hasModelInCache,
  deleteModelAllInfoInCache,
  type MLCEngineInterface,
  type InitProgressReport,
} from '@mlc-ai/web-llm'
import { chunkClinicalMarkdown, getSectionSpecializedPrompt } from './clinicalChunker'
import type { ExtractedCard } from '../cardExtractor'

export const DEFAULT_LOCAL_MODEL = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'

let activeEngine: MLCEngineInterface | null = null
let activeWorker: Worker | null = null
let loadedModelId: string | null = null

export interface WebGPUStatus {
  supported: boolean
  reason?: string
}

export interface LocalGenerationProgress {
  stage: 'downloading' | 'loading' | 'chunking' | 'inferring' | 'complete' | 'error'
  text: string
  progress: number // 0 to 1
  currentChunk?: number
  totalChunks?: number
}

/**
 * Verifica si el navegador y el hardware soportan WebGPU.
 */
export async function checkWebGPUSupport(): Promise<WebGPUStatus> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
    return {
      supported: false,
      reason: 'Tu navegador no dispone de la API WebGPU. Se requiere Chrome/Edge 113+, Firefox Nightly o Safari 18+.',
    }
  }

  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      return {
        supported: false,
        reason: 'No se detectó un adaptador gráfico (GPU) compatible con WebGPU en este dispositivo.',
      }
    }
    return { supported: true }
  } catch (e: any) {
    return {
      supported: false,
      reason: e?.message || 'Error al consultar el adaptador WebGPU.',
    }
  }
}

/**
 * Verifica si el modelo está descargado en el caché local del navegador (CacheStorage/OPFS).
 */
export async function isLocalModelCached(modelId = DEFAULT_LOCAL_MODEL): Promise<boolean> {
  try {
    return await hasModelInCache(modelId)
  } catch {
    return false
  }
}

/**
 * Inicializa o recupera la instancia del motor WebLLM (con soporte para Web Worker dedicado y fallback a Main Thread).
 */
export async function getOrInitLocalEngine(
  modelId = DEFAULT_LOCAL_MODEL,
  onProgress?: (progress: LocalGenerationProgress) => void
): Promise<MLCEngineInterface> {
  if (activeEngine && loadedModelId === modelId) {
    return activeEngine
  }

  if (activeEngine) {
    try {
      await activeEngine.unload()
    } catch {
      // Ignorar error al descargar anterior
    }
    activeEngine = null
  }

  if (activeWorker) {
    activeWorker.terminate()
    activeWorker = null
  }

  onProgress?.({
    stage: 'downloading',
    text: 'Cargando modelo local Qwen 2.5...',
    progress: 0,
  })

  const progressCallback = (report: InitProgressReport) => {
    onProgress?.({
      stage: report.progress < 1 ? 'downloading' : 'loading',
      text: report.text,
      progress: report.progress,
    })
  }

  try {
    // Intento 1: Web Worker dedicado (no bloquea el renderizado de la UI)
    activeWorker = new Worker(new URL('../../workers/webllm.worker.ts', import.meta.url), {
      type: 'module',
    })

    const engine = await CreateWebWorkerMLCEngine(activeWorker, modelId, {
      initProgressCallback: progressCallback,
    })

    activeEngine = engine
    loadedModelId = modelId
    return engine
  } catch (workerErr: any) {
    console.warn('[WebLLM] Web Worker falló o no soporta WebGPU, usando motor en Main Thread:', workerErr)
    if (activeWorker) {
      activeWorker.terminate()
      activeWorker = null
    }

    // Fallback: Main Thread MLCEngine
    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: progressCallback,
    })

    activeEngine = engine
    loadedModelId = modelId
    return engine
  }
}

/**
 * Genera flashcards clínicas usando el modelo local Qwen 2.5 con segmentación semántica.
 */
export async function generateFlashcardsWithWebLlm(
  articleTitle: string,
  markdown: string,
  targetCount = 4,
  modelId = DEFAULT_LOCAL_MODEL,
  onProgress?: (progress: LocalGenerationProgress) => void
): Promise<ExtractedCard[]> {
  // 1. Verificar WebGPU
  const gpuCheck = await checkWebGPUSupport()
  if (!gpuCheck.supported) {
    throw new Error(gpuCheck.reason || 'WebGPU no está disponible en este dispositivo.')
  }

  // 2. Segmentar el contenido por secciones clínicas
  onProgress?.({
    stage: 'chunking',
    text: 'Analizando estructura clínica del artículo...',
    progress: 0.1,
  })

  const chunks = chunkClinicalMarkdown(articleTitle, markdown)
  if (chunks.length === 0) {
    throw new Error('El artículo no contiene suficiente texto para generar flashcards.')
  }

  // 3. Inicializar / Cargar motor
  const engine = await getOrInitLocalEngine(modelId, onProgress)

  // 4. Distribuir targetCount equitativamente a lo largo de todo el artículo
  const extractedCards: ExtractedCard[] = []
  let lastError: Error | null = null

  // 5. Inferencia secuencial sección por sección cubriendo todo el artículo
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const currentChunkNumber = i + 1
    const remainingChunks = chunks.length - i
    const remainingCards = Math.max(1, targetCount - extractedCards.length)
    const targetThisChunk = Math.max(1, Math.ceil(remainingCards / remainingChunks))

    onProgress?.({
      stage: 'inferring',
      text: `Analizando sección ${currentChunkNumber}/${chunks.length}: ${chunk.title}...`,
      progress: 0.2 + (0.7 * (i / chunks.length)),
      currentChunk: currentChunkNumber,
      totalChunks: chunks.length,
    })

    const prompt = getSectionSpecializedPrompt(articleTitle, chunk, targetThisChunk)
    const maxTokens = Math.min(1000, Math.max(350, targetThisChunk * 140))

    try {
      // Limpiar KV Cache y memoria WebGPU entre chunks para evitar overflow en móviles
      try {
        await engine.resetChat()
      } catch {}

      const completion = await engine.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
      })

      const rawResponse = completion.choices[0]?.message?.content || ''
      const cleanedJson = extractJsonArrayString(rawResponse)
      const parsed = JSON.parse(cleanedJson)

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.front === 'string' && typeof item.back === 'string') {
            const front = item.front.trim()
            const back = item.back.trim()
            if (front && back && !extractedCards.some(c => c.front.toLowerCase() === front.toLowerCase())) {
              extractedCards.push({
                front,
                back,
                sourceType: 'local_ai',
              })
            }
          }
        }
      }
    } catch (e: any) {
      lastError = e
      console.warn(`[WebLLM] Error procesando chunk "${chunk.title}":`, e)
    }
  }

  if (extractedCards.length === 0 && lastError) {
    throw new Error(
      `Error al procesar con IA local (Qwen 2.5): ${lastError.message || lastError.toString()}`
    )
  }

  onProgress?.({
    stage: 'complete',
    text: `¡Listo! Se generaron ${extractedCards.length} flashcards con Qwen 2.5 local.`,
    progress: 1,
    currentChunk: chunks.length,
    totalChunks: chunks.length,
  })

  return extractedCards.slice(0, Math.max(targetCount, extractedCards.length))
}

/**
 * Extrae y aísla el bloque JSON `[...]` de una respuesta en texto crudo.
 */
export function extractJsonArrayString(text: string): string {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')

  const firstBracket = cleaned.indexOf('[')
  const lastBracket = cleaned.lastIndexOf(']')

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return cleaned.substring(firstBracket, lastBracket + 1)
  }

  return cleaned
}

/**
 * Descarga el modelo de la memoria VRAM y termina el worker activo.
 */
export async function unloadLocalModel(): Promise<void> {
  if (activeEngine) {
    try {
      await activeEngine.unload()
    } catch (e) {
      console.warn('[WebLLM] Error al descargar modelo:', e)
    }
    activeEngine = null
    loadedModelId = null
  }

  if (activeWorker) {
    activeWorker.terminate()
    activeWorker = null
  }
}

/**
 * Elimina los archivos del modelo del caché local del navegador para liberar espacio en disco.
 */
export async function clearLocalModelCache(modelId = DEFAULT_LOCAL_MODEL): Promise<void> {
  await unloadLocalModel()
  try {
    await deleteModelAllInfoInCache(modelId)
  } catch (e) {
    console.warn('[WebLLM] Error al limpiar caché:', e)
  }
}
