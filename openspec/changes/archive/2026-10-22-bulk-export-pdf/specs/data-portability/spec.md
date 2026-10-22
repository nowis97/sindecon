# Spec Delta

## ADDED Requirements

### Requirement: Exportación masiva de artículos seleccionados a PDF combinado

El sistema SHALL permitir al usuario seleccionar múltiples artículos clínicos y exportarlos o imprimirlos de forma combinada en un único documento PDF mediante un modal interactivo (`BulkExportPdfModal`).

El modal de exportación masiva SHALL incluir:
1. Un buscador reactivo por texto para filtrar artículos por título.
2. Filtros por carpeta de origen y por etiquetas (tags).
3. Controles para seleccionar o deseleccionar todos los artículos visibles con un solo clic, así como selección y deselección individual de cada nota mediante casillas de verificación (checkboxes).
4. Un contador en tiempo real que indique la cantidad de artículos actualmente seleccionados.
5. Selección de maquetación: **1 Columna (Lectura continua)** o **2 Columnas (Ficha médica / Resumen compacto)**.
6. Opciones de personalización del compendio: incluir u ocultar cabecera médica (título, fecha de modificación y ruta jerárquica) en cada artículo, incluir u ocultar etiquetas, y opción para forzar salto de página automático antes de cada nuevo artículo.
7. Un campo de texto editable para asignar el título del compendio clínico, el cual SHALL asignarse a `document.title` durante el disparo de `window.print()` para que el navegador sugiera automáticamente ese nombre de archivo al guardar el PDF.

Al confirmar la exportación, el sistema SHALL montar un contenedor de impresión (`#print-bulk-document`) renderizando secuencialmente todos los artículos seleccionados con su maquetación clínica y tipografía justificada (`9pt`, `line-height: 1.15`), e invocar la impresión del navegador (`window.print()`).

#### Scenario: Selección múltiple y exportación de artículos a compendio PDF
- **WHEN** el usuario abre el modal de exportación masiva a PDF, selecciona 5 artículos de diferentes carpetas y confirma la exportación con maquetación de 2 columnas y salto de página entre artículos
- **THEN** el sistema genera la vista de impresión unificada conteniendo los 5 artículos en secuencia, cada uno iniciando en una página nueva con diseño de 2 columnas, y lanza el diálogo de impresión / guardado en PDF del navegador

#### Scenario: Filtrado por búsqueda y selección rápida
- **WHEN** el usuario escribe un término en el buscador del modal o selecciona una carpeta específica
- **THEN** la lista muestra únicamente los artículos coincidentes y el botón "Seleccionar todos" marca únicamente los artículos resultantes del filtro activo

#### Scenario: Restitución del estado de la aplicación tras la impresión
- **WHEN** finaliza o se cancela el diálogo de impresión (`window.print()`)
- **THEN** el sistema restaura el título original de la pestaña (`document.title`), remueve las clases de impresión del `body` y desmonta el contenedor de impresión sin alterar el artículo seleccionado en la vista principal
