import { describe, it, expect, vi } from 'vitest'
import {
  checkWebGPUSupport,
  extractJsonArrayString,
  DEFAULT_LOCAL_MODEL,
  robustParseJsonCards,
  sanitizeUnescapedControlCharsInJson,
  extractCardsByRegex,
} from './webLlmClient'

describe('webLlmClient', () => {
  it('DEFAULT_LOCAL_MODEL está configurado a Qwen2.5 0.5B', () => {
    expect(DEFAULT_LOCAL_MODEL).toBe('Qwen2.5-0.5B-Instruct-q4f16_1-MLC')
  })

  it('extrae arrays JSON correctamente de texto con y sin bloques de código', () => {
    const rawWithMarkdown = '```json\n[{"front": "¿Dosis de AAS?", "back": "300 mg VO"}]\n```'
    expect(extractJsonArrayString(rawWithMarkdown)).toBe('[{"front": "¿Dosis de AAS?", "back": "300 mg VO"}]')

    const rawWithSurroundingText = 'Aquí tienes las tarjetas:\n[{"front": "Pregunta", "back": "Respuesta"}]\nEspero te sirvan.'
    expect(extractJsonArrayString(rawWithSurroundingText)).toBe('[{"front": "Pregunta", "back": "Respuesta"}]')

    const cleanJson = '[{"front": "P", "back": "R"}]'
    expect(extractJsonArrayString(cleanJson)).toBe('[{"front": "P", "back": "R"}]')
  })

  it('parsea exitosamente JSON con caracteres de control crudos y saltos de línea literales (Bad control character fix)', () => {
    const rawWithRawNewlines = `[
  {
    "front": "¿Cuál es la definición de urticaria?",
    "back": "La urticaria es una afección dermatológica caracterizada por:
- Habones eritematosos y pruriginosos
- Angioedema en 40% de casos"
  }
]`

    const cards = robustParseJsonCards(rawWithRawNewlines)
    expect(cards.length).toBe(1)
    expect(cards[0].front).toBe('¿Cuál es la definición de urticaria?')
    expect(cards[0].back).toContain('- Habones eritematosos y pruriginosos')
    expect(cards[0].sourceType).toBe('local_ai')
  })

  it('sanitiza caracteres de control no escapados dentro de cadenas JSON', () => {
    const brokenJson = '{"front": "Pregunta", "back": "Línea 1\nLínea 2\tTabulado"}'
    const sanitized = sanitizeUnescapedControlCharsInJson(brokenJson)
    expect(sanitized).toBe('{"front": "Pregunta", "back": "Línea 1\\nLínea 2\\tTabulado"}')
    expect(() => JSON.parse(sanitized)).not.toThrow()
  })

  it('extrae tarjetas con regex cuando el JSON está truncado o tiene sintaxis rota', () => {
    const truncatedJson = `[
      {"front": "¿Tratamiento de primera línea en urticaria aguda?", "back": "Antihistamínicos H1 de 2da generación (ej. Cetirizina 10 mg/día)."},
      {"front": "¿Cuándo indicar epinefrina?", "back": "Ante sospecha de anafilaxia o compromiso de vía aérea`

    const cards = extractCardsByRegex(truncatedJson)
    expect(cards.length).toBe(1)
    expect(cards[0].front).toBe('¿Tratamiento de primera línea en urticaria aguda?')
    expect(cards[0].back).toContain('Antihistamínicos H1')
  })

  it('detecta ausencia de WebGPU cuando navigator.gpu no existe', async () => {
    const originalGpu = (navigator as any).gpu
    delete (navigator as any).gpu

    const status = await checkWebGPUSupport()
    expect(status.supported).toBe(false)
    expect(status.reason).toContain('WebGPU')

    // Restaurar si existía
    if (originalGpu) {
      (navigator as any).gpu = originalGpu
    }
  })

  it('detecta soporte WebGPU si navigator.gpu y requestAdapter están disponibles', async () => {
    const mockRequestAdapter = vi.fn().mockResolvedValue({
      requestDevice: vi.fn(),
    })
    ;(navigator as any).gpu = {
      requestAdapter: mockRequestAdapter,
    }

    const status = await checkWebGPUSupport()
    expect(status.supported).toBe(true)
    expect(mockRequestAdapter).toHaveBeenCalled()

    delete (navigator as any).gpu
  })
})
