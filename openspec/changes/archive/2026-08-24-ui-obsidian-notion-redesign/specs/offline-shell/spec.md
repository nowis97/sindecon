## ADDED Requirements

### Requirement: Tema visual moderno estilo Obsidian y Notion
El sistema DEBE aplicar una jerarquía visual de alto contraste y densidad limpia con paleta Obsidian Dark (`#0f141c`) y Notion Light (`#ffffff`), con bordes translúcidos de 1px, tipografía sans-serif legible y compatibilidad con pantallas OLED y móviles.

#### Scenario: Alternar tema con persistencia y contraste correcto
- **WHEN** el usuario alterna entre modo claro y oscuro
- **THEN** todas las superficies, tarjetas, inputs de tags y modales adaptan sus colores de fondo y texto sin pérdida de contraste

### Requirement: Floating Dock de navegación móvil con Glassmorphism
El sistema DEBE proveer en dispositivos móviles una barra inferior translúcida con desenfoque de cristal (`backdrop-filter: blur(16px)`), botón central flotante para captura rápida y accesos directos a Temas, Favoritos, Inbox y Sincronización.

#### Scenario: Navegar mediante el dock móvil
- **WHEN** el usuario interactúa con la barra inferior en un dispositivo móvil
- **THEN** el sistema navega instantáneamente a la sección seleccionada con respuesta visual activa
