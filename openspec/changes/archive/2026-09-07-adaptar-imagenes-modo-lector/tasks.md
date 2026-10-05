## 1. Componente de Imagen y Limpieza de Zoom

- [x] 1.1 Refactorizar `app/src/components/reader/AssetImage.tsx` para renderizar un contenedor `<figure className="reader-image-figure">` con `<img className="reader-image" />`, eliminando el estado `isZoomed`, listeners `onClick`, hint `"🔍 Toca para ampliar"` y modal de zoom.
- [x] 1.2 Actualizar y añadir pruebas unitarias en `app/src/components/reader/ArticleReader.test.ts` verificando el parseo y renderizado de bloques de imagen standalone.

## 2. Estilos CSS de Centrado y Adaptabilidad Multicolumna

- [x] 2.1 Implementar reglas CSS en `app/src/index.css` para `.reader-image-figure` y `.reader-image` con centrado automático horizontal, contención fluida (`max-width: 100%; height: auto`) y prevención de cortes (`break-inside: avoid; page-break-inside: avoid;`).
- [x] 2.2 Asegurar que las reglas de centrado y prevención de cortes apliquen idénticamente a la vista de impresión y PDF en `app/src/index.css`.

## 3. Pruebas E2E y Validación del Sistema

- [x] 3.1 Añadir prueba E2E automatizada en Playwright (`app/e2e/vital.spec.ts`) validando el centrado y adaptación de imágenes en modo 2 columnas y la ausencia total de controles o modales de zoom al hacer clic.
- [x] 3.2 Ejecutar la suite completa de pruebas (`npm test` y `npx playwright test`) y verificar la compilación de producción con `npm run build`.

