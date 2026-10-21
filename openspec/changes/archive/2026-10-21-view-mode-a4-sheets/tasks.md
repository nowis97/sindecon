# Tasks

## 1. Estilos y Maquetación de Hojas A4 en CSS

- [x] 1.1 Definir las clases `.a4-sheet` y `.a4-sheet-container` en `app/src/index.css` con dimensiones A4 (`max-width: 210mm`, `min-height: 297mm`), márgenes físicos tipográficos (padding 20-24mm), fondo de tarjeta/papel y sombra perimetral de elevación.
- [x] 1.2 Implementar la separación visual entre hojas múltiples (margen vertical de 28px y divisor sutil de página) sobre el fondo del lienzo de lectura.
- [x] 1.3 Adaptar las reglas de `.a4-sheet` para soportar coherentemente la maquetación a 2 columnas (`.layout-two-columns`), texto justificado (`.text-justified`) y desbordamiento controlado en tablas y diagramas Mermaid.
- [x] 1.4 Configurar media queries responsivas (`@media (max-width: 768px)`) para adaptar la hoja A4 al 100% del viewport en teléfonos móviles con padding adaptado (16px) y `min-height: auto`.

## 2. Refactorización de ArticleReader

- [x] 2.1 Actualizar `app/src/components/reader/ArticleReader.tsx` para segmentar los bloques de Markdown en hojas `.a4-sheet`, utilizando las reglas horizontales (`type: 'hr'`) como separadores naturales de página.
- [x] 2.2 Aplicar las clases de dos columnas y justificación a nivel de cada `.a4-sheet` generada dentro del lector.
- [x] 2.3 Ajustar la vista de artículo vacío en `ArticleReader.tsx` para que mantenga la proporción y estética de hoja A4.

## 3. Pruebas y Verificación

- [x] 3.1 Agregar o actualizar tests unitarios en Vitest para comprobar la segmentación de bloques en hojas A4 y las clases aplicadas en `ArticleReader`.
- [x] 3.2 Ejecutar `npm run test` y `npm run build` en el workspace de `app` y verificar que la suite completa pase sin errores de tipado ni fallos de renderizado.
