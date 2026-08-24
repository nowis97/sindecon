# Propuesta: Sincronización Automática con Google Drive (Nube Personal Local-First)

## Why

El Cuaderno Médico Personal (`sindecon`) está concebido como una aplicación *Local-First*: funciona al 100% sin conexión a internet en hospitales y guardias utilizando IndexedDB en el dispositivo. Sin embargo, los usuarios utilizan múltiples dispositivos (smartphone para notas rápidas en planta, laptop/PC para estudio y redacción extensa de protocolos, y tablet para lectura).

Actualmente, para mover información entre el celular y la PC, el usuario debe exportar manualmente un archivo `.zip` e importarlo en el otro dispositivo. Esta propuesta introduce **sincronización en la nube personal del usuario mediante Google Drive (AppData Folder)**, logrando que los cambios viajen de forma transparente entre dispositivos sin necesidad de servidores propietarios ni costos de infraestructura, manteniendo la soberanía total de los datos en la cuenta de Google del usuario.

## What Changes

- **Autenticación con Google Identity Services (GIS):**
  - Botón "Conectar con Google Drive" mediante OAuth 2.0 Token Client (alcance seguro y restringido `https://www.googleapis.com/auth/drive.appdata`).
  - Almacenamiento local del token de sesión en `localStorage` / `sessionStorage` para reconexión rápida.
- **Almacenamiento en Espacio Privado `drive.appdata`:**
  - Los respaldos sincronizados se guardan en la carpeta oculta de aplicación de Google Drive (`appDataFolder`), evitando mezclar archivos médicos con las carpetas personales de Drive del usuario.
  - Guarda `cuaderno-backup.zip` y un manifiesto liviano `sync-manifest.json` con timestamp y hash de versión para verificaciones ultrarrápidas sin descargar todo el archivo si no hay cambios.
- **Motor de Sincronización Bidireccional (`syncEngine.ts`):**
  - Comprobación automática al iniciar la app o recuperar conexión a internet:
    - Si la versión en la nube es más reciente que la local: descarga el snapshot y aplica el algoritmo de fusión (`importFromZip` + `merge.ts`).
    - Si la versión local contiene modificaciones no sincronizadas: genera snapshot y lo sube a Google Drive con debounce.
  - Botón manual "Sincronizar ahora" para forzar sincronización a demanda.
- **Indicador Visual de Estado de Sync (`SyncIndicator.tsx`):**
  - Icono de estado en la cabecera (PC) y barra inferior (móvil):
    - 🟢 **Sincronizado** (Al día con Google Drive).
    - 🟡 **Sincronizando…** (Subiendo o descargando cambios).
    - ⚪ **Sin conexión / Offline** (Los cambios se guardan localmente).
    - 🔴 **Desconectado / Error de autenticación**.
- **Panel de Configuración de Nube:**
  - Ver cuenta de Google conectada, fecha/hora de la última sincronización y botón para "Desconectar cuenta".

## Capabilities

### New Capabilities
- `cloud-sync`: Capacidad de sincronización y respaldo bidireccional automático contra la carpeta privada `appDataFolder` de Google Drive.

### Modified Capabilities
- `data-portability`: Extensión de la barra de portabilidad para incorporar el estado de la nube y sincronización manual/automática en adición a la exportación/importación local en disco.

## Impact
- **Código nuevo:** `src/pwa/googleDrive.ts`, `src/pwa/syncEngine.ts`, `src/components/portability/SyncIndicator.tsx`, `src/components/portability/GoogleDriveModal.tsx`.
- **Código modificado:** `src/components/portability/PortabilityBar.tsx`, `src/App.tsx`, `src/index.css`.
- **Pruebas:** Cobertura de tests unitarios para `syncEngine.ts` y simulación de flujos de sincronización y resolución de conflictos.
