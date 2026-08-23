# offline-shell (Delta Spec: Modo Oscuro y Navegación Móvil)

## MODIFIED REQUIREMENTS

### REQ-OS-003: Ergonomía Móvil y Barra Inferior
El sistema DEBE proveer navegación inferior accesible con el pulgar en pantallas de ancho reducido.

#### Scenario: Visualización y uso de la barra inferior móvil
- **GIVEN** que la aplicación se ejecuta en una pantalla de resolución móvil (< 768px)
- **WHEN** el usuario navega por la app
- **THEN** DEBE mostrarse una barra inferior fija con botones para Temas, Buscar, Captura Rápida central, Inbox con badge y cambio de Tema.

### REQ-OS-004: Modo Oscuro / Claro
El sistema DEBE permitir alternar entre Modo Claro y Modo Oscuro y recordar la preferencia.

#### Scenario: Persistencia del tema elegido
- **GIVEN** que el usuario pulsa el botón de alternancia de tema 🌓
- **WHEN** se recarga la aplicación o se abre en sesiones posteriores
- **THEN** el sistema DEBE aplicar de inmediato el tema seleccionado guardado en `localStorage`.
