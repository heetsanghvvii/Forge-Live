import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, Loader2, AlertTriangle, Check, Eye, Clock, Lock } from 'lucide-react';
import type { SyncBadgeStatus } from '../utils/autoSyncController';

interface Props {
  status: SyncBadgeStatus;
  onRetry: () => void;
  onOpenSettings: () => void;
}

const STYLE: Record<SyncBadgeStatus['kind'], string> = {
  idle: 'text-slate-300 border-[#222933]',
  pending: 'text-amber-300 border-amber-500/30',
  saving: 'text-sky-300 border-sky-500/30',
  synced: 'text-[#B6FF3B] border-[#B6FF3B]/30',
  offline: 'text-amber-300 border-amber-500/30',
  failed: 'text-rose-300 border-rose-500/40',
  conflict: 'text-amber-200 border-amber-500/50',
  disabled: 'text-slate-400 border-[#222933]',
  viewer: 'text-purple-300 border-purple-500/40',
  checking: 'text-slate-300 border-[#222933]',
  'cloud-found': 'text-sky-300 border-sky-500/40',
  'cloud-empty': 'text-slate-300 border-[#222933]',
  'check-failed': 'text-rose-300 border-rose-500/40'
};

function Icon({ kind }: { kind: SyncBadgeStatus['kind'] }) {
  const c = 'w-3.5 h-3.5 shrink-0';
  switch (kind) {
    case 'saving': case 'checking': return <Loader2 className={`${c} animate-spin`} />;
    case 'synced': return <Check className={c} />;
    case 'offline': return <CloudOff className={c} />;
    case 'failed': case 'conflict': case 'check-failed': return <AlertTriangle className={c} />;
    case 'viewer': return <Eye className={c} />;
    case 'pending': return <Clock className={c} />;
    case 'disabled': return <Lock className={c} />;
    default: return <Cloud className={c} />;
  }
}

/** Small status badge for the top bar. Tap: Conflict opens Settings; everything else opens a short details panel. */
export const SyncBadge: React.FC<Props> = ({ status, onRetry, onOpenSettings }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [status.kind]);
  const spoken = [status.label, status.kind === 'synced' && status.lastSyncedLabel ? `last synced ${status.lastSyncedLabel}` : '', status.detail && status.kind !== 'synced' ? status.detail : ''].filter(Boolean).join('. ');
  const canRetry = status.kind === 'failed' || status.kind === 'offline' || status.kind === 'check-failed';
  const canSettings = status.kind === 'disabled' && status.disabledReason !== 'signed-out';
  const canLoad = status.kind === 'cloud-found';
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (status.kind === 'conflict' ? onOpenSettings() : setOpen(o => !o))}
        aria-expanded={status.kind === 'conflict' ? undefined : open}
        aria-label={`Cloud save status: ${spoken}`}
        className={`min-h-[36px] px-2.5 rounded-xl bg-[#14181D] border text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition-all ${STYLE[status.kind]}`}
      >
        <Icon kind={status.kind} />
        <span>{status.label}</span>
        {status.kind === 'synced' && status.lastSyncedLabel && <span className="font-mono font-medium text-slate-400">{status.lastSyncedLabel}</span>}
      </button>
      {/* Screen readers hear every status change, politely. */}
      <span className="sr-only" role="status" aria-live="polite">{spoken}</span>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 z-50 p-3 rounded-2xl bg-[#14181D] border border-[#222933] shadow-2xl text-[11px] space-y-2">
          <p className="text-slate-200 leading-relaxed">{status.detail || status.label}</p>
          {status.kind === 'failed' && status.retryInMs !== undefined && (
            <p className="text-slate-400">Retrying automatically in about {Math.max(1, Math.round(status.retryInMs / 1000))}s.</p>
          )}
          {status.refreshError && <p className="text-slate-400">Last cloud check failed: {status.refreshError}</p>}
          <div className="flex gap-2">
            {canRetry && <button type="button" onClick={() => { setOpen(false); onRetry(); }} className="min-h-[36px] px-3 rounded-xl bg-[#B6FF3B] text-black font-extrabold active:scale-95">Retry now</button>}
            {canLoad && <button type="button" onClick={() => { setOpen(false); onOpenSettings(); }} className="min-h-[36px] px-3 rounded-xl bg-[#B6FF3B] text-black font-extrabold active:scale-95">Load from cloud</button>}
            {(canSettings || status.kind === 'cloud-empty' || status.kind === 'failed') && <button type="button" onClick={() => { setOpen(false); onOpenSettings(); }} className="min-h-[36px] px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-slate-200 font-semibold active:scale-95">Open Settings</button>}
            <button type="button" onClick={() => setOpen(false)} className="min-h-[36px] px-3 rounded-xl text-slate-400 hover:text-white">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
