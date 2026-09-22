## 1. Utilidades de procesamiento y persistencia de PDFs

- [x] 1.1 Crear utilidades de procesamiento de PDFs en `src/domain/pdfUpload.ts` para extraer títulos limpios a partir del nombre del archivo (eliminando `.pdf` y formateando espacios), validar MIME/extensión y escribir tests unitarios en `src/domain/pdfUpload.test.ts`.
- [x] 1.2 Implementar función de servicio de persistencia en `src/db/assets.ts` o `src/db/pdfArticles.ts` que almacene el archivo PDF en la tabla `assets` con `mime: 'application/pdf'`, cree el nodo `article` en la carpeta seleccionada y guarde el artículo con `[pdf](asset://${assetId})`.

## 2. Componente de visualización de PDFs en el lector

- [x] 2.1 Crear el componente `PdfDocumentViewer` en `src/components/reader/PdfDocumentViewer.tsx` que resuelva el blob del asset, genere el `blobUrl`, renderice el tag `<object data={blobUrl} type="application/pdf">` (con fallback de `iframe` y enlace directo) y barra de herramientas con "⬇️ Descargar" y "↗️ Abrir en pestaña", liberando el `blobUrl` al desmontarse.
- [x] 2.2 Actualizar el parser y renderizador de bloques en `src/components/reader/ArticleReader.tsx` para reconocer `[pdf](asset://...)` y `![pdf](asset://...)` y montar `PdfDocumentViewer`, agregando estilos en `src/index.css`.

## 3. Diálogo modal de subida de PDFs (UploadPdfModal)

- [x] 3.1 Crear `UploadPdfModal` en `src/components/portability/UploadPdfModal.tsx` con zona de arrastrar y soltar (drag & drop), selector de archivos nativo multi-selección (`.pdf`), lista interactiva con peso y campo de texto para renombrar opcionalmente cada título, botones para descartar archivos y selector de carpeta de destino.
- [x] 3.2 Implementar en `UploadPdfModal` la lógica asíncrona de subida en lote, manejo de estados de carga, deshabilitación de controles durante la escritura y notificación/callback al completar.

## 4. Puntos de integración en la interfaz de usuario

- [x] 4.1 Incorporar la acción "📄 Subir PDFs" en el menú contextual (`···`) de carpetas en `TreeView.tsx` para abrir el modal con la carpeta seleccionada como destino.
- [x] 4.2 Incorporar el botón "📄 Subir PDF" en la barra de herramientas de la vista exploradora de carpeta (`FolderExplorerView.tsx`).
- [x] 4.3 Conectar en `App.tsx` el estado global y props para gestionar la apertura/cierre de `UploadPdfModal`, recargando y navegando a los documentos subidos al completar.

## 5. Verificación y pruebas

- [x] 5.1 Ejecutar los tests unitarios con `npm test` para asegurar que todas las suites pasen sin regresiones.
- [x] 5.2 Crear y ejecutar test E2E con Playwright en `app/e2e/upload-pdf.spec.ts` que verifique la subida de PDFs, la edición de nombre, la persistencia en IndexedDB y el renderizado del visor.
