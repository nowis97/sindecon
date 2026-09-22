import { test, expect } from '@playwright/test'

test.describe('Visibilidad de Plantillas y Colapso de Barra Lateral', () => {
  test.beforeEach(async ({ page }) => {
    // Abrir la aplicación y limpiar preferencias de test
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('sindecon_show_templates_folder')
      localStorage.removeItem('sindecon_sidebar_collapsed_desktop')
    })
    await page.reload()
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
  })

  test('1. Alternar visibilidad de la carpeta Plantillas y persistencia', async ({ page }) => {
    // Esperar a que la carpeta Plantillas esté sembrada y visible
    const plantillasRow = page.locator('.tree-row', { hasText: 'Plantillas' })
    await expect(plantillasRow).toBeVisible({ timeout: 10000 })

    // El botón toggle de plantillas debe existir
    const toggleBtn = page.locator('.btn-toggle-templates')
    await expect(toggleBtn).toBeVisible()
    await expect(toggleBtn).toHaveAttribute('title', /Ocultar carpeta/i)

    // Ocultar la carpeta de plantillas
    await toggleBtn.click()

    // La fila de Plantillas debe desaparecer del árbol
    await expect(plantillasRow).not.toBeVisible()
    await expect(toggleBtn).toHaveAttribute('title', /Mostrar carpeta/i)

    // El selector de plantillas en la barra de herramientas DEBE seguir funcionando
    const templateSelect = page.locator('.sidebar select.template-select')
    await expect(templateSelect).toBeVisible()
    await expect(templateSelect.locator('option')).toHaveCount(13)

    // Recargar la página para verificar persistencia en localStorage
    await page.reload()
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.tree-row', { hasText: 'Plantillas' })).not.toBeVisible()

    // Volver a mostrar la carpeta
    const toggleBtnAfterReload = page.locator('.btn-toggle-templates')
    await toggleBtnAfterReload.click()
    await expect(page.locator('.tree-row', { hasText: 'Plantillas' })).toBeVisible()
  })

  test('2. Colapsar y expandir barra lateral en escritorio con botón y atajo Ctrl+B', async ({ page }) => {
    const layout = page.locator('.layout')
    const collapseBtn = page.locator('.btn-sidebar-collapse-desktop')
    await expect(collapseBtn).toBeVisible()

    // 1. Colapsar con el botón
    await collapseBtn.click()
    await expect(layout).toHaveClass(/desktop-sidebar-collapsed/)

    // Botón para reabrir debe aparecer en el área de lectura
    const expandBtn = page.locator('.btn-sidebar-expand-desktop')
    await expect(expandBtn).toBeVisible()

    // 2. Expandir con el botón de reapertura
    await expandBtn.click()
    await expect(layout).not.toHaveClass(/desktop-sidebar-collapsed/)
    await expect(expandBtn).not.toBeVisible()

    // 3. Colapsar y verificar persistencia tras recargar
    await collapseBtn.click()
    await expect(layout).toHaveClass(/desktop-sidebar-collapsed/)
    await page.reload()
    await expect(page.locator('.layout')).toHaveClass(/desktop-sidebar-collapsed/, { timeout: 10000 })
    await expect(page.locator('.btn-sidebar-expand-desktop')).toBeVisible()

    // 4. Alternar con atajo de teclado Ctrl+B
    await page.keyboard.press('Control+b')
    await expect(page.locator('.layout')).not.toHaveClass(/desktop-sidebar-collapsed/)

    await page.keyboard.press('Control+b')
    await expect(page.locator('.layout')).toHaveClass(/desktop-sidebar-collapsed/)
  })
})
