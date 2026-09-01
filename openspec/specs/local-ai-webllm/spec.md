# local-ai-webllm Specification

## Purpose
Proporciona un motor de inteligencia artificial 100% local y privado mediante WebLLM (Qwen 2.5) sobre WebGPU para generar flashcards y sintetizar conocimiento médico sin conexión a Internet.

## Requirements

### Requirement: Local WebLLM Engine Initialization and WebGPU Validation
El sistema SHALL / DEBE verificar la disponibilidad de la API WebGPU en el navegador del usuario e inicializar el motor `@mlc-ai/web-llm` en un Web Worker dedicado. Si WebGPU no está disponible, el sistema DEBE mostrar un mensaje informativo y ofrecer el Extractor Rápido Offline o proveedores Cloud.

#### Scenario: WebGPU compatible browser initialization
- **WHEN** el usuario selecciona el modo "🧠 IA Local (Qwen 2.5)" en un navegador con WebGPU
- **THEN** el sistema inicializa el Web Worker con el modelo `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` sin congelar la interfaz de usuario

#### Scenario: WebGPU incompatible browser fallback
- **WHEN** el usuario intenta usar IA Local en un navegador sin soporte para WebGPU
- **THEN** el sistema muestra un banner explicativo y redirige al Extractor Rápido Offline o a la configuración de Gemini

### Requirement: One-time Model Weight Download with Transparent Progress
El sistema SHALL / DEBE gestionar la descarga inicial de los pesos cuantizados del modelo (~1.1 GB) mostrando una barra de porcentaje y megabytes descargados, y almacenándolos en la caché local del navegador para su posterior reutilización sin conexión.

#### Scenario: First-time model download
- **WHEN** el usuario activa la IA local por primera vez
- **THEN** se muestra un modal de progreso con el porcentaje exacto y los datos descargados, guardando los pesos en `CacheStorage`

#### Scenario: Subsequent offline execution
- **WHEN** el usuario genera flashcards con IA local tras haber completado la descarga previa
- **THEN** el modelo carga en memoria en menos de 2 segundos sin realizar peticiones de red

### Requirement: Clinical Markdown Semantic Chunking and Token Limit Protection
El sistema SHALL / DEBE segmentar artículos médicos extensos por encabezados (`H2`/`H3`), tablas y secciones clínicas, limitando cada bloque a menos de 1.200 tokens y aplicando prompts especializados (Diagnóstico, Farmacología, Alertas) para garantizar alta calidad clínica sin exceder la ventana de contexto.

#### Scenario: Long clinical article chunking
- **WHEN** el usuario solicita generar flashcards de un artículo extenso (> 2.000 palabras)
- **THEN** el sistema divide el artículo en secciones semánticas, procesa cada sección en el Web Worker y ensambla las tarjetas consolidadas

### Requirement: Background Processing and Floating Toast Notification
El sistema SHALL / DEBE procesar la generación en segundo plano sin interrumpir la navegación o edición de notas, notificando al usuario mediante un Toast flotante cuando las tarjetas estén listas.

#### Scenario: Background generation completion notification
- **WHEN** el Web Worker finaliza la extracción de flashcards mientras el usuario navega en la app
- **THEN** aparece un Toast flotante con el conteo de tarjetas generadas y un botón de acceso directo para revisarlas y guardarlas en el mazo

### Requirement: Memory Management and Local Cache Cleanup
El sistema SHALL / DEBE permitir al usuario liberar la memoria VRAM de la GPU y eliminar los archivos del modelo del almacenamiento local desde los Ajustes de IA.

#### Scenario: User unloads model and frees disk space
- **WHEN** el usuario pulsa "Liberar modelo / Vaciar caché local" en Ajustes de IA
- **THEN** el sistema descarga el modelo de la VRAM, elimina los archivos de `CacheStorage` y actualiza el estado a no descargado
