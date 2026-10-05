## Why

Tras la implementación del sistema de Flashcards con Repetición Espaciada SM-2 y Generación Híbrida (Extractor Estructural + Cloud AI + WebLLM Local), es fundamental contar con una suite de pruebas End-to-End (E2E) automatizadas con Playwright. Esto garantiza la estabilidad a largo plazo, evitando regresiones en la interactividad de la tarjeta 3D, el cálculo de intervalos SM-2, la persistencia en IndexedDB, la extracción de tarjetas desde Markdown y los contadores en tiempo real del Dashboard.

## What Changes

- **Nueva Suite de Pruebas E2E (pp/e2e/flashcards.spec.ts)**:
  - **Extracción Estructural**: Creación de un artículo médico con tablas, listas en negrita y secciones, apertura del modal de generación y guardado exitoso de las tarjetas detectadas.
  - **Gestión Manual de Flashcards**: Creación manual de preguntas/respuestas en un artículo, edición inline y eliminación con actualización reactiva del contador.
  - **Configuración de Proveedores de IA**: Apertura de AiSettingsModal, selección de proveedores (Gemini, Groq, OpenAI, Ollama, WebLLM), ingreso de clave y persistencia local.
  - **Sesión de Repaso Activo SM-2**: Lanzamiento del StudyModal, verificación del efecto 3D flip card al pulsar espacio/clic, calificación con botones SM-2 (1: Otra vez, 2: Difícil, 3: Bueno, 4: Fácil), transición de tarjetas y pantalla final de celebración.
  - **Métricas y Acciones en Dashboard**: Verificación de contadores dinámicos de repasos pendientes y tarjetas en mazo en el Dashboard principal.

## Capabilities

### Modified Capabilities
- lashcards: Cobertura completa de pruebas End-to-End para flujos interactivos de estudio activo SM-2, extracción automática, gestión de tarjetas y configuración de IA.

## Impact

- **Código Afectado**:
  - pp/e2e/flashcards.spec.ts (Nuevo archivo de pruebas Playwright).
  - Scripts de pp/package.json para ejecución de tests E2E si fuera necesario.
