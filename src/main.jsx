import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import './index.css'

void import('virtual:pwa-register')
  .then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
  .catch(() => {
    /* PWA plugin not loaded */
  })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
