import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Nota: sin StrictMode — el editor (Crepe/ProseMirror) no tolera
// el doble montaje de efectos en desarrollo.
createRoot(document.getElementById('root')!).render(<App />)
