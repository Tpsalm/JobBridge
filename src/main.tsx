import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';

// Apply persisted dark mode preference before React mounts so initial render matches
try {
  const dark = localStorage.getItem('darkMode');
  if (dark === 'true') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch (e) {
  // ignore (e.g., SSR or restricted storage)
}

// Capture global errors for debugging blank page on Vercel
window.addEventListener('error', (e) => {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#fee;color:#c00;padding:12px;font:13px monospace;z-index:99999;white-space:pre-wrap';
  el.textContent = `[JS Error] ${e.message}\n${e.filename ? e.filename : ''}`;
  document.body.appendChild(el);
});
window.addEventListener('unhandledrejection', (e) => {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:40px;left:0;right:0;background:#fee;color:#c00;padding:12px;font:13px monospace;z-index:99999;white-space:pre-wrap';
  el.textContent = `[Promise Error] ${e.reason?.message || e.reason}`;
  document.body.appendChild(el);
});

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
        <ToastContainer />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);

