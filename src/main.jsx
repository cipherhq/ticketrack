import React from 'react'
import ReactDOM from 'react-dom/client'
import './lib/sentry' // Initialize Sentry before App (only loads in production if DSN is set)
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // New version available - update immediately so users don't get stale chunks
      updateSW(true)
    },
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
