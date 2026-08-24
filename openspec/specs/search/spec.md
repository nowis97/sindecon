## Purpose

Encontrar conocimiento al instante — por texto, por síntoma o por relaciones entre artículos — funcionando completamente offline.

## Requirements

### Requirement: Búsqueda de texto completo local

El sistema SHALL indexar localmente título, contenido y tags de todos los artículos, y ofrecer búsqueda con resultados ordenados por relevancia, sin conexión. El índice SHALL actualizarse al crear, editar o eliminar artículos.

#### Scenario: Buscar por término clínico

- **WHEN** el usuario busca "amiodarona"
- **THEN** aparecen los artículos que la mencionan en título, contenido o tags, ordenados por relevancia, sin necesidad de conexión

### Requirement: Tags de síntomas

El sistema SHALL permitir asignar tags a los artículos (p.ej. síntomas: "fiebre", "dolor torácico"), con autocompletado desde los tags existentes. La búsqueda por un síntoma SHALL devolver los artículos tagueados con él.

#### Scenario: Buscar por síntoma

- **WHEN** el usuario busca el síntoma "dolor torácico"
- **THEN** aparecen todos los artículos tagueados con ese síntoma

#### Scenario: Autocompletar tag existente

- **WHEN** el usuario escribe "fie" al etiquetar un artículo y existe el tag "fiebre"
- **THEN** el sistema sugiere "fiebre" para evitar duplicados con variantes

### Requirement: Referencias cruzadas wiki

El sistema SHALL permitir enlazar artículos entre sí escribiendo `[[` en el editor, con autocompletado por título de artículo. El enlace SHALL resolverse al artículo aunque este cambie de ubicación en el árbol.

#### Scenario: Enlazar desde un artículo a otro

- **WHEN** el usuario escribe `[[Fibrilación auricular]]` dentro del artículo "Amiodarona"
- **THEN** el enlace queda activo y navega al artículo enlazado al tocarlo

#### Scenario: El enlace sobrevive a mover el artículo

- **WHEN** el artículo enlazado se mueve a otra categoría
- **THEN** el enlace sigue resolviendo al artículo correcto

### Requirement: Artículos relacionados

La vista lector SHALL mostrar los artículos que enlazan al artículo actual (backlinks).

#### Scenario: Ver quién enlaza aquí

- **WHEN** el usuario lee "Fibrilación auricular" y "Amiodarona" lo enlaza
- **THEN** la vista lector muestra "Amiodarona" en la lista de artículos relacionados

### Requirement: Entrada fluida y navegación cinematográfica en Command Palette

El sistema SHALL presentar la paleta de comandos global (Ctrl+K) con transiciones suaves de entrada modal y navegación interactiva por teclado.

#### Scenario: Apertura fluida de la paleta de comandos

- **WHEN** el usuario pulsa el atajo `Ctrl+K` o el botón de comandos en la cabecera
- **THEN** la paleta emerge con una animación elástica de escala y desplazamiento vertical, enfocando de inmediato el campo de búsqueda

#### Scenario: Selección suave de resultados con teclado

- **WHEN** el usuario pulsa las flechas `↑` o `↓` para recorrer las acciones o artículos encontrados
- **THEN** el elemento activo se resalta con una transición fluida y realiza autoscroll suave dentro de la lista

