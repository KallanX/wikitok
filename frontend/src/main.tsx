import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LikedArticlesProvider } from './contexts/LikedArticlesContext'
import { LocalizationProvider } from './contexts/LocalizationContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocalizationProvider>
      <LikedArticlesProvider>
        <App />
      </LikedArticlesProvider>
    </LocalizationProvider>
  </StrictMode>,
)
