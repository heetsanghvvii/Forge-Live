import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, RotateCcw, X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const MAX_VISIBLE_TOASTS = 3;

export const ToastContainer: React.FC<ToastProps> = ({ toasts: allToasts, onDismiss }) => {
  if (allToasts.length === 0) return null;
  // Show only the newest 3 (the oldest are dropped from view).
  const toasts = allToasts.slice(-MAX_VISIBLE_TOASTS);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((toast) => {
        const isWarning = toast.type === 'warning';
        const isInfo = toast.type === 'info';

        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
              isWarning
                ? 'bg-[#1E1712] border-[#FF8C3B]/40 text-[#FF8C3B]'
                : isInfo
                ? 'bg-[#141B26] border-sky-500/40 text-sky-300'
                : 'bg-[#14181D]/95 border-[#B6FF3B]/30 text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isWarning ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#FF8C3B]" />
              ) : isInfo ? (
                <Info className="w-4 h-4 shrink-0 text-sky-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#B6FF3B]" />
              )}
              <span className="text-xs sm:text-sm font-medium tracking-tight truncate">
                {toast.text}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.undoAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.undoAction?.();
                    onDismiss(toast.id);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 min-h-[36px] text-xs font-semibold text-[#B6FF3B] hover:bg-[#B6FF3B]/10 rounded transition-colors active:scale-95"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Close notification"
                className="text-slate-400 hover:text-white p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
