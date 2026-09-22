## Context

Sindecon gestiona el conocimiento médico local en un árbol de nodos (carpetas y artículos) persistidos en IndexedDB mediante Dexie.js. La base de datos incluye la tabla `assets`, utilizada para almacenar archivos binarios (imágenes y capturas) como `Blob`, referenciados dentro del Markdown como `asset://<uuid>`.

El usuario requiere poder subir archivos PDF (uno o múltiples a la vez) organizados en carpetas, con la posibilidad de modificar opcionalmente sus títulos antes de guardarlos, y visualizarlos de manera interactiva dentro del lector de la aplicación sin necesidad de extraer o convertir su texto.

## Goals / Non-Goals

**Goals:**
- Proporcionar un diálogo modal `UploadPdfModal` intuitivo y accesible desde el menú contextual (`···`) de carpetas y desde la barra de herramientas de `FolderExplorerView`.
- Soportar selección múltiple de archivos `.pdf` mediante explorador de archivos nativo o arrastrar y soltar (drag & drop).
- Presentar una lista de los documentos cargados mostrando su peso y un campo de entrada para editar opcionalmente su título (sugiriendo por defecto el nombre del archivo sin extensión `.pdf` formateado limpiamente).
- Permitir eliminar elementos individuales de la lista antes de proceder a la carga.
- Permitir seleccionar o cambiar la carpeta de destino en el árbol de conocimientos (preseleccionando la carpeta actual).
- Persistir cada PDF como un blob en la tabla `assets` con MIME `application/pdf` y crear un nodo de tipo `article` en la base de datos asociado mediante la referencia `[pdf](asset://<assetId>)`.
- Renderizar un visor nativo de PDF responsivo en `ArticleReader` mediante `<object data={blobUrl} type="application/pdf">` (con fallback de `iframe` y enlace directo) que incluya controles de zoom, páginas, impresión y botones de utilidad ("Descargar PDF", "Abrir en pestaña nueva").
- Garantizar la liberación adecuada de memoria de los Object URLs generados (`URL.revokeObjectURL`).

**Non-Goals:**
- Extracción de texto a Markdown, OCR o análisis de contenido con LLM en este flujo.
- Edición, recorte, firma o manipulación interna de las páginas del PDF.
- Incorporación de dependencias pesadas de renderizado como `pdfjs-dist` o `pdf-lib`.

## Decisions

### 1. Reutilización de la infraestructura existente de `assets` y `articles`
- **Decisión:** Cada PDF subido se guarda como un `AssetRow` (`mime: 'application/pdf'`) en Dexie y se crea un `NodeRow` de tipo `article` con `body_md: '[pdf](asset://<assetId>)'`.
- **Razón:** Aprovecha el sistema actual de almacenamiento de archivos locales offline, la resolución automática de dueños en `saveArticle(node.id, ...)` y el backup portátil en ZIP sin romper la sincronización ni requerir nuevas tablas en IndexedDB.
- **Alternativas consideradas:**
  - *Crear un nuevo tipo de nodo `kind: 'pdf'`*: Requeriría cambiar el tipo `NodeKind = 'folder' | 'article'`, adaptar el árbol de conocimientos, breadcrumbs, explorador de carpetas, ordenamiento, búsqueda y esquemas de sincronización. No justifica la complejidad (violación de YAGNI / Ponytail).

### 2. Formato del cuerpo Markdown para documentos PDF
- **Decisión:** Usar la sintaxis canónica Markdown `[pdf](asset://<assetId>)` (o `![pdf](asset://<assetId>)`).
- **Razón:** Es un enlace/imagen estándar en Markdown legible por cualquier parser, integrable con el regex de `saveArticle` para asociar el activo, y fácil de detectar por `ArticleReader`.
- **Alternativas consideradas:**
  - *Directiva personalizada como `:::pdf`*: Más compleja de redactar manualmente si el usuario abre el editor de markdown y no añade valor sobre el formato de enlace estándar.

### 3. Visor nativo con `<object>` y fallback
- **Decisión:** Implementar un componente `PdfDocumentViewer` dentro de `ArticleReader` que use la etiqueta HTML5 `<object data={blobUrl} type="application/pdf">` junto a una barra de herramientas con "⬇️ Descargar" y "↗️ Abrir en pestaña".
- **Razón:** Todos los navegadores modernos (Chromium, Safari, Firefox, Edge) y PWAs instaladas ofrecen visores de PDF nativos rápidos, accesibles y con soporte para zoom, búsqueda y páginas, con coste 0 en kilobytes añadidos al bundle. Para navegadores móviles donde los embeds de PDF a veces se comportan como previsualización limitada, los botones "Abrir en pestaña" y "Descargar" garantizan 100% de usabilidad.
- **Alternativas consideradas:**
  - *Empaquetar `pdfjs-dist`*: Añade varios megabytes al bundle inicial de la PWA y consumo excesivo de memoria en dispositivos móviles.

### 4. Puntos de entrada para el modal de subida
- **Decisión:** Exponer "📄 Subir PDFs" en el menú contextual de carpetas (`FolderContextMenu`) y como botón en la cabecera de `FolderExplorerView`.
- **Razón:** Sigue el mismo patrón UX establecido para "📥 Importar archivos .md" y "Crear artículo", proporcionando acceso directo en el punto donde el usuario organiza sus archivos.

## Risks / Trade-offs

- **[Riesgo] Tamaño de almacenamiento en IndexedDB con múltiples PDFs pesados** → IndexedDB en navegadores modernos admite decenas de gigabytes de cuota por origen; la app ya solicita almacenamiento persistente en el shell offline.
- **[Riesgo] Fugas de memoria con Object URLs** → `PdfDocumentViewer` gestiona el ciclo de vida del `blobUrl` mediante `useEffect` y `URL.revokeObjectURL(url)` en la función de limpieza de desmontaje.
- **[Riesgo] Visualización embebida en navegadores móviles (iOS Safari / Android Chrome)** → Se incluyen botones destacados de acción rápida para abrir en visor a pantalla completa del sistema operativo o descargar el archivo.
