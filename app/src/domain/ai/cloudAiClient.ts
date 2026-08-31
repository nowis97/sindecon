import type { AiConfig } from '../../db/db'
import { estimateFlashcardsFromWords, type ExtractedCard } from '../cardExtractor'

export function getMedicalFlashcardSystemPrompt(targetCount: number): string {
  return `
Eres un médico experto en educación clínica y memorización activa de alto rendimiento (Anki/SM-2).
Tu tarea es analizar el artículo médico provisto y generar EXACTAMENTE ${targetCount} flashcards esenciales de alto rendimiento clínico.

Enfócate en cubrir de forma equilibrada:
- Criterios diagnósticos, signos cardinales y estudios de elección (Gold Standard).
- Fármacos de primera línea, dosis exactas, vías y contraindicaciones críticas.
- Fisiopatología clave, mecanismos y desencadenantes.
- Complicaciones graves, criterios de alarma (Red Flags) y conductas de urgencia.
- Perlas clínicas y diagnósticos diferenciales relevantes.

REGLAS ESTRICTAS:
1. Genera EXACTAMENTE ${targetCount} flashcards (ni más ni menos).
2. El campo "front" debe ser una pregunta directa, clara y específica (ej. "¿Cuál es la dosis de Noradrenalina en shock séptico?").
3. El campo "back" debe ser una respuesta concisa, bien estructurada con formato Markdown (listas con guiones, negritas en conceptos clave, o tablas si aplica).
4. Devuelve ÚNICAMENTE un array JSON válido con la estructura:
[
  {
    "front": "Pregunta médica clara y específica...",
    "back": "Respuesta estructurada en Markdown..."
  }
]
`.trim()
}

/**
 * Limpia y acorta el Markdown para enviarlo al modelo de IA:
 * 1. Reemplaza imágenes Base64 pesadas por etiquetas ligeras.
 * 2. Si excede el límite seguro de caracteres, trunca preservando saltos de línea limpios.
 */
export function cleanAndTruncateMarkdownForAi(markdown: string, maxChars = 25000): string {
  if (!markdown) return ''

  // Reemplazar data URLs base64 de imágenes
  let cleaned = markdown.replace(/!\[(.*?)\]\(data:image\/[^;]+;base64,[^)]+\)/g, '![$1]([imagen])')

  if (cleaned.length <= maxChars) {
    return cleaned
  }

  const sliced = cleaned.slice(0, maxChars)
  const lastNewline = sliced.lastIndexOf('\n')
  const safeText = lastNewline > maxChars * 0.7 ? sliced.slice(0, lastNewline) : sliced

  return `${safeText}\n\n[...contenido restante omitido para optimizar contexto...]`
}

export function humanizeAiError(provider: string, status: number, rawErrorText: string): string {
  const lower = rawErrorText.toLowerCase()
  if (lower.includes('prepayment credits are depleted') || lower.includes('billing') || lower.includes('ai.studio/projects')) {
    return 'Tu clave está asociada a un proyecto de Google Cloud con créditos de prepago agotados. Solución: Ve a Google AI Studio (aistudio.google.com/app/apikey), pulsa "Create API key" y elige "Create API key in new project" para usar el plan 100% GRATIS sin facturación.'
  }
  if (lower.includes('api_key_invalid') || lower.includes('invalid api key') || status === 401 || status === 403) {
    return `La API Key de ${provider.toUpperCase()} es inválida o expiró. Verifica haberla copiado completa.`
  }
  if (lower.includes('resource_exhausted') || status === 429) {
    return `Límite de velocidad alcanzado en ${provider.toUpperCase()}. Espera un momento o cambia a Groq Cloud.`
  }
  try {
    const json = JSON.parse(rawErrorText)
    return json.error?.message || rawErrorText
  } catch {
    return rawErrorText
  }
}

