# Propuesta: Layout Móvil con Menú Lateral sobre la Cabecera y Dock Inferior Fijo

## Why

En dispositivos móviles, cuando el usuario abre el menú lateral (drawer de temas y carpetas), el drawer actualmente se renderiza con un z-index inferior a la barra de navegación inferior (mobile-bottom-bar), lo que provoca que la barra inferior se superponga sobre el pie del menú y tape los últimos elementos del árbol de artículos. Además, el menú no aprovecha la altura superior completa sobre la cabecera. Se requiere que el menú lateral se despliegue desde la parte superior (cubriendo la cabecera) y termine exactamente donde inicia la barra inferior flotante, manteniéndola visible y accesible como control maestro de navegación táctil sin ocluir contenido.

## What Changes

- **Menú Lateral Móvil con Altura y Capa Optimizadas**: El menú lateral (.sidebar) en vistas móviles (max-width: 768px) se posiciona desde top: 0 hasta bottom: calc(64px + env(safe-area-inset-bottom, 0px)) con z-index: 35, cubriendo la barra superior móvil sin superponerse a la barra inferior dock.
- **Barra Inferior Dock Ininterrumpida**: La barra de navegación inferior (mobile-bottom-bar) permanece visible en z-index: 40 fija al pie de pantalla, permitiendo alternar temas, disparar búsqueda o captura rápida con una sola mano.
- **Backdrop y Foco Visual**: El fondo oscurecido (.sidebar-backdrop) se ajusta para cubrir el contenido principal y la cabecera detrás del menú, con z-index: 30, permitiendo cerrar el menú al tocar el área derecha.
- **Scroll Íntegro en Árbol de Carpetas**: El contenedor interno del árbol dentro del menú lateral mantiene un scroll limpio y completo, asegurando que todos los nodos, carpetas y acciones de portabilidad sean 100% visibles y accionables sin ser tapados por la barra dock.

## Capabilities

### Modified Capabilities
- offline-shell: Actualizar los requerimientos de layout y navegación móvil para definir la coexistencia entre el drawer lateral, la cabecera superior y el dock inferior flotante.

## Impact

- **CSS**: pp/src/index.css en las reglas @media (max-width: 768px) para .sidebar, .sidebar-backdrop, .mobile-topbar y .mobile-bottom-bar.
- **Componentes**: pp/src/App.tsx y pp/src/components/navigation/MobileBottomBar.tsx.
- **Pruebas y Build**: Pruebas unitarias de PWA/shell y build de producción.
