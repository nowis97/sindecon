## 1. Modelo de Datos y Utilidades de Google Drive

- [x] 1.1 Extender la interfaz AiConfig con updated_at?: number en pp/src/db/db.ts y pp/src/db/flashcards.ts, asegurando que saveAiConfig asigne updated_at: Date.now() y verificar compilación TypeScript.
- [x] 1.2 Implementar en pp/src/pwa/googleDrive.ts las funciones etchAiConfigFromDrive(token) y uploadAiConfigToDrive(token, config) para gestionar i-config.json en ppDataFolder y verificar su tipado.

## 2. Integración en el Motor de Sincronización

- [x] 2.1 Actualizar pp/src/pwa/syncEngine.ts para que performGoogleDriveSync descargue i-config.json si el remoto es más reciente que el local o si el local está vacío, y suba el local si tiene cambios más recientes, verificando la lógica con tests unitarios.

## 3. Integración Reactiva en UI

- [x] 3.1 Actualizar pp/src/components/settings/AiSettingsModal.tsx para que al guardar configuración invoque la subida inmediata a Google Drive si isGoogleSyncEnabled() y existe token activo, verificando feedback visual de guardado.

## 4. Tests y Verificación

- [x] 4.1 Añadir pruebas unitarias en pp/src/pwa/syncEngine.test.ts que validen la sincronización bidireccional y resolución de conflictos de i-config.json y verificar que pasen con 
pm test.
- [x] 4.2 Añadir test E2E en Playwright en pp/e2e/flashcards.spec.ts que valide el guardado y sincronización de API Key con Google Drive mockeado.
- [x] 4.3 Ejecutar toda la suite de tests (
pm test y 
px playwright test) y verificar que todos los tests pasen limpiamente.