export async function generateFlashcardsWithCloudAi(
  articleTitle: string,
  markdown: string,
  config: AiConfig,
  customTargetCount?: number
): Promise<ExtractedCard[]> {
  const { provider, apiKey, modelName } = config

  if (!markdown || !markdown.trim()) {
    throw new Error('El artículo no contiene texto para procesar.')
  }

  const estimated = estimateFlashcardsFromWords(markdown).estimatedCards
  const targetCount = customTargetCount || (estimated > 0 ? estimated : 6)
  const systemPrompt = getMedicalFlashcardSystemPrompt(targetCount)

  const cleanedMarkdown = cleanAndTruncateMarkdownForAi(markdown, 25000)
  const promptText = `Artículo: "${articleTitle}"\n\nPor favor genera exactamente ${targetCount} flashcards clínicas sobre el siguiente contenido:\n\n${cleanedMarkdown}`

  let rawJsonText = ''

  if (provider === 'gemini') {
    if (!apiKey) {
      throw new Error('Debes configurar tu API Key de Google Gemini en Ajustes de IA.')
    }
    const model = modelName || 'gemini-3.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(humanizeAiError('Gemini', response.status, errBody))
    }

    const data = await response.json()
    rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
  } else if (provider === 'groq' || provider === 'openai') {
    if (!apiKey) {
      throw new Error(`Debes configurar tu API Key de ${provider.toUpperCase()} en Ajustes de IA.`)
    }
    const baseUrl =
      provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions'
    const defaultModel = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName || defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(`Error de ${provider.toUpperCase()} (${response.status}): ${errBody}`)
    }

    const data = await response.json()
    rawJsonText = data.choices?.[0]?.message?.content || '[]'
  } else {
    throw new Error(`Proveedor de IA no soportado: ${provider}`)
  }

  return parseCardsFromJson(rawJsonText, 'cloud_ai')
}

export function parseCardsFromJson(
  rawText: string,
  sourceType: ExtractedCard['sourceType'] = 'cloud_ai'
): ExtractedCard[] {
  try {
    let cleaned = rawText.trim()
    // Remover fences ```json ... ``` si existen
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    }

    const parsed = JSON.parse(cleaned)
    const items: Array<{ front?: string; back?: string; question?: string; answer?: string }> = Array.isArray(parsed)
      ? parsed
      : parsed.flashcards || parsed.cards || parsed.items || []

    return items
      .map((item) => ({
        front: (item.front || item.question || '').trim(),
        back: (item.back || item.answer || '').trim(),
        sourceType,
      }))
      .filter((c) => c.front.length >= 5 && c.back.length >= 3)
  } catch (err) {
    console.error('Error parseando JSON de IA:', err, rawText)
    throw new Error('La respuesta de la IA no tuvo un formato JSON válido.')
  }
}

export interface AiModelOption {
  id: string
  name: string
  badge: string
  description: string
  isDefault?: boolean
}

export const PROVIDER_MODELS: Record<string, AiModelOption[]> = {
  gemini: [
    {
      id: 'gemini-3.5-flash',
      name: 'Gemini 3.5 Flash',
      badge: 'Ultra Rápido',
      description: 'Generación veloz de preguntas y flashcards clínicas esenciales. 100% gratuito.',
      isDefault: true,
    },
    {
      id: 'gemini-3.6-flash',
      name: 'Gemini 3.6 Flash',
      badge: 'Balanceado / Recomendado',
      description: 'Gran equilibrio entre velocidad de respuesta y precisión diagnóstica.',
    },
    {
      id: 'gemini-3.7-flash',
      name: 'Gemini 3.7 Flash',
      badge: 'Máximo Razonamiento',
      description: 'Capacidad avanzada para casos clínicos complejos y perlas terapéuticas.',
    },
  ],
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B Versatile',
      badge: 'Recomendado / 70B',
      description: 'El modelo libre más inteligente de Meta, con velocidad ultra rápida en Groq.',
      isDefault: true,
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      badge: 'Ultra Ligero',
      description: 'Respuesta en milisegundos para extracciones rápidas.',
    },
    {
      id: 'mixtral-8x7b-32768',
      name: 'Mixtral 8x7B (MoE)',
      badge: 'Contexto Amplio',
      description: 'Excelente para procesar artículos extensos con 32k tokens.',
    },
    {
      id: 'gemma2-9b-it',
      name: 'Gemma 2 9B IT',
      badge: 'Google en Groq',
      description: 'Arquitectura de Google optimizada por los procesadores LPU de Groq.',
    },
  ],
  openai: [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      badge: 'Recomendado / Veloz',
      description: 'Excelente rendimiento clínico a costo muy bajo.',
      isDefault: true,
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      badge: 'Insignia Multimodal',
      description: 'El modelo más potente de OpenAI para análisis exhaustivos.',
    },
    {
      id: 'o3-mini',
      name: 'o3-mini',
      badge: 'Razonamiento STEM',
      description: 'Modelo de razonamiento paso a paso para resolver dudas complejas.',
    },
  ],
}

