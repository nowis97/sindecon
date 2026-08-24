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
