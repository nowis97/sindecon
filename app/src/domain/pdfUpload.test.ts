import { describe, it, expect } from 'vitest'
import {
  cleanPdfFilenameToTitle,
  isPdfFile,
  formatPdfFileSize,
} from './pdfUpload'

describe('pdfUpload domain utilities', () => {
  describe('cleanPdfFilenameToTitle', () => {
    it('elimina la extensión .pdf y normaliza guiones bajos y medios', () => {
      expect(cleanPdfFilenameToTitle('guia_hta_2024.pdf')).toBe('Guia Hta 2024')
      expect(cleanPdfFilenameToTitle('algoritmo-rcp-avanzado.PDF')).toBe('Algoritmo Rcp Avanzado')
    })

    it('respeta mayúsculas si ya contiene mezcla de mayúsculas y minúsculas', () => {
      expect(cleanPdfFilenameToTitle('Guia_NICE_Hipertension.pdf')).toBe('Guia NICE Hipertension')
      expect(cleanPdfFilenameToTitle('Harrison_Capitulo_12.pdf')).toBe('Harrison Capitulo 12')
    })

    it('devuelve valor por defecto para nombres vacíos o solo extensión', () => {
      expect(cleanPdfFilenameToTitle('.pdf')).toBe('Documento PDF')
      expect(cleanPdfFilenameToTitle('')).toBe('Documento PDF')
      expect(cleanPdfFilenameToTitle('   ___---.pdf')).toBe('Documento PDF')
    })
  })

  describe('isPdfFile', () => {
    it('identifica archivos con extensión .pdf', () => {
      expect(isPdfFile({ name: 'documento.pdf' })).toBe(true)
      expect(isPdfFile({ name: 'DOCUMENTO.PDF' })).toBe(true)
    })

    it('identifica archivos con tipo MIME application/pdf', () => {
      expect(isPdfFile({ name: 'blob-sin-ext', type: 'application/pdf' })).toBe(true)
    })

    it('rechaza archivos que no son PDF', () => {
      expect(isPdfFile({ name: 'nota.md', type: 'text/markdown' })).toBe(false)
      expect(isPdfFile({ name: 'foto.png', type: 'image/png' })).toBe(false)
      expect(isPdfFile({ name: '' })).toBe(false)
    })
  })

  describe('formatPdfFileSize', () => {
    it('formatea bytes correctamente en B, KB y MB', () => {
      expect(formatPdfFileSize(512)).toBe('512 B')
      expect(formatPdfFileSize(1024)).toBe('1.0 KB')
      expect(formatPdfFileSize(45 * 1024)).toBe('45 KB')
      expect(formatPdfFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
      expect(formatPdfFileSize(0)).toBe('0 B')
    })
  })
})
