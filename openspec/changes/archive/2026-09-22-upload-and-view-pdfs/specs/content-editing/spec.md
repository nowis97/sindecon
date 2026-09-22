## ADDED Requirements

### Requirement: Visualizador interactivo de documentos PDF en artículos
El sistema SHALL detectar artículos cuyo contenido principal sea un documento PDF referenciado mediante un asset local (`asset://<id>`) y renderizar un visor de PDF integrado en el modo lectura del artículo (`ArticleReader`), ofreciendo controles para interactuar con el documento (zoom, navegación de páginas e impresión nativa) sin necesidad de software de terceros. Adicionalmente, el visor SHALL proveer acciones de respaldo para descargar el archivo PDF original o abrirlo en una pestaña independiente del navegador.

#### Scenario: Renderizado del visor nativo de PDF en modo lectura
- **WHEN** el usuario selecciona un artículo que contiene un documento PDF
- **THEN** el lector de artículos muestra el visor embebido con el archivo cargado directamente desde IndexedDB (`URL.createObjectURL(blob)`), adaptado al ancho de la pantalla

#### Scenario: Abrir en pestaña nueva y descargar archivo
- **WHEN** el usuario pulsa en el botón "↗️ Abrir en pestaña" o "⬇️ Descargar" en la barra de herramientas del visor de PDF
- **THEN** el sistema abre el documento en una pestaña independiente o inicia la descarga del archivo binario con el nombre del artículo

#### Scenario: Renombrar artículo con documento PDF
- **WHEN** el usuario hace clic en el botón de renombrar (`btn-article-rename`) en la cabecera del visor de un artículo PDF
- **THEN** el título del artículo se actualiza en IndexedDB, en el árbol lateral y en la cabecera del visor manteniendo el archivo PDF intacto
