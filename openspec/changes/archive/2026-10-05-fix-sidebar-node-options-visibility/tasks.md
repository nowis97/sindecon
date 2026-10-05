# Tasks

## 1. Contención de Layout y Truncamiento de Nodos en CSS

- [x] 1.1 Configurar `min-width: 0; width: 100%;` en `.tree-children-accordion`, `.tree-children-inner` y `.tree-node-wrapper` en `app/src/index.css` para evitar la expansión intrínseca de CSS Grid. Verificar que el ancho de fila no exceda los 320px de la barra lateral.
- [x] 1.2 Asegurar que `.tree-row` aplique `box-sizing: border-box; width: 100%;` y que `.tree-title` trunque correctamente con elipsis (`text-overflow: ellipsis`) sin empujar `.tree-row-actions`. Verificar visualmente en el navegador con títulos largos.

## 2. Visibilidad Persistente y Estilos del Botón de Opciones

- [x] 2.1 Actualizar las reglas de `.btn-tree-row-menu` en `app/src/index.css` para que tenga visibilidad predeterminada en reposo (`opacity: 0.65` y color legible) en lugar de estar oculto con `opacity: 0`. Verificar que el botón `···` sea visible de inmediato sin requerir hover.
- [x] 2.2 Refinar los estados interactivos de `.btn-tree-row-menu` (`:hover`, `:focus-visible`, `.active`) asegurando opacidad `1`, contraste nítido y fondo sutil para usabilidad táctil y con teclado.
- [x] 2.3 Verificar que el menú contextual flotante (`.tree-context-menu`) se posicione adecuadamente y permanezca dentro de la pantalla al abrirse desde cualquier fila.

## 3. Verificación Automatizada y Validación con Chrome DevTools

- [x] 3.1 Ejecutar suite de pruebas unitarias (`npm run test` en `app/`) para comprobar que no existan regresiones en la manipulación del árbol y nodos.
- [x] 3.2 Inspeccionar y verificar mediante Chrome DevTools (captura de pantalla y métricas de elementos DOM) que las opciones `···` sean visibles en todas las carpetas y artículos, y que el menú contextual se despliegue y funcione al interactuar con él.
