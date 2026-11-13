import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { signUpWithEmail, signInWithEmail, sendResetEmail, MIN_PASSWORD_LENGTH } from '../utils/emailAuth';

type Mode = 'login' | 'signup' | 'reset';

interface Props {
  onSignedIn?: (email: string | null) => void;
}

const inputCls =
  'w-full h-11 pl-10 pr-3 rounded-xl bg-[#14181D] border border-[#222933] text-white text-sm focus:outline-none focus:border-[#B6FF3B] transition-colors';

export const EmailAccountPanel: React.FC<Props> = ({ onSignedIn }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (password !== confirm) throw new Error('Passwords do not match.');
        const { user, verificationSent } = await signUpWithEmail(email, password);
        setInfo(
          verificationSent
            ? `Account created. We sent a verification link to ${user.email}. Check your inbox and spam folder.`
            : 'Account created. The verification email could not be sent; you can still use the app.'
        );
        onSignedIn?.(user.email);
      } else if (mode === 'login') {
        const user = await signInWithEmail(email, password);
        onSignedIn?.(user.email);
      } else {
        await sendResetEmail(email);
        setInfo('If an account exists for that email, a password reset link is on its way. Check spam too.');
      }
      setPassword('');
      setConfirm('');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      className={`min-h-[40px] flex-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
        mode === m ? 'bg-[#B6FF3B] text-black' : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3 pt-3 mt-3 border-t border-[#222933]">
      <p className="text-[11px] text-slate-400">Or use an email and password. Your password is handled by Firebase and never stored in this app.</p>
      <div className="flex gap-1 p-1 rounded-xl bg-[#14181D] border border-[#222933]">
        {tab('login', 'Log in')}
        {tab('signup', 'Create account')}
        {tab('reset', 'Forgot password')}
      </div>

      {error && (
        <div role="alert" className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-[11px]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div role="status" className="p-2.5 rounded-lg bg-[#B6FF3B]/10 border border-[#B6FF3B]/20 flex items-start gap-2 text-[#B6FF3B] text-[11px]">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{info}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-2.5" noValidate>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="email"
            autoComplete="email"
            aria-label="Email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>
        {mode !== 'reset' && (
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              aria-label="Password"
              placeholder={mode === 'signup' ? `Password (min ${MIN_PASSWORD_LENGTH} characters)` : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pr-10`}
            />
            <button
              type="button"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              onClick={() => setShowPw(!showPw)}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        )}
        {mode === 'signup' && (
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              aria-label="Confirm password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[44px] rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider active:scale-95 disabled:opacity-50 transition-all"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>
      </form>
    </div>
  );
};
