## ADDED Requirements

### Requirement: Protección de la interfaz mediante Error Boundary
El shell de la aplicación DEBE estar envuelto en un Error Boundary que prevenga caídas globales de la aplicación y preserve el estado de navegación y datos en caso de errores en subárboles de componentes.

#### Scenario: Recuperación ante fallo de interfaz
- **WHEN** un componente de la interfaz lanza una excepción no controlada
- **THEN** la aplicación captura el error sin cerrar la app y permite al usuario reintentar el renderizado
