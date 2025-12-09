import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Lazy load MultiViewPage - only loaded when on /multiview route
const MultiViewPage = lazy(() => import('./components/multiview/MultiViewPage'));

// Initialize Sentry for error tracking (if configured)
if (import.meta.env.PROD) {
  import('@sentry/react').then(Sentry => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration()
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0
    });
  });
}

// Check if we're on the multi-view route
const isMultiViewRoute = window.location.pathname.startsWith('/multiview');

// Simple loading fallback for multi-view
const MultiViewLoadingFallback = () => (
  <div style={{
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    color: '#666',
    fontFamily: 'Inter, sans-serif',
  }}>
    Loading Multi-View...
  </div>
);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Render MultiViewPage for /multiview route, otherwise render main App
root.render(
  <React.StrictMode>
    {isMultiViewRoute ? (
      <Suspense fallback={<MultiViewLoadingFallback />}>
        <MultiViewPage />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
