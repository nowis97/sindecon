# 🗺️ Roadmap de Mejoras: Cuaderno Médico Personal

Este documento recopila las propuestas de mejoras y funcionalidades avanzadas diseñadas para llevar el **Cuaderno Médico Personal** al siguiente nivel clínico, educativo y operativo.

---

## 📑 Índice de Iniciativas

1. [🧮 1. Calculadoras Médicas Interactivas Embebidas](#1-calculadoras-médicas-interactivas-embebidas)
2. [🧠 2. Repetición Espaciada & Flashcards (Anki / FSRS Local)](#2-repetición-espaciada--flashcards-anki--fsrs-local)
3. [🎙️ 3. Dictado Clínico por Voz a Texto (Hands-Free)](#3-dictado-clínico-por-voz-a-texto-hands-free)
4. [🕸️ 4. Grafo de Conocimiento Interactivo (Obsidian Graph View)](#4-grafo-de-conocimiento-interactivo-obsidian-graph-view)
5. [📄 5. Exportador a PDF Clínico / Fichas de Bolsillo](#5-exportador-a-pdf-clínico--fichas-de-bolsillo)

---

## 🧮 1. Calculadoras Médicas Interactivas Embebidas

### 🎯 Objetivo
Permitir la inserción de widgets reactivos de cálculo de scores clínicos directamente en el texto Markdown o invocables desde la paleta de comandos (`Ctrl+K`).

### ⚙️ Especificación Técnica
- **Sintaxis Markdown**:
  ````markdown
  ```calculator:cha2ds2-vasc
  ```
  ````
- **Renderizado**: El visor detecta el bloque y monta un componente interactivo con selectores/checks, cálculo automático de puntos y recomendaciones basadas en guías clínicas oficiales.
- **Scores prioritarios**:
  - **Cardiovascular**: CHA₂DS₂-VASc, HAS-BLED, Wells (TVP / TEP), TIMI, GRACE.
  - **Nefrología**: Filtrado Glomerular (CKD-EPI 2021, Cockcroft-Gault), Fracción Excretada de Sodio (FeNa).
  - **Urgencias / Cuidados Críticos**: Glasgow Coma Scale (GCS), CURB-65, qSOFA, APACHE II simplificado.
  - **Hepatología**: Child-Pugh, MELD-Na.
- **Ventaja**: 100% offline, reactivo, sin dependencias externas pesadas.

---

## 🧠 2. Repetición Espaciada & Flashcards (Anki / FSRS Local)

### 🎯 Objetivo
Facilitar el estudio activo y la memorización a largo plazo de dosis de fármacos, criterios diagnósticos y perlas clínicas directamente desde los artículos del cuaderno.

### ⚙️ Especificación Técnica
- **Extracción Automática**:
  - Callouts especiales: `:::pearl` o `[!pearl]`.
  - Sintaxis de tarjetas en Markdown:
    ```markdown
    Q: ¿Cuál es la tríada clásica de la Meningitis aguda?
    A: Fiebre, rigidez de nuca y alteración del estado mental.
    ```
  - Bloques de fármacos: generación automática de "¿Dosis y contraindicaciones de [Fármaco]?".
- **Algoritmo**: Motor local SM-2 / FSRS integrado con Dexie IndexedDB (`cards`, `reviews`).
- **Interfaz**:
  - Modo sesión de repaso diario en Dashboard y barra de navegación móvil.
  - Botones de respuesta táctiles: `🔴 Otra vez (1d)`, `🟡 Difícil (3d)`, `🟢 Fácil (7d)`.

---

## 🎙️ 3. Dictado Clínico por Voz a Texto (Hands-Free)

### 🎯 Objetivo
Agilizar la toma de apuntes rápidos y captura de casos clínicos en guardias o planta sin necesidad de teclear.

### ⚙️ Especificación Técnica
- **API**: **Web Speech API** nativa del navegador (`webkitSpeechRecognition` / `SpeechRecognition`), garantizando cero latencia y funcionamiento sin coste por API.
- **Puntos de Integración**:
  - Modal de **Captura Rápida** (botón de micrófono al lado del input de nota).
  - Barra de herramientas del **Editor Markdown**.
- **Comandos de voz básicos**: Detección de puntuación hablada ("punto", "coma", "dos puntos", "nuevo párrafo").

---

## 🕸️ 4. Grafo de Conocimiento Interactivo (Obsidian Graph View)

### 🎯 Objetivo
Explorar visualmente la red semántica del conocimiento médico, identificando cómo interactúan síntomas, patologías, pruebas diagnósticas y tratamientos.

### ⚙️ Especificación Técnica
- **Motor**: Cytoscape.js con layout de fuerzas (force-directed layout) o Canvas 2D acelerado.
- **Nodos & Aristas**:
  - Nodos = Artículos y Carpetas.
  - Aristas = Enlaces bidireccionales `[[WikiLinks]]` y etiquetas compartidas (`#tags`).
  - Tamaño de nodo proporcional a la centralidad de grado (temas de alto impacto).
- **Filtros interactivos**:
  - Filtrar por especialidad / carpeta.
  - Filtrar por etiquetas clínicas (`#Urgencias`, `#Cardiología`, `#Farmaco`).
  - Navegación al hacer clic directo sobre cualquier nodo.

---

## 📄 5. Exportador a PDF Clínico / Fichas de Bolsillo

### 🎯 Objetivo
Permitir imprimir o compartir protocolos de actuación y fichas farmacológicas con un formato limpio de bolsillo.

### ⚙️ Especificación Técnica
- **Estilos de Impresión**: Reglas CSS `@media print` optimizadas para A4 / A5 (formato ficha de bolsillo).
- **Opciones de Maquetación**:
  - Encabezado con metadatos clínicos (fecha de actualización, categoría, autor).
  - Disposición a 2 columnas para ahorro de espacio en fichas farmacológicas.
  - Renderizado vectorial de diagramas Mermaid y fórmulas KaTeX en alta resolución.

---

## 📊 Matriz de Priorización

| Módulo | Complejidad | Impacto Clínico | Estado |
| :--- | :---: | :---: | :---: |
| **🧮 Calculadoras Médicas** | Media | ⭐⭐⭐⭐⭐ | Propuesta lista para OpenSpec |
| **🧠 Flashcards / Repetición Espaciada** | Media-Alta | ⭐⭐⭐⭐⭐ | Propuesta lista para OpenSpec |
| **🎙️ Dictado por Voz** | Baja-Media | ⭐⭐⭐⭐ | Propuesta lista para OpenSpec |
| **🕸️ Grafo de Conocimiento** | Media | ⭐⭐⭐⭐ | Propuesta lista para OpenSpec |
| **📄 Exportación a PDF** | Baja | ⭐⭐⭐ | Propuesta lista para OpenSpec |
