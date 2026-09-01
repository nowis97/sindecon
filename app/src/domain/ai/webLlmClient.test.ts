import { describe, it, expect, vi } from 'vitest'
import {
  checkWebGPUSupport,
  extractJsonArrayString,
  DEFAULT_LOCAL_MODEL,
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
