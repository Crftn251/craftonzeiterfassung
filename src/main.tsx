
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Simple error boundary to surface runtime issues in the UI
class ErrorBoundary extends React.Component<
  { children: React.ReactNode }, 
  { hasError: boolean; error?: unknown }
> {
  state = { hasError: false, error: undefined };
  
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary] Caught error', error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Fehler beim Laden der App</h1>
          <p className="mt-2 text-sm opacity-80">Bitte laden Sie die Seite neu. Details unten:</p>
          <pre className="mt-3 text-xs whitespace-pre-wrap">
            {String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

console.log('[Boot] main.tsx start');
const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[Boot] Root element not found');
  throw new Error('Root element not found');
}

try {
  console.log('[Boot] Creating root and rendering App');
  const root = createRoot(rootEl);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  console.log('[Boot] Render invoked');
} catch (e) {
  console.error('[Boot] Render failed', e);
  if (rootEl) {
    rootEl.innerHTML = `<pre style="padding:16px">App crash: ${String(e)}</pre>`;
  }
}
