## 1. Corrección de Drag and Drop en Desktop

- [x] 1.1 Agregar regla .tree-view.is-dragging .tree-row * { pointer-events: none; } en pp/src/index.css y la clase condicional .is-dragging en TreeView.tsx.
- [x] 1.2 Actualizar TreeView.tsx para simplificar la detección de destino en carpetas (inside), eliminar interceptores en .tree-children-inner y asegurar la ejecución de onMoveNodeDirect.
- [x] 1.3 Asegurar que canMove en pp/src/domain/tree.ts valide correctamente destinos nulos o de carpeta.

## 2. Validación y Pruebas

- [x] 2.1 Ejecutar suite de pruebas automatizadas (
pm test) y verificar que todos los tests pasen.
- [x] 2.2 Ejecutar compilación de producción (
pm run build).
- [x] 2.3 Validar mediante Chrome DevTools en vivo que mover artículos y carpetas funciona sin interrupciones.
