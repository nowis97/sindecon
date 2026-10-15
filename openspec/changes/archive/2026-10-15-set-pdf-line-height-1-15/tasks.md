# Tasks

## 1. Ajustes de Interlineado en `@media print`

- [x] 1.1 Modificar `line-height` a `1.15 !important;` en `.reader-paragraph` dentro de `@media print` en `app/src/index.css`.
- [x] 1.2 Actualizar `line-height` a `1.15 !important;` en los contenedores de maquetación (`.print-layout-single .print-reader-view` y `.print-layout-two-columns .print-reader-view`) en `app/src/index.css`.

## 2. Verificación y Calidad

- [x] 2.1 Ejecutar suite de pruebas (`npm run test`) y linter (`npm run lint`) en `app/` garantizando cero regresiones.
- [x] 2.2 Validar la conformidad del cambio con `openspec validate set-pdf-line-height-1-15`.

## 3. Despliegue y Versionado

- [x] 3.1 Incrementar versión a `v0.16.7` en `app/package.json`.
- [x] 3.2 Sincronizar delta spec con el spec principal y archivar el cambio con `openspec archive set-pdf-line-height-1-15 --yes`.
- [x] 3.3 Crear commit git y enviar cambios con `git push origin master`.
