## ADDED Requirements

### Requirement: Persistencia y sincronización de configuración de IA en Google Drive

El sistema SHALL persistir y sincronizar de forma bidireccional la configuración de Inteligencia Artificial (proveedor, clave de API y modelo seleccionado) en el espacio privado ppDataFolder de Google Drive del usuario mediante el archivo i-config.json. Al iniciar sesión en Google Drive o ejecutar el ciclo de sincronización, si el almacenamiento local no cuenta con una clave de API configurada y existe una versión en Google Drive, el sistema SHALL descargar y aplicar la configuración automáticamente en el almacenamiento local IndexedDB.

#### Scenario: Carga automática de API Key al iniciar sesión en un dispositivo nuevo

- **WHEN** un usuario inicia sesión con su cuenta de Google Drive en un dispositivo o navegador sin clave de API configurada
- **THEN** el sistema descarga automáticamente el archivo i-config.json de su espacio privado ppDataFolder y guarda la configuración de IA en IndexedDB dejándola lista para su uso inmediato sin requerir configuración manual

#### Scenario: Subida reactiva al guardar nueva configuración de IA con Drive conectado

- **WHEN** el usuario actualiza o ingresa una nueva API Key o cambia de modelo en el modal de Ajustes de IA estando Google Drive conectado
- **THEN** el sistema guarda la configuración localmente en IndexedDB y sube de inmediato el archivo i-config.json actualizado al espacio ppDataFolder de Google Drive

#### Scenario: Preservación local al desconectar Google Drive

- **WHEN** el usuario decide desconectar su cuenta de Google Drive
- **THEN** la configuración de IA local (API Key y modelo) permanece intacta en el dispositivo local para evitar interrupciones en el flujo de trabajo

#### Scenario: Aislamiento estricto de exportaciones manuales en ZIP

- **WHEN** el usuario exporta un respaldo completo de su cuaderno a archivo .zip
- **THEN** el archivo .zip generado NO contiene claves de API ni secretos de IA, previniendo fugas de credenciales privadas al compartir respaldos
