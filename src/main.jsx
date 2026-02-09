import React from 'react'
import ReactDOM from 'react-dom/client'
import './lib/sentry' // Initialize Sentry before App (only loads in production if DSN is set)
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
