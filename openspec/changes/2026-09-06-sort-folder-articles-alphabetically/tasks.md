## 1. Capa de Dominio y Funciones de Ordenamiento

- [x] 1.1 Implementar `sortNodesBy` y tipos de ordenación (`SortCriteria`) en `app/src/domain/tree.ts` utilizando `Intl.Collator` en español (`es`) con soporte numérico y distinción de carpetas/artículos.
- [x] 1.2 Añadir tests unitarios en `app/src/domain/tree.test.ts` validando ordenamiento alfabético A-Z, Z-A, orden por fecha de modificación y preservación de carpetas arriba.

## 2. Capa de Base de Datos y Persistencia Transaccional

- [x] 2.1 Implementar `sortChildrenInFolder` en `app/src/db/nodes.ts` para actualizar atómicamente la secuencia de `order` de todos los hermanos vivos de una carpeta en Dexie.
- [x] 2.2 Añadir tests unitarios en `app/src/db/nodes.test.ts` verificando la reasignación de índices de orden y actualización de `updated_at`.

## 3. Componentes de Interfaz de Usuario e Integración

- [x] 3.1 Añadir la opción "🔤 Ordenar alfabéticamente (A-Z)" en el menú contextual (`···`) de carpetas en `TreeView.tsx`.
- [x] 3.2 Implementar selector de orden de visualización (Manual, A-Z, Z-A, Recientes) y botón de acción "🔤 Ordenar A-Z" en `FolderExplorerView.tsx`.
- [x] 3.3 Conectar los handlers de ordenamiento persistente en `App.tsx` mostrando notificación Toast de confirmación al usuario.

## 4. Pruebas E2E y Validación del Sistema

- [x] 4.1 Añadir prueba E2E automatizada en Playwright (`app/e2e/vital.spec.ts`) validando el ordenamiento alfabético de artículos dentro de una carpeta y verificación visual en el árbol y en la vista de carpeta.
- [x] 4.2 Ejecutar suite completa de tests (`npm test` y `npx playwright test`) y verificar compilación de producción con `npm run build`.

