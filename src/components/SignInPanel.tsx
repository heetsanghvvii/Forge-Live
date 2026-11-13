import React, { useEffect, useState } from 'react';
import { LogIn, X } from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ensureGoogleSignIn } from '../utils/cloudSync';
import { EmailAccountPanel } from './EmailAccountPanel';

interface PanelProps {
  onSignedIn?: (label: string) => void;
  onError?: (message: string) => void;
}

/** THE cloud sign-in flow (Google + email). Used by the Login button, the Settings cloud panel and the sync banner. */
export const SignInPanel: React.FC<PanelProps> = ({ onSignedIn, onError }) => {
  const [busy, setBusy] = useState(false);
  const google = async () => {
    setBusy(true);
    try {
      const u = await ensureGoogleSignIn();
      onSignedIn?.(u.email || u.displayName || 'your Google account');
    } catch (e: any) {
      onError?.(e?.message || 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400">
        Cloud login: backs up your records and lets other devices see them. Nothing is saved until you tap "Save to cloud" once to link this device.
      </p>
      <button
        type="button"
        onClick={google}
        disabled={busy}
        className="min-h-[40px] px-4 rounded-xl bg-white text-black font-bold text-xs flex items-center gap-2 hover:bg-slate-200 active:scale-95 transition-all shadow-md disabled:opacity-50"
      >
        <LogIn className="w-4 h-4" />
        <span>Sign in with Google</span>
      </button>
      <EmailAccountPanel onSignedIn={(em) => onSignedIn?.(em || 'your account')} />
    </div>
  );
};

interface ModalProps {
  onClose: () => void;
  onSignedIn?: (label: string) => void;
  /** Opens the legacy on-device profile screen (kept, clearly labelled). */
  onUseOnDeviceProfile?: () => void;
}

/** Full-screen wrapper: Close button + Escape. Closing never signs out and never changes data. */
export const SignInModal: React.FC<ModalProps> = ({ onClose, onSignedIn, onUseOnDeviceProfile }) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto" role="dialog" aria-modal="true" aria-label="Sign in to the cloud">
      <div className="w-full max-w-md bg-[#14181D] border border-[#222933] rounded-3xl p-6 shadow-2xl space-y-4 my-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">Cloud sign-in</h2>
            <p className="text-xs text-slate-400">{user ? `Signed in as ${user.email || user.displayName || 'your account'}` : 'Sign in to back up and sync.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close sign-in" className="w-10 h-10 shrink-0 rounded-xl bg-[#0B0D10] border border-[#222933] flex items-center justify-center text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        {user ? (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-300">You are signed in. Open Settings to link this device and save to the cloud.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="min-h-[40px] px-4 rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs active:scale-95">Done</button>
              <button type="button" onClick={() => { void signOut(auth); }} className="min-h-[40px] px-4 rounded-xl bg-[#0B0D10] border border-[#222933] text-slate-200 font-semibold text-xs active:scale-95">Sign out</button>
            </div>
          </div>
        ) : (
          <SignInPanel onSignedIn={(l) => { setErr(null); onSignedIn?.(l); onClose(); }} onError={setErr} />
        )}
        {err && <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2" role="alert">{err}</p>}
        {onUseOnDeviceProfile && !user && (
          <button type="button" onClick={onUseOnDeviceProfile} className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-white min-h-[36px]">
            Use an on-device profile instead (not a cloud login)
          </button>
        )}
        <button type="button" onClick={onClose} className="block w-full min-h-[40px] text-xs text-slate-400 hover:text-white">Back to the app</button>
      </div>
    </div>
  );
};
