import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { registerAccount, loginAccount } from '../utils/storage';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  X
} from 'lucide-react';

interface AuthModalProps {
  onSuccess: (account: UserAccount) => void;
  isOpen?: boolean;
  /** Closing never signs out and never changes data. */
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onSuccess,
  isOpen = true,
  onClose
}) => {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Role selection
  const [role, setRole] = useState<'owner' | 'coach'>('owner');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [displayName, setDisplayName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [bodyweightKg, setBodyweightKg] = useState<number | ''>('');
  const [avatarEmoji, setAvatarEmoji] = useState<string>('💪');

  const avatarOptions = ['💪', '⚡', '🔥', '🏋️', '🥋', '🦁', '🎯', '🚀', '🛡️'];

  // Height conversion helper: cm to ft & in
  const formatHeight = (cm: number | '') => {
    if (!cm) return 'Enter height';
    const totalInches = Number(cm) / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet} ft ${inches} in`;
  };

  // BMI calculation
  const calculateBmi = (kg: number | '', cm: number | '') => {
    if (!kg || !cm) return 0;
    const heightM = Number(cm) / 100;
    return Math.round((Number(kg) / (heightM * heightM)) * 10) / 10;
  };

  const currentBmi = calculateBmi(bodyweightKg, heightCm);

  const getBmiCategory = (bmi: number) => {
    if (bmi <= 0) return 'Pending';
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal Weight';
    if (bmi < 30) return 'Overweight';
    return 'Obesity';
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!loginUsername.trim()) {
      setErrorMsg('Please enter your username.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Please enter your password.');
      return;
    }

    const res = loginAccount(loginUsername, loginPassword);
    if (!res.success || !res.account) {
      setErrorMsg(res.error || 'Login failed.');
      return;
    }

    onSuccess(res.account);
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!displayName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!signupUsername.trim() || signupUsername.trim().length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }
    if (!signupPassword || signupPassword.length < 4) {
      setErrorMsg('Password must be at least 4 characters.');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    if (role === 'owner') {
      if (heightCm === '' || Number(heightCm) < 100 || Number(heightCm) > 240) {
        setErrorMsg('Please enter a valid height between 100 and 240 cm.');
        return;
      }
      if (bodyweightKg === '' || Number(bodyweightKg) < 40 || Number(bodyweightKg) > 200) {
        setErrorMsg('Please enter a valid bodyweight between 40 and 200 kg.');
        return;
      }
    }

    const res = registerAccount({
      username: signupUsername,
      displayName,
      password: signupPassword,
      gender: role === 'coach' ? undefined : gender,
      heightCm: role === 'coach' || heightCm === '' ? undefined : Number(heightCm),
      bodyweightKg: role === 'coach' || bodyweightKg === '' ? undefined : Number(bodyweightKg),
      avatarEmoji: role === 'coach' ? '🛡️' : avatarEmoji,
      role
    });

    if (!res.success || !res.account) {
      setErrorMsg(res.error || 'Registration failed.');
      return;
    }

    onSuccess(res.account);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto" role="dialog" aria-modal="true" aria-label="On-device profile">
      <div className="relative w-full max-w-md bg-[#14181D] border border-[#222933] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-auto animate-in fade-in zoom-in-95 duration-200">
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-[#0B0D10] border border-[#222933] flex items-center justify-center text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
        {/* App Branding */}
        <div className="flex flex-col items-center text-center space-y-1.5 pt-1">
          <div className="w-14 h-14 rounded-2xl bg-[#B6FF3B] flex items-center justify-center text-black font-extrabold text-xl shadow-lg shadow-[#B6FF3B]/20 mb-1">
            F
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            On-device profile (not cloud login)
          </h2>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Forge profile stored only on this device. It does not back up or sync. To back up, use the cloud sign-in instead.
          </p>
        </div>

        {/* Tab Toggle: Log In / Create Account */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#0B0D10] border border-[#222933]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`min-h-[42px] rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
              mode === 'login'
                ? 'bg-[#B6FF3B] text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
            }}
            className={`min-h-[42px] rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
              mode === 'signup'
                ? 'bg-[#B6FF3B] text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form: Log In Mode */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-sm focus:outline-none focus:border-[#B6FF3B] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full h-12 pl-10 pr-11 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-sm focus:outline-none focus:border-[#B6FF3B] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#B6FF3B]/10 hover:bg-[#a6ec31] active:scale-95 transition-all"
            >
              <span>Log In to Your Journey</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Form: Create Account Mode */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-4 max-h-[62vh] overflow-y-auto pr-1 no-scrollbar">
            {/* Account Role Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === 'owner'
                      ? 'bg-[#14181D] border-[#B6FF3B] text-white'
                      : 'bg-[#0B0D10] border-[#222933] text-slate-400'
                  }`}
                >
                  <span className="block text-xs font-bold text-white">Athlete / Owner</span>
                  <span className="block text-[10px] text-slate-400">Full edit access to personal tracker</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('coach')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === 'coach'
                      ? 'bg-[#14181D] border-purple-400 text-white'
                      : 'bg-[#0B0D10] border-[#222933] text-slate-400'
                  }`}
                >
                  <span className="block text-xs font-bold text-white">Coach Account</span>
                  <span className="block text-[10px] text-slate-400">Read-only audit & review dashboard</span>
                </button>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {role === 'coach' ? 'Coach Name' : 'Full Name'}
              </label>
              <input
                type="text"
                placeholder={role === 'coach' ? 'e.g. Coach' : 'e.g. Your Name'}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-sm focus:outline-none focus:border-[#B6FF3B]"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username (for sign in)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">@</span>
                <input
                  type="text"
                  placeholder="username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full h-11 pl-8 pr-3.5 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-sm font-mono focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>
            </div>

            {/* Password and Confirm Password */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 4 chars"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-sm focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-sm focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>
            </div>

            {role === 'owner' && (
              <>
                {/* Gender Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Gender
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['male', 'female', 'other'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={`h-10 rounded-xl text-xs font-bold capitalize transition-all ${
                          gender === g
                            ? 'bg-[#B6FF3B] text-black shadow-sm'
                            : 'bg-[#0B0D10] border border-[#222933] text-slate-400 hover:text-white'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Height & Weight Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Height
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatHeight(heightCm)}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="100"
                        max="240"
                        placeholder="e.g. 175"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full h-11 px-3 pr-10 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-sm font-semibold focus:outline-none focus:border-[#B6FF3B]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                        CM
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Starting Weight
                      </label>
                      <span className="text-[10px] text-[#B6FF3B] font-mono">
                        {bodyweightKg ? `${Math.round(Number(bodyweightKg) * 2)}g Pro` : 'Baseline'}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="40"
                        max="200"
                        placeholder="e.g. 70"
                        value={bodyweightKg}
                        onChange={(e) => setBodyweightKg(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full h-11 px-3 pr-10 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-sm font-semibold focus:outline-none focus:border-[#B6FF3B]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                        KG
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body Metrics Summary Strip */}
                {bodyweightKg && heightCm && (
                  <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#222933] flex items-center justify-between text-xs animate-in fade-in">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Calculated BMI</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {currentBmi} <span className="text-[11px] font-normal text-slate-400">({getBmiCategory(currentBmi)})</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Maintenance</span>
                      <span className="font-mono font-bold text-[#B6FF3B] text-sm">
                        ~{Math.round(Number(bodyweightKg) * 29)} kcal
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Avatar Emoji Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Choose Profile Avatar
              </label>
              <div className="flex items-center justify-between gap-1 p-1 bg-[#0B0D10] border border-[#222933] rounded-xl">
                {avatarOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatarEmoji(emoji)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                      avatarEmoji === emoji
                        ? 'bg-[#B6FF3B]/20 border border-[#B6FF3B] scale-110'
                        : 'hover:bg-slate-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#B6FF3B]/10 hover:bg-[#a6ec31] active:scale-95 transition-all mt-2"
            >
              <span>{role === 'coach' ? 'Create Coach Account' : 'Create Account & Start Program'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
