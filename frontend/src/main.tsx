import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LikedArticlesProvider } from './contexts/LikedArticlesContext'
import { LocalizationProvider } from './contexts/LocalizationContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LocalizationProvider>
        <LikedArticlesProvider>
          <App />
        </LikedArticlesProvider>
      </LocalizationProvider>
    </ErrorBoundary>
  </StrictMode>,
)
