import { test, expect } from '@playwright/test'

test.describe('Cuaderno Médico Personal - Vital E2E Tests (OpenSpec)', () => {
  test.beforeEach(async ({ page }) => {
    // Abrir la aplicación
    await page.goto('/')
    // Esperar a que la app y la barra lateral estén listas
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
  })

  test('1. Siembra de plantillas en primer arranque (spec: templates) y Dashboard', async ({ page }) => {
    // Esperar a que las 10 plantillas maestras terminen de sembrarse en IndexedDB
    const templateSelect = page.locator('.sidebar select.template-select')
    await expect(templateSelect.locator('option')).toHaveCount(12, { timeout: 10000 })

    // Verificar que la carpeta Plantillas está visible en el árbol
    const plantillasRow = page.locator('.tree-row', { hasText: 'Plantillas' })
    await expect(plantillasRow).toBeVisible()

    // El dropdown de plantillas debe tener las opciones disponibles
    const options = await templateSelect.locator('option').allInnerTexts()
    expect(options).toContain('Patología / Enfermedad')
    expect(options).toContain('Fármaco / Ficha farmacológica')

    // Verificar que el Dashboard de inicio se renderiza correctamente
    await expect(page.locator('.dashboard-container')).toBeVisible()
    await expect(page.locator('.dashboard-hero h1')).toContainText('Cuaderno Médico')
    await expect(page.locator('.dashboard-stats-grid')).toBeVisible()
  })

  test('2. Creación de carpeta, artículo y navegación breadcrumbs con modales (spec: knowledge-tree)', async ({ page }) => {
    // Abrir modal de nueva carpeta
    await page.getByRole('button', { name: '+ Carpeta' }).click()
    const folderInput = page.locator('.dialog-input')
    await expect(folderInput).toBeVisible()
    await folderInput.fill('Cardiología')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // Verificar que aparece en el árbol
    const cardioFolder = page.locator('.tree-row', { hasText: 'Cardiología' })
    await expect(cardioFolder).toBeVisible()

    // Seleccionar la carpeta y crear un artículo dentro
    await cardioFolder.click()
    await page.getByRole('button', { name: '+ Artículo' }).click()
    const articleInput = page.locator('.dialog-input')
    await expect(articleInput).toBeVisible()
    await articleInput.fill('Fibrilación Auricular')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // Verificar artículo creado y breadcrumbs
    const faArticle = page.locator('.tree-row', { hasText: 'Fibrilación Auricular' })
    await expect(faArticle).toBeVisible()
    await expect(page.locator('.article-title')).toHaveText('Fibrilación Auricular')

    // Verificar breadcrumbs: Tema / Carpeta -> click para navegar
    const breadcrumbs = page.locator('.breadcrumbs')
    await expect(breadcrumbs).toContainText('Cardiología')
    await expect(breadcrumbs).toContainText('Fibrilación Auricular')
  })

  test('3. Crear artículo desde plantilla con modal y alternar Modo Lector / Editor (spec: templates & content-editing)', async ({ page }) => {
    const templateSelect = page.locator('.sidebar select.template-select')
    await expect(templateSelect.locator('option')).toHaveCount(12, { timeout: 10000 })

    // Seleccionar plantilla Patología
    await templateSelect.selectOption('Patología / Enfermedad')
    const titleInput = page.locator('.dialog-input')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('Insuficiencia Cardíaca Crónica')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // Verificar que el título reemplazó {título}
    await expect(page.locator('.article-title')).toHaveText('Insuficiencia Cardíaca Crónica')

    // Alternar a modo Lector
    const btnLector = page.locator('button.btn-mode', { hasText: '👁 Lector' })
    await btnLector.click()
    await expect(btnLector).toHaveClass(/active/)

    // En modo lector debe renderizarse el lector de Markdown
    const readerView = page.locator('.article-reader-view')
    await expect(readerView).toBeVisible()
    await expect(readerView).toContainText('Definición')
    await expect(readerView).toContainText('Tratamiento')

    // Debe renderizar la tabla médica en modo lector
    await expect(readerView.locator('.reader-table')).toBeVisible()

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
    await page.getByRole('button', { name: '+ Artículo' }).click()
    const articleInput = page.locator('.dialog-input')
    await expect(articleInput).toBeVisible()
    await articleInput.fill('Asma Bronquial')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()
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
    await expect(templateSelect.locator('option')).toHaveCount(12, { timeout: 10000 })

    // Crear artículo a partir de plantilla de fármaco
    await templateSelect.selectOption('Fármaco / Ficha farmacológica')
    const titleInput = page.locator('.dialog-input')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('Amoxicilina')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

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
    await expect(templateSelect.locator('option')).toHaveCount(12, { timeout: 10000 })

    // Crear artículo a partir de plantilla de urgencia
    await templateSelect.selectOption('Urgencia / Emergencia')
    const titleInput = page.locator('.dialog-input')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('Shock Anafiláctico')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

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

  test('9. Menú contextual en árbol de conocimientos y eliminación con confirmación modal', async ({ page }) => {
    // Crear una carpeta de prueba
    await page.getByRole('button', { name: '+ Carpeta' }).click()
    const folderInput = page.locator('.dialog-input')
    await folderInput.fill('Pediatría')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    const pediaRow = page.locator('.tree-row', { hasText: 'Pediatría' })
    await expect(pediaRow).toBeVisible()

    // Abrir menú contextual (···) en la fila de Pediatría
    const menuBtn = pediaRow.locator('.btn-tree-row-menu')
    await menuBtn.click()

    // Verificar menú desplegado y hacer click en "Renombrar"
    const contextMenu = pediaRow.locator('.tree-context-menu')
    await expect(contextMenu).toBeVisible()
    await contextMenu.locator('button', { hasText: 'Renombrar' }).click()

    // Renombrar a "Pediatría y Neonatología"
    const renameInput = page.locator('.dialog-input')
    await expect(renameInput).toBeVisible()
    await renameInput.fill('Pediatría y Neonatología')
    await page.locator('.btn-dialog-primary', { hasText: 'Renombrar' }).click()

    await expect(page.locator('.tree-row', { hasText: 'Pediatría y Neonatología' })).toBeVisible()

    // Abrir menú contextual y eliminar
    const updatedRow = page.locator('.tree-row', { hasText: 'Pediatría y Neonatología' })
    await updatedRow.locator('.btn-tree-row-menu').click()
    await updatedRow.locator('.tree-context-menu button', { hasText: 'Eliminar' }).click()

    // Confirmar en el modal de eliminación
    const confirmBtn = page.locator('.btn-dialog-danger', { hasText: 'Eliminar definitivamente' })
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    // Ya no debe estar en el árbol
    await expect(page.locator('.tree-row', { hasText: 'Pediatría y Neonatología' })).not.toBeVisible()
  })

  test('10. Alternancia de Modo Oscuro / Claro y persistencia (spec: offline-shell)', async ({ page }) => {
    // Localizar botón de cambio de tema en desktop
    const themeBtn = page.locator('.sidebar-header-desktop .btn-theme-toggle')
    await expect(themeBtn).toBeVisible()

    // Click para alternar a tema oscuro
    await themeBtn.click()
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveAttribute('data-theme', /dark|light/)

    // Recargar la página y verificar que persiste
    await page.reload()
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(htmlElement).toHaveAttribute('data-theme', /dark|light/)
  })

  test('11. Command Palette con atajo Ctrl+K y búsqueda instantánea (spec: search)', async ({ page }) => {
    // Abrir Command Palette pulsando el botón Ctrl+K o con atajo de teclado
    const triggerBtn = page.locator('.btn-command-palette-trigger')
    await expect(triggerBtn).toBeVisible()
    await triggerBtn.click()

    const palette = page.locator('.command-palette-modal')
    await expect(palette).toBeVisible()

    // Buscar acción rápida "Nuevo Artículo" y pulsar Enter
    const input = palette.locator('input.palette-input')
    await input.fill('Nuevo Artículo')
    await page.keyboard.press('Enter')

    // El Command Palette se cierra y abre el prompt de crear artículo
    await expect(palette).not.toBeVisible()
    const promptDialog = page.locator('.dialog-modal')
    await expect(promptDialog).toBeVisible()
    await expect(promptDialog.locator('.dialog-header h3')).toContainText('Nuevo Artículo')
    await page.locator('.btn-dialog-secondary', { hasText: 'Cancelar' }).click()
  })

  test('12. Artículos favoritos con estrella y sección en árbol (spec: knowledge-tree)', async ({ page }) => {
    // Crear un artículo
    await page.getByRole('button', { name: '+ Artículo' }).click()
    const articleInput = page.locator('.dialog-input')
    await articleInput.fill('Protocolo RCP Avanzado')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // Marcar como favorito usando el botón de estrella ⭐
    const favStar = page.locator('.btn-fav-star')
    await expect(favStar).toBeVisible()
    await favStar.click()
    await expect(favStar).toHaveClass(/active/)

    // Verificar que aparece en la sección "⭐ Favoritos / Clave" del árbol
    const favSection = page.locator('.tree-favorites-section')
    await expect(favSection).toBeVisible()
    await expect(favSection.locator('.favorite-row', { hasText: 'Protocolo RCP Avanzado' })).toBeVisible()

    // Desmarcar desde la estrella
    await favStar.click()
    await expect(favStar).not.toHaveClass(/active/)
    await expect(page.locator('.tree-favorites-section')).not.toBeVisible()
  })

  test('13. Modal de configuración de Google Drive y chip de estado (spec: data-portability)', async ({ page }) => {
    // Localizar el chip de estado de sync en el sidebar desktop
    const syncChip = page.locator('.sidebar-header-desktop .sync-indicator-chip')
    await expect(syncChip).toBeVisible()
    await syncChip.click()

    // El modal de Google Drive debe desplegarse
    const modal = page.locator('.gdrive-modal')
    await expect(modal).toBeVisible()
    await expect(modal.locator('.dialog-header h3')).toContainText('Sincronización con Google Drive')
    await expect(modal.locator('.btn-google-signin')).toBeVisible()

    // Abrir opciones avanzadas
    const advToggle = modal.locator('.btn-link-toggle')
    await advToggle.click()
    await expect(modal.locator('.gdrive-advanced-panel')).toBeVisible()

    // Cerrar modal
    await modal.locator('.dialog-btn-close').click()
    await expect(modal).not.toBeVisible()
  })

  test('14. Asistente de Importación Inteligente para ChatGPT y Word (spec: content-editing)', async ({ page }) => {
    // Crear un artículo de prueba
    await page.getByRole('button', { name: '+ Artículo' }).click()
    const articleInput = page.locator('.dialog-input')
    await articleInput.fill('Fiebre de Origen Desconocido')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // Pulsar el botón 🪄 Importar en la cabecera del artículo
    const btnImport = page.locator('.btn-smart-import-trigger')
    await expect(btnImport).toBeVisible()
    await btnImport.click()

    // Verificar que abre el SmartImportModal
    const modal = page.locator('.smart-import-modal')
    await expect(modal).toBeVisible()
    await expect(modal.locator('.dialog-header h3')).toContainText('Asistente de Importación')

    // Pegar texto simulado de ChatGPT con Advertencia y Tabla
    const textarea = modal.locator('.smart-import-textarea')
    await textarea.fill(`
### Criterios de Durack y Street

ADVERTENCIA: Descartar bacteriemia antes de iniciar corticoides empíricos.

| Categoría | Criterio |
| --- | --- |
| Clásica | Fiebre > 38.3C por > 3 semanas |
| Nosocomial | Hospitalizado sin infección previa |

DOSIS: Paracetamol 1g cada 8h condicional a fiebre.
    `)

    // Verificar que la vista previa se actualizó con el callout visual
    const preview = modal.locator('.smart-import-preview-section')
    await expect(preview).toBeVisible()
    await expect(preview.locator('.callout-warning')).toBeVisible()
    await expect(preview.locator('.callout-dosage')).toBeVisible()
    await expect(preview.locator('.reader-table')).toBeVisible()

    // La opción "➕ Añadir al final" debe estar seleccionada por defecto
    await expect(modal.locator('input[value="append"]')).toBeChecked()

    // Aplicar importación
    await modal.locator('.btn-dialog-primary', { hasText: 'Aplicar Importación' }).click()
    await expect(modal).not.toBeVisible()

    // Cambiar a Modo Lector y verificar que el contenido importado está en el artículo
    const btnLector = page.locator('button.btn-mode', { hasText: '👁 Lector' })
    await btnLector.click()
    const readerView = page.locator('.article-reader-view')
    await expect(readerView.locator('.callout-warning')).toBeVisible()
    await expect(readerView.locator('.reader-table')).toBeVisible()
    await expect(readerView).toContainText('Criterios de Durack y Street')
  })

  test('15. Explorador de contenidos de carpeta y diferenciación visual de árbol (spec: knowledge-tree)', async ({ page }) => {
    // 1. Crear carpeta Neumología
    await page.getByRole('button', { name: '+ Carpeta' }).click()
    const folderInput = page.locator('.dialog-input')
    await folderInput.fill('Neumología')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 2. Seleccionar carpeta Neumología en el árbol
    const pneumoRow = page.locator('.tree-row.tree-folder-row', { hasText: 'Neumología' })
    await expect(pneumoRow).toBeVisible()
    await pneumoRow.click()

    // 3. Verificar que se renderiza el FolderExplorerView
    const folderExplorer = page.locator('.folder-explorer-container')
    await expect(folderExplorer).toBeVisible()
    await expect(folderExplorer.locator('.folder-hero-title')).toHaveText('Neumología')
    await expect(folderExplorer.locator('.folder-empty-state')).toBeVisible()

    // 4. Crear artículo desde el botón del explorador
    await folderExplorer.locator('.folder-empty-actions button', { hasText: 'Crear Primer Artículo' }).click()
    const articleInput = page.locator('.dialog-input')
    await articleInput.fill('Neumonía Adquirida')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 5. Volver a la carpeta Neumología desde breadcrumbs
    const crumbNeumo = page.locator('.breadcrumbs .crumb-folder', { hasText: 'Neumología' })
    await expect(crumbNeumo).toBeVisible()
    await crumbNeumo.click()

    // 6. Ahora debe mostrar la sección de artículos
    await expect(folderExplorer.locator('.articles-grid')).toBeVisible()
    await expect(folderExplorer.locator('.article-card-item-title')).toHaveText('Neumonía Adquirida')

    // 7. Crear subcarpeta desde la barra de acciones de la carpeta
    await folderExplorer.locator('.btn-folder-action', { hasText: 'Nueva Subcarpeta' }).click()
    const subfolderInput = page.locator('.dialog-input')
    await subfolderInput.fill('Vías Aéreas')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 8. Verificar que la subcarpeta aparece en la cuadrícula de subcarpetas
    await expect(folderExplorer.locator('.subfolders-grid')).toBeVisible()
    const subCard = folderExplorer.locator('.subfolder-card', { hasText: 'Vías Aéreas' })
    await expect(subCard).toBeVisible()

    // 9. Hacer clic en la tarjeta de subcarpeta para navegar hacia ella
    await subCard.click()
    await expect(folderExplorer.locator('.folder-hero-title')).toHaveText('Vías Aéreas')
    await expect(page.locator('.breadcrumbs')).toContainText('Neumología')
    await expect(page.locator('.breadcrumbs')).toContainText('Vías Aéreas')
  })

  test('16. Drag and Drop de artículos y subcarpetas en Desktop (spec: knowledge-tree)', async ({ page }) => {
    // 1. Crear carpeta Cardiología
    await page.getByRole('button', { name: '+ Carpeta' }).click()
    await page.locator('.dialog-input').fill('Cardiología')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 2. Crear artículo Insuficiencia Cardíaca en la raíz
    await page.getByRole('button', { name: '+ Artículo' }).click()
    await page.locator('.dialog-input').fill('Insuficiencia Cardíaca')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 3. Arrastrar Insuficiencia Cardíaca hacia la carpeta Cardiología en el árbol
    const articleRow = page.locator('.tree-row.tree-article-row', { hasText: 'Insuficiencia Cardíaca' })
    const folderRow = page.locator('.tree-row.tree-folder-row', { hasText: 'Cardiología' })
    await expect(articleRow).toBeVisible()
    await expect(folderRow).toBeVisible()

    await articleRow.dispatchEvent('dragstart')
    await folderRow.dispatchEvent('dragover')
    await folderRow.dispatchEvent('drop')
    await articleRow.dispatchEvent('dragend')

    // 4. Navegar a Cardiología haciendo click en su título en el árbol
    await folderRow.locator('.tree-title').click()
    const folderExplorer = page.locator('.folder-explorer-container')
    await expect(folderExplorer).toBeVisible()
    await expect(folderExplorer.locator('.folder-hero-title')).toHaveText('Cardiología')
    await expect(folderExplorer.locator('.article-card-item', { hasText: 'Insuficiencia Cardíaca' })).toBeVisible()

    // 5. Crear subcarpeta Arritmias
    await folderExplorer.locator('.btn-folder-action', { hasText: 'Nueva Subcarpeta' }).click()
    await page.locator('.dialog-input').fill('Arritmias')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 6. Arrastrar la tarjeta del artículo Insuficiencia Cardíaca a la tarjeta de la subcarpeta Arritmias
    const articleCard = folderExplorer.locator('.article-card-item', { hasText: 'Insuficiencia Cardíaca' })
    const subfolderCard = folderExplorer.locator('.subfolder-card', { hasText: 'Arritmias' })
    await expect(articleCard).toBeVisible()
    await expect(subfolderCard).toBeVisible()

    await articleCard.dispatchEvent('dragstart')
    await subfolderCard.dispatchEvent('dragover')
    await subfolderCard.dispatchEvent('drop')
    await articleCard.dispatchEvent('dragend')

    // 7. Navegar a Arritmias y verificar que ahora contiene Insuficiencia Cardíaca
    await subfolderCard.click()
    await expect(folderExplorer.locator('.folder-hero-title')).toHaveText('Arritmias')
    await expect(folderExplorer.locator('.article-card-item-title')).toHaveText('Insuficiencia Cardíaca')
  })

  test('17. Drag and Drop táctil en Mobile Touch (spec: knowledge-tree)', async ({ page }) => {
    // 1. Simular viewport móvil
    await page.setViewportSize({ width: 390, height: 844 })

    // 2. Abrir drawer móvil de Temas para acceder a los botones de creación
    const btnTemas = page.getByRole('button', { name: 'Abrir menú de temas' })
    if (await btnTemas.isVisible()) {
      await btnTemas.click()
    }

    // 3. Crear carpeta Gastroenterología
    await page.getByRole('button', { name: '+ Carpeta' }).click()
    await page.locator('.dialog-input').fill('Gastroenterología')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 4. Crear artículo Hemorragia Digestiva
    await page.getByRole('button', { name: '+ Artículo' }).click()
    await page.locator('.dialog-input').fill('Hemorragia Digestiva')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 5. En móvil la creación de artículo auto-cierra el drawer. Reabrirlo para interactuar con el árbol.
    const sidebar = page.locator('.sidebar')
    if (!(await sidebar.evaluate((el) => el.classList.contains('mobile-open')))) {
      await btnTemas.click()
    }

    const artRow = page.locator('.tree-row.tree-article-row', { hasText: 'Hemorragia Digestiva' })
    const gastroRow = page.locator('.tree-row.tree-folder-row', { hasText: 'Gastroenterología' })
    await expect(artRow).toBeVisible()
    await expect(gastroRow).toBeVisible()

    // 6. Arrastrar en móvil
    await artRow.dragTo(gastroRow)

    // 7. Verificar que se muestra notificación toast de movimiento exitoso
    await expect(page.locator('.toast-container')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.toast-message')).toContainText('Gastroenterología')
  })
})
