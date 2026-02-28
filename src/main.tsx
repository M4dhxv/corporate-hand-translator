import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

/**
 * Entry point for the Corporate Signal Translator application.
 * Wraps App in ErrorBoundary to gracefully handle runtime failures
 * (camera denied, CDN offline, WebGL unsupported, etc.).
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);
