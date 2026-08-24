# Design: Sincronización Automática con Google Drive

## Arquitectura y Protocolo

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE SINCRONIZACIÓN                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   1. Autenticación:                                                    │
│      Google Identity Services (GIS) Token Client                       │
│      Scope: 'https://www.googleapis.com/auth/drive.appdata'            │
│                                                                        │
│   2. Chequeo Ultraliviano:                                             │
│      GET https://www.googleapis.com/drive/v3/files                     │
│      ?spaces=appDataFolder&q=name='sync-manifest.json'                 │
│      -> Compara `remoteTimestamp` vs `lastLocalSyncTimestamp`          │
│                                                                        │
│   3. Si Remoto > Local:                                                │
│      GET 'cuaderno-backup.zip' desde appDataFolder                     │
│      -> importFromZip(blob) -> merge.ts -> Actualiza IndexedDB         │
│                                                                        │
│   4. Si Local > Remoto:                                                │
│      exportToZip() -> PUT 'cuaderno-backup.zip'                        │
│      PUT 'sync-manifest.json' con timestamp actualizado                │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Componentes

1. **Cliente Google Drive (`googleDrive.ts`):**
   - Manejo de token OAuth mediante `google.accounts.oauth2.initTokenClient`.
   - Operaciones REST sobre Google Drive API v3 (`files.list`, `files.create`, `files.get`, `files.update`) dirigidas a `spaces: ['appDataFolder']`.

2. **Motor de Sincronización (`syncEngine.ts`):**
   - Manejo de estados: `'idle' | 'checking' | 'syncing' | 'offline' | 'error'`.
   - Coordinación de la lógica de comparación de timestamps, exportación de zip y aplicación de merge.
   - Sincronización periódica / disparada por eventos: al cargar la página (`window.onload`), al recuperar foco (`visibilitychange`), o por llamada manual del usuario.

3. **Interfaz de Usuario:**
   - **`SyncIndicator.tsx`:** Botón/chip con indicador de estado (verde, amarillo, blanco, rojo) y fecha de última sincronización.
   - **`GoogleDriveModal.tsx`:** Modal para iniciar sesión con Google, ver estado de la conexión, forzar sincronización manual o desconectar la cuenta.
   - Integración en `PortabilityBar.tsx`, cabecera desktop y barra inferior móvil.
