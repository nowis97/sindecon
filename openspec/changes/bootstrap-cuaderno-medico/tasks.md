# Tareas: Bootstrap del Cuaderno Médico Personal

Ordenadas por fases del roadmap (ver design.md). Cada fase deja la app usable.

## 1. V0.1 — Esqueleto caminable

- [x] 1.1 Scaffold de la app real (React + TS + Vite + Vitest) en paquete propio `app/`, con la estructura por capas del design.md (`db/`, `domain/`, `hooks/`, `components/`, `pwa/`) y reutilizando el setup del editor de `spike-editor/`; verificar `npm run build` exitoso y app en blanco cargando
- [x] 1.2 Capa de datos con Dexie: tablas `nodes`, `articles`, `assets`, `meta` con uuid, `created_at`/`updated_at` y borrado por tombstone (`deleted_at`); verificar con test unitario de creación/borrado
- [x] 1.3 Operaciones del árbol (spec knowledge-tree): crear carpeta/artículo, renombrar, mover, eliminar con cascada + tombstones; verificar cada operación en la UI
- [x] 1.4 Navegación: panel del árbol + breadcrumbs clicables; verificar navegación completa Tema ▸ subcarpeta ▸ artículo y vuelta
- [x] 1.5 Editor Crepe integrado con los fixes del spike (lenguajes con `load`, `renderPreview` async vía `applyPreview`) guardando `body_md` en IndexedDB; verificar round-trip editar → F5 → contenido idéntico
- [x] 1.6 PWA con vite-plugin-pwa: manifest + service worker; verificar instalable en navegador y recarga completa sin conexión (DevTools → offline)

## 2. V0.2 — Seguro de vida (antes de contenido real)

- [x] 2.1 Solicitar `navigator.storage.persist()` al primer arranque y mostrar aviso permanente si se deniega (spec offline-shell); verificar estado persistido en DevTools → Application
- [x] 2.2 Export a zip (jszip): estructura espejo del árbol, `.md` con frontmatter (`id`, `tags`, `order`, `updated_at`), `assets/`, `_manifest.json` con `export_format_version: 1` y `_deleted.json` (spec data-portability); verificar abriendo el zip y leyendo un `.md` en editor externo
- [x] 2.3 Import con fusión por uuid: inserta nuevos, actualiza solo si `updated_at` entrante es más reciente, aplica tombstones (nunca reemplaza); verificar importando un export con ediciones manuales conflictivas y comprobando que ganan los datos más recientes

## 3. V0.3 — Contenido rico + plantillas

- [ ] 3.1 Tablas GFM en el editor real; verificar creación visual de tabla + round-trip del Markdown GFM en test
- [ ] 3.2 Imágenes: `onUpload`/pegado/arrastre → compresión (~1600px) → blob en `assets`, referencia `asset://<id>` en el Markdown y resolución a blob URL al renderizar (editor y lector); verificar imagen visible tras recarga offline
- [ ] 3.3 Mermaid con `import()` dinámico (editor y lector), preview en vivo en el editor; verificar que el bundle inicial no incluye mermaid y que el esquema renderiza offline tras primer uso
- [ ] 3.4 Carpeta de sistema `Plantillas/` + siembra única de las 10 plantillas maestras del PDF (Patología, Síndrome, Síntoma, Urgencia, Procedimiento, Examen diagnóstico, Concepto básico, Prevención, Terapéutica, Fármaco) con tablas/fences mermaid semilla donde corresponda; verificar primer arranque y no-sobrescritura en re-arranque
- [ ] 3.5 Crear artículo desde plantilla: diálogo de elección, copia de contenido, reemplazo de `{título}`; verificar que el artículo creado es independiente de la plantilla

## 4. V0.4 — Búsqueda y relaciones

- [ ] 4.1 Índice MiniSearch (título + contenido + tags) reconstruido al arranque desde IndexedDB y actualizado en cada CRUD; verificar búsqueda offline con resultados por relevancia
- [ ] 4.2 Tags en artículos con autocompletado desde tags existentes; verificar que buscar un síntoma devuelve los artículos tagueados
- [ ] 4.3 Wiki-links: autocompletado al escribir `[[`, enlace persistido por uuid (no por título ni ruta); verificar que el enlace sigue funcionando tras mover/renombrar el artículo destino
- [ ] 4.4 Backlinks ("artículos relacionados") en la vista lector; verificar que aparecen los artículos que enlazan al actual

## 5. V0.5 — Móvil (captura y consulta)

- [ ] 5.1 Captura rápida a 1 toque: foto (`<input type="file" accept="image/*" capture>`) + nota → artículo en Inbox sin pedir ubicación; verificar desde un teléfono real o emulación
- [ ] 5.2 Vista lector móvil: zoom/pan en esquemas mermaid e imágenes anchas; verificar legibilidad de un algoritmo ancho en pantalla estrecha
- [ ] 5.3 UX móvil: búsqueda siempre visible arriba, breadcrumbs táctiles, navegación del árbol usable con una mano; verificar flujo completo de consulta sin teclado

## 6. V0.6 — Sync manual bidireccional

- [ ] 6.1 Validar el flujo PC ↔ móvil en ambos sentidos: export de capturas del móvil → import en PC; export de artículos del PC → import en móvil; verificar que ninguna edición reciente se pierde y las capturas llegan al Inbox del PC
- [ ] 6.2 Reporte de importación visible: cuántos nodos se añadieron, actualizaron, eliminaron y omitieron; verificar mensajes con un export de prueba
- [ ] 6.3 Suite de tests de regresión: round-trip del editor, fusión de imports, siembra de plantillas; verificar `npm test` verde

## 7. Cierre

- [ ] 7.1 Validar el change completo: `openspec validate bootstrap-cuaderno-medico --strict` sin errores
- [ ] 7.2 Recorrido de aceptación con datos reales de estudio: crear tema, fichas desde plantilla, esquema, captura móvil, export e import cruzado
