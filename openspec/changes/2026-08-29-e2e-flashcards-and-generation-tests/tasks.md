## 1. Configuración y Suite Base de Pruebas E2E

- [x] 1.1 Crear archivo `app/e2e/flashcards.spec.ts` con configuración inicial de Playwright y helpers de navegación y reseteo.
- [x] 1.2 Añadir helper para crear artículos médicos con contenido rico de prueba (secciones clínicas, tablas de dosis, listas con negritas y callouts).

## 2. Implementación de Casos de Prueba E2E

- [x] 2.1 Implementar prueba E2E para extracción estructural de flashcards desde Markdown y guardado en mazo, verificando que las tarjetas aparezcan en la lista del tema.
- [x] 2.2 Implementar prueba E2E para creación manual de tarjetas, edición inline con botón ✏️ y eliminación con botón 🗑️ en ArticleFlashcardsModal.
- [x] 2.3 Implementar prueba E2E para configuración de proveedores de IA en AiSettingsModal, verificando la selección de proveedor (Gemini, Groq, etc.) y la persistencia de la API Key al recargar/reabrir.
- [x] 2.4 Implementar prueba E2E para generación de flashcards con Cloud AI simulando la respuesta de red mediante page.route(), verificando la previsualización y guardado de tarjetas.
- [x] 2.5 Implementar prueba E2E para sesión de repaso activo SM-2 en StudyModal, verificando animación de flip card 3D (clic y tecla Espacio), calificación con botones 1-4, recálculo de intervalos y pantalla final de resumen 🎉.
- [x] 2.6 Implementar prueba E2E para visualización reactiva de estadísticas en Dashboard, verificando el conteo de repasos pendientes y el estado "Al día" tras concluir la sesión de estudio.

## 3. Ejecución y Validación

- [x] 3.1 Ejecutar la suite completa de pruebas Playwright (`npx playwright test`) y verificar 100% de éxito (20/20 tests pasados).
