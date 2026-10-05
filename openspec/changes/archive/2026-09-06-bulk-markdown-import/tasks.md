## 1. Capa de Dominio y Extracción de Metadatos

- [x] 1.1 Implementar `parseMarkdownArticle` en `app/src/domain/bulkMarkdownImport.ts` para extraer título (Frontmatter YAML > H1 > Nombre de archivo), etiquetas y cuerpo limpio.
- [x] 1.2 Implementar soporte para desempaquetar archivos ZIP de notas Markdown usando `jszip` en `app/src/domain/bulkMarkdownImport.ts`.
- [x] 1.3 Crear suite de tests unitarios en `app/src/domain/bulkMarkdownImport.test.ts` validando todas las variantes de Frontmatter, títulos vacíos, sanitización de nombres y archivos ZIP.

## 2. Capa de Base de Datos y Persistencia Atómica

- [x] 2.1 Implementar `importBulkArticles` en `app/src/db/bulkArticles.ts` utilizando transacciones de Dexie (`db.transaction`) con soporte para estrategias de colisión (`skip`, `suffix`, `overwrite`).
- [x] 2.2 Crear tests unitarios en `app/src/db/bulkArticles.test.ts` verificando la creación masiva de nodos y artículos, asignación correcta de `parent_id` y resolución de duplicados.

## 3. Componentes de Interfaz de Usuario

- [x] 3.1 Crear el componente `BulkImportModal.tsx` en `app/src/components/portability/BulkImportModal.tsx` con soporte para selección múltiple de archivos, selección de directorio (`webkitdirectory`), soltado Drag & Drop, previsualización de lote y barra de progreso en tiempo real.
- [x] 3.2 Integrar la opción "📥 Importar archivos .md" en el menú contextual (`···`) de carpetas en `TreeView.tsx`.
- [x] 3.3 Integrar botón de importación masiva y zona de soltado en `FolderExplorerView.tsx`.
- [x] 3.4 Conectar el flujo en `App.tsx` para abrir `BulkImportModal` con la carpeta de destino preseleccionada.

## 4. Pruebas E2E y Validación del Sistema

- [x] 4.1 Añadir prueba E2E automatizada en Playwright (`app/e2e/vital.spec.ts`) validando la importación masiva de múltiples archivos `.md` en una carpeta con verificación de títulos, etiquetas y lectura en Modo Lector.
- [x] 4.2 Ejecutar suite completa de tests (`npm test` y `npx playwright test`) y verificar build de producción (`npm run build`).

