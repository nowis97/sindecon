## ADDED Requirements

### Requirement: Validación E2E de Extracción Estructural y Mazo de Flashcards

La suite de pruebas E2E SHALL validar que el usuario pueda abrir un artículo con contenido médico estructurado (secciones, tablas, negritas o callouts), abrir el modal de generación, visualizar las tarjetas extraídas automáticamente, seleccionar/editar preguntas y guardarlas exitosamente en el mazo del tema.

#### Scenario: Extracción estructural y guardado en mazo
- **WHEN** el usuario navega a un artículo con secciones y tablas y hace clic en " 🧠 Flashcards\ -> \✨ Generar Flashcards con IA / Extractor\
- **THEN** el sistema extrae las tarjetas estructurales, permite seleccionarlas y al hacer clic en \💾 Guardar en el Mazo\ aparecen en la lista de tarjetas del artículo.

### Requirement: Validación E2E de Gestión Manual de Flashcards

La suite de pruebas E2E SHALL verificar la creación manual de preguntas y respuestas, la edición inline de texto y la eliminación de tarjetas con actualización inmediata de contadores en el modal del tema.

#### Scenario: Crear, editar y eliminar una tarjeta manual
- **WHEN** el usuario pulsa \➕ Tarjeta Manual\, ingresa una pregunta y respuesta clínica y la guarda
- **THEN** la tarjeta se añade a la lista con badge \Nueva\, permite editar su texto mediante el botón ✏️ y eliminarla mediante 🗑️.

### Requirement: Validación E2E de Configuración de Proveedores de IA

La suite de pruebas E2E SHALL comprobar que el modal de Ajustes de IA permita alternar entre proveedores (Gemini, Groq, OpenAI, Ollama, WebLLM), ingresar credenciales y persistirlas en el almacenamiento local.

#### Scenario: Guardar configuración de API Key de IA
- **WHEN** el usuario abre \⚙️ Ajustes de IA Clínica\ desde el Dashboard, selecciona un proveedor e ingresa su clave
- **THEN** al guardar se muestra el feedback \✓ Guardado\ y los valores permanecen persistidos al reabrir el modal.

### Requirement: Validación E2E de Sesión de Estudio Activo SM-2 (Flip Card 3D)

La suite de pruebas E2E SHALL verificar el flujo completo de estudio interactivo: visualización de la cara frontal (pregunta), animación 3D de volteo (por clic o tecla Espacio), visualización de los 4 botones de calificación SM-2 (1: Otra vez, 2: Difícil, 3: Bueno, 4: Fácil), avance progresivo entre tarjetas y pantalla final de celebración con estadísticas de retención.

#### Scenario: Realizar sesión de estudio y recibir feedback
- **WHEN** el usuario inicia un repaso con tarjetas pendientes, voltea cada una y califica su dificultad
- **THEN** la barra de progreso avanza, el mazo recorre todas las tarjetas y al finalizar se despliega la pantalla de sesión completada con resumen de calificaciones.

### Requirement: Validación E2E de Métricas Reactivas en Dashboard

La suite de pruebas E2E SHALL verificar que el widget de \Repaso Activo SM-2\ y las estadísticas del Dashboard reflejen en tiempo real las tarjetas listas para estudiar y el total acumulado en el mazo.

#### Scenario: Actualización de contadores del Dashboard tras repasar
- **WHEN** el usuario concluye el estudio de todas sus tarjetas pendientes y regresa al Dashboard principal
- **THEN** la tarjeta de estadísticas actualiza su conteo a 0 repasos pendientes y el botón de acción rápida muestra el estado \Al día\.
