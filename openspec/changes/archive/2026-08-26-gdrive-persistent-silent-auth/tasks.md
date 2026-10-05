## 1. Persistencia y Renovación Silenciosa de Tokens en Google Drive

- [x] 1.1 Implementar funciones de estado persistente (isGoogleSyncEnabled, setGoogleSyncEnabled, isTokenExpired) en pp/src/pwa/googleDrive.ts sin borrar el email ni la bandera de sincronización al expirar el token temporal.
- [x] 1.2 Implementar función equestSilentAccessToken con Google Identity Services (prompt: '') en pp/src/pwa/googleDrive.ts.
- [x] 1.3 Actualizar el hook useGoogleSync en pp/src/hooks/useGoogleSync.ts para auto-reconectar silenciosamente al montar el hook y al detectar foco/visibilidad con token expirado.
- [x] 1.4 Agregar temporizador de refresco proactivo periódico cada 45-50 minutos en useGoogleSync.ts para renovar el token antes de su caducidad.

## 2. Validación y Pruebas

- [x] 2.1 Ejecutar suite de pruebas automatizadas (
pm test) y verificar que todos los tests pasen sin fallos.
- [x] 2.2 Ejecutar compilación de producción (
pm run build) para verificar bundle PWA limpio.