export interface ProviderGuide {
  providerName: string
  portalName: string
  portalUrl: string
  freeTierInfo: string
  steps: string[]
  keyPrefix: string
}

export const PROVIDER_GUIDES: Record<string, ProviderGuide> = {
  gemini: {
    providerName: 'Google Gemini',
    portalName: 'Google AI Studio',
    portalUrl: 'https://aistudio.google.com/app/apikey',
    freeTierInfo: 'Gratis: hasta 15 solicitudes/min sin requerir tarjeta de crédito.',
    steps: [
      'Entra a Google AI Studio con tu cuenta Google.',
      'Haz clic en el botón azul "Create API key" (o "Crear clave de API").',
      'Selecciona "Create API key in new project" (IMPORTANTE: no elijas un proyecto existente con facturación/créditos prepagos para activar el plan 100% gratis).',
      'Copia la clave generada (empieza por AIzaSy...) y pégala en el campo de abajo.',
    ],
    keyPrefix: 'AIzaSy...',
  },
  groq: {
    providerName: 'Groq Cloud',
    portalName: 'Groq Cloud Console',
    portalUrl: 'https://console.groq.com/keys',
    freeTierInfo: 'Gratis: velocidad extrema (~500 tokens/seg) en modelos Llama 3.3.',
    steps: [
      'Inicia sesión en Groq Console con tu cuenta Google o GitHub.',
      'En la sección "API Keys", haz clic en "Create API Key".',
      'Escribe un nombre (ej. "Cuaderno Medico") y haz clic en "Submit".',
      'Copia la clave (empieza por gsk_...) y pégala aquí abajo.',
    ],
    keyPrefix: 'gsk_...',
  },
  openai: {
    providerName: 'OpenAI',
    portalName: 'OpenAI Platform',
    portalUrl: 'https://platform.openai.com/api-keys',
    freeTierInfo: 'Requiere saldo o créditos activos en OpenAI Platform.',
    steps: [
      'Inicia sesión en la plataforma de desarrolladores de OpenAI.',
      'Ve a la pestaña "API keys" en el panel lateral.',
      'Haz clic en "Create new secret key", dale un nombre y confirma.',
      'Copia la clave secreta (empieza por sk-...) y pégala aquí abajo.',
    ],
    keyPrefix: 'sk-...',
  },
}

export async function testAiConnection(config: AiConfig): Promise<{ ok: boolean; message: string }> {
  const { provider, apiKey, modelName } = config
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, message: 'Ingresa una API Key para realizar la prueba.' }
  }

  try {
    if (provider === 'gemini') {
      const model = modelName || 'gemini-3.5-flash'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responde con la palabra OK.' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return { ok: false, message: humanizeAiError('Gemini', response.status, errText) }
      }

      return { ok: true, message: `¡Conexión exitosa con Google Gemini (${model})!` }
    }

    if (provider === 'groq' || provider === 'openai') {
      const baseUrl =
        provider === 'groq'
          ? 'https://api.groq.com/openai/v1/chat/completions'
          : 'https://api.openai.com/v1/chat/completions'
      const defaultModel = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'
      const model = modelName || defaultModel

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return { ok: false, message: humanizeAiError(provider, response.status, errText) }
      }

      return { ok: true, message: `¡Conexión exitosa con ${provider === 'groq' ? 'Groq' : 'OpenAI'} (${model})!` }
    }

    return { ok: false, message: `Proveedor ${provider} no soportado.` }
  } catch (err: any) {
    return { ok: false, message: `Error de red: ${err.message || String(err)}` }
  }
}
