## ADDED Requirements

### Requirement: Opción de Generador con IA Local WebLLM
El sistema SHALL / DEBE incorporar el modo "🧠 IA Local (Qwen 2.5 WebGPU)" en el modal de generación de flashcards del tema, permitiendo generar preguntas y respuestas clínicas de alta calidad sin conexión y sin consumir tokens de APIs externas.

#### Scenario: Selección del modo IA Local en el generador
- **WHEN** el usuario abre el modal de generación de flashcards y selecciona la pestaña "🧠 IA Local (Qwen 2.5)"
- **THEN** el sistema muestra el estado de preparación del modelo local, el selector de cantidad de tarjetas y el botón para disparar la generación en segundo plano

#### Scenario: Visualización de progreso en generación con IA Local
- **WHEN** se inicia la generación con WebLLM
- **THEN** el generador muestra el avance sección por sección del artículo clínico sin bloquear la interfaz de usuario
