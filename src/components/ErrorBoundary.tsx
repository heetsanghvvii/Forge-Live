import React from 'react';
import { STORAGE_KEY } from '../utils/storage';
import { downloadTextFile } from '../utils/download';
import { getPendingUnsavedText } from '../utils/storageNotices';

interface State { error: Error | null }

/** Last-resort screen for render crashes. Never loses data: offers a backup download before any reset. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Forge crashed while rendering:', error, info.componentStack);
  }

  private backup = () => {
    let text: string | null = null;
    try { text = getPendingUnsavedText() ?? localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (!text) { window.alert('There is no saved data on this device to download.'); return; }
    downloadTextFile(`forge-backup-${new Date().toISOString().slice(0, 10)}.json`, text);
  };

  private reset = () => {
    if (!window.confirm("Reset this browser's local copy? Download a backup first. This cannot be undone.")) return;
    try {
      // Keep a copy of what we are removing, then clear only the app state.
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(`forge_corrupt_backup_v1_${Date.now()}`, raw);
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const btn = 'w-full min-h-[48px] rounded-xl text-sm font-bold px-4';
    return (
      <div role="alert" className="min-h-screen bg-[#0B0D10] text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-extrabold">Something went wrong</h1>
          <p className="text-sm text-slate-400">
            Your data has not been deleted. Reload to try again, or download a backup first to be safe.
          </p>
          <button type="button" onClick={() => window.location.reload()} className={`${btn} bg-[#B6FF3B] text-black`}>Reload</button>
          <button type="button" onClick={this.backup} className={`${btn} border border-slate-700 text-slate-200`}>Download my data (backup)</button>
          <button type="button" onClick={this.reset} className={`${btn} border border-red-500/40 text-red-300`}>Reset this browser's local copy</button>
        </div>
      </div>
    );
  }
}
