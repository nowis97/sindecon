# Tasks

## 1. Ocultación de controles interactivos en diagramas

- [x] 1.1 Ocultar `.mermaid-controls` y botones de zoom/fullscreen en `@media print` en `app/src/index.css`, verificando que ningún botón interactivo aparezca en la vista previa de impresión
- [x] 1.2 Añadir reseteo de transformaciones (`transform: none`) y escalado responsivo en `.mermaid-svg-wrapper svg` bajo `@media print` para evitar diagramas desalineados o cortados

## 2. Maquetación a 2 columnas y legibilidad de diagramas

- [x] 2.1 Configurar `column-span: all` en `.mermaid-viewer-card` dentro de `.print-layout-two-columns` para que los diagramas de flujo complejos y horizontales se expandan a lo ancho de la página sin comprimirse
- [x] 2.2 Asegurar que las tablas anchas (`.reader-table-wrapper`) respeten la legibilidad en impresión aplicando contención y `column-span: all` cuando excedan el ancho de una columna
- [x] 2.3 Reforzar `break-after: avoid` en subtítulos y líneas introductorias de lista para evitar elementos huérfanos entre páginas o columnas (ej. `Evitar:` descolgado)
- [x] 2.4 Corregir el solapamiento tipográfico en la cima de columnas reseteando márgenes y asegurando `box-decoration-break: clone` o paddings seguros

## 3. Normalización y renderizado de Callouts clínicos

- [x] 3.1 Actualizar la normalización en `parseMarkdownBlocks` (`app/src/components/reader/ArticleReader.tsx`) para desescapar corchetes `\[` (`replace(/\\+\[/g, '[')`) y soportar variantes de llamada clínica como `\[!DOSIS]`
- [x] 3.2 Agregar pruebas unitarias en `app/src/components/reader/ArticleReader.test.ts` para verificar el parseo de callouts con corchetes escapados y verificar con `npm run test`

## 4. Verificación y validación de exportación a PDF

- [x] 4.1 Ejecutar la suite completa de tests (`npm run test`) y confirmar que no existan regresiones
- [x] 4.2 Validar en la interfaz que la exportación a 2 columnas de un artículo con diagramas complejos (como Hemorragia puerperal) genera páginas equilibradas, sin controles de interfaz y con todos los callouts clínicos estilizados
