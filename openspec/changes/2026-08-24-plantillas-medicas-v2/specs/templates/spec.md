# templates: Plantillas Médicas Maestras v2

## Requirements

### Requirement: Siembra de plantillas v2 en arranque
El sistema SHALL sembrar en "Plantillas/" los 11 formatos maestros v2 definidos en `plantillas_sindecon/`:
1. Patología / Enfermedad
2. Síndrome clínico / Diagnóstico sindromático
3. Síntoma / Motivo de consulta
4. Urgencia / Emergencia
5. Procedimiento / Técnica / Exploración clínica
6. Examen / Prueba / Interpretación diagnóstica
7. Concepto / Anatomía / Fisiología / Fisiopatología
8. Prevención / Tamizaje / Control clínico
9. Terapéutica / Estrategia de tratamiento
10. Fármaco / Ficha farmacológica
11. Patología oncológica / Cáncer

Cada plantilla SHALL contener sus secciones como encabezados Markdown, tablas semilla (`Tratamiento`, `Fármacos y dosis`, `Dosis en adultos`), algoritmos Mermaid semilla (`Algoritmo de estudio`, `Algoritmo terapéutico`, `Algoritmo y errores frecuentes`) y listas semilla para perlas clínicas.

### Requirement: Maquetación editorial a 2 columnas y estilo clínico
El lector de artículos SHALL permitir visualización a 2 columnas tipo díptico médico en pantallas de escritorio y tablets, con tipografía `Roboto`, títulos principales en Navy (`#142337`) y encabezados de sección en Teal (`#008080`), adaptándose a 1 columna en pantallas móviles.
