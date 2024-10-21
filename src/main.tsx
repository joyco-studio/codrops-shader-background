import React from 'react'
import ReactDOM from 'react-dom/client'
import '@repo/ui/globals.css'
import App from './app.tsx'
import { Header } from './default-ui.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Header />
    <div id="webgl">
      <App />
    </div>
  </React.StrictMode>
)
