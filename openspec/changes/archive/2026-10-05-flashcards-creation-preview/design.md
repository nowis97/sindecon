## Context

Actualmente SINDECON cuenta con el componente `FlashcardMarkdown` para el renderizado seguro de Markdown en flashcards y la animación de volteo 3D en `StudySessionModal`. Sin embargo, los formularios de creación manual en `ArticleFlashcardsModal` y de generación en `GenerateFlashcardsModal` no disponen de una previsualización interactiva previa al guardado en base de datos.

## Goals / Non-Goals

**Goals:**
- Proporcionar un componente o modo de vista previa interactiva en tiempo real (`Live Card Preview`) tanto en creación manual como en edición inline.
- Permitir voltear la tarjeta en 3D (Flip Front/Back) con un clic o atajo para verificar el renderizado de la pregunta y la respuesta.
- Asegurar que el renderizado de Markdown (tablas clínicas, listas, fórmulas, negritas y callouts) sea 100% idéntico al modo de estudio SM-2 real.
- Integrar la estimación de tarjetas por número de palabras (~1 card / 60 palabras) en los paneles de generación y mazo.

**Non-Goals:**
- No modificar el esquema de base de datos Dexie `FlashcardRow` ni el algoritmo matemático SM-2.
- No incorporar dependencias externas pesadas de animación (usar CSS 3D transforms nativas).

## Decisions

### 1. Toggle "✍️ Redactar" / "👁️ Vista Previa" en el Formulario Manual
- **Decisión**: Añadir un selector de pestañas en el encabezado del formulario de creación y edición.
- **Razón**: Permite redactar cómodamente en campos `input` y `textarea` y, con un solo clic o toque, visualizar la tarjeta renderizada en 3D exactamente como se verá en el examen/estudio.
- **Alternativa descartada**: Previsualización fija lado a lado obligatoria (en pantallas móviles de guardia o teléfonos ocuparía demasiado espacio vertical).

### 2. Subcomponente `FlashcardLivePreview`
- **Decisión**: Diseñar un contenedor con tarjeta flip 3D que recibe `front`, `back`, `sourceType`, `articleTitle` y estado `isFlipped`.
- **Razón**: Reutilizable tanto en el formulario manual como en el modal de candidatos de IA/Extractor.

### 3. Reutilización de `FlashcardMarkdown`
- **Decisión**: Renderizar tanto la cara frontal como la trasera usando `FlashcardMarkdown`.
- **Razón**: Garantiza coherencia visual absoluta con el lector, el modo de estudio y el editor clínico.

## Risks / Trade-offs

- **[Riesgo]** Respuestas clínicas muy extensas que excedan la altura de la tarjeta de previsualización.
  - **Mitigación**: Aplicar `max-height: 280px` con `overflow-y: auto` y scrollbar sutil, idéntico al diseño de tarjetas de `StudySessionModal`.
- **[Riesgo]** Campos vacíos en la vista previa.
  - **Mitigación**: Mostrar textos de marcador (*placeholders*) elegantes si la pregunta o respuesta aún no han sido redactadas (ej. *"Escribe una pregunta médica..."*).
