import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import {StorageNotices} from './components/StorageNotices';
import './index.css';
import {EMULATOR_MODE} from './lib/firebase';

// Keep a focused field visible above the fixed tab bar / on-screen keyboard.
document.addEventListener('focusin', (e) => {
  const el = e.target as HTMLElement | null;
  if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  setTimeout(() => { try { el.scrollIntoView({block: 'center', behavior: 'smooth'}); } catch { /* ignore */ } }, 300);
});

if (EMULATOR_MODE) {
  // Unmistakable on every screen: this build talks to the local emulator, not the real project.
  document.title = '[EMULATOR] ' + document.title;
  const tag = document.createElement('div');
  tag.textContent = 'EMULATOR (test data only)';
  tag.setAttribute('data-testid', 'emulator-banner');
  tag.style.cssText = 'position:fixed;bottom:2px;left:2px;z-index:100000;background:#b91c1c;color:#fff;font:700 9px/1 monospace;padding:2px 4px;border-radius:4px;pointer-events:none;opacity:.9';
  document.body.appendChild(tag);
}

// Lets the app be installed to the Home Screen and show notifications. No caching.
if ('serviceWorker' in navigator && import.meta.env.PROD && !EMULATOR_MODE) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* reminders still show inside the app */ });
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <StorageNotices />
    <App />
  </ErrorBoundary>
);
