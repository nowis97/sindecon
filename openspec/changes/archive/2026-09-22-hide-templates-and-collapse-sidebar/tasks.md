## 1. Visibilidad de Carpeta de Plantillas

- [x] 1.1 Añadir estado reactivo `showTemplatesFolder` en `App.tsx` con persistencia en `localStorage` y botón de alternancia en la barra de herramientas del sidebar.
- [x] 1.2 Implementar filtrado en `TreeView.tsx` para excluir la carpeta del sistema "Plantillas" del árbol cuando `showTemplatesFolder` esté desactivado, verificando que el selector "+ desde plantilla" se mantenga operativo.
- [x] 1.3 Añadir pruebas unitarias en `src/domain/tree.test.ts` que validen la lógica de filtrado de carpetas protegidas en el árbol.

## 2. Colapso de Barra Lateral en Escritorio

- [x] 2.1 Implementar estado `desktopSidebarCollapsed` en `App.tsx` con persistencia en `localStorage`, botón de colapso en la cabecera del sidebar y botón de reapertura cuando esté colapsada.
- [x] 2.2 Configurar atajo de teclado global `Ctrl+B` / `Cmd+B` en `App.tsx`, previniendo interferencias con el formato de negrita dentro del editor de artículos.
- [x] 2.3 Agregar estilos CSS en `index.css` para el estado `.desktop-sidebar-collapsed` con transiciones suaves y expansión de `.content` a ancho completo.

## 3. Verificación Integral

- [x] 3.1 Ejecutar la suite completa de pruebas con `npm test` y verificar la compilación TypeScript con `npm run build`.
