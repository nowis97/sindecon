# Propuesta: Sistema de Flashcards, Repetición Espaciada (SM-2) y Generación Multi-Motor (Extractor Automático + IA Cloud + WebLLM Local)

## Why

Para optimizar la memorización activa a largo plazo de contenidos médicos críticos (fármacos, dosis, criterios diagnósticos y perlas de guardia), se requiere un sistema completo de Flashcards con algoritmo de repetición espaciada (SM-2) 100% offline, integrado con 3 modalidades de generación inteligente:
1. **Extractor Estructural Automático**: Extrae preguntas a partir del texto común (secciones, listas en negrita, tablas y callouts) sin marcas especiales ni internet.
2. **IA Cloud Gratuita / Configurable**: Integración con Google Gemini 1.5 Flash (tier gratis), Groq, OpenAI y Ollama para generar preguntas clínicas de razonamiento diagnóstico.
3. **WebLLM Local en Navegador (WebGPU)**: Motor de IA local que se ejecuta directamente en la GPU del navegador sin necesidad de servidores ni claves.

## What Changes

- **Modelo de Datos en Dexie.js (KbDatabase)**:
  - Tabla lashcards (id, node_id, front, back, source_type, interval, ease_factor, reps, lapses, due_date, created_at, updated_at).
  - Configuración de IA persistida en tabla meta (i_config).
- **Motor de Repetición Espaciada SM-2**:
  - Cálculo de intervalos adaptativos (Otra vez, Difícil, Bueno, Fácil) y vencimientos diarios.
- **Generación Tri-Motor de Flashcards**:
  - Extractor Heurístico: Análisis de ## Secciones, - **Término:** Definición, tablas y callouts clínicos.
  - Cliente Cloud AI: Soporte de Gemini REST API, OpenAI / Groq / Ollama endpoints con prompt clínico y esquema JSON estricto.
  - WebLLM Engine: Ejecución local en navegador con WebGPU y modelos ligeros (Llama-3.2-1B-Instruct-q4f32_1-MLC o Qwen2.5-0.5B-Instruct-q4f16_1-MLC).
- **Interfaz de Usuario y Estudio Activo**:
  - **Modal de Generación (GenerateFlashcardsModal.tsx)**: Pestañas de generación, vista previa editable y selección antes de guardar.
  - **Gestor por Artículo (ArticleFlashcardsModal.tsx)**: Ver, crear manualmente, editar y repasar tarjetas de un artículo específico.
  - **Visor de Estudio Activo (StudyModal.tsx)**: Modo de repaso a pantalla completa con volteo 3D (*flip card*), atajos de teclado (Espacio/1-4), soporte táctil y pantalla de resumen final con estadísticas.
  - **Dashboard & Navegación**: Tarjeta de repaso diario con contador de pendientes y botón de acceso rápido.
  - **Ajustes de IA**: Panel de configuración de proveedores (Gemini, Groq, OpenAI, Ollama, WebLLM).

## Capabilities

### New Capabilities
- lashcards: Persistencia, motor SM-2, extracción automática, generación con IA (Cloud y WebLLM) y sesión de estudio activa.

## Impact

- **Datos y Portabilidad**: Las flashcards se incluyen en las copias de seguridad JSON (exportImport.ts).
- **Rendimiento**: WebLLM se carga bajo demanda (*lazy loading*) mediante import('@mlc-ai/web-llm') para no afectar el tiempo de inicio de la app.
