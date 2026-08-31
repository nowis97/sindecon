import { test, expect } from '@playwright/test'

test.describe('Flashcards & Repetición Espaciada SM-2 - E2E Tests (OpenSpec)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
  })

  test('1. Extracción estructural de flashcards desde Markdown y guardado en mazo (spec: flashcards)', async ({ page }) => {
    // Crear un artículo desde plantilla médica con secciones y tablas
    const templateSelect = page.locator('.sidebar select.template-select')
    await expect(templateSelect).toBeVisible()
    await templateSelect.selectOption('Patología / Enfermedad')

    const articleInput = page.locator('.dialog-input')
    await expect(articleInput).toBeVisible()
    await articleInput.fill('Cefaleas y Migraña')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    await expect(page.locator('.article-title')).toHaveText('Cefaleas y Migraña')

    // Abrir modal de Flashcards desde la cabecera
    const btnFlashcards = page.locator('.btn-article-flashcards')
    await expect(btnFlashcards).toBeVisible()
    await btnFlashcards.click()

    // Verificar modal de flashcards del artículo
    const articleModal = page.locator('.article-flashcards-modal')
    await expect(articleModal).toBeVisible()
    await expect(articleModal).toContainText('Cefaleas y Migraña')

    // Abrir modal de generación
    const btnOpenGenerate = articleModal.locator('button.btn-primary-action', {
      hasText: 'Generar Flashcards con IA / Extractor',
    })
    await btnOpenGenerate.click()

    // Verificar modal de generación con modo estructural por defecto
    const generateModal = page.locator('.generate-flashcards-modal')
    await expect(generateModal).toBeVisible()
    await expect(generateModal.locator('.btn-mode-tab.active')).toContainText('Extractor Rápido')

    // Debe extraer tarjetas automáticamente de la plantilla
    await expect(generateModal.locator('.candidate-card-item').first()).toBeVisible({ timeout: 5000 })

    // Guardar tarjetas en el mazo
    const saveBtn = generateModal.locator('button.btn-primary', { hasText: 'Guardar' })
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    await expect(generateModal).not.toBeVisible()
    await expect(articleModal.locator('.article-card-row').first()).toBeVisible()
  })

  test('2. Gestión manual de flashcards (creación, edición inline y eliminación) (spec: flashcards)', async ({ page }) => {
    // Crear un artículo de prueba
    await page.getByRole('button', { name: '+ Artículo' }).click()
    const articleInput = page.locator('.dialog-input')
    await expect(articleInput).toBeVisible()
    await articleInput.fill('Shock Cardiogénico')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // Abrir modal de flashcards
    await page.locator('.btn-article-flashcards').click()
    const articleModal = page.locator('.article-flashcards-modal')
    await expect(articleModal).toBeVisible()

    // Abrir formulario de tarjeta manual
    const btnManual = articleModal.locator('button.btn-secondary-action', {
      hasText: '➕ Tarjeta Manual',
    })
    await btnManual.click()

    const manualForm = articleModal.locator('.manual-card-form')
    await expect(manualForm).toBeVisible()

    // Rellenar pregunta y respuesta
    const frontInput = manualForm.locator('textarea').nth(0)
    const backInput = manualForm.locator('textarea').nth(1)
    await frontInput.fill('¿Cuál es el inotrópico de elección en shock cardiogénico con bajo gasto?')
    await backInput.fill('Dobutamina (2.5 - 20 mcg/kg/min)')

    // Guardar tarjeta con botón Añadir al Mazo
    await manualForm.getByRole('button', { name: 'Añadir al Mazo' }).click()
    await expect(manualForm).not.toBeVisible()

    // Verificar que la tarjeta aparece en la lista con badge 'Nueva'
    const cardRow = articleModal.locator('.article-card-row')
    await expect(cardRow).toHaveCount(1)
    await expect(cardRow).toContainText('Dobutamina')
    await expect(cardRow.locator('.interval-badge')).toContainText('Nueva')

    // Editar la tarjeta
    await cardRow.locator('button[title= Editar]').click()
    const editForm = cardRow.locator('.edit-card-inline-form')
    await expect(editForm).toBeVisible()
    await editForm.locator('textarea').nth(1).fill('Dobutamina o Milrinona')
    await editForm.locator('button.btn-sm-primary', { hasText: 'Guardar' }).click()

    await expect(cardRow).toContainText('Dobutamina o Milrinona')

    // Eliminar la tarjeta
    await cardRow.locator('button.btn-delete').click()
    await expect(articleModal.locator('.empty-flashcards-placeholder')).toBeVisible()
  })

  test('3. Configuración y persistencia de proveedores de IA en AiSettingsModal (spec: flashcards)', async ({ page }) => {
    // Ir al Dashboard
    await page.locator('.app-title').click()
    await expect(page.locator('.dashboard-container')).toBeVisible()

    // Abrir modal de Ajustes de IA
    const btnAiSettings = page.locator('.action-card.action-ai-settings')
    await expect(btnAiSettings).toBeVisible()
    await btnAiSettings.click()

    const aiModal = page.locator('.ai-settings-modal')
    await expect(aiModal).toBeVisible()

    // Seleccionar proveedor Groq
    const selectProvider = aiModal.locator('select').first()
    await selectProvider.selectOption('groq')

    // Ingresar API key de prueba
    const keyInput = aiModal.locator('input[type=password]')
    await keyInput.fill('gsk_test_mock_key_987654')

    // Guardar
    await aiModal.locator('button[type=submit]').click()
    await expect(aiModal.locator('button[type=submit]')).toContainText('Guardado')

    // Esperar a que cierre el modal
    await expect(aiModal).not.toBeVisible()

    // Reabrir y verificar persistencia
    await btnAiSettings.click()
    await expect(aiModal).toBeVisible()
    await expect(aiModal.locator('select').first()).toHaveValue('groq')
    await expect(aiModal.locator('input[type=password]')).toHaveValue('gsk_test_mock_key_987654')

    await aiModal.locator('.btn-close').click()
  })

  test('4. Generación de flashcards con Cloud AI mockeando la respuesta de red (spec: flashcards)', async ({ page }) => {
    // Interceptar llamadas a Google Gemini para simular respuesta clínica estructurada
    await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      front: '¿Cuál es la tríada de Beck en taponamiento cardíaco?',
                      back: 'Hipotensión, ingurgitación yugular y ruidos cardíacos apagados.',
                    },
                    {
                      front: '¿Cuál es el tratamiento de urgencia del taponamiento cardíaco?',
                      back: 'Pericardiocentesis evacuadora guiada por ecocardiografía.',
                    },
                  ]),
                },
              ],
            },
          },
        ],
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      })
    })

    // Configurar API Key simulada en Ajustes de IA
    await page.locator('.app-title').click()
    await page.locator('.action-card.action-ai-settings').click()
    const aiModal = page.locator('.ai-settings-modal')
    await aiModal.locator('select').first().selectOption('gemini')
    await aiModal.locator('input[type=password]').fill('AIzaSy_mock_key')
    await aiModal.locator('button[type=submit]').click()
    await expect(aiModal).not.toBeVisible()

    // Crear artículo desde plantilla médica para que tenga texto clínico
    const templateSelect = page.locator('.sidebar select.template-select')
    await templateSelect.selectOption('Urgencia / Emergencia')
    await page.locator('.dialog-input').fill('Taponamiento Cardíaco')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // Abrir modal de flashcards y lanzar generador con IA Cloud
    await page.locator('.btn-article-flashcards').click()
    const articleModal = page.locator('.article-flashcards-modal')
    await articleModal.locator('button.btn-primary-action').click()

    const generateModal = page.locator('.generate-flashcards-modal')
    await expect(generateModal).toBeVisible()

    // Cambiar a pestaña IA Cloud
    await generateModal.locator('button.btn-mode-tab', { hasText: 'IA Cloud' }).click()

    // Verificar que las tarjetas mockeadas aparecen en la lista de candidatos
    await expect(generateModal.locator('.candidate-card-item')).toHaveCount(2, { timeout: 10000 })
    await expect(generateModal).toContainText('tríada de Beck')

    // Guardar en el mazo
    await generateModal.locator('button.btn-primary', { hasText: 'Guardar' }).click()
    await expect(generateModal).not.toBeVisible()

    // Verificar que las 2 tarjetas están añadidas en el mazo del tema
    await expect(articleModal.locator('.article-card-row')).toHaveCount(2)
  })

  test('5. Sesión interactiva de estudio activo SM-2 (Flip 3D, atajos de teclado y resumen) (spec: flashcards)', async ({ page }) => {
    // Crear artículo con 2 tarjetas manuales
    await page.getByRole('button', { name: '+ Artículo' }).click()
    await page.locator('.dialog-input').fill('Disección Aórtica')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    await page.locator('.btn-article-flashcards').click()
    const articleModal = page.locator('.article-flashcards-modal')

    // Añadir tarjeta 1
    await articleModal.locator('button.btn-secondary-action', { hasText: '➕ Tarjeta Manual' }).click()
    await articleModal.locator('.manual-card-form textarea').nth(0).fill('¿Cuál es el síntoma cardinal de la disección aórtica?')
    await articleModal.locator('.manual-card-form textarea').nth(1).fill('Dolor torácico o interescapular desgarrador de inicio súbito.')
    await articleModal.locator('.manual-card-form').getByRole('button', { name: 'Añadir al Mazo' }).click()

    // Añadir tarjeta 2
    await articleModal.locator('button.btn-secondary-action', { hasText: '➕ Tarjeta Manual' }).click()
    await articleModal.locator('.manual-card-form textarea').nth(0).fill('¿Qué fármaco se debe iniciar primero para control hemodinámico?')
    await articleModal.locator('.manual-card-form textarea').nth(1).fill('Betabloqueantes IV (ej. Esmolol o Labetalol) antes que vasodilatadores.')
    await articleModal.locator('.manual-card-form').getByRole('button', { name: 'Añadir al Mazo' }).click()

    // Iniciar repaso
    const btnStudy = articleModal.locator('button.btn-study-action')
    await expect(btnStudy).toContainText('Repasar Ahora (2)')
    await btnStudy.click()

    // Verificar StudyModal
    const studyModal = page.locator('.study-modal-container')
    await expect(studyModal).toBeVisible()
    await expect(studyModal).toContainText('Repaso Activo SM-2')
    await expect(studyModal).toContainText('Tarjeta 1 de 2')

    // Tarjeta 1: Voltear con botón o espacio
    const cardWrapper = studyModal.locator('.flashcard-3d-wrapper')
    await expect(cardWrapper).not.toHaveClass(/is-flipped/)
    await page.keyboard.press('Space')
    await expect(cardWrapper).toHaveClass(/is-flipped/)

    // Verificar que los botones de calificación SM-2 son visibles
    const ratingRow = studyModal.locator('.rating-buttons-row')
    await expect(ratingRow).toBeVisible()
    await expect(ratingRow.locator('.btn-rate-good')).toContainText('Bueno')

    // Calificar tarjeta 1 con atajo de teclado '3' (Bueno)
    await page.keyboard.press('3')

    // Tarjeta 2: Avanza automáticamente
    await expect(studyModal).toContainText('Tarjeta 2 de 2')
    await expect(cardWrapper).not.toHaveClass(/is-flipped/)

    // Voltear tarjeta 2 haciendo clic en la tarjeta
    await cardWrapper.click()
    await expect(cardWrapper).toHaveClass(/is-flipped/)

    // Calificar tarjeta 2 con clic en 'Fácil' (4)
    await studyModal.locator('.btn-rate-easy').click()

    // Pantalla de resumen final
    const finishedScreen = studyModal.locator('.study-finished-screen')
    await expect(finishedScreen).toBeVisible()
    await expect(finishedScreen).toContainText('¡Sesión de Repaso Completada!')
    await expect(finishedScreen.locator('.stat-card.good .stat-number')).toHaveText('1')
    await expect(finishedScreen.locator('.stat-card.easy .stat-number')).toHaveText('1')

    // Cerrar y volver
    await finishedScreen.locator('button.btn-finished-action').click()
    await expect(studyModal).not.toBeVisible()
  })

  test('6. Visualización reactiva de estadísticas y estado Al día en Dashboard (spec: flashcards)', async ({ page }) => {
    // Ir al Dashboard principal
    await page.locator('.app-title').click()
    const dashboard = page.locator('.dashboard-container')
    await expect(dashboard).toBeVisible()

    // Verificar que la tarjeta de métrica 🧠 Repasos Pendientes existe en el grid
    const statsGrid = dashboard.locator('.dashboard-stats-grid')
    await expect(statsGrid).toContainText('Repasos Pendientes')

    // Verificar que el botón de acción rápida de repaso activo está presente
    const actionStudy = dashboard.locator('.action-card.action-study-deck')
    await expect(actionStudy).toBeVisible()
    await expect(actionStudy).toContainText('Repaso Activo SM-2')
  })

  test('7. Persistencia de configuración de IA con timestamp y preparación para Google Drive (spec: data-portability)', async ({ page }) => {
    await page.locator('.app-title').click()
    const dashboard = page.locator('.dashboard-container')
    await expect(dashboard).toBeVisible()

    // Abrir modal de Ajustes de IA
    const btnAiSettings = page.locator('.action-card.action-ai-settings')
    await btnAiSettings.click()

    const aiModal = page.locator('.ai-settings-modal')
    await expect(aiModal).toBeVisible()

    // Seleccionar Gemini y modelo gemini-3.7-flash
    const selectProvider = aiModal.locator('select').first()
    await selectProvider.selectOption('gemini')

    const selectModel = aiModal.locator('select').nth(1)
    await selectModel.selectOption('gemini-3.7-flash')

    // Ingresar API key
    const keyInput = aiModal.locator('input[type=password]')
    await keyInput.fill('AIzaSy_E2E_Test_Key_999')

    // Guardar
    await aiModal.locator('button[type=submit]').click()
    await expect(aiModal.locator('button[type=submit]')).toContainText('Guardado')
    await expect(aiModal).not.toBeVisible()

    // Verificar en IndexedDB que se guardó con updated_at
    const savedConfig = await page.evaluate(async () => {
      // @ts-ignore
      const { db } = await import('/src/db/db.ts')
      const row = await db.meta.get('ai_config')
      return row?.value
    })

    expect(savedConfig).toBeTruthy()
    expect(savedConfig.provider).toBe('gemini')
    expect(savedConfig.modelName).toBe('gemini-3.7-flash')
    expect(savedConfig.apiKey).toBe('AIzaSy_E2E_Test_Key_999')
    expect(savedConfig.updated_at).toBeGreaterThan(0)
  })

  test('8. Renderizado fiel de formato Markdown en preguntas y respuestas de flashcards (spec: flashcards)', async ({ page }) => {
    // 1. Crear un artículo de prueba
    await page.getByRole('button', { name: '+ Artículo' }).click()
    const articleInput = page.locator('.dialog-input')
    await articleInput.fill('Fármacos en Urgencias')
    await page.locator('.btn-dialog-primary', { hasText: 'Crear' }).click()

    // 2. Abrir modal de flashcards
    await page.locator('.btn-article-flashcards').click()
    const articleModal = page.locator('.article-flashcards-modal')
    await expect(articleModal).toBeVisible()

    // 3. Crear tarjeta manual con Markdown rico
    const btnManual = articleModal.locator('button.btn-secondary-action', {
      hasText: '➕ Tarjeta Manual',
    })
    await btnManual.click()

    const manualForm = articleModal.locator('.manual-card-form')
    await expect(manualForm).toBeVisible()

    const frontInput = manualForm.locator('textarea').nth(0)
    const backInput = manualForm.locator('textarea').nth(1)

    await frontInput.fill('¿Cuál es la **dosis inicial** de `Adenosina` en TPSV?')
    await backInput.fill('**Protocolo:**\n- **1ª dosis:** `6 mg` en bolo IV rápido.\n- **2ª dosis:** `12 mg` si no revierte en 1-2 min.\n\n> [!NOTE] Administrar seguido de flush de 20ml de SF.')

    await manualForm.getByRole('button', { name: 'Añadir al Mazo' }).click()
    await expect(manualForm).not.toBeVisible()

    // 4. Verificar que se renderizan elementos HTML enriquecidos en la lista (strong, code, ul, li)
    const cardRow = articleModal.locator('.article-card-row').first()
    await expect(cardRow.locator('.front-side strong.card-md-bold')).toContainText('dosis inicial')
    await expect(cardRow.locator('.front-side code.card-code-inline')).toHaveText('Adenosina')
    await expect(cardRow.locator('.back-side strong.card-md-bold').first()).toContainText('Protocolo:')
    await expect(cardRow.locator('.back-side ul.card-md-ul li')).toHaveCount(2)
    await expect(cardRow.locator('.back-side .card-md-callout')).toBeVisible()

    // 5. Iniciar sesión de estudio y verificar Markdown en 3D Flip
    await articleModal.locator('.btn-study-action').click()
    const studyModal = page.locator('.study-modal-container')
    await expect(studyModal).toBeVisible()

    // Frente de la tarjeta
    await expect(studyModal.locator('.flashcard-front strong.card-md-bold')).toContainText('dosis inicial')
    await expect(studyModal.locator('.flashcard-front code.card-code-inline')).toHaveText('Adenosina')

    // Voltear tarjeta
    await studyModal.locator('.flashcard-3d-wrapper').click()
    await expect(studyModal.locator('.flashcard-back strong.card-md-bold').first()).toContainText('Protocolo:')
    await expect(studyModal.locator('.flashcard-back ul.card-md-ul li')).toHaveCount(2)
    await expect(studyModal.locator('.flashcard-back .card-md-callout')).toBeVisible()

    // Cerrar sesión
    await studyModal.locator('.btn-close').click()
    await expect(studyModal).not.toBeVisible()
  })
})