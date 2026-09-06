// Polyfill seguro de crypto.randomUUID para contextos no seguros (ej. acceso por IP en red local HTTP)
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    // @ts-ignore
    window.crypto = {}
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function () {
      if (typeof window.crypto.getRandomValues === 'function') {
        return ('10000000-1000-4000-8000-100000000000').replace(/[018]/g, (c: string) => {
          const n = Number(c)
          return (n ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (n / 4)))).toString(16)
        }) as `${string}-${string}-${string}-${string}-${string}`
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      }) as `${string}-${string}-${string}-${string}-${string}`
    }
  }
}

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry } from './observability/sentry.ts'
import { MedicalErrorBoundary } from './components/common/MedicalErrorBoundary.tsx'

// Inicializar telemetría segura de Sentry si hay DSN configurado
initSentry()

// Nota: sin StrictMode — el editor (Crepe/ProseMirror) no tolera
// el doble montaje de efectos en desarrollo.
createRoot(document.getElementById('root')!).render(
  <MedicalErrorBoundary>
    <App />
  </MedicalErrorBoundary>,
)
