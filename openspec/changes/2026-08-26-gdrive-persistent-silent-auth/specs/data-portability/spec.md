## ADDED Requirements

### Requirement: Sincronización persistente en Google Drive con Silent Token Refresh

El sistema SHALL mantener la sesión del usuario en Google Drive de forma persistente a través de reinicios y cierres de la aplicación, renovando automáticamente los Access Tokens expirados en segundo plano mediante Google Identity Services (GIS) sin interrumpir al usuario ni abrir ventanas emergentes cuando la cuenta ya ha sido autorizada previamente.

#### Scenario: Auto-reconexión silenciosa al abrir la aplicación
- **WHEN** el usuario abre SINDECON habiendo vinculado previamente su cuenta de Google Drive y el Access Token temporal ha caducado
- **THEN** el sistema solicita silenciosamente un nuevo Access Token (prompt: '') en segundo plano
- **AND** el estado de sincronización se actualiza automáticamente a conectado ( Al día) sin solicitar interacción manual

#### Scenario: Refresco proactivo en segundo plano
- **WHEN** la aplicación permanece abierta y el Access Token activo está próximo a expirar (después de 45-50 minutos)
- **THEN** el sistema renueva el Access Token de forma silenciosa para asegurar la continuidad de la sincronización automática

#### Scenario: Desconexión explícita por el usuario
- **WHEN** el usuario pulsa en Desconectar cuenta en el modal de Google Drive
- **THEN** el sistema elimina todas las credenciales y marcas de sesión persistente, volviendo al estado desconectado
