# Spec Delta

## ADDED Requirements

### Requirement: Barra de progreso e indicador de avance en la sincronización con Google Drive

El sistema SHALL proporcionar retroalimentación visual en tiempo real del progreso de la sincronización con Google Drive, indicando tanto la fase de ejecución activa (comprobación en la nube, preparación/compresión de notas locales, transferencia de subida o descarga, y actualización del manifiesto) como el porcentaje estimado de completitud (0% a 100%).

Durante la sincronización activa, el sistema SHALL mostrar una barra de progreso visual interactiva en el modal de Google Drive acompañada de la descripción textual de la etapa y el valor porcentual numérico. Asimismo, el sistema SHALL reflejar el avance dinámico en el chip de sincronización de la barra de navegación superior (`SyncIndicator`), mostrando el porcentaje en tiempo real y una animación de actividad, garantizando que el usuario conozca el estado del proceso sin necesidad de mantener el modal abierto.

#### Scenario: Visualización del progreso en el modal de sincronización
- **WHEN** el usuario pulsa "Sincronizar ahora" dentro del modal de Google Drive o abre el modal mientras una sincronización se encuentra en curso
- **THEN** el sistema despliega una barra de progreso que se llena fluidamente de acuerdo al porcentaje actual (0% a 100%) y un texto descriptivo de la etapa (ej. *"Comprobando archivos en la nube…"*, *"Preparando respaldo de notas…"*, *"Subiendo a Google Drive…"*, *"Actualizando manifiesto…"*)

#### Scenario: Indicador de progreso en el chip de cabecera
- **WHEN** se inicia una sincronización manual o automática en segundo plano
- **THEN** el chip de estado en la cabecera actualiza su etiqueta mostrando el icono de sincronización animado y el porcentaje numérico en tiempo real (ej. *"🔄 45%"*)
- **AND** al completarse el ciclo de sincronización, el chip transiciona suavemente al estado *"Al día"* con la hora de actualización

#### Scenario: Transición limpia en caso de error o desconexión
- **WHEN** ocurre una interrupción de red o fallo de autenticación durante la sincronización
- **THEN** la barra de progreso se interrumpe y el sistema actualiza tanto el modal como el chip de cabecera con el estado de error correspondiente y el mensaje descriptivo del fallo
