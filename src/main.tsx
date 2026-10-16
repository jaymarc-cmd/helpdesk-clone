import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Base styles first so page-level stylesheets (imported by pages) can override them.
import './styles.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
