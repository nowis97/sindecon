## Purpose

Proporciona telemetría de errores segura, reporte de crashes y monitoreo de salud del sistema para la aplicación clínica.

## ADDED Requirements

### Requirement: Captura y reporte de excepciones y fallos en producción
El sistema DEBE capturar excepciones JavaScript no controladas y promesas rechazadas en tiempo de ejecución y transmitirlas al servicio de observabilidad configurado (Sentry) mediante el DSN establecido.

#### Scenario: Excepción no controlada reportada
- **WHEN** ocurre un error JavaScript o fallo en la aplicación en un entorno con DSN configurado
- **THEN** el sistema captura el stack trace del error y lo transmite a Sentry sin bloquear el flujo del usuario

### Requirement: Sanitización y privacidad de datos médicos en telemetría
El sistema DEBE filtrar y eliminar cualquier contenido de notas clínicas, títulos privados de pacientes, tokens OAuth o datos sensibles de salud antes de que cualquier reporte sea transmitido al servicio de observabilidad.

#### Scenario: Error contiene texto clínico o datos privados
- **WHEN** un error o breadcrumb incluye texto de un artículo o parámetro sensible
- **THEN** el sanitizador `beforeSend` remueve los datos sensibles y solo transmite metadatos técnicos (archivo, línea, tipo de error, navegador y OS)

### Requirement: Pantalla de rescate y recuperación amigable ante errores (Error Boundary)
El sistema DEBE proveer un componente Error Boundary que atrape errores de renderizado de React, evitando la pantalla en blanco ("white screen of death") y ofreciendo al usuario una opción de recuperación y reintento.

#### Scenario: Fallo de renderizado en componente
- **WHEN** un componente de la interfaz lanza una excepción no controlada durante el renderizado
- **THEN** el Error Boundary muestra una tarjeta amigable de error con botón "Reintentar" y botón para copiar el código técnico del error
