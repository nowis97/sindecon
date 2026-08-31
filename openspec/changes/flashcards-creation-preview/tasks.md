## 1. Componente de Vista Previa Interactiva

- [x] 1.1 Crear el componente `FlashcardLivePreview.tsx` con soporte de volteo 3D (Front/Back) y renderizado completo mediante `FlashcardMarkdown`
- [x] 1.2 Integrar el selector interactivo "✍️ Redactar" vs "👁️ Vista Previa" en el formulario de creación manual de `ArticleFlashcardsModal.tsx`
- [x] 1.3 Integrar el botón o pestaña de previsualización en la edición inline de flashcards en `ArticleFlashcardsModal.tsx`

## 2. Previsualización en el Generador Automático (Extractor e IA)

- [x] 2.1 Añadir modal o panel desplegable de inspección de tarjetas candidatas en `GenerateFlashcardsModal.tsx` para previsualizarlas en formato real antes de guardarlas

## 3. Estilos CSS y Pruebas de Calidad

- [x] 3.1 Implementar clases de diseño y animaciones 3D para `.flashcard-live-preview-card`, `.preview-card-flipper` y selectores de modo en `index.css`
- [x] 3.2 Agregar prueba en `app/e2e/flashcards.spec.ts` que valide la alternancia a modo vista previa y el volteo interactivo de la tarjeta
- [x] 3.3 Ejecutar `npm test` y `npx playwright test` para verificar que todas las pruebas pasen al 100%
