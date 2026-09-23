import { test, expect } from '@playwright/test'

const VALID_MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF',
)

async function getStoredAnnotationStrokesCount(page: any): Promise<number> {
  return page.evaluate(async () => {
    return new Promise<number>((resolve, reject) => {
      const req = indexedDB.open('cuaderno-medico')
      req.onsuccess = () => {
        const idb = req.result
        if (!idb.objectStoreNames.contains('pdf_annotations')) {
          resolve(0)
          return
        }
        const tx = idb.transaction('pdf_annotations', 'readonly')
        const store = tx.objectStore('pdf_annotations')
        const getAll = store.getAll()
        getAll.onsuccess = () => {
          const records = getAll.result || []
          if (records.length === 0) {
            resolve(0)
          } else {
            resolve(records[0].strokes?.length || 0)
          }
        }
        getAll.onerror = () => reject(getAll.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
}

test.describe('Anotaciones y Dibujo Libre en Visor PDF', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
  })

  test('Permite activar modo anotación, dibujar trazos con lápiz y resaltador, deshacer y persistir tras recarga', async ({
    page,
  }) => {
    // 1. Crear una carpeta 'Anotaciones Clínicas'
    await page.getByRole('button', { name: '+ Carpeta' }).click()
    const folderInput = page.locator('.dialog-input')
    await expect(folderInput).toBeVisible()
    await folderInput.fill('Anotaciones Clínicas')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    const folderRow = page.locator('.tree-row.tree-folder-row', {
      hasText: 'Anotaciones Clínicas',
    })
    await expect(folderRow).toBeVisible()

    // 2. Abrir menú contextual y subir un PDF
    const menuBtn = folderRow.locator('.btn-tree-row-menu')
    await menuBtn.click()

    const uploadOption = page.locator(
      '.tree-context-menu button:has-text("📄 Subir PDFs")',
    )
    await expect(uploadOption).toBeVisible()
    await uploadOption.click()

    const modal = page.locator('.upload-pdf-modal')
    await expect(modal).toBeVisible()

    const fileInput = modal.locator('input[type="file"]')
    await fileInput.setInputFiles([
      {
        name: 'esquema_ventilatorio.pdf',
        mimeType: 'application/pdf',
        buffer: VALID_MINIMAL_PDF,
      },
    ])

    const submitBtn = modal.locator('button:has-text("Subir 1 documento PDF")')
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()
    await expect(modal).not.toBeVisible()

    // 3. Verificar que el visor PDF se carga
    const pdfViewer = page.locator('main.content .pdf-document-viewer')
    await expect(pdfViewer).toBeVisible({ timeout: 10000 })

    const canvasOverlay = pdfViewer.locator('.pdf-annotation-canvas').first()
    await expect(canvasOverlay).toBeVisible({ timeout: 10000 })

    // Inicialmente el canvas de anotación no captura eventos
    await expect(canvasOverlay).not.toHaveClass(/active/)
    await expect(canvasOverlay).toHaveCSS('pointer-events', 'none')

    // 4. Activar modo Anotación
    const annotateToggle = pdfViewer.locator('.btn-pdf-annotate-toggle')
    await expect(annotateToggle).toBeVisible()
    await annotateToggle.click()

    // Comprobar que la barra secundaria de herramientas aparece y el toggle está activo
    await expect(annotateToggle).toHaveClass(/active/)
    await expect(annotateToggle).toContainText('Finalizar')
    const annotationToolbar = pdfViewer.locator('.pdf-annotation-toolbar')
    await expect(annotationToolbar).toBeVisible()

    await expect(canvasOverlay).toHaveClass(/active/)
    await expect(canvasOverlay).toHaveCSS('pointer-events', 'auto')

    // 5. Dibujar un trazo con el Lápiz
    const overlayBox = await canvasOverlay.boundingBox()
    expect(overlayBox).not.toBeNull()

    const startX = overlayBox!.x + 50
    const startY = overlayBox!.y + 50

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 60, startY + 40, { steps: 5 })
    await page.mouse.move(startX + 120, startY + 80, { steps: 5 })
    await page.mouse.up()

    // Esperar a que la persistencia en IndexedDB se complete
    await expect.poll(async () => getStoredAnnotationStrokesCount(page), {
      timeout: 5000,
    }).toBe(1)

    // 6. Cambiar a herramienta Resaltador y seleccionar otro color
    const highlighterBtn = annotationToolbar.locator(
      '.btn-pdf-tool:has-text("Resaltador")',
    )
    await highlighterBtn.click()
    await expect(highlighterBtn).toHaveClass(/active/)

    // Cambiar de color (segundo color de la paleta)
    const colorButtons = annotationToolbar.locator('.btn-pdf-color')
    await expect(colorButtons.first()).toBeVisible()
    await colorButtons.nth(1).click()

    // Dibujar un segundo trazo con el resaltador
    await page.mouse.move(startX + 20, startY + 120)
    await page.mouse.down()
    await page.mouse.move(startX + 150, startY + 120, { steps: 5 })
    await page.mouse.up()

    // Verificar que ahora hay 2 trazos en IndexedDB
    await expect.poll(async () => getStoredAnnotationStrokesCount(page), {
      timeout: 5000,
    }).toBe(2)

    // 7. Probar acción Deshacer (Undo)
    const undoBtn = annotationToolbar.locator('.btn-pdf-undo')
    await undoBtn.click()

    // Debe quedar 1 trazo en IndexedDB
    await expect.poll(async () => getStoredAnnotationStrokesCount(page), {
      timeout: 5000,
    }).toBe(1)

    // 8. Salir del modo Anotación y verificar que se restablece el puntero
    await annotateToggle.click()
    await expect(annotationToolbar).not.toBeVisible()
    await expect(canvasOverlay).toHaveCSS('pointer-events', 'none')

    // 9. Recargar la página y verificar que las anotaciones se conservan
    await page.reload()
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })

    // Seleccionar el artículo en el árbol para abrir el visor
    const articleRow = page.locator('.tree-row', {
      hasText: 'Esquema Ventilatorio',
    })
    await expect(articleRow).toBeVisible()
    await articleRow.click()

    // El visor vuelve a cargar
    await expect(pdfViewer).toBeVisible({ timeout: 10000 })
    const reloadedOverlay = pdfViewer.locator('.pdf-annotation-canvas').first()
    await expect(reloadedOverlay).toBeVisible({ timeout: 10000 })

    // Comprobar que en IndexedDB el registro sigue conteniendo 1 trazo
    const countAfterReload = await getStoredAnnotationStrokesCount(page)
    expect(countAfterReload).toBe(1)
  })
})
