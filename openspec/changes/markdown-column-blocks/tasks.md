## 1. Parser de Bloques Markdown Multicolumna

- [x] 1.1 Extender `Block` con `{ type: 'columns', columns: Block[][] }` en `ArticleReader.tsx` y parsear delimitadores `:::columns` y `|||`, verificando con tests unitarios
- [x] 1.2 Añadir soporte para renderizado recursivo de bloques hijos dentro de cada columna en `ArticleReader.tsx`
- [x] 1.3 Crear suite de pruebas unitarias para `parseMarkdownBlocks` verificando 2 y 3 columnas con listas, tablas, callouts y negritas

## 2. Estilos y Diseño Responsivo

- [x] 2.1 Añadir clases CSS `.article-columns-grid` y `.article-column-item` con soporte de variable `--col-count` y media query para móvil (< 640px) en `index.css`
- [x] 2.2 Asegurar que las columnas se rendericen y ajusten correctamente en la vista de exportación a PDF e impresión

## 3. Integración en Editor y Barra de Herramientas

- [x] 3.1 Añadir botón `[ ◫ Columnas ]` en `MarkdownEditor.tsx` para insertar la plantilla de dos columnas en la posición del cursor
- [x] 3.2 Verificar preservación de bloques `:::columns` en exportación e importación Markdown en `exportmd.ts`

## 4. Pruebas E2E y Verificación

- [x] 4.1 Añadir prueba E2E en Playwright verificando inserción de columnas, renderizado visual en Modo Lector y comportamiento responsivo
- [x] 4.2 Ejecutar suite completa de pruebas unitarias (`npm test`) y E2E (`npx playwright test`) para confirmar 100% de aprobación
