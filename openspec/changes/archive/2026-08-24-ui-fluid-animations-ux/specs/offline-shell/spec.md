## ADDED Requirements

### Requirement: Transiciones de navegación y micro-interacciones del shell
El sistema SHALL presentar transiciones fluidas en la barra de navegación móvil, el drawer lateral y el cambio de temas (claro/oscuro), respetando las preferencias de accesibilidad del usuario.

#### Scenario: Apertura fluida del drawer lateral en móvil
- **WHEN** el usuario pulsa el botón de menú o el botón de temas en la barra superior/inferior móvil
- **THEN** el drawer lateral se despliega con una transición de aceleración suave y el fondo oscurecido aplica un desenfoque progresivo

#### Scenario: Cambio de tema visual sin saltos abruptos
- **WHEN** el usuario pulsa el botón de alternar tema (modo claro / modo oscuro)
- **THEN** la paleta de colores y los fondos de la interfaz realizan una transición suave de 200ms sin parpadeos

#### Scenario: Respeto a preferencias de movimiento reducido
- **WHEN** el sistema operativo o navegador tiene activada la opción `prefers-reduced-motion: reduce`
- **THEN** las transiciones cinéticas y animaciones complejas se desactivan o se reducen a desvanecimientos instantáneos
