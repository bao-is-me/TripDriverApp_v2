import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { TripDriverApp } from './app/TripDriverApp'
import './style.css'

const container = document.querySelector('#app')

if (!container) {
  throw new Error('TripDriver root container was not found.')
}

createRoot(container).render(
  <StrictMode>
    <TripDriverApp />
  </StrictMode>,
)
