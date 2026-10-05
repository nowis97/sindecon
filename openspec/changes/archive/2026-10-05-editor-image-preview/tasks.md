# Tasks

## 1. Resolución de Assets y Gestión de Memoria en el Editor

- [x] 1.1 Implementar el hook `proxyDomURL` en la configuración de `[Crepe.Feature.ImageBlock]` en `app/src/components/editor/MarkdownEditor.tsx` para resolver URLs locales `asset://<id>` extrayendo el blob desde IndexedDB con `getAssetBlob(id)` y generando un Object URL (`URL.createObjectURL`).
- [x] 1.2 Añadir seguimiento en `activeObjectUrlsRef` para almacenar los Object URLs generados y revocar cada uno con `URL.revokeObjectURL` durante el desmontaje del editor en el cleanup de `useEffect`.
- [x] 1.3 Adaptar `app/src/components/editor/imageAssetView.ts` para dar soporte coherente a nodos `image-block`, `image` e `image-inline` como capa de compatibilidad.

## 2. Pruebas Automatizadas y Verificación Integral

- [x] 2.1 Crear prueba E2E en Playwright verificando que un artículo con imágenes `asset://<id>` renderiza la previsualización visual con `src` comenzando en `blob:` dentro de `.milkdown` en modo editor.
- [x] 2.2 Ejecutar la verificación completa: suite vitest (`npm test`), suite Playwright (`npx playwright test`) y compilación de producción (`npm run build`).
