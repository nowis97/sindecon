## Context

Ver proposal.md para la motivación. Actualmente SINDECON utiliza googleDrive.ts y syncEngine.ts para sincronizar cuaderno-backup.zip y sync-manifest.json dentro del espacio privado ppDataFolder de Google Drive. La configuración de IA (AiConfig) se almacena en Dexie IndexedDB (db.meta, clave 'ai_config').

## Goals / Non-Goals

**Goals:**
- Sincronizar automáticamente la configuración de IA (provider, piKey, modelName, updated_at) mediante un archivo i-config.json en ppDataFolder.
- Si un usuario conecta Google Drive en un dispositivo nuevo o limpio, restaurar su clave de API y modelo sin requerir interacción manual.
- Si el usuario modifica su clave o modelo en AiSettingsModal, propagar los cambios inmediatamente a Google Drive si la sesión está activa.
- Preservar la clave de API local en IndexedDB al desconectar la cuenta de Google Drive.
- Mantener los backups manuales en archivo .zip (exportToZip) estrictamente libres de credenciales de API.

**Non-Goals:**
- No implementar gestión de contraseñas maestras o cifrado asimétrico adicional con PIN (las API Keys gratuitas se protegen a través del canal autenticado OAuth2 y el aislamiento de ppDataFolder de Google).
- No sincronizar claves a través de servidores o backends intermediarios propios (arquitectura 100% cliente y privada en Google Drive).

## Decisions

### 1. Archivo dedicado i-config.json en ppDataFolder
- **Decisión**: Guardar la configuración en un archivo i-config.json independiente en ppDataFolder en lugar de incrustarlo en cuaderno-backup.zip.
- **Razón**: Permite sincronizar y actualizar la clave de IA de forma ligera y reactiva (~1KB) sin tener que reempaquetar y resubir todo el archivo zip de notas e imágenes. Además, evita que las exportaciones manuales contengan la clave de API.
- **Alternativa descartada**: Incrustar i_config en cuaderno-backup.zip. Descartada porque mezclaría credenciales con notas médicas portables.

### 2. Estructura de AiConfig con marca temporal updated_at
- **Decisión**: Añadir updated_at: number a la interfaz AiConfig tanto en db.meta como en i-config.json.
- **Razón**: Permite la resolución de conflictos determinista basada en *Last-Write-Wins* (LWW) entre dispositivos.
- **Alternativa descartada**: Comparar solo si piKey está vacía o no. Descartada porque no permitiría actualizar una clave existente o cambiar de modelo en un dispositivo y que se refleje en los demás.

### 3. Sincronización proactiva en AiSettingsModal
- **Decisión**: Al guardar cambios en AiSettingsModal, si getStoredToken() está presente y no expirado, invocar uploadAiConfigToDrive(...) en segundo plano.
- **Razón**: Garantiza que los cambios de modelo o clave se reflejen de inmediato en la nube sin esperar al siguiente ciclo de sincronización periódica de notas.

## Risks / Trade-offs

- **[Riesgo] Clave de API almacenada en Google Drive**:
  - *Mitigación*: ppDataFolder es un espacio oculto y aislado por diseño de Google Drive API v3, inaccesible por el usuario en la interfaz web de Drive y solo accesible por la aplicación autorizada mediante el token OAuth2 drive.appdata.
- **[Riesgo] Dispositivo sin conexión (Offline)**:
  - *Mitigación*: db.meta sigue siendo la fuente de verdad local para la ejecución inmediata de llamadas a la IA. Las sincronizaciones fallidas por falta de red se reintentan en el siguiente ciclo online.
