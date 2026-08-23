# Diseño: Cuaderno Médico Personal

## Context

Proyecto greenfield (ver proposal.md para motivación). Las decisiones aquí registradas provienen de una sesión de exploración completa y de un spike técnico (`spike-editor/`) que validó el riesgo principal: round-trip WYSIWYG ↔ Markdown sin pérdidas usando Milkdown Crepe 7.x, incluyendo tablas visuales, preview de mermaid en vivo, pegar Markdown crudo interpretado y copiar serializado a Markdown.

Restricciones duras: app personal, gratis, sin backend ni cuentas, offline total, una sola codebase para web + móvil, mantenible por una sola persona que conoce React.

## Goals / Non-Goals

**Goals:**

- Una codebase PWA (React + TS + Vite) instalable en PC y móvil, 100% offline.
- Markdown como fuente de verdad portable; el conocimiento sobrevive a la app.
- Flujo móvil = capturar/consultar; flujo PC = elaborar.
- Datos locales preparados para sync futuro sin reescritura (uuid, updated_at, tombstones).

**Non-Goals:**

- Sin backend, cuentas, colaboración multiusuario ni sync automático (fusión manual via export/import solamente).
- Sin publicación en App Store/Play Store (instalación PWA desde el navegador).
- Sin OCR ni búsqueda dentro de imágenes; sin variables de plantilla más allá de `{título}`.
- El editor NO ofrece nada que Markdown no pueda expresar (regla de oro de portabilidad).

## Decisions

### D1. PWA sobre Flutter / React Native / Ionic

Una codebase, instalable sin stores, service worker para offline, IndexedDB para datos. La app es ~90% lectura/edición de contenido: no necesita APIs nativas más allá de la cámara (disponible vía `<input type="file" accept="image/*" capture>`). Alternativas descartadas: Flutter (segundo lenguaje para el mantenedor), RN/Expo (duplica UI web/móvil), Ionic (capa extra sin beneficio aquí).

### D2. Modelo de conocimiento: nodo recursivo único

Una sola tabla `nodes` con `parent_id` autorreferenciado; `kind: folder | article`. "Tema" = nodo carpeta raíz (azúcar en la UI, no en el modelo). Los artículos pueden colgar de cualquier carpeta (no solo hojas). Alternativa descartada: tipos separados Tema/Categoría — añade tablas y lógica especial sin beneficio, y bloquea niveles futuros (p.ej. "Especialidades" sobre Temas).

Carpetas de sistema marcadas con `system: 'inbox' | 'templates' | null`: el Inbox y las Plantillas son nodos normales con semántica especial.

### D3. Markdown como fuente de verdad + editor WYSIWYG acotado

`articles.body_md` guarda Markdown GFM + fences `mermaid` + referencias de imagen. El editor (Milkdown Crepe) solo ofrece lo que Markdown expresa; el export a `.md` es literal y sin pérdidas. Validado en el spike. Alternativas descartadas: bloques JSON tipo Notion (portabilidad pobre), HTML WYSIWYG (round-trip sucio).

Hallazgos del spike que pasan a ser detalles fijos de implementación:

- `LanguageDescription.of` exige `load`/`support` → registrar lenguajes con un `StreamLanguage` vacío (solo importa el nombre para el fence).
- Preview de mermaid: `renderPreview` debe devolver `undefined` y entregar el SVG vía `applyPreview()` (async); devolver un elemento y rellenarlo después no funciona (el componente copia innerHTML al instante).
- Pegar Markdown crudo y copiar serializado a Markdown son nativos del plugin clipboard de Crepe.

### D4. Persistencia: IndexedDB vía Dexie

Tablas:

```
nodes    { id, parent_id, kind, title, order, system, created_at, updated_at, deleted_at }
articles { node_id, body_md, tags[] }        // 1:1 con nodes kind=article
assets   { id, node_id, blob, mime }         // imágenes comprimidas al importar
meta     { key, value }                      // schema_version, seeded_at, ...
```

Las imágenes se referencian en el Markdown con esquema propio `asset://<id>` (el render lo resuelve a blob URL; el export lo reescribe a ruta relativa + archivo). Alternativa descartada: data URLs inline (Markdown gigante e ilegible). Al importar fotos se recomprimen (máx ~1600px) para proteger la cuota de IndexedDB. Se solicita `navigator.storage.persist()` al primer arranque.

### D5. Plantillas = carpeta de sistema con siembra inicial

Al primer arranque se crea `Plantillas/` con los 10 formatos maestros de `Formatos_sintesis_conocimiento_medico.pdf` (Patología, Síndrome, Síntoma, Urgencia, Procedimiento, Examen diagnóstico, Concepto básico, Prevención/tamizaje, Terapéutica, Fármaco). Cada plantilla es un artículo normal: se edita con el mismo WYSIWYG y viaja en export/import. "Crear desde plantilla" copia `body_md` y reemplaza `{título}` por el nombre del nuevo artículo. Sin vínculo post-creación (el artículo queda independiente, como Notion/Obsidian). Alternativa descartada: plantillas fijas en código (no editables por el usuario).

### D6. Export/Import: carpeta de Markdown + fusión por uuid

