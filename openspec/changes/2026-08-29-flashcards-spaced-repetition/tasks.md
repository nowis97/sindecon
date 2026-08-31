## 1. Capa de Datos y Dominio (SM-2, Extractor y Clientes de IA)

- [x] 1.1 Actualizar `app/src/db/db.ts` con FlashcardRow, AiConfig y versión 2 de Dexie.
- [x] 1.2 Implementar `app/src/db/flashcards.ts` con operaciones CRUD y consultas de tarjetas vencidas (getDueFlashcards, getFlashcardsByNode, upsertFlashcards, deleteFlashcard, getAiConfig, saveAiConfig).
- [x] 1.3 Implementar algoritmo `app/src/domain/sm2.ts` con tests unitarios exhaustivos en `app/src/domain/sm2.test.ts`.
- [x] 1.4 Implementar extractor estructural `app/src/domain/cardExtractor.ts` (secciones, listas en negrita, tablas y callouts) con tests unitarios en `app/src/domain/cardExtractor.test.ts`.
- [x] 1.5 Implementar cliente Cloud AI `app/src/domain/ai/cloudAiClient.ts` (Gemini, Groq, OpenAI, Ollama) con prompts médicos y fallback seguro.
- [x] 1.6 Implementar motor WebLLM `app/src/domain/ai/webLlmClient.ts` con carga perezosa (lazy import) y detección de WebGPU.
- [x] 1.7 Integrar flashcards en backup y export/import JSON (`app/src/db/exportImport.ts`).

## 2. Interfaz de Usuario y Modo de Estudio Activo

- [x] 2.1 Crear componente `app/src/components/flashcards/StudyModal.tsx` con animación 3D de flip card, atajos de teclado, soporte táctil y pantalla de resumen final.
- [x] 2.2 Crear componente `app/src/components/flashcards/GenerateFlashcardsModal.tsx` con selector de motor (Estructural / Cloud IA / WebLLM) y previsualización editable.
- [x] 2.3 Crear componente `app/src/components/flashcards/ArticleFlashcardsModal.tsx` para gestionar y crear tarjetas manuales por artículo.
- [x] 2.4 Crear componente `app/src/components/settings/AiSettingsModal.tsx` para configurar proveedores y API Keys.
- [x] 2.5 Integrar widget de repaso diario en `app/src/components/dashboard/Dashboard.tsx` y botones de Flashcards en cabecera de artículos y navegación.
- [x] 2.6 Añadir estilos CSS y animaciones 3D en `app/src/index.css`.

## 3. Validación y Pruebas

- [x] 3.1 Ejecutar suite de pruebas unitarias (`npm test`) asegurando 100% de éxito (86 tests pasados).
- [x] 3.2 Ejecutar compilación de producción (`npm run build`).
- [x] 3.3 Validar interactividad de estudio y generación en Chrome DevTools.
