## 1. Tipografía y Estilos CSS de Justificación

- [x] 1.1 Implementar reglas CSS para texto justificado (`.text-justified`) en `app/src/index.css` aplicando `text-align: justify`, `text-justify: inter-word`, `hyphens: auto` y `-webkit-hyphens: auto` sobre párrafos, listas, callouts y blockquotes en `.article-reader-view` y `.print-reader-view`.
- [x] 1.2 Añadir estilos para el botón de alternancia de alineación (`.btn-reader-align-toggle`) en la barra de herramientas del lector en `app/src/index.css`.

## 2. Componente Lector e Interacción de Usuario

- [x] 2.1 Integrar el estado `isJustified` con persistencia en `localStorage` (`sindecon_reader_text_align`), el botón de control en la barra de herramientas y la clase `.text-justified` en `app/src/components/reader/ArticleReader.tsx`.
- [x] 2.2 Actualizar tests unitarios en `app/src/components/reader/ArticleReader.test.ts` verificando la presencia de las clases de justificación y el renderizado correcto de bloques.

## 3. Pruebas E2E y Validación del Sistema

- [x] 3.1 Añadir prueba E2E automatizada en Playwright (`app/e2e/vital.spec.ts`) validando la alternancia del botón de justificación en la barra del lector y la persistencia de la preferencia.
- [x] 3.2 Ejecutar suite completa de pruebas (`npm test` y `npx playwright test`) y verificar compilación con `npm run build`.

