import React, { useState } from 'react';
import { UserAccount, AppState } from '../types';
import {
  getAllAccounts,
  setActiveUsername,
  updateAccountProfile,
  logoutActiveUser
} from '../utils/storage';
import {
  X,
  User,
  LogOut,
  Users,
  Edit2,
  Check,
  Scale,
  Ruler,
  Flame,
  Award,
  Sparkles
} from 'lucide-react';

interface UserProfileModalProps {
  currentAccount: UserAccount | null;
  appState: AppState;
  onClose: () => void;
  onSwitchUser: (account: UserAccount) => void;
  onLogout: () => void;
  onProfileUpdated: (updatedAccount: UserAccount) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  currentAccount,
  appState,
  onClose,
  onSwitchUser,
  onLogout,
  onProfileUpdated
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(
    currentAccount?.displayName || appState.settings.displayName || 'Champion'
  );
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(
    currentAccount?.gender || appState.settings.gender || 'male'
  );
  const [heightCm, setHeightCm] = useState<number | string>(
    currentAccount?.heightCm || appState.settings.heightCm || ''
  );
  const [bodyweightKg, setBodyweightKg] = useState<number | string>(
    currentAccount?.bodyweightKg || appState.settings.bodyweightKg || ''
  );
  const [avatarEmoji, setAvatarEmoji] = useState<string>(
    currentAccount?.avatarEmoji || appState.settings.avatarEmoji || '💪'
  );

  const avatarOptions = ['💪', '⚡', '🔥', '🏋️', '🥋', '🦁', '🎯', '🚀'];

  const allAccounts = getAllAccounts();
  const otherAccounts = Object.values(allAccounts).filter(
    (acc) => acc.username !== currentAccount?.username
  );

  const formatHeight = (cm: number) => {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet} ft ${inches} in`;
  };

  const calculateBmi = (kg: number, cm: number) => {
    if (!kg || !cm) return 0;
    const heightM = cm / 100;
    return Math.round((kg / (heightM * heightM)) * 10) / 10;
  };

  const numWeight = bodyweightKg !== '' ? Number(bodyweightKg) : 0;
  const numHeight = heightCm !== '' ? Number(heightCm) : 0;
  const currentBmi = calculateBmi(numWeight, numHeight);

  const handleSaveProfile = () => {
    if (!currentAccount) return;
    const updated = updateAccountProfile(currentAccount.username, {
      displayName,
      gender,
      heightCm: numHeight || undefined,
      bodyweightKg: numWeight || undefined,
      avatarEmoji
    });
    if (updated) {
      onProfileUpdated(updated);
      setIsEditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-md bg-[#14181D] border border-[#222933] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222933]">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#B6FF3B]" />
            <h2 className="text-lg font-bold text-white tracking-tight">Athlete Profile</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile modal"
            className="w-9 h-9 rounded-xl bg-[#0B0D10] border border-[#222933] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Avatar & Hero Card */}
        <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#14181D] border border-[#222933] flex items-center justify-center text-3xl shadow-md shrink-0">
            {avatarEmoji}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-extrabold text-white truncate">
              {displayName}
            </h3>
            <p className="text-xs font-mono text-slate-400 truncate">
              @{currentAccount?.username || 'user'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#B6FF3B]/10 text-[#B6FF3B]">
                {gender}
              </span>
              {numHeight > 0 && (
                <span className="text-[10px] font-mono text-slate-400">
                  {numHeight} cm ({formatHeight(numHeight)})
                </span>
              )}
            </div>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-xl bg-[#14181D] border border-[#222933] text-slate-300 hover:text-[#B6FF3B]"
              title="Edit Profile"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Edit Profile Form */}
        {isEditing ? (
          <div className="space-y-4 p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] animate-in fade-in">
            <span className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
              Edit Athlete Details
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white text-xs focus:outline-none focus:border-[#B6FF3B]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white text-xs focus:outline-none focus:border-[#B6FF3B]"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Height (cm)</label>
                <input
                  type="number"
                  min="100"
                  max="240"
                  value={heightCm}
                  onChange={(e) => setHeightCm(parseInt(e.target.value) || 0)}
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white text-xs font-mono focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Current Weight (kg)</label>
              <input
                type="number"
                step="0.5"
                min="40"
                max="200"
                value={bodyweightKg}
                onChange={(e) => setBodyweightKg(parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white text-xs font-mono focus:outline-none focus:border-[#B6FF3B]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Avatar</label>
              <div className="flex items-center gap-1.5">
                {avatarOptions.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setAvatarEmoji(em)}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center ${
                      avatarEmoji === em ? 'bg-[#B6FF3B]/20 border border-[#B6FF3B]' : 'bg-[#14181D]'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-9 px-3 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="h-9 px-4 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold"
              >
                Save Profile
              </button>
            </div>
          </div>
        ) : (
          /* Stats Grid */
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933] text-center">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">Weight</span>
              <span className="text-base font-extrabold text-white font-mono">
                {numWeight > 0 ? `${numWeight} kg` : 'Not set'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933] text-center">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">BMI Index</span>
              <span className="text-base font-extrabold text-[#B6FF3B] font-mono">
                {currentBmi > 0 ? currentBmi : 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933] text-center">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">Height</span>
              <span className="text-base font-extrabold text-sky-400 font-mono">
                {numHeight > 0 ? `${numHeight} cm` : 'Not set'}
              </span>
            </div>
          </div>
        )}

        {/* Switch Account Section */}
        {otherAccounts.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Users className="w-3.5 h-3.5" />
              <span>Switch Local Account:</span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {otherAccounts.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => {
                    setActiveUsername(acc.username);
                    onSwitchUser(acc);
                    onClose();
                  }}
                  className="w-full p-2.5 rounded-xl bg-[#0B0D10] border border-[#222933] hover:border-slate-600 flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{acc.avatarEmoji || '💪'}</span>
                    <div>
                      <span className="block text-xs font-bold text-white leading-tight">
                        {acc.displayName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        @{acc.username} · {acc.bodyweightKg} kg · {acc.heightCm} cm
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#B6FF3B]">Switch</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons: Log Out */}
        <div className="pt-2 border-t border-[#222933] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              logoutActiveUser();
              onLogout();
              onClose();
            }}
            className="min-h-[44px] px-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-2 hover:bg-rose-500/20 active:scale-95 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl bg-[#14181D] border border-slate-700 text-slate-200 font-bold text-xs hover:border-[#B6FF3B] active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
