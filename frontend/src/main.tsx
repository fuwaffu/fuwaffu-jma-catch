import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ObsApp from './ObsApp.tsx'

const urlParams = new URLSearchParams(window.location.search);
const isObsMode = urlParams.get('mode') === 'obs';

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const getJST = () => new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

console.log = (...args) => originalConsoleLog(`[${getJST()}]`, ...args);
console.error = (...args) => originalConsoleError(`[${getJST()}]`, ...args);
console.warn = (...args) => originalConsoleWarn(`[${getJST()}]`, ...args);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isObsMode ? <ObsApp /> : <App />}
  </StrictMode>,
)
