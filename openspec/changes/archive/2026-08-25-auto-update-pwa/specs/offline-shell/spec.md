## MODIFIED Requirements

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
