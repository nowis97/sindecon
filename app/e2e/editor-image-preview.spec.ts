import { test, expect } from '@playwright/test'

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGYzUAAIpJA/0+0nJFAAAAAElFTkSuQmCC'

test.describe('Previsualización de imágenes en modo Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
  })

  test('Renderiza vista previa de imagen local asset:// en el editor visual con blob URL', async ({
    page,
  }) => {
    // 1. Guardar un asset de prueba en IndexedDB (cuaderno-medico -> assets)
    const assetId = 'test-editor-image-rx'
    await page.evaluate(
      async ({ id, base64 }) => {
        const byteCharacters = atob(base64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'image/png' })

        return new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('cuaderno-medico')
          req.onsuccess = () => {
            const db = req.result
            const tx = db.transaction('assets', 'readwrite')
            const store = tx.objectStore('assets')
            store.put({
              id,
              node_id: 'temp-node',
              blob,
              mime_type: 'image/png',
              created_at: Date.now(),
            })
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
          }
          req.onerror = () => reject(req.error)
        })
      },
      { id: assetId, base64: TINY_PNG_BASE64 },
    )

    // 2. Crear un artículo nuevo
    await page.getByRole('button', { name: '+ Artículo' }).click()
    const input = page.locator('.dialog-input')
    await expect(input).toBeVisible()
    await input.fill('Estudio Imagenológico')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()
    await expect(page.locator('.article-title')).toHaveText('Estudio Imagenológico')

    // 3. Importar contenido que referencia el asset local y una imagen data: URL
    await page.locator('.btn-mode', { hasText: 'Editor' }).click()
    const btnImport = page.locator('.btn-smart-import-trigger')
    await expect(btnImport).toBeVisible()
    await btnImport.click()

    const importModal = page.locator('.smart-import-modal')
    await expect(importModal).toBeVisible()
    await importModal.locator('input[value="replace"]').check()
    await importModal.locator('.smart-import-textarea').fill(`# Estudio de Tórax

Vista radiográfica frontal del tórax con cardiomegalia grado II.

![Radiografía de Tórax PA](asset://${assetId})

Texto posterior a la imagen médica.
`)
    await importModal.locator('.btn-dialog-primary', { hasText: 'Aplicar Importación' }).click()
    await expect(importModal).not.toBeVisible()

    // 4. En modo Editor, verificar que el contenedor .editor-host contiene la imagen renderizada
    const editorHost = page.locator('.editor-host')
    await expect(editorHost).toBeVisible()

    const editorImg = editorHost.locator('img').first()
    await expect(editorImg).toBeVisible({ timeout: 10000 })

    // El src debe haberse resuelto mediante proxyDomURL a una URL de objeto blob:
    await expect(editorImg).toHaveAttribute('src', /^blob:/)

    // Comprobar que la imagen cargó exitosamente (naturalWidth > 0)
    const isLoaded = await editorImg.evaluate((img: HTMLImageElement) => {
      return img.complete && img.naturalWidth > 0
    })
    expect(isLoaded).toBe(true)

    // 5. Alternar a modo Lector y verificar que sigue visible
    await page.locator('.btn-mode', { hasText: 'Lector' }).click()
    const readerImg = page.locator('.article-reader-view img').first()
    await expect(readerImg).toBeVisible()
    await expect(readerImg).toHaveAttribute('src', /^blob:/)

    // 6. Volver a modo Editor y verificar que la imagen vuelve a renderizarse sin errores
    await page.locator('.btn-mode', { hasText: 'Editor' }).click()
    const editorImgReturn = editorHost.locator('img').first()
    await expect(editorImgReturn).toBeVisible()
    await expect(editorImgReturn).toHaveAttribute('src', /^blob:/)
  })
})
