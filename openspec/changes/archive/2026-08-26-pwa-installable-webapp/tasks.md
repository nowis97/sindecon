## 1. Hook y Lógica de Instalación PWA

- [x] 1.1 Crear el hook usePwaInstall en pp/src/hooks/usePwaInstall.ts con soporte de eforeinstallprompt, detección de modo standalone y soporte iOS.
- [x] 1.2 Actualizar metadatos PWA en pp/index.html (apple-touch-icon, theme-color, meta tags) y pp/vite.config.ts (manifest enriquecido).

## 2. Componentes de UI e Integración

- [x] 2.1 Crear componente IosInstallModal.tsx en pp/src/components/portability/ con guía visual paso a paso para iOS Safari.
- [x] 2.2 Integrar botón de instalación en la barra lateral (Sidebar / App.tsx) y tarjeta en HomeDashboard.tsx (Dashboard.tsx).
- [x] 2.3 Añadir estilos para el botón y modal de instalación en pp/src/index.css.

## 3. Validación y Pruebas

- [x] 3.1 Ejecutar suite de pruebas automatizadas (
pm test) y verificar que todos los tests pasen.
- [x] 3.2 Ejecutar compilación de producción (
pm run build) para verificar bundle PWA y service worker.
