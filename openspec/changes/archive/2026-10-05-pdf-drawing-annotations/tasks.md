## 1. Modelo de Datos y Persistencia de Anotaciones en Dexie

- [x] 1.1 Definir interfaces tipadas (`AnnotationPoint`, `AnnotationStroke`, `PageAnnotationsRecord`) y registrar la tabla `pdf_annotations` en el esquema de IndexedDB en `app/src/db/db.ts`.
- [x] 1.2 Crear módulo `app/src/db/pdfAnnotations.ts` con operaciones CRUD (`getPageAnnotations`, `savePageAnnotations`, `clearPageAnnotations`) y verificar con pruebas unitarias en `app/src/db/pdfAnnotations.test.ts`.

## 2. Capa Canvas de Anotación y Escalado Vectorial

- [x] 2.1 Crear el componente `PdfAnnotationOverlay.tsx` superpuesto en `.pdf-page-canvas-wrapper` con dimensiones exactas a la página PDF y redibujado vectorial escalado con `scale * pixelRatio`.
- [x] 2.2 Implementar captura de `PointerEvents` (`pointerdown`, `pointermove`, `pointerup`) con interpolación de curvas suaves (`quadraticCurveTo`), `touch-action: none` y soporte para stylus/táctil.
- [x] 2.3 Implementar lógica de trazo para Lápiz (colores negro, azul, rojo, verde), Resaltador semitransparente, Borrador de trazo y función Deshacer (`Undo`).
- [x] 2.4 Integrar carga inicial y persistencia automática de trazos al finalizar cada trazo (`pointerup`) hacia IndexedDB.

## 3. Barra de Herramientas de Dibujo y Estilos

- [x] 3.1 Añadir botón de alternancia "✏️ Anotar" en la toolbar de `PdfDocumentViewer.tsx` y desplegar la barra de herramientas de dibujo (selector de herramientas, paleta de colores, borrador y deshacer).
- [x] 3.2 Añadir estilos en `app/src/index.css` para la barra de anotación, botones de colores activos, cursores de dibujo y capa de lienzo superpuesta en tema claro y oscuro.
- [x] 3.3 Asegurar ergonomía táctil en tablets (touch targets adecuados, prevención de scroll gestual en modo dibujo y restauración de scroll normal al salir del modo).

## 4. Pruebas Automatizadas y Verificación

- [x] 4.1 Escribir pruebas unitarias para la lógica de normalización y escalado de coordenadas de trazos vectoriales.
- [x] 4.2 Crear prueba E2E en Playwright verificando activación del modo lápiz, dibujo en canvas, alternancia a resaltador, acción deshacer y persistencia de anotaciones tras recargar la página.
- [x] 4.3 Ejecutar verificación integral: suite vitest (`npm test`), suite Playwright (`npx playwright test`) y build de producción (`npm run build`).
