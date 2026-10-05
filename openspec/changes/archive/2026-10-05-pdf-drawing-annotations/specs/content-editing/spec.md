## ADDED Requirements

### Requirement: Modo de anotación a mano alzada en visor de PDF

El sistema SHALL proporcionar un modo interactivo de anotaciones a mano alzada dentro del visor de documentos PDF (`PdfDocumentViewer`). Cuando el modo de anotación esté activado, el sistema SHALL capturar eventos de puntero (ratón, lápiz óptico/stylus y toque táctil) sobre una capa de lienzo transparente alineada con cada página del PDF, deshabilitando el desplazamiento gestual accidental sobre el área de dibujo (`touch-action: none`). Cuando el modo esté desactivado, el visor SHALL permitir el desplazamiento y paneo normal del documento.

#### Scenario: Activar modo de anotación y dibujar sobre la página
- **WHEN** el usuario pulsa el botón "Anotar / Modo Lápiz" en la barra del visor de PDF
- **THEN** la barra de herramientas de dibujo se hace visible, el cursor cambia a indicador de dibujo y los trazos realizados sobre cualquier página del PDF quedan dibujados en tiempo real sobre la capa de la página

#### Scenario: Desactivar modo de anotación para desplazarse libremente
- **WHEN** el usuario desactiva el modo de anotación pulsando nuevamente el botón de alternancia o cerrando la barra de dibujo
- **THEN** las anotaciones dibujadas permanecen visibles sobre las páginas y el usuario puede hacer scroll vertical y horizontal sin realizar trazos accidentales

### Requirement: Herramientas de trazo (Lápiz, Resaltador y Borrador)

El sistema SHALL proveer una paleta de herramientas de anotación con al menos tres modos:
1. **Lápiz / Bolígrafo:** Trazo fino continuo y opaco con grosor configurable y selector de color (ej. negro, azul, rojo y verde).
2. **Resaltador:** Trazo grueso semitransparente que permite leer el texto subyacente del PDF (ej. amarillo fluorescente, verde claro o rosa).
3. **Borrador:** Herramienta para eliminar trazos dibujados previamente al pasar sobre ellos o hacer clic en ellos.
4. **Deshacer / Limpiar:** Acciones para deshacer el último trazo realizado (`Undo`) y limpiar todos los trazos de la página activa.

#### Scenario: Resaltar texto médico en una página del PDF
- **WHEN** el usuario selecciona la herramienta de resaltador amarillo y traza una línea sobre una sección de texto de la página
- **THEN** se dibuja un trazo translúcido que destaca el texto manteniéndolo completamente legible

#### Scenario: Borrar un trazo dibujado
- **WHEN** el usuario selecciona la herramienta borrador y toca un trazo previamente dibujado en la página
- **THEN** el trazo correspondiente se elimina de la capa de dibujo sin afectar el contenido original del PDF

#### Scenario: Deshacer último trazo
- **WHEN** el usuario realiza un trazo incorrecto y pulsa el botón "Deshacer"
- **THEN** el último trazo dibujado en la página actual desaparece inmediatamente

### Requirement: Escalado vectorial y persistencia local de anotaciones

Las anotaciones de cada página del PDF SHALL almacenarse como secuencias de trazos vectoriales normalizados respecto a la resolución base (escala 1.0) de la página. El sistema SHALL guardar automáticamente las anotaciones de cada página en el almacenamiento local persistente (IndexedDB) asociado al artículo. Al cambiar el zoom del PDF (ampliar o reducir) o al recargar la aplicación, el sistema SHALL redibujar los trazos escalados proporcionalmente para que su posición y dimensiones coincidan exactamente con el contenido del PDF.

#### Scenario: Mantener posición exacta de anotaciones al cambiar zoom
- **WHEN** el usuario dibuja un círculo alrededor de un término en una página y luego aumenta el zoom al 150%
- **THEN** las dimensiones del círculo y su posición relativa sobre el término aumentan proporcionalmente sin desplazarse ni desfasarse

#### Scenario: Persistencia y restauración tras recargar
- **WHEN** el usuario realiza anotaciones en un PDF, navega a otro artículo o recarga la aplicación y vuelve al PDF
- **THEN** las anotaciones dibujadas se cargan desde el almacenamiento local y se muestran exactamente en sus respectivas páginas
