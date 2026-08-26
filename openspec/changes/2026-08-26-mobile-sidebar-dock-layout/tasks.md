## 1. Estilos y Capas del Shell Móvil

- [x] 1.1 Configurar en pp/src/index.css el dimensionamiento de .sidebar en @media (max-width: 768px) con 	op: 0, ottom: calc(64px + env(safe-area-inset-bottom, 0px)) y z-index: 35, y verificar que el contenedor del árbol aproveche la altura completa.
- [x] 1.2 Configurar en pp/src/index.css el z-index: 30 para .sidebar-backdrop y confirmar que mobile-bottom-bar permanezca en z-index: 40.

## 2. Validación y Pruebas

- [x] 2.1 Ejecutar suite de tests automatizados (
pm test) y verificar que los 12 archivos de prueba y 73 tests pasen sin fallos.
- [x] 2.2 Ejecutar compilación de producción (
pm run build) para verificar bundle PWA limpio.
