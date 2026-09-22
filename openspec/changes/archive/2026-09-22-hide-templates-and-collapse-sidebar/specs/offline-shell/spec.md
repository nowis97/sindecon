## ADDED Requirements

### Requirement: Barra lateral colapsable en escritorio
El sistema SHALL permitir colapsar y expandir la barra lateral en vistas de escritorio y tablet mediante un botón en la cabecera de la barra lateral, un control de reapertura accesible cuando está colapsada y el atajo de teclado `Ctrl+B` (o `Cmd+B` en macOS). El estado de colapso SHALL persistir en el almacenamiento local del navegador para conservarse entre recargas. Al colapsarse la barra lateral, el contenedor de contenido principal SHALL expandirse al 100% del ancho disponible para optimizar el espacio de lectura y edición.

#### Scenario: Colapsar barra lateral en escritorio
- **WHEN** el usuario pulsa el botón de colapso en la cabecera de la barra lateral o presiona `Ctrl+B` en una pantalla de escritorio
- **THEN** la barra lateral se oculta hacia la izquierda con una transición suave y el área de contenido principal se expande horizontalmente

#### Scenario: Expandir barra lateral colapsada
- **WHEN** la barra lateral está colapsada y el usuario pulsa el botón de reapertura o presiona `Ctrl+B`
- **THEN** la barra lateral vuelve a desplegarse con su ancho estándar de navegación

#### Scenario: Persistencia del estado de la barra lateral
- **WHEN** el usuario colapsa la barra lateral y recarga la página o reabre la PWA en escritorio
- **THEN** la aplicación inicia con la barra lateral colapsada según la última preferencia guardada
