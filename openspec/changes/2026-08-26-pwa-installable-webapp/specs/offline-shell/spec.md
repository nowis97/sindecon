## MODIFIED Requirements

### Requirement: Instalable como PWA

El sistema SHALL ser instalable como aplicación (manifest + iconos) tanto en escritorio como en móvil, desde el navegador, sin pasar por tiendas de aplicaciones, ofreciendo un botón de instalación en la interfaz ( 📲 Instalar App), capturando el evento nativo eforeinstallprompt y proporcionando instrucciones visuales para entornos que requieren instalación manual como iOS Safari.

#### Scenario: Instalar en el teléfono
- **WHEN** el usuario abre la app en el navegador del móvil y elige \Añadir a pantalla de inicio\
- **THEN** la app queda instalada con su icono y abre a pantalla completa sin la barra del navegador

#### Scenario: Instalación directa mediante prompt del navegador en Desktop y Android
- **WHEN** el usuario hace clic en el botón \📲 Instalar App\ en un navegador compatible con eforeinstallprompt
- **THEN** el sistema dispara el prompt nativo de instalación del navegador
- **AND** tras la aceptación, la aplicación queda instalada con icono propio y se ejecuta en modo standalone a pantalla completa

#### Scenario: Instalación guiada en iOS Safari
- **WHEN** el usuario pulsa en \📲 Instalar App\ desde Safari en iOS
- **THEN** la aplicación muestra un modal o tooltip con pasos claros: \Toca Compartir ⎋ y selecciona Añadir a pantalla de inicio ➕\

#### Scenario: Detección de aplicación ya instalada
- **WHEN** la aplicación se abre en modo standalone (display-mode: standalone) o tras haberse instalado
- **THEN** el botón de instalación se oculta automáticamente para mantener la interfaz limpia
