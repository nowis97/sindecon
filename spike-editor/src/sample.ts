export const SAMPLE = `# Fibrilación Auricular

Arritmia **supraventricular** con actividad auricular desorganizada, *irregularmente irregular*.

## Tratamiento agudo

| Fármaco | Dosis | Vía | Notas |
| --- | --- | --- | --- |
| Amiodarona | 150 mg | IV | En 10-20 min |
| Metoprolol | 2.5-5 mg | IV | Repetir cada 5 min |

## Algoritmo de decisión

\`\`\`mermaid
flowchart TD
    A[Sospecha de FA] --> B{Inestable?}
    B -- Sí --> C[Cardioversión eléctrica]
    B -- No --> D{Inicio menor a 48h?}
    D -- Sí --> E[Cardioversión farmacológica]
    D -- No --> F[Anticoagular + control de frecuencia]
\`\`\`

## Notas

- ECG: ausencia de ondas P, intervalos RR irregulares
- Siempre valorar riesgo tromboembólico (CHA2DS2-VASc)
`
