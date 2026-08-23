import { test, expect } from '@playwright/test'

test.describe('Cuaderno Médico Personal - Vital E2E Tests (OpenSpec)', () => {
  test.beforeEach(async ({ page }) => {
    // Abrir la aplicación
    await page.goto('/')
    // Esperar a que la app y la barra lateral estén listas
    await expect(page.locator('.sidebar')).toBeVisible()
  })

  test('1. Siembra de plantillas en primer arranque (spec: templates)', async ({ page }) => {
    // Esperar a que las 10 plantillas maestras terminen de sembrarse en IndexedDB
    const templateSelect = page.locator('.sidebar select.template-select')
    await expect(templateSelect.locator('option')).toHaveCount(11, { timeout: 10000 })

    // Verificar que la carpeta Plantillas está visible en el árbol
    const plantillasRow = page.locator('.tree-row', { hasText: 'Plantillas' })
    await expect(plantillasRow).toBeVisible()

    // El dropdown de plantillas debe tener las opciones disponibles
    const options = await templateSelect.locator('option').allInnerTexts()
    expect(options).toContain('Patología / Enfermedad')
    expect(options).toContain('Fármaco / Ficha farmacológica')
  })

  test('2. Creación de carpeta, artículo y navegación breadcrumbs (spec: knowledge-tree)', async ({ page }) => {
    // Manejar prompt para nueva carpeta
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Nombre de la carpeta')
      await dialog.accept('Cardiología')
    })
    await page.getByRole('button', { name: '+ Carpeta' }).click()

    // Verificar que aparece en el árbol
    const cardioFolder = page.locator('.tree-row', { hasText: 'Cardiología' })
    await expect(cardioFolder).toBeVisible()

    // Seleccionar la carpeta y crear un artículo dentro
    await cardioFolder.click()
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Título del artículo')
      await dialog.accept('Fibrilación Auricular')
    })
    await page.getByRole('button', { name: '+ Artículo' }).click()

    // Verificar artículo creado y breadcrumbs
    const faArticle = page.locator('.tree-row', { hasText: 'Fibrilación Auricular' })
    await expect(faArticle).toBeVisible()
    await expect(page.locator('.article-title')).toHaveText('Fibrilación Auricular')

    // Verificar breadcrumbs: Tema / Carpeta -> click para navegar
    const breadcrumbs = page.locator('.breadcrumbs')
    await expect(breadcrumbs).toContainText('Cardiología')
    await expect(breadcrumbs).toContainText('Fibrilación Auricular')
  })

  test('3. Crear artículo desde plantilla y alternar Modo Lector / Editor (spec: templates & content-editing)', async ({ page }) => {
    const templateSelect = page.locator('.sidebar select.template-select')
    await expect(templateSelect.locator('option')).toHaveCount(11, { timeout: 10000 })

    // Seleccionar plantilla Patología
    page.once('dialog', async (dialog) => {
      await dialog.accept('Insuficiencia Cardíaca')
    })
    await templateSelect.selectOption('Patología / Enfermedad')

    // Verificar que el título reemplazó {título}
    await expect(page.locator('.article-title')).toHaveText('Insuficiencia Cardíaca')

    // Alternar a modo Lector
    const btnLector = page.locator('button.btn-mode', { hasText: '👁 Lector' })
    await btnLector.click()
    await expect(btnLector).toHaveClass(/active/)

    // En modo lector debe renderizarse el lector de Markdown
    const readerView = page.locator('.article-reader-view')
    await expect(readerView).toBeVisible()
    await expect(readerView).toContainText('Definición')
    await expect(readerView).toContainText('Tratamiento')

    // Debe renderizar el visor de algoritmos/mermaid
    await expect(page.locator('.mermaid-viewer-card')).toBeVisible()

    // Alternar de vuelta a modo Editor
    const btnEditor = page.locator('button.btn-mode', { hasText: '✏ Editor' })
    await btnEditor.click()
    await expect(btnEditor).toHaveClass(/active/)
    await expect(page.locator('.editor-host')).toBeVisible()
  })

  test('4. Captura Rápida a 1 toque e Inbox (spec: knowledge-tree & offline-shell)', async ({ page }) => {
    // Abrir modal de captura rápida usando el botón visible en el sidebar desktop
    const btnCapture = page.locator('.sidebar-header-desktop .btn-quick-capture')
    await btnCapture.click()

    const captureModal = page.locator('.capture-modal')
    await expect(captureModal).toBeVisible()

    // Escribir nota rápida
    const noteInput = page.locator('.capture-note-input')
    await noteInput.fill('Paciente hipertenso 160/100 en urgencias')

    // Guardar en Inbox
    await page.locator('.btn-save-inbox').click()
    await expect(captureModal).not.toBeVisible()

    // Verificar que existe la carpeta Inbox y contiene la captura
    const inboxRow = page.locator('.tree-row', { hasText: 'Inbox' })
    await expect(inboxRow).toBeVisible()
    await expect(page.locator('.article-title')).toHaveText('Paciente hipertenso 160/100 en urgencias')
  })

  test('5. Búsqueda local de artículos y etiquetas (spec: search)', async ({ page }) => {
    // Crear un artículo con título buscable
    page.once('dialog', async (dialog) => {
      await dialog.accept('Asma Bronquial')
    })
    await page.getByRole('button', { name: '+ Artículo' }).click()
    await expect(page.locator('.article-title')).toHaveText('Asma Bronquial')

    // Buscar el artículo creado en el input visible del sidebar
    const searchInput = page.locator('.sidebar-search input[type="search"]')
    await searchInput.fill('Asma')

    // Debe aparecer en la lista de resultados
    const resultItem = page.locator('.sidebar-search .search-results li', { hasText: 'Asma Bronquial' })
    await expect(resultItem).toBeVisible()

    // Al hacer click, debe seleccionarlo
    await resultItem.click()
    await expect(page.locator('.article-title')).toHaveText('Asma Bronquial')
  })

  test('6. Exportación de backup portable zip (spec: data-portability)', async ({ page }) => {
    // Escuchar evento de descarga al hacer click en "Exportar backup"
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar backup' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/^cuaderno-medico-\d{4}-\d{2}-\d{2}\.zip$/)
  })

  test('7. Renderizado correcto y editable en Modo Editor desde plantilla (spec: templates & content-editing)', async ({ page }) => {
    const templateSelect = page.locator('.sidebar select.template-select')
    await expect(templateSelect.locator('option')).toHaveCount(11, { timeout: 10000 })

    // Crear artículo a partir de plantilla de fármaco
    page.once('dialog', async (dialog) => {
      await dialog.accept('Amoxicilina')
    })
    await templateSelect.selectOption('Fármaco / Ficha farmacológica')

    // 1. Verificar título principal
    await expect(page.locator('.article-title')).toHaveText('Amoxicilina')

    // 2. Verificar que el botón de modo Editor está activo por defecto
    const btnEditor = page.locator('button.btn-mode', { hasText: '✏ Editor' })
    await expect(btnEditor).toHaveClass(/active/)

    // 3. Verificar que el contenedor de Milkdown/Crepe está presente y visible
    const editorHost = page.locator('.editor-host')
    await expect(editorHost).toBeVisible()

    // 4. Verificar que ProseMirror se montó en modo editable
    const prosemirror = editorHost.locator('[contenteditable="true"]')
    await expect(prosemirror).toBeVisible()

    // 5. Verificar que las secciones de la plantilla se renderizaron como elementos en el editor
    await expect(prosemirror).toContainText('Amoxicilina')
    await expect(prosemirror).toContainText('Grupo farmacológico')
    await expect(prosemirror).toContainText('Mecanismo de acción')
    await expect(prosemirror).toContainText('Dosis en adultos y vía de administración')

    // 6. Verificar que la tabla de dosis de la plantilla se renderizó estructurada en el editor
    const tableHeaders = prosemirror.locator('table th, table td')
    await expect(tableHeaders.filter({ hasText: 'Presentación' })).toBeVisible()
    await expect(tableHeaders.filter({ hasText: 'Dosis' })).toBeVisible()
    await expect(tableHeaders.filter({ hasText: 'Vía' })).toBeVisible()
    await expect(tableHeaders.filter({ hasText: 'Frecuencia' })).toBeVisible()
  })

  test('8. Renderizado fiel e interactivo en Modo Lector desde plantilla (spec: templates & content-editing)', async ({ page }) => {
    const templateSelect = page.locator('.sidebar select.template-select')
    await expect(templateSelect.locator('option')).toHaveCount(11, { timeout: 10000 })

    // Crear artículo a partir de plantilla de urgencia
    page.once('dialog', async (dialog) => {
      await dialog.accept('Shock Anafiláctico')
    })
    await templateSelect.selectOption('Urgencia / Emergencia')

    await expect(page.locator('.article-title')).toHaveText('Shock Anafiláctico')

    // Cambiar a Modo Lector
    const btnLector = page.locator('button.btn-mode', { hasText: '👁 Lector' })
    await btnLector.click()
    await expect(btnLector).toHaveClass(/active/)

    // 1. Verificar contenedor de lectura
    const readerView = page.locator('.article-reader-view')
    await expect(readerView).toBeVisible()

    // 2. Verificar encabezados H1 y H2
    const h1Heading = readerView.locator('h1.reader-heading')
    await expect(h1Heading).toHaveText('Shock Anafiláctico')

    const h2Headings = readerView.locator('h2.reader-heading')
    await expect(h2Headings.filter({ hasText: 'Reconocimiento inmediato' })).toBeVisible()
    await expect(h2Headings.filter({ hasText: 'Evaluación ABCDE' })).toBeVisible()
    await expect(h2Headings.filter({ hasText: 'Criterios de gravedad' })).toBeVisible()
    await expect(h2Headings.filter({ hasText: 'Fármacos y dosis' })).toBeVisible()
    await expect(h2Headings.filter({ hasText: 'Algoritmo y errores frecuentes' })).toBeVisible()

    // 3. Verificar renderizado de tabla médica en modo lector
    const readerTable = readerView.locator('.reader-table')
    await expect(readerTable).toBeVisible()
    const ths = readerTable.locator('th')
    await expect(ths.filter({ hasText: 'Fármaco' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Dosis' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Vía' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Notas' })).toBeVisible()

    // 4. Verificar tarjeta interactiva del visor Mermaid
    const mermaidCard = readerView.locator('.mermaid-viewer-card')
    await expect(mermaidCard).toBeVisible({ timeout: 10000 })

    // Botones de control de zoom y SVG renderizado
    const zoomInBtn = mermaidCard.locator('.mermaid-buttons button', { hasText: '+' })
    await expect(zoomInBtn).toBeVisible()
    await expect(mermaidCard.locator('.mermaid-buttons button', { hasText: '-' })).toBeVisible()
    await expect(mermaidCard.locator('.mermaid-buttons button', { hasText: '100%' })).toBeVisible()
    await expect(mermaidCard.locator('.mermaid-buttons button', { hasText: '⛶' })).toBeVisible()

    // Interacción: Click en zoom in y verificar actualización del porcentaje a 125%
    await zoomInBtn.click()
    await expect(mermaidCard.locator('.mermaid-buttons button', { hasText: '125%' })).toBeVisible()

    // El SVG del diagrama debe renderizarse dentro del viewport
    await expect(mermaidCard.locator('.mermaid-svg-wrapper svg')).toBeVisible({ timeout: 10000 })
  })
})
