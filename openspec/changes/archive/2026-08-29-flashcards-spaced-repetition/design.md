# Diseño Técnico: Flashcards, SM-2 y Generación Tri-Motor

## Context

SINDECON es una base de conocimientos médica personal offline-first. Para convertir las notas en un instrumento de memorización activa, se implementa un sistema completo de Flashcards con algoritmo SuperMemo-2 (SM-2), persistencia en Dexie.js y 3 motores de generación:
1. Extractor Estructural (Offline).
2. Clientes Cloud AI (Gemini, Groq, OpenAI, Ollama).
3. WebLLM en Navegador (WebGPU).

## Architecture & Data Flow

`mermaid
flowchart TD
  Article[Artículo Médico Markdown] --> ModeSelector{Selector de Generación}
  
  ModeSelector -->|Modo 1: Estructural| Extractor[cardExtractor.ts]
  ModeSelector -->|Modo 2: Cloud AI| CloudAI[cloudAiClient.ts (Gemini / Groq / OpenAI / Ollama)]
  ModeSelector -->|Modo 3: WebLLM| WebLLM[webLlmClient.ts (WebGPU Local)]
  
  Extractor --> Preview[GenerateFlashcardsModal: Vista previa y selección]
  CloudAI --> Preview
  WebLLM --> Preview
  
  Preview -->|Guardar seleccionadas| DB[(Dexie.js: flashcards)]
  
  User[Usuario / Sesión de Repaso] --> Study[StudyModal.tsx (Flip Card 3D)]
  Study -->|Consulta due_date <= now| DB
  Study -->|Calificación 1-4| SM2[sm2.ts Engine]
  SM2 -->|Actualiza interval, ease, due_date| DB
  
  DB -->|Contador de pendientes| Dashboard[Dashboard Widget & Header Badge]
`

## Decisions

### 1. Modelo de Datos (FlashcardRow y AiConfigRow)
En pp/src/db/db.ts:
`	s
export interface FlashcardRow {
  id: string              // uuid
  node_id: string         // artículo origen
  front: string           // Anverso (Pregunta / Enunciado)
  back: string            // Reverso (Respuesta / Explicación)
  source_type: 'manual' | 'structural' | 'cloud_ai' | 'web_llm'
  interval: number        // Días hasta el próximo repaso
  ease_factor: number     // Factor de facilidad (inicial: 2.5, mínimo: 1.3)
  reps: number            // Racha de repasos exitosos
  lapses: number          // Número de fallos acumulados
  due_date: number        // Timestamp en ms del vencimiento
  created_at: number
  updated_at: number
}

export interface AiConfig {
  provider: 'gemini' | 'groq' | 'openai' | 'ollama' | 'web_llm' | 'none'
  apiKey?: string
  modelName?: string
  endpointUrl?: string // e.g. http://localhost:11434 para Ollama
  webLlmModel?: string // e.g. Llama-3.2-1B-Instruct-q4f32_1-MLC
}
`

### 2. Algoritmo SM-2 Adaptado (pp/src/domain/sm2.ts)
- Calificaciones:
  - 1 (Otra vez): interval = 1, eps = 0, lapses += 1, ease_factor = max(1.3, ease_factor - 0.20)
  - 2 (Difícil): interval = max(1, Math.round(interval * 1.2)), ease_factor = max(1.3, ease_factor - 0.15)
  - 3 (Bueno): eps === 0 ? 1 : reps === 1 ? 6 : Math.round(interval * ease_factor), eps += 1
  - 4 (Fácil): eps === 0 ? 4 : reps === 1 ? 8 : Math.round(interval * ease_factor * 1.3), eps += 1, ease_factor += 0.15

### 3. Extractor Estructural (pp/src/domain/cardExtractor.ts)
- Parser puro que extrae:
  1. Secciones de encabezado ## [Sección] con su texto/listas.
  2. Listas con negrita - **[Término]:** [Definición].
  3. Filas de tablas Markdown con sus encabezados de columna.
  4. Callouts > [!TIPO] [Título].

### 4. Cliente Cloud AI (pp/src/domain/ai/cloudAiClient.ts)
- Implementa llamadas fetch a:
  - Google Gemini API (generateContent con esponseMimeType: application/json).
  - OpenAI / Groq / Ollama (/v1/chat/completions con esponse_format: { type:  json_object }).
- Prompt médico para extraer 4-8 tarjetas de alta relevancia clínica.

### 5. Motor WebLLM Local (pp/src/domain/ai/webLlmClient.ts)
- Carga dinámica @mlc-ai/web-llm mediante import('@mlc-ai/web-llm').
- Reporte de progreso de descarga y carga de pesos en GPU.

### 6. Componentes de UI
- StudyModal.tsx: Visor de estudio interactivo con animación 3D de volteo y atajos.
- GenerateFlashcardsModal.tsx: Selector de motor (Estructural / Cloud IA / WebLLM) y previsualización editable.
- ArticleFlashcardsModal.tsx: Gestor de tarjetas por artículo.
- AiSettingsModal.tsx: Configuración de claves y modelos.
- Dashboard.tsx: Widget de repaso diario con contador.
