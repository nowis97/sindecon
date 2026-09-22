import { test, expect } from '@playwright/test'

const VALID_MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF',
)

test.describe('Subida y visualización de documentos PDF', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
  })

  test('Subir un PDF desde el menú contextual, editar su nombre y visualizarlo en el lector', async ({
    page,
  }) => {
    // 1. Crear una carpeta 'Documentación Médica'
    await page.getByRole('button', { name: '+ Carpeta' }).click()
    const folderInput = page.locator('.dialog-input')
    await expect(folderInput).toBeVisible()
    await folderInput.fill('Documentación Médica')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    const folderRow = page.locator('.tree-row.tree-folder-row', { hasText: 'Documentación Médica' })
    await expect(folderRow).toBeVisible()

    // 2. Abrir menú contextual de la carpeta y pulsar 'Subir PDFs'
    const menuBtn = folderRow.locator('.btn-tree-row-menu')
    await menuBtn.click()

    const uploadOption = page.locator('.tree-context-menu button:has-text("📄 Subir PDFs")')
    await expect(uploadOption).toBeVisible()
    await uploadOption.click()

    // 3. Comprobar que el modal de subida de PDFs está visible con la carpeta preseleccionada
    const modal = page.locator('.upload-pdf-modal')
    await expect(modal).toBeVisible()
    await expect(modal.locator('select option:checked')).toContainText('Documentación Médica')

    // 4. Cargar un archivo PDF válido mediante el input de archivo
    const fileInput = modal.locator('input[type="file"]')
    await fileInput.setInputFiles([
      {
        name: 'algoritmo_rcp_soporte_vital.pdf',
        mimeType: 'application/pdf',
        buffer: VALID_MINIMAL_PDF,
      },
    ])

    // 5. Verificar que se lista el documento con su título limpio sugerido
    const itemInput = modal.locator('.upload-pdf-item-input')
    await expect(itemInput).toBeVisible()
    await expect(itemInput).toHaveValue('Algoritmo Rcp Soporte Vital')

    // Modificar opcionalmente el título
    await itemInput.fill('Algoritmo RCP 2024 - Soporte Vital Avanzado')

    // 6. Confirmar la subida
    const submitBtn = modal.locator('button:has-text("Subir 1 documento PDF")')
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // 7. El modal se cierra y el artículo se selecciona automáticamente
    await expect(modal).not.toBeVisible()

    // 8. Verificar que el contenedor se expande a pantalla completa y se ocultan los botones de justificado, columnas y exportar
    await expect(page.locator('.article-container.article-container-pdf')).toBeVisible()
    await expect(page.locator('.article-reader-container.pdf-container-full')).toBeVisible()
    await expect(page.locator('.btn-reader-align-toggle')).not.toBeVisible()
    await expect(page.locator('.btn-reader-layout-toggle')).not.toBeVisible()
    await expect(page.locator('.btn-reader-export-pdf')).not.toBeVisible()

    // Verificar que el visor de PDF se renderiza en el área de lectura
    const pdfViewer = page.locator('main.content .pdf-document-viewer')
    await expect(pdfViewer).toBeVisible({ timeout: 10000 })

    // Comprobar la barra de herramientas del visor
    await expect(pdfViewer.locator('.pdf-title-text')).toContainText(
      'Algoritmo RCP 2024 - Soporte Vital Avanzado',
    )
    await expect(pdfViewer.locator('.pdf-viewer-toolbar .btn-pdf-download')).toBeVisible()
    await expect(pdfViewer.locator('.pdf-viewer-toolbar .btn-pdf-open')).toBeVisible()
    await expect(pdfViewer.locator('.btn-pdf-zoom').first()).toBeVisible()

    // Comprobar que el canvas de la página PDF se renderizó
    const pdfCanvas = pdfViewer.locator('.pdf-page-canvas')
    await expect(pdfCanvas).toBeVisible({ timeout: 10000 })

    // 9. Renombrar el artículo desde la cabecera
    const renameBtn = page.locator('.btn-article-rename')
    await renameBtn.click()
    const renameInput = page.locator('.dialog-input')
    await expect(renameInput).toBeVisible()
    await renameInput.fill('Algoritmo RCP (AHA 2024)')
    await page.locator('.btn-dialog-primary', { hasText: 'Renombrar' }).click()

    // El título se actualiza en cabecera, árbol y visor de PDF
    await expect(page.locator('.article-title')).toHaveText('Algoritmo RCP (AHA 2024)')
    await expect(page.locator('.tree-row', { hasText: 'Algoritmo RCP (AHA 2024)' })).toBeVisible()
    await expect(pdfViewer.locator('.pdf-title-text')).toContainText('Algoritmo RCP (AHA 2024)')
  })

  test('Subir múltiples PDFs en lote desde FolderExplorerView', async ({ page }) => {
    // 1. Crear una carpeta 'Pediatría'
    await page.getByRole('button', { name: '+ Carpeta' }).click()
    const folderInput = page.locator('.dialog-input')
    await folderInput.fill('Pediatría')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 2. Abrir la carpeta en FolderExplorerView haciendo clic en ella
    const folderRow = page.locator('.tree-row.tree-folder-row', { hasText: 'Pediatría' })
    await folderRow.click()

    // Comprobar que FolderExplorerView está activo
    const folderExplorer = page.locator('.folder-explorer-container')
    await expect(folderExplorer).toBeVisible()
    await expect(folderExplorer.locator('.folder-hero-title')).toHaveText('Pediatría')

    // 3. Pulsar el botón 'Subir PDFs' en la barra de acciones o estado vacío
    const uploadBtn = folderExplorer.locator('button', { hasText: 'Subir PDFs' }).first()
    await expect(uploadBtn).toBeVisible()
    await uploadBtn.click()

    const modal = page.locator('.upload-pdf-modal')
    await expect(modal).toBeVisible()

    // 4. Seleccionar tres archivos PDF
    const fileInput = modal.locator('input[type="file"]')
    await fileInput.setInputFiles([
      {
        name: 'asma_pediatrica.pdf',
        mimeType: 'application/pdf',
        buffer: VALID_MINIMAL_PDF,
      },
      {
        name: 'deshidratacion_infantil.pdf',
        mimeType: 'application/pdf',
        buffer: VALID_MINIMAL_PDF,
      },
      {
        name: 'descartar_archivo.pdf',
        mimeType: 'application/pdf',
        buffer: VALID_MINIMAL_PDF,
      },
    ])

    // 5. Verificar que se listan tres
    const items = modal.locator('.upload-pdf-item')
    await expect(items).toHaveCount(3)

    // Descartar el tercero con el botón de papelera
    const removeBtns = modal.locator('.btn-upload-pdf-remove')
    await removeBtns.last().click()
    await expect(items).toHaveCount(2)

    // 6. Subir los 2 documentos restantes en lote
    await modal.locator('button:has-text("Subir 2 documentos PDF")').click()
    await expect(modal).not.toBeVisible()

    // 7. Verificar que permanecemos en la vista de carpeta y se crearon ambas tarjetas de artículos
    await expect(page.locator('.folder-main-view-wrapper')).toBeVisible()
    await expect(page.locator('.article-card-item-title', { hasText: 'Deshidratacion Infantil' })).toBeVisible()
    await expect(page.locator('.article-card-item-title', { hasText: 'Asma Pediatrica' })).toBeVisible()
  })
})
