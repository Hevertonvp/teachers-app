import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { registerServiceWorker } from './pwa/registerServiceWorker.js'
import './offline/networkStatus.js' // registra os handlers de conectividade em api.js — precisa ser importado antes de qualquer apiFetch

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
