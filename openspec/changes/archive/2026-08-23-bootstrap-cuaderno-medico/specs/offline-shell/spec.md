## Purpose

Que la aplicación funcione por completo sin conexión y se instale como una app en PC y móvil desde el navegador, protegiendo los datos locales contra limpiezas del navegador.

## ADDED Requirements

### Requirement: Instalable como PWA

El sistema SHALL ser instalable como aplicación (manifest + iconos) tanto en escritorio como en móvil, desde el navegador, sin pasar por tiendas de aplicaciones.

#### Scenario: Instalar en el teléfono

- **WHEN** el usuario abre la app en el navegador del móvil y elige "Añadir a pantalla de inicio"
- **THEN** la app queda instalada con su icono y abre a pantalla completa sin la barra del navegador

### Requirement: Funcionamiento offline total

El sistema SHALL funcionar por completo sin conexión tras la primera carga: navegación del árbol, lectura, edición, búsqueda, plantillas, imágenes y renderizado de esquemas mermaid. Los recursos cargados bajo demanda (p.ej. mermaid) SHALL quedar cacheados tras su primer uso.

#### Scenario: Consulta en sótano sin señal

- **WHEN** el usuario abre la app instalada sin conexión y busca un artículo con esquema mermaid
- **THEN** la búsqueda funciona y el artículo se muestra con su esquema renderizado

#### Scenario: Edición offline

- **WHEN** el usuario edita un artículo estando offline y recarga la app
- **THEN** los cambios persisten

### Requirement: Almacenamiento persistente

El sistema SHALL solicitar al navegador almacenamiento persistente en el primer arranque, para proteger la base de conocimiento contra la expulsión automática de datos bajo presión de espacio. Si el navegador lo deniega, el sistema SHALL advertir al usuario y recomendar exportar backups con regularidad.

#### Scenario: Concesión de persistencia

- **WHEN** el usuario abre la app por primera vez en un navegador compatible
- **THEN** la app solicita almacenamiento persistente y registra el resultado

#### Scenario: Persistencia denegada

- **WHEN** el navegador deniega o no soporta almacenamiento persistente
- **THEN** la app muestra un aviso permanente y visible recomendando exportar backups
