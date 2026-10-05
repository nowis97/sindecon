## Why

Al crear o editar flashcards médicas (tanto de forma manual como mediante extracción estructural o IA), los usuarios redactan en formato Markdown y revisan preguntas y respuestas en campos de texto sin una representación visual de la tarjeta final. Esto dificulta verificar si tablas de dosis, listas estructuradas, perlas clínicas o negritas se visualizarán de forma legible y atractiva antes de guardarlas en el mazo de repetición espaciada SM-2.

Incorporar una **vista previa interactiva en tiempo real (Live Card Preview)** con renderizado Markdown completo y efecto de giro (Flip 3D) permite al profesional o estudiante de medicina comprobar inmediatamente la calidad, legibilidad y concisión de cada flashcard antes de integrarla a su sesión de estudio.

## What Changes

- **Vista Previa Interactiva en Creación y Edición Manual**:
  - Pestaña / Modo interactivo "Editar" vs "Vista Previa" en el formulario de creación y edición inline de flashcards en `ArticleFlashcardsModal`.
  - Renderizado fiel de la tarjeta en tamaño real (estilo Anki / Estudio SM-2) con animación de giro 3D para alternar entre Pregunta (Front) y Respuesta (Back) con un solo toque.
  - Soporte completo de renderizado Markdown (negritas, tablas clínicas, listas anidadas, callouts de alarma y perlas).
- **Previsualización Visual en el Generador Automático (Extractor / Cloud AI)**:
  - Posibilidad de previsualizar cualquier tarjeta candidata generada antes de guardarla en el mazo.
  - Indicador de metadatos clínicos (tipo de origen: `⚡ Estructural`, `✨ IA Cloud`, `✍️ Manual`).
- **Feedback de Rendimiento y Densidad Médica**:
  - Integración visual del contador de palabras y estimación recomendada (~1 card / 60 palabras) junto a la previsualización.

## Capabilities

### New Capabilities
- `flashcards`: Define los requisitos de gestión, estimación clínica, vista previa interactiva en tiempo real (Live Card Preview con Flip 3D) y persistencia de flashcards en el sistema de repetición espaciada SM-2.

## Impact

- **Componentes Afectados**:
  - `app/src/components/flashcards/ArticleFlashcardsModal.tsx`
  - `app/src/components/flashcards/GenerateFlashcardsModal.tsx`
  - `app/src/components/flashcards/FlashcardMarkdown.tsx`
- **Estilos CSS**:
  - Nuevas clases para `.flashcard-live-preview-card`, `.preview-flip-wrapper`, `.preview-toggle-btn`.
- **Compatibilidad**:
  - 100% retrocompatible con la base de datos Dexie `FlashcardRow` existente y el motor de estudio SM-2.
