## Purpose

Que la aplicación funcione por completo sin conexión y se instale como una app en PC y móvil desde el navegador, protegiendo los datos locales contra limpiezas del navegador.

## Requirements

### Requirement: Instalable como PWA

El sistema SHALL ser instalable como aplicación (manifest + iconos) tanto en escritorio como en móvil, desde el navegador, sin pasar por tiendas de aplicaciones.

#### Scenario: Instalar en el teléfono

- **WHEN** el usuario abre la app en el navegador del móvil y elige "Añadir a pantalla de inicio"
- **THEN** la app queda instalada con su icono y abre a pantalla completa sin la barra del navegador

### Requirement: Funcionamiento offline total

El sistema SHALL funcionar por completo sin conexión tras la primera carga: navegación del árbol, lectura, edición, búsqueda, plantillas, imágenes y renderizado de esquemas mermaid. Los recursos cargados bajo demanda (p.ej. mermaid) SHALL quedar cacheados tras su primer uso.

#### Scenario: Consulta en sótano sin señal

- **WHEN** el usuario abre la app instalada sin conexión y busca un artículo con esquema mermaid
- **THEN** la búsqueda funciona y el artículo se muestra con su esquema renderizado

#### Scenario: Edición offline

- **WHEN** el usuario edita un artículo estando offline y recarga la app
- **THEN** los cambios persisten

### Requirement: Almacenamiento persistente

El sistema SHALL solicitar al navegador almacenamiento persistente en el primer arranque, para proteger la base de conocimiento contra la expulsión automática de datos bajo presión de espacio. Si el navegador lo deniega, el sistema SHALL advertir al usuario y recomendar exportar backups con regularidad.

#### Scenario: Concesión de persistencia

- **WHEN** el usuario abre la app por primera vez en un navegador compatible
- **THEN** la app solicita almacenamiento persistente y registra el resultado

#### Scenario: Persistencia denegada

- **WHEN** el navegador deniega o no soporta almacenamiento persistente
- **THEN** la app muestra un aviso permanente y visible recomendando exportar backups

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

### Requirement: Protección de la interfaz mediante Error Boundary
El shell de la aplicación DEBE estar envuelto en un Error Boundary que prevenga caídas globales de la aplicación y preserve el estado de navegación y datos en caso de errores en subárboles de componentes.

#### Scenario: Recuperación ante fallo de interfaz
- **WHEN** un componente de la interfaz lanza una excepción no controlada
- **THEN** la aplicación captura el error sin cerrar la app y permite al usuario reintentar el renderizado

### Requirement: Detección proactiva y aviso de nueva versión lista
El sistema SHALL detectar automáticamente nuevas versiones desplegadas en Cloudflare Pages mediante sondeo periódico y por eventos de foco/visibilidad, presentando un aviso Toast flotante no intrusivo que permita al usuario recargar la aplicación sin riesgo de perder datos ni interrumpir tareas clínicas en curso.

#### Scenario: Detección periódica en segundo plano
- **WHEN** la aplicación permanece abierta durante 3 minutos y se ha desplegado una nueva versión en el servidor
- **THEN** el Service Worker comprueba la existencia de una actualización en segundo plano sin bloquear la interfaz

#### Scenario: Detección al regresar a la pestaña o desbloquear dispositivo
- **WHEN** el usuario vuelve a la pestaña de la aplicación (`visibilitychange` a visible o evento `focus`)
- **THEN** el sistema dispara inmediatamente una verificación de actualización del Service Worker (`registration.update()`)

#### Scenario: Presentación de aviso flotante Toast
- **WHEN** un nuevo Service Worker ha terminado de descargarse e instalarse (`installed`/`waiting`)
- **THEN** la interfaz muestra un Toast flotante en la parte superior/inferior con el texto "✨ Nueva versión disponible" y un botón "Actualizar ahora"
- **AND** la aplicación no fuerza ninguna recarga automática destructiva mientras el usuario está escribiendo o navegando

#### Scenario: Aplicación de la actualización en un clic
- **WHEN** el usuario pulsa en el botón "Actualizar ahora" del Toast
- **THEN** el sistema envía la señal `SKIP_WAITING` al nuevo Service Worker y recarga la ventana (`window.location.reload()`) para montar la versión más reciente

### Requirement: Políticas estrictas de no-caché para descriptores PWA en Cloudflare Pages
El sistema SHALL disponer de una configuración de cabeceras HTTP (`public/_headers`) para Cloudflare Pages que prohíba de forma estricta el almacenamiento en caché de `/sw.js`, `/registerSW.js`, `/manifest.webmanifest` e `index.html`, asegurando que el navegador siempre consulte la versión viva del servidor.

#### Scenario: Solicitud de `sw.js` a Cloudflare Pages
- **WHEN** el navegador o el Service Worker solicita `/sw.js` o `index.html`
- **THEN** la respuesta incluye `Cache-Control: no-cache, no-store, must-revalidate`

#### Scenario: Solicitud de assets empaquetados
- **WHEN** el navegador solicita archivos estáticos bajo `/assets/*` con hash en el nombre
- **THEN** la respuesta incluye `Cache-Control: public, max-age=31536000, immutable`

