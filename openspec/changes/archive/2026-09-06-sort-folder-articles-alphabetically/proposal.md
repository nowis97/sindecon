## Why

En bases de conocimiento médico con decenas de artículos dentro de una especialidad o subcarpeta (por ejemplo, listas de fármacos en *Farmacología*, patologías en *Infectología* o fichas clínicas importadas masivamente), el ordenamiento manual o por orden de creación puede dificultar la localización visual rápida. 

Los profesionales médicos necesitan poder organizar los artículos de cualquier carpeta en orden alfabético (A-Z / Z-A) de forma opcional y flexible, tanto mediante visualización dinámica en la vista de carpeta como aplicando el reordenamiento permanente a la estructura del árbol en IndexedDB.

## What Changes

- **Ordenamiento Alfabético Persistente (One-Click)**:
  - Nueva función en capa de dominio/DB (`sortFolderChildrenAlphabetically`) que reordena los nodos hijos de una carpeta actualizando sus campos `order` atómicamente en IndexedDB.
  - Opción en el menú contextual (`···`) de cada carpeta en `TreeView.tsx`: *"🔤 Ordenar alfabéticamente (A-Z)"*.
  - Botón de acción en la cabecera de `FolderExplorerView.tsx`: *"🔤 Ordenar A-Z"*.
- **Control de Ordenamiento en Vista de Explorador de Carpeta**:
  - Selector en `FolderExplorerView.tsx` para alternar la visualización entre:
    - *Orden manual / personalizado* (orden por defecto del árbol).
    - *Alfabético A-Z*.
    - *Alfabético Z-A*.
    - *Más recientes* (por `updated_at`).
- **Respeto a subcarpetas y artículos**:
  - Las subcarpetas y los artículos se ordenan alfabéticamente de manera natural usando `Intl.Collator` o `localeCompare` en español con soporte numérico y de acentos (ej. "Ácido" junto a "Aciclovir").

## Capabilities

### Modified Capabilities
- `knowledge-tree`: Incorpora el requisito de ordenamiento alfabético opcional de nodos hijos dentro de cualquier carpeta (tanto persistente en la estructura como dinámico en la vista de carpeta).

## Impact

- **Capa de Dominio & Base de Datos**: `app/src/domain/tree.ts` y `app/src/db/nodes.ts` (nueva función `sortChildrenInFolder`).
- **Componentes de Interfaz**: `app/src/components/tree/TreeView.tsx` (menú contextual) y `app/src/components/tree/FolderExplorerView.tsx` (controles de orden y acción de ordenamiento).
- **Pruebas**: Nuevos tests unitarios en `tree.test.ts` / `nodes.test.ts` y prueba E2E en Playwright (`app/e2e/vital.spec.ts`).
