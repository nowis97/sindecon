## Why

Actualmente, cuando un usuario configura su API Key y modelo de IA en AiSettingsModal, estos ajustes se almacenan únicamente en el almacenamiento local IndexedDB (db.meta). Al abrir SINDECON en otro dispositivo (por ejemplo, desde el móvil o en otra computadora) o al restaurar la sesión mediante Google Drive, las notas y flashcards se sincronizan de inmediato, pero la configuración de IA se pierde y debe reingresarse manualmente.

Esta propuesta permite persistir y sincronizar automáticamente la configuración de IA (provider, apiKey, modelName) a través del espacio privado y seguro appDataFolder de Google Drive, ofreciendo una experiencia fluida, continua y sin fricción entre múltiples dispositivos.

## What Changes

- **Sincronización de ai-config.json en Google Drive**:
  - Almacenamiento del archivo de configuración ai-config.json en el espacio privado appDataFolder de Google Drive.
  - Carga y actualización automática bidireccional durante el ciclo de sincronización de syncEngine.
- **Actualización reactiva al guardar configuración**:
  - Si Google Drive está conectado y el usuario guarda cambios en AiSettingsModal, se sincroniza/sube inmediatamente ai-config.json a Google Drive.
- **Carga inicial transparente**:
  - Al iniciar sesión con Google Drive en un dispositivo nuevo o limpio, si no existe API key local pero sí existe en Google Drive, se descarga y se aplica a db.meta automáticamente.
- **Persistencia local resiliente**:
  - Si el usuario desconecta Google Drive, la configuración local de IA se preserva intacta en el dispositivo.
- **Aislamiento de backups manuales**:
  - Las exportaciones manuales a archivo .zip (exportToZip) se mantienen limpias sin incluir claves privadas de API, evitando fugas accidentales al compartir apuntes.

## Capabilities

### Modified Capabilities
- \data-portability\: Se añade el requisito de persistencia y sincronización segura de configuración de IA a través de appDataFolder de Google Drive.

## Impact

- **Código afectado**:
  - app/src/pwa/syncEngine.ts: Detección, descarga y subida de ai-config.json en el ciclo de sincronización.
  - app/src/pwa/googleDrive.ts: Funciones auxiliares para gestionar ai-config.json en appDataFolder.
  - app/src/components/settings/AiSettingsModal.tsx: Disparo de sincronización inmediata al guardar configuración si Drive está conectado.
  - app/src/db/flashcards.ts / app/src/db/db.ts: Estructura enriquecida con updated_at en AiConfig.
  - app/e2e/flashcards.spec.ts / app/e2e/vital.spec.ts: Tests E2E de sincronización de configuración de IA.
- **Dependencias**: Ninguna nueva dependencia externa requerida.
