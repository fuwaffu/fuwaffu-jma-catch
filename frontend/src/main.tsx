import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ObsApp from './ObsApp.tsx'

const urlParams = new URLSearchParams(window.location.search);
const isObsMode = urlParams.get('mode') === 'obs';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isObsMode ? <ObsApp /> : <App />}
  </StrictMode>,
)
