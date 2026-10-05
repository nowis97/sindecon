# Tareas: Plantillas Médicas Maestras v2

## 1. Base de Datos y Plantillas
- [x] Actualizar `TEMPLATES` en `src/db/templates.ts` con los 11 formatos v2 y sus secciones completas. <!-- id: task-db-templates-v2 -->
- [x] Configurar `SEED_KEY = 'seeded_templates_v2'` y lógica de siembra idempotente. <!-- id: task-seed-v2 -->
- [x] Actualizar tests unitarios en `src/db/templates.test.ts` para verificar las 11 plantillas v2. <!-- id: task-test-templates -->

## 2. Tipografía y Estilos Clínicos
- [x] Incorporar tipografía `Roboto` en `src/index.css`. <!-- id: task-css-roboto -->
- [x] Configurar colores exactos del Word (`#142337` y `#008080`) con soporte para Modo Oscuro. <!-- id: task-css-colors -->
- [x] Implementar clases CSS de 2 columnas con `column-span: all`, `column-rule` y `break-inside: avoid`. <!-- id: task-css-2col -->

## 3. Experiencia de Lectura
- [x] Añadir selector de modo de columnas (1 Col / 2 Col) en `ArticleReader.tsx`. <!-- id: task-reader-toggle -->
- [x] Optimizar estilos de impresión `@media print` para exportación en 2 columnas. <!-- id: task-print-2col -->

## 4. Verificación
- [x] Ejecutar suite de pruebas unitarias (`npm test`). <!-- id: task-verify-tests -->
- [x] Sincronizar especificación principal `openspec/specs/templates/spec.md`. <!-- id: task-sync-spec -->
