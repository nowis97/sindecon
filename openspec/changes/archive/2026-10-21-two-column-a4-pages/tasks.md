# Tasks

## 1. Algoritmo de Paginación en Hojas A4 para Modo 2 Columnas

- [x] 1.1 Implementar la función de estimación y segmentación de páginas `paginateTwoColumnBlocks` en `app/src/components/reader/ArticleReader.tsx`, calculando la capacidad vertical de una hoja A4 (capacidad útil de ~2140px entre las 2 columnas) y respetando saltos de página explícitos (`hr`).
- [x] 1.2 Integrar la paginación condicional en `ArticleReader.tsx`: aplicar `paginateTwoColumnBlocks` cuando `isTwoColumns` esté activo, y la partición estándar por `hr` en modo 1 columna.
- [x] 1.3 Mostrar el número de página ("Página X" o "Página X de Y") y delimitar claramente la separación física en el renderizado de cada hoja A4.

## 2. Estilos CSS para Hojas A4 a Dos Columnas con Márgenes Acotados

- [x] 2.1 Actualizar las reglas de `.article-reader-view.a4-sheet.layout-two-columns` en `app/src/index.css` aplicando los márgenes acotados de exportación (`padding: 7mm 10.5mm;`).
- [x] 2.2 Establecer `column-fill: auto;`, `column-gap: 1.5rem;`, `column-rule: 1px solid var(--border-subtle);` e interlineado compacto (`line-height: 1.2;`) para dos columnas en `app/src/index.css`.
- [x] 2.3 Reforzar la separación física visible entre hojas sucesivas en `.a4-sheet-container` (gap de 32px, elevación con sombras y delimitador de hoja).
- [x] 2.4 Asegurar la adaptación responsiva en pantallas móviles (`@media (max-width: 820px)`) para colapsar fluidamente a 1 columna sin desbordamiento.

## 3. Pruebas y Verificación

- [x] 3.1 Agregar tests unitarios en `app/src/components/reader/ArticleReader.test.ts` para comprobar la paginación secuencial de bloques en múltiples hojas A4 en el modo a 2 columnas.
- [x] 3.2 Ejecutar `npm run test` y `npm run build` en el workspace de `app` y verificar que la suite completa pase sin errores de tipado ni fallos de renderizado.
