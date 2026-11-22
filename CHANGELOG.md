# Changelog

All notable changes to SINDECON are documented in this file.

## [1.0.2] - 2026-11-22

### Changed
- **Dock Inferior Compartido (`ClinicalBottomDock`)**: Unificación de las barras inferiores de `Dashboard`, `FolderExplorerView` y `ArticleWorkspaceView` con grilla simétrica (`1fr auto 1fr`, `max-w 1080px`) para mantener el botón `+` exactamente centrado horizontal y verticalmente en escritorio y móvil.
- **Barra de Visor PDF (`PdfDocumentViewer`)**: Distribución en 3 columnas en escritorio (`md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`) para centrar los controles de zoom sin depender del ancho del título.

### Fixed
- **Estilos y Responsividad del Dock en Tailwind v4**: Reemplazo del bloque `@layer components` descartado en `tailwind.css` por utilidades directas, separación de `inline-flex` vs. `hidden sm:inline-flex` y ajuste de etiqueta `"Imprimir PDF"` (`hidden xl:inline`) eliminando barras de scroll horizontales y solapamientos en móvil.

## [1.0.1] - 2026-11-22

### Changed
- **Unificación Tipográfica `SINDECON Clínico`**: Carga de `Plus Jakarta Sans`, `Inter` y `JetBrains Mono` en `index.html`, mapeo de `--font-sans`, `--font-display`, `--font-mono` en Tailwind y `--font-main` en CSS, y reemplazo de `font-serif` y escalas heredadas de Milkdown Crepe (`Noto Serif` 42px) por encabezados y texto clínico consistentes entre Dashboard, Carpetas, Lector A4, Editor, Impresión y Modales.
- **Barras Inferiores Cohesivas (Ghost Pills)**: Estandarización del dock flotante inferior en `FolderExplorerView` y `ArticleWorkspaceView` con clases compartidas `.clinical-dock`, `.clinical-dock-btn` y `.clinical-dock-orb` (en `@layer components`), preservando la visibilidad adaptativa en móviles y añadiendo margen inferior (`pb-36 sm:pb-40`) para evitar solapamientos.
- **Encabezado y Tabla de Carpeta**: Alineación horizontal de filtros clínicos y selector `Orden:` en una sola fila en escritorio, y reemplazo de `⋮` visible por texto accesible en cabecera de tabla.

### Fixed
- **Contraste en Modo Oscuro (`Guardia UCI`)**: Separación entre `--ch-accent-solid` (`#0f766e` para botones primarios con texto blanco) y `--ch-accent` (`#2dd4bf` para pestañas activas, iconos, enlaces y bordes en tema oscuro), además de mejor contraste en botones deshabilitados y badge de cabecera de `Dashboard`.
- **Diagramas Mermaid dentro de Hoja A4 en Modo Oscuro**: Conservación de superficie y tinta claras dentro de `.a4-sheet .mermaid-viewer-card` y `.mermaid-tag` para que `"Algoritmo / Esquema"` permanezca legible sobre la ficha blanca A4.
- **Hidratación Limpia en Editor y Copy Coherente**: Ajuste de `isArticleReady` en `App.tsx` para esperar la carga del artículo seleccionado antes de montar `MarkdownEditor`, localización de placeholder de Crepe al español, soporte de tema oscuro para Crepe (`--crepe-color-*`) y corrección de texto `"Editar"` -> `"Editor"` en `ArticleReader.tsx`.

## [1.0.0] - 2026-11-22

### Added
- **Estación Clínica SINDECON v1.0 (`SINDECON Clínico`)**: Nuevo panel principal en dos columnas (`Dashboard`) con repositorio filtrable, tarjeta de repaso SM-2, acceso rápido a plantillas y dock inferior flotante.
- **Espacio de Artículo sin Barra Lateral Fija**: Nuevo componente `ArticleWorkspaceView` con selector desplegable superior de carpetas/protocolos, barra de herramientas deduplicada, cajón flotante de bloques clínicos e índice contextual lateral.
- **Explorador de Carpeta Clínica**: Vista interior rediseñada en `FolderExplorerView` con búsqueda en vivo, índice compacto de protocolos y selector de marca clínica rápida.
- **Shell Compartida de Modales y Toasts (`BaseModal`)**: Contenedor unificado con cápsulas de bordes `22px`, botones píldora (`PILL_BTN_PRIMARY`, `PILL_BTN_SECONDARY`, `PILL_BTN_DANGER`), campos unificados e íconos vectoriales de Lucide en `DialogModal.tsx`.
- **Persistencia de Marcas Clínicas**: Guardado dual en `localStorage` + IndexedDB (`db.meta['clinical_marks']`) y respaldo automático/restauración tolerante a fallos en archivos `_clinical_marks.json` dentro de exportaciones ZIP.

### Changed
- **Unificación Visual Integral (Dirección A)**: Migración de todos los modales, diálogos, toasts, selector `[[Wiki-link]]`, captura rápida y barras del visor PDF/Mermaid a `SINDECON Clínico` (`clinical-home`) con temas claro y oscuro coherentes.
- **Botones y Controles Consistentes**: Eliminación de emojis crudos en títulos de diálogos, toasts, vista previa de flashcards, breadcrumbs, visor PDF y barra de navegación móvil, sustituidos por iconografía Lucide uniforme.

### Fixed
- **Resiliencia en Backup ZIP de Marcas Clínicas**: Sanitización segura al leer y restaurar marcas clínicas desde `localStorage` o `_clinical_marks.json`, evitando fallos de exportación/importación ante JSON corrupto o estructuras no tabulares.
- **Integración OAuth y Estado de Sincronización en UI**: Unificación del indicador de estado pendiente (`Pendiente`, `Última consulta`, reintento con refresco silencioso BFF y fix en `getDefaultGoogleClientId` para respetar overrides vacíos en `VITE_GOOGLE_CLIENT_ID`).
- **Contrato de Importación Masiva**: Corrección de propiedades pasadas a `importBulkArticles` en `BulkImportModal.tsx`.
