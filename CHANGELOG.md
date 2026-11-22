# Changelog

All notable changes to SINDECON are documented in this file.

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
