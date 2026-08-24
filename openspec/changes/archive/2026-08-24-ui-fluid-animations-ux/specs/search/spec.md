## ADDED Requirements

### Requirement: Entrada fluida y navegación cinematográfica en Command Palette
El sistema SHALL presentar la paleta de comandos global (Ctrl+K) con transiciones suaves de entrada modal y navegación interactiva por teclado.

#### Scenario: Apertura fluida de la paleta de comandos
- **WHEN** el usuario pulsa el atajo `Ctrl+K` o el botón de comandos en la cabecera
- **THEN** la paleta emerge con una animación elástica de escala y desplazamiento vertical, enfocando de inmediato el campo de búsqueda

#### Scenario: Selección suave de resultados con teclado
- **WHEN** el usuario pulsa las flechas `↑` o `↓` para recorrer las acciones o artículos encontrados
- **THEN** el elemento activo se resalta con una transición fluida y realiza autoscroll suave dentro de la lista
