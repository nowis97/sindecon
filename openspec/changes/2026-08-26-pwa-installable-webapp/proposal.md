# Propuesta: Webapp Instalable (PWA con Prompt Nativo y Metadatos Completos)

## Why

SINDECON es una base de conocimientos médicos offline-first diseñada para utilizarse en guardias, consultas y plantas hospitalarias. Para ofrecer la mejor experiencia como aplicación de escritorio y móvil autónoma (a pantalla completa, con icono dedicado y sin barras del navegador), se requiere habilitar el flujo completo de instalación PWA: captura del evento eforeinstallprompt, botón de instalación directo en la barra lateral y dashboard, guía amigable para dispositivos iOS/Safari y metadatos completos de manifest y cabeceras.

## What Changes

- **Hook de Instalación PWA (usePwaInstall)**:
  - Escucha y captura el evento eforeinstallprompt en navegadores compatibles (Chrome, Edge, Android, Opera).
  - Expone el estado canInstall, isInstalled y la función installApp().
  - Detecta si el usuario está en iOS/Safari para ofrecer la guía contextual de instalación ( Compartir ⎋ -> Añadir a inicio ➕).
- **Botón y CTA de Instalación en la UI**:
  - Botón visible 📲 Instalar App en la barra lateral (Sidebar) y en el Dashboard de inicio cuando la app no esté instalada en modo standalone.
  - Modal o tooltip explicativo con instrucciones sencillas para plataformas donde la instalación es manual (ej. iOS).
- **Metadatos y Manifest Completos**:
  - Actualización de ite.config.ts (VitePWA manifest) con metadatos enriquecidos: nombre oficial SINDECON — Cuaderno Médico, short_name: SINDECON, display: standalone, categories: [medical, productivity, education], orientation: any, id: / y scope: /.
  - Actualización de index.html con etiquetas pple-touch-icon, 	heme-color, pple-mobile-web-app-capable, pple-mobile-web-app-status-bar-style y pple-mobile-web-app-title.

## Capabilities

### Modified Capabilities
- offline-shell: Reforzar el requerimiento de instalabilidad PWA con captura de eforeinstallprompt, botón en la interfaz y soporte multi-plataforma.

## Impact

- **Código**: pp/vite.config.ts, pp/index.html, pp/src/hooks/usePwaInstall.ts, pp/src/App.tsx, pp/src/components/dashboard/HomeDashboard.tsx y pp/src/index.css.
- **Experiencia de Usuario**: Permite a los profesionales de la salud instalar la app en 1 clic tanto en PC como en sus teléfonos móviles.
