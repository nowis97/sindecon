# Propuesta: Sesión Persistente y Renovación Silenciosa de Google Drive

## Why

Actualmente, cuando el usuario inicia sesión en Google Drive para sincronizar su cuaderno médico, Google entrega un Access Token válido solo por 60 minutos. Al expirar el tiempo o reabrir SINDECON más tarde, la aplicación borra el token y fuerza al usuario a volver a iniciar sesión manualmente en el modal. Se requiere mantener la sesión iniciada de manera indefinida mediante la técnica de Silent Token Refresh de Google Identity Services (GIS), renovando el token en segundo plano de forma transparente al abrir la aplicación o antes de que expire.

## What Changes

- **Estado de Conexión Persistente (cuaderno-gdrive-enabled)**: Se almacena una bandera persistente en localStorage indicando que el usuario autorizó la sincronización con Google Drive, preservando el correo asociado incluso si el Access Token temporal expira.
- **Auto-Reconexión Silenciosa al Iniciar la App**: Al arrancar SINDECON o al recuperar el foco (isibilitychange), si la sincronización está habilitada y el token expiró, la aplicación ejecuta automáticamente client.requestAccessToken({ prompt: '' }) para obtener un nuevo Access Token en segundo plano sin abrir ventanas emergentes ni requerir clics.
- **Refresco Proactivo en Segundo Plano**: Un temporizador periódico renovará el token de forma silenciosa cada 45-50 minutos mientras la aplicación esté en uso para evitar interrupciones de sincronización.
- **Manejo Robusto de Errores y Desconexión Explícita**: Si el usuario revoca permisos en su cuenta de Google, la interfaz solicita reconectar con un mensaje claro. La sesión solo se olvida completamente si el usuario hace clic expresamente en " Desconectar cuenta\.

## Capabilities

### Modified Capabilities
- data-portability: Formalizar el requerimiento de sincronización en la nube con sesión persistente y renovación silenciosa de credenciales en Google Drive.

## Impact

- **Código**: pp/src/pwa/googleDrive.ts y pp/src/hooks/useGoogleSync.ts.
- **UI/Modales**: GoogleDriveModal.tsx y SyncIndicator.tsx.
- **Pruebas**: Pruebas unitarias de sincronización y build de producción.
