# data-portability (Delta Spec: Sincronización con Google Drive)

## MODIFIED REQUIREMENTS

### REQ-DP-003: Sincronización en la Nube Personal (Google Drive)
El sistema DEBE permitir sincronizar la base de datos completa con la carpeta privada `appDataFolder` de Google Drive del usuario.

#### Scenario: Autenticación y vinculación de cuenta
- **GIVEN** que el usuario hace click en "Conectar Google Drive"
- **WHEN** autoriza el acceso restringido a la carpeta de aplicación (`drive.appdata`) mediante Google Identity Services
- **THEN** el sistema DEBE registrar el token de acceso, actualizar el estado a "Conectado" y realizar una sincronización inicial.

#### Scenario: Sincronización automática de cambios
- **GIVEN** que la app está conectada a Google Drive y el usuario realiza modificaciones locales
- **WHEN** hay conexión a internet disponible
- **THEN** el sistema DEBE actualizar el archivo de respaldo `cuaderno-backup.zip` y `sync-manifest.json` en Google Drive sin bloquear la interfaz.

#### Scenario: Fusión de cambios remotos al abrir la aplicación
- **GIVEN** que se realizaron cambios en el celular y posteriormente se abre la aplicación en la PC
- **WHEN** la aplicación consulta el manifiesto en Google Drive y detecta un timestamp superior al local
- **THEN** el sistema DEBE descargar el snapshot remoto, ejecutar la fusión no destructiva mediante `merge.ts` y refrescar el árbol de artículos en tiempo real.

#### Scenario: Funcionamiento sin conexión (Offline-First)
- **GIVEN** que el dispositivo no tiene acceso a internet o no está conectado a Google Drive
- **WHEN** el usuario crea, edita o elimina notas
- **THEN** todas las operaciones DEBEN guardarse en IndexedDB de inmediato con estado "Pendiente de sincronizar".
