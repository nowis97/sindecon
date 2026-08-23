# Propuesta: Bootstrap del Cuaderno Médico Personal

## Why

El usuario necesita una base de conocimientos médica personal — un "cuaderno de estudio digital" — usable en PC (elaboración de contenido) y móvil (captura rápida y consulta en contexto hospitalario), que funcione 100% offline, sin backend, sin cuentas y gratis. No existe código aún: este change funda la aplicación completa, con todas las decisiones de arquitectura ya exploradas y un spike técnico superado que validó el riesgo principal (round-trip WYSIWYG ↔ Markdown).

## What Changes

- Crear la aplicación desde cero: PWA en React + TypeScript + Vite, instalable en web y móvil, offline-first con datos en IndexedDB.
- Modelo de conocimiento como **árbol recursivo de nodos** (carpeta | artículo); un "Tema" es simplemente la categoría raíz. Los artículos pueden vivir en cualquier nivel.
- Contenido de artículos en **Markdown como fuente de verdad** (texto formateado, tablas GFM, listas, bloques `mermaid`, imágenes como blobs), editado con un editor WYSIWYG (Milkdown Crepe) limitado deliberadamente a lo que Markdown puede expresar.
- **Plantillas**: carpeta especial editable con el mismo editor; 10 plantillas maestras sembradas en el primer arranque según `Formatos_sintesis_conocimiento_medico.pdf`; crear artículo desde plantilla = copiar contenido con placeholder `{título}`.
- **Inbox de capturas** para el flujo móvil (foto + nota rápida sin clasificar, elaborar después en PC).
- **Búsqueda local** por título, contenido y tags de síntomas; referencias cruzadas `[[wiki-links]]` entre artículos.
- **Portabilidad de datos**: export/import como carpeta de `.md` con frontmatter + assets; importación por **fusión** (uuid + updated_at + tombstones) que sirve de backup hoy y de base para sync futuro mañana.
- Persistencia de almacenamiento del navegador (`navigator.storage.persist()`).

## Capabilities

### New Capabilities

- `knowledge-tree`: Árbol recursivo de nodos (carpetas y artículos), navegación con breadcrumbs, operaciones crear/renombrar/mover/eliminar, bandeja Inbox para capturas sin clasificar.
- `content-editing`: Editor WYSIWYG que persiste Markdown; tablas visuales; bloques mermaid con preview en vivo; imágenes (pegar/arrastrar/subir → blob local); pegar texto plano interpretado como Markdown; copiar desde el editor serializa a Markdown; vista lector.
- `templates`: Carpeta especial `Plantillas/`; siembra de las 10 plantillas maestras en el primer arranque; creación de artículos desde plantilla (copia + reemplazo de `{título}`); plantillas editables como artículos normales.
- `search`: Índice local (MiniSearch) sobre título + contenido + tags; tags de síntomas en frontmatter; búsqueda por síntoma; autocompletado de `[[wiki-links]]` y lista de "artículos relacionados".
- `offline-shell`: PWA instalable (manifest + service worker), funcionamiento total offline incluyendo mermaid.js, solicitud de almacenamiento persistente.
- `data-portability`: Export a zip/carpeta de Markdown con frontmatter (id, tags, orden) + assets; import con fusión por uuid (gana updated_at más reciente, respeta tombstones); versionado del formato de export.

### Modified Capabilities

(ninguna — no existen specs previos)

## Impact

- **Código nuevo**: aplicación completa bajo `app/` (o raíz de paquete nueva). El spike en `spike-editor/` queda como referencia desechable (setup de Crepe, fixes de LanguageDescription y applyPreview ya resueltos ahí).
- **Dependencias**: react, react-dom, vite, typescript, @milkdown/crepe, @milkdown/kit, mermaid, dexie (IndexedDB), minisearch, vite-plugin-pwa, jszip (export).
- **Sin backend, sin cuentas, sin costos**: todo local en el dispositivo.
- **Deuda conocida aceptada**: bundle pesado por mermaid (mitigar con import dinámico); sync automático entre dispositivos queda fuera de alcance (diseño sync-ready, fusión ya definida).
- **Documento fuente de plantillas**: `Formatos_sintesis_conocimiento_medico.pdf` (10 plantillas maestras, en la raíz del repo).
