# Diseño Técnico: Coexistencia de Menú Lateral Móvil y Barra Dock Inferior

## Context

En SINDECON, la interfaz móvil utiliza una barra superior (mobile-topbar), una barra de navegación inferior fija (mobile-bottom-bar) y un menú lateral desplegable (sidebar). Ver proposal.md para motivación y detalles del problema.

## Goals / Non-Goals

**Goals:**
- Desplegar el menú lateral móvil desde 	op: 0 hasta el borde superior de la barra dock inferior (ottom: calc(64px + env(safe-area-inset-bottom, 0px))).
- Mantener la barra inferior visible y utilizable en todo momento (z-index: 40) sin superponerse visualmente al contenido del árbol.
- Configurar el backdrop desenfocado (sidebar-backdrop) en z-index: 30 para oscurecer la cabecera superior y el área de contenido, permitiendo cerrar el menú al hacer tap fuera.
- Garantizar soporte de safe areas en dispositivos con barra de gestos (iOS / Android moderno).

**Non-Goals:**
- No alterar la distribución ni el comportamiento del sidebar en pantallas de escritorio (> 768px).
- No modificar la lógica de persistencia de nodos ni las acciones de creación.

## Decisions

### 1. Dimensionamiento y Capas del Menú Lateral Móvil

- **Propiedad ottom dinámica:**
  `css
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: calc(64px + env(safe-area-inset-bottom, 0px));
      height: auto;
      max-height: calc(100vh - 64px - env(safe-area-inset-bottom, 0px));
      z-index: 35;
      transform: translateX(-100%);
      box-shadow: var(--shadow-float);
      transition: transform var(--dur-sheet) var(--ease-spring);
    }
  }
  `
  *Alternativa considerada:* Darle ottom: 0 al sidebar con padding-bottom: 70px. Se descartó porque la barra dock translúcida dejaba ver texto y líneas de árbol por debajo con un efecto visual confuso. Al terminar exactamente en el borde superior del dock, la separación es limpia y profesional.

### 2. Jerarquía de Elevación (Z-Index Stack)

- mobile-bottom-bar: z-index: 40 (control táctil prioritario).
- sidebar: z-index: 35 (drawer sobre la cabecera y el fondo).
- sidebar-backdrop: z-index: 30 (pantalla de atenuación).
- mobile-topbar: z-index: 20 (cabecera base).

## Risks / Trade-offs

- **[Riesgo]** Variaciones de altura de viewport en navegadores móviles con barra de direcciones dinámica.
  → *Mitigación:* Uso de ottom: calc(64px + env(safe-area-inset-bottom, 0px)) combinado con position: fixed para anclarlo de manera sólida al viewport activo.
