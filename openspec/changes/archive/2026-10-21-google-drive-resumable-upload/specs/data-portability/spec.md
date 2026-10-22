# Spec Delta

## ADDED Requirements

### Requirement: Subida resumable por bloques a Google Drive con reanudación automática

El sistema SHALL subir los respaldos y archivos al espacio `appDataFolder` de Google Drive utilizando el protocolo de subida resumable (`uploadType=resumable`). El sistema SHALL iniciar una sesión de subida obteniendo la URI de sesión (`Location`) y transferir el contenido binario dividido en bloques múltiplos de 256 KB (por defecto bloques de 2 MB) mediante peticiones `PUT` con cabeceras `Content-Range: bytes <inicio>-<fin>/<total>`.

Si un bloque falla debido a una interrupción temporal de red o un error transitorio del servidor (`5xx`), el sistema SHALL consultar el estado actual de la sesión enviando una petición `PUT` vacía con cabecera `Content-Range: bytes */<total>`, leer el último byte confirmado en la cabecera `Range` de la respuesta `308 Resume Incomplete`, y reanudar automáticamente la transferencia desde ese byte exacto con reintentos exponenciales, sin reiniciar la subida desde cero.

#### Scenario: Subida por bloques de un respaldo grande
- **WHEN** se sube un respaldo `cuaderno-backup.zip` cuyo tamaño supera el tamaño de bloque (por ejemplo, 5 MB con bloques de 2 MB)
- **THEN** el sistema inicia una sesión `uploadType=resumable` y envía los bloques secuencialmente con `Content-Range`, recibiendo `308 Resume Incomplete` en los bloques intermedios y `200 OK` o `201 Created` en el bloque final

#### Scenario: Reanudación automática tras fallo transitorio de red en un bloque intermedio
- **WHEN** ocurre un error de red o respuesta `503` al enviar el segundo bloque de un archivo durante la sincronización
- **THEN** el sistema consulta a la URI de sesión el rango recibido (`Content-Range: bytes */<total>`), obtiene el offset confirmado por Google Drive en la cabecera `Range`, y reanuda el envío desde ese byte sin volver a subir el primer bloque

#### Scenario: Expiración o invalidación de la sesión resumable
- **WHEN** la URI de sesión resumable devuelve `404 Not Found` o `410 Gone` al intentar reanudar
- **THEN** el sistema descarta la URI de sesión expirada e inicia una nueva sesión resumable limpia

## MODIFIED Requirements

### Requirement: Barra de progreso e indicador de avance en la sincronización con Google Drive

El sistema SHALL proporcionar retroalimentación visual en tiempo real del progreso de la sincronización con Google Drive, indicando tanto la fase de ejecución activa (comprobación en la nube, preparación/compresión de notas locales, transferencia de subida o descarga, y actualización del manifiesto) como el porcentaje estimado de completitud (0% a 100%).

Durante la fase de subida del respaldo (`transferring`), el sistema SHALL actualizar el porcentaje de manera continua a medida que cada bloque de la subida resumable se confirma, mostrando además en la descripción textual los megabytes transferidos frente al tamaño total del respaldo (ej. *"Subiendo a Google Drive (2.0 MB / 5.4 MB)…"*).

Durante la sincronización activa, el sistema SHALL mostrar una barra de progreso visual interactiva en el modal de Google Drive acompañada de la descripción textual de la etapa y el valor porcentual numérico. Asimismo, el sistema SHALL reflejar el avance dinámico en el chip de sincronización de la barra de navegación superior (`SyncIndicator`), mostrando el porcentaje en tiempo real y una animación de actividad, garantizando que el usuario conozca el estado del proceso sin necesidad de mantener el modal abierto.

#### Scenario: Visualización del progreso en el modal de sincronización
- **WHEN** el usuario pulsa "Sincronizar ahora" dentro del modal de Google Drive o abre el modal mientras una sincronización se encuentra en curso
- **THEN** el sistema despliega una barra de progreso que se llena fluidamente de acuerdo al porcentaje actual (0% a 100%) y un texto descriptivo de la etapa (ej. *"Comprobando archivos en la nube…"*, *"Preparando respaldo de notas…"*, *"Subiendo a Google Drive (2.0 MB / 5.4 MB)…"*, *"Actualizando manifiesto…"*)

#### Scenario: Avance progresivo por bloques durante la subida resumable
- **WHEN** el sistema sube un archivo `cuaderno-backup.zip` en múltiples bloques mediante `uploadType=resumable`
- **THEN** el porcentaje de la barra de progreso se incrementa tras cada bloque transferido dentro del rango de transferencia y el mensaje muestra los megabytes subidos y totales

#### Scenario: Indicador de progreso en el chip de cabecera
- **WHEN** se inicia una sincronización manual o automática en segundo plano
- **THEN** el chip de estado en la cabecera actualiza su etiqueta mostrando el icono de sincronización animado y el porcentaje numérico en tiempo real (ej. *"🔄 45%"*)
- **AND** al completarse el ciclo de sincronización, el chip transiciona suavemente al estado *"Al día"* con la hora de actualización

#### Scenario: Transición limpia en caso de error o desconexión
- **WHEN** ocurre una interrupción de red definitiva (agotados los reintentos de reanudación) o fallo de autenticación durante la sincronización
- **THEN** la barra de progreso se interrumpe y el sistema actualiza tanto el modal como el chip de cabecera con el estado de error correspondiente y el mensaje descriptivo del fallo
