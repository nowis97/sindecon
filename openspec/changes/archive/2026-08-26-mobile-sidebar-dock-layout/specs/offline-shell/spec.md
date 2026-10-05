## MODIFIED Requirements

### Requirement: Transiciones de navegación y micro-interacciones del shell

El sistema SHALL presentar transiciones fluidas en la barra de navegación móvil, el drawer lateral y el cambio de temas (claro/oscuro), respetando las preferencias de accesibilidad del usuario. El drawer lateral en móvil SHALL posicionarse desde el borde superior de la pantalla cubriendo la cabecera superior y finalizar en el límite superior de la barra de navegación inferior dock, con scroll completo e independiente.

#### Scenario: Apertura fluida del drawer lateral en móvil

- **WHEN** el usuario pulsa el botón de menú o el botón de temas en la barra superior/inferior móvil
- **THEN** el drawer lateral se despliega desde la parte superior sobre la cabecera sin superponerse a la barra inferior flotante
- **AND** el fondo oscurecido aplica un desenfoque progresivo en la zona de contenido

#### Scenario: Cambio de tema visual sin saltos abruptos

- **WHEN** el usuario pulsa el botón de alternar tema (modo claro / modo oscuro)
- **THEN** la paleta de colores y los fondos de la interfaz realizan una transición suave de 200ms sin parpadeos

#### Scenario: Respeto a preferencias de movimiento reducido

- **WHEN** el sistema operativo o navegador tiene activada la opción prefers-reduced-motion: reduce
- **THEN** las transiciones cinéticas y animaciones complejas se desactivan o se reducen a desvanecimientos instantáneos

### Requirement: Floating Dock de navegación móvil con Glassmorphism
El sistema DEBE proveer en dispositivos móviles una barra inferior translúcida con desenfoque de cristal (ackdrop-filter: blur(16px)), botón central flotante para captura rápida y accesos directos a Temas, Favoritos, Inbox y Sincronización, manteniéndose siempre al frente en capa superior (z-index: 40) accesible con el pulgar.

#### Scenario: Navegar mediante el dock móvil
- **WHEN** el usuario interactúa con la barra inferior en un dispositivo móvil
- **THEN** el sistema navega instantáneamente a la sección seleccionada con respuesta visual activa

#### Scenario: Coexistencia con el menú lateral desplegado
- **WHEN** el drawer de temas está abierto en un dispositivo móvil
- **THEN** la barra de navegación inferior permanece visible y completamente funcional, sin tapar los nodos del árbol ni quedar oculta por el menú
