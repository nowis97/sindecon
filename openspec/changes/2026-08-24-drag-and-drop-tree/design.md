# Design Document: Drag and Drop en TreeView

## Contexto y Arquitectura
El componente `TreeView` (`app/src/components/tree/TreeView.tsx`) renderiza recursivamente la jerarquía de `NodeRow[]`.
La base de datos Dexie implementa `moveNode(id, newParentId)` en `app/src/db/nodes.ts`, la cual utiliza `canMove(allNodes, id, newParentId)` de `app/src/domain/tree.ts` para garantizar que ningún nodo se mueva dentro de sí mismo o de su propia descendencia.

## Diseño de la Interacción Drag and Drop
1. **Drag Source**:
   - `draggable={true}` en cada `.tree-row`.
   - `onDragStart`: Asigna `e.dataTransfer.setData('text/plain', node.id)` y `draggedNodeId = node.id`.
   - `onDragEnd`: Limpia `draggedNodeId = null` y `dragOverFolderId = null`.

2. **Drop Target (Carpetas)**:
   - `onDragOver`: Si `node.kind === 'folder'` y `canMove(nodes, draggedNodeId, node.id)` es verdadero, `e.preventDefault()` y `setDragOverFolderId(node.id)`.
   - `onDragLeave`: Si sale de la carpeta, limpia `dragOverFolderId`.
   - `onDrop`: Ejecuta `onMoveNodeDirect(draggedId, node.id)`.

3. **Auto-Expand Timer**:
   - Al hacer dragover sobre una carpeta colapsada, se inicia un `setTimeout(600ms)` para expandir la carpeta.

4. **Zona de Soltado a la Raíz**:
   - Un área de soltado en la parte inferior del árbol permite mover elementos al nivel raíz (`parent_id = null`).
