import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import {
  cleanFilenameToTitle,
  extractFrontmatter,
  parseMarkdownArticle,
  extractMarkdownZip,
  processFilesForBulkImport,
} from './bulkMarkdownImport'

describe('bulkMarkdownImport domain', () => {
  describe('cleanFilenameToTitle', () => {
    it('convierte nombres de archivo con guiones y guiones bajos en títulos legibles', () => {
      expect(cleanFilenameToTitle('cetoacidosis_diabetica_manejo.md')).toBe('Cetoacidosis Diabetica Manejo')
      expect(cleanFilenameToTitle('insuficiencia-cardiaca-aguda.markdown')).toBe('Insuficiencia Cardiaca Aguda')
      expect(cleanFilenameToTitle('shock_septico--guia-2024.md')).toBe('Shock Septico Guia 2024')
    })

    it('respeta mayúsculas si ya están presentes', () => {
      expect(cleanFilenameToTitle('Guia_ACLS_2024.md')).toBe('Guia ACLS 2024')
    })

    it('devuelve Sin Título si el nombre de archivo queda vacío tras la limpieza', () => {
      expect(cleanFilenameToTitle('___---.md')).toBe('Sin Título')
    })
  })

  describe('extractFrontmatter', () => {
    it('extrae metadatos y cuerpo con delimitador YAML estándar', () => {
      const raw = `---
title: Manejo de Sepsis y Choque Séptico
tags: [urgencias, infectología, uci]
author: Dr. House
---
# Introducción a la Sepsis
Contenido clínico relevante.
`
      const { frontmatter, body } = extractFrontmatter(raw)
      expect(frontmatter.title).toBe('Manejo de Sepsis y Choque Séptico')
      expect(frontmatter.tags).toEqual(['urgencias', 'infectología', 'uci'])
      expect(frontmatter.author).toBe('Dr. House')
      expect(body.trim()).toBe('# Introducción a la Sepsis\nContenido clínico relevante.')
    })

    it('soporta etiquetas en formato multilínea YAML', () => {
      const raw = `---
title: Fibrilación Auricular
tags:
  - cardiología
  - arritmias
  - anticoagulación
---
Cuerpo del artículo.
`
      const { frontmatter, body } = extractFrontmatter(raw)
      expect(frontmatter.title).toBe('Fibrilación Auricular')
      expect(frontmatter.tags).toEqual(['cardiología', 'arritmias', 'anticoagulación'])
      expect(body.trim()).toBe('Cuerpo del artículo.')
    })

    it('devuelve objeto vacío y texto intacto si no hay frontmatter', () => {
      const raw = '# Artículo sin Frontmatter\nTexto directo.'
      const { frontmatter, body } = extractFrontmatter(raw)
      expect(frontmatter).toEqual({})
      expect(body).toBe(raw)
    })
  })

  describe('parseMarkdownArticle', () => {
    it('prioriza título de Frontmatter sobre H1 y nombre de archivo', () => {
      const raw = `---
title: Título Frontmatter
---
# Título H1
Cuerpo de prueba.
`
      const parsed = parseMarkdownArticle(raw, 'nombre_archivo.md')
      expect(parsed.title).toBe('Título Frontmatter')
      expect(parsed.originalFilename).toBe('nombre_archivo.md')
    })

    it('usa H1 como título si no hay Frontmatter', () => {
      const raw = `# Título H1 Detectado
Cuerpo de prueba sin frontmatter.
`
      const parsed = parseMarkdownArticle(raw, 'archivo_fallback.md')
      expect(parsed.title).toBe('Título H1 Detectado')
    })

    it('usa nombre de archivo limpio si no hay Frontmatter ni H1', () => {
      const raw = `Párrafo directo sin ningún encabezado ni metadato.`
      const parsed = parseMarkdownArticle(raw, 'hipertension_arterial_urgencias.md')
      expect(parsed.title).toBe('Hipertension Arterial Urgencias')
    })

    it('extrae y normaliza etiquetas desde categories o keywords', () => {
      const raw = `---
categories: urgencias, pediatría
---
Cuerpo...
`
      const parsed = parseMarkdownArticle(raw, 'test.md')
      expect(parsed.tags).toContain('urgencias')
      expect(parsed.tags).toContain('pediatría')
    })
  })

  describe('extractMarkdownZip y processFilesForBulkImport', () => {
    it('desempaqueta archivos ZIP ignorando carpetas ocultas y archivos no Markdown', async () => {
      const zip = new JSZip()
      zip.file('medicina/asma_aguda.md', '# Crisis Asmática\nTratamiento con Salbutamol.')
      zip.file('medicina/neumonia.markdown', '---\ntitle: Neumonía Grave\n---\nCuerpo.')
      zip.file('medicina/imagen.png', 'fake image data')
      zip.file('__MACOSX/._asma_aguda.md', 'mac metadata')
      zip.file('.hidden/hidden.md', 'hidden data')

      const zipData = await zip.generateAsync({ type: 'arraybuffer' })
      const items = await extractMarkdownZip(zipData)

      expect(items.length).toBe(2)
      const names = items.map((i) => i.filename)
      expect(names).toContain('asma_aguda.md')
      expect(names).toContain('neumonia.markdown')
      expect(names).not.toContain('imagen.png')
    })

    it('procesa lista mixta de Files simulando selección de usuario', async () => {
      const mdFile = new File(['# Cefalea en Trueno\nUrgencia neurológica.'], 'cefalea.md', {
        type: 'text/markdown',
      })
      const results = await processFilesForBulkImport([mdFile])

      expect(results.length).toBe(1)
      expect(results[0].title).toBe('Cefalea en Trueno')
      expect(results[0].body).toContain('Urgencia neurológica.')
    })
  })
})