- **Export**: zip con estructura espejo del árbol (`Tema/Subcategoria/Articulo.md` + `assets/`), frontmatter YAML por archivo (`id`, `tags`, `order`, `updated_at`), más `_manifest.json` (versión de formato) y `_deleted.json` (tombstones).
- **Import**: NUNCA reemplaza — fusiona por uuid: inserta nuevos, actualiza si `updated_at` entrante es más reciente, aplica tombstones. La misma lógica servirá al sync automático futuro: el sync es "fusión continua", no otra máquina.
- El formato lleva versión desde el día 1 (`export_format_version`) para que el backup de hoy lo lea la app de mañana.

Motivo: el flujo es bidireccional (PC exporta artículos elaborados → móvil; móvil exporta capturas del Inbox → PC). Importar-reemplazando borraría capturas; la fusión es obligatoria, no opcional.

### D7. Búsqueda local con MiniSearch

Índice en memoria reconstruible desde IndexedDB al arrancar (título + body + tags). Tags de síntomas viven en el frontmatter/`articles.tags` y se autocompletan desde los existentes. `[[wiki-links]]` con autocompletado por título; la vista lector muestra "artículos relacionados" (backlinks). Sin indexación de contenido de imágenes (non-goal).

### D8. Mermaid con carga diferida

Mermaid pesa ~1.8 MB en el bundle del spike. En la app real se carga con `import()` dinámico solo cuando un artículo contiene fences mermaid (editor o lector). El service worker lo cachea tras la primera carga → offline se mantiene.

## Arquitectura de código

Las decisiones D1–D8 fijan la arquitectura de *sistema*; esta sección fija la arquitectura de *código* (estructura, capas, convenciones) para que el scaffold de la tarea 1.1 nazca con ella y no improvisada.

### Estructura por capas

```
app/src/
├── db/            ← ÚNICA capa que toca IndexedDB
│   ├── db.ts          schema Dexie + versionado
│   ├── nodes.ts       CRUD del árbol (cascadas, tombstones)
│   ├── articles.ts / assets.ts / seed.ts
├── domain/        ← lógica PURA, sin DOM, 100% testeable
│   ├── tree.ts        mover/ordenar nodos
│   ├── merge.ts       fusión por uuid (import)
│   ├── markdown.ts    refs asset://, wiki-links
│   └── templates.ts   las 10 plantillas como datos
├── hooks/         ← useLiveQuery: datos vivos de IndexedDB a componentes
├── components/
│   ├── tree/      TreeView, Breadcrumbs
│   ├── editor/    MarkdownEditor (wrapper Crepe)
│   ├── reader/    ArticleReader, bloques mermaid con zoom
│   ├── search/    SearchBox, TagInput
│   └── capture/   QuickCapture móvil
└── pwa/           service worker, persistencia
```

### Reglas de la casa (buenas prácticas vinculantes)

1. **Regla de una puerta**: solo `db/` toca la base de datos. Ningún componente importa Dexie directamente → cambiar de storage en el futuro duele en un solo sitio.
2. **Dominio puro**: `domain/` son funciones sin efectos secundarios, testeables con Vitest sin navegador. Los tests de `merge.ts` (fusión) y del round-trip del editor son los más valiosos del proyecto.
3. **Sin state manager**: `useLiveQuery` de Dexie empuja cambios de IndexedDB a React directamente; la base de datos ES el estado. No Redux ni Zustand — menos código, menos bugs de sincronización de estado.
4. **Componentes tontos**: `components/` solo renderiza props y llama hooks; nada de lógica de negocio dentro del JSX.
5. **Simplicidad deliberada**: app personal mantenida por una persona — la mejor arquitectura es la que cabe entera en la cabeza sin esfuerzo. Prohibido añadir capas "por si acaso".

## Risks / Trade-offs

- [El navegador puede expulsar IndexedDB bajo presión de almacenamiento] → `storage.persist()` al primer arranque + recordatorio de exportar backup; el export es trivial (Markdown plano).
- [Sync manual bidireccional puede generar conflictos si se edita el mismo artículo en dos dispositivos] → fusión por `updated_at` (last-write-wins a nivel artículo); la UX empuja a un dispositivo principal de edición (PC) y el móvil edita solo capturas del Inbox.
- [Round-trip WYSIWYG↔Markdown puede tener casos borde] → mitigado por spike + regla de oro (el editor no ofrece lo que MD no expresa); tests de round-trip en la suite.
- [Diagramas mermaid anchos ilegibles en móvil] → vista lector con zoom/pan (pinch) en bloques mermaid e imágenes.
- [Primera carga lenta por bundle mermaid/editor] → code-splitting (D8) + cacheo del service worker; la shell abre sin editor montado.

## Migration Plan

N/A — greenfield sin datos previos. El propio formato de export nace versionado (D6).

## Open Questions

- ¿Distribución futura vía Play Store con TWA (Trusted Web Activity)? Diferible: la PWA instalable cubre el uso personal.
- ¿Las capturas del Inbox merecen plantilla propia o recordatorios de "elaborar pendientes"? Se decide con uso real post-V0.5.
