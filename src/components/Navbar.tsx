import React from 'react';
import { TabType, PhaseType } from '../types';
import { SyncBadge } from './SyncBadge';
import type { SyncBadgeStatus } from '../utils/autoSyncController';
import { Home, Dumbbell, UtensilsCrossed, TrendingUp, Settings } from 'lucide-react';

interface NavbarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenSettings: () => void;
  currentDayNumber: number;
  activePhase: PhaseType;
  phase3Unlocked: boolean;
  onSwitchPhase: (phase: PhaseType) => void;
}

export const TopBar: React.FC<{
  currentDayNumber: number;
  activePhase: PhaseType;
  phase3Unlocked: boolean;
  currentUser: { displayName?: string; username: string; avatarEmoji?: string } | null;
  onSwitchPhase: (phase: PhaseType) => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  syncStatus?: SyncBadgeStatus | null;
  onSyncRetry?: () => void;
  onOpenSyncSettings?: () => void;
}> = ({
  currentDayNumber,
  activePhase,
  phase3Unlocked,
  currentUser,
  onSwitchPhase,
  onOpenSettings,
  onOpenProfile,
  onOpenAuth,
  syncStatus,
  onSyncRetry,
  onOpenSyncSettings
}) => {
  const getPhaseDetails = () => {
    if (activePhase === 'phase1') {
      return {
        label: 'Phase 1: Foundation',
        dayLabel: `Day ${currentDayNumber} of 7`
      };
    } else if (activePhase === 'phase2') {
      return {
        label: 'Phase 2: Base Building',
        dayLabel: `Day ${currentDayNumber - 7} of 28`
      };
    } else {
      return {
        label: 'Phase 3: Muscle Building',
        dayLabel: `Day ${currentDayNumber - 35} of 28`
      };
    }
  };

  const details = getPhaseDetails();

  return (
    <header className="sticky top-0 z-30 w-full bg-[#0B0D10]/95 backdrop-blur-md border-b border-[#222933]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {currentUser ? (
            <button
              type="button"
              onClick={onOpenProfile}
              className="w-8 h-8 rounded-lg bg-[#14181D] border border-[#222933] hover:border-[#B6FF3B] flex items-center justify-center text-sm shadow-md shrink-0 transition-colors"
              title={`Logged in as ${currentUser.displayName || currentUser.username}`}
            >
              {currentUser.avatarEmoji || '💪'}
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#B6FF3B] flex items-center justify-center text-black font-extrabold text-sm shadow-md shadow-[#B6FF3B]/20 shrink-0">
              F
            </div>
          )}
          {/* Below 360px the title block would be squeezed to an unreadable "F."; the logo stays, the text returns when it fits. */}
          <div className="min-w-0 hidden min-[360px]:block">
            <h1 className="text-xs sm:text-sm font-extrabold text-white tracking-tight leading-tight truncate">
              {currentUser ? currentUser.displayName || currentUser.username : 'Forge'}
            </h1>
            <p className="text-[11px] font-medium text-slate-400 truncate">
              {details.label} <span className="text-slate-600">·</span> {details.dayLabel} <span className="text-slate-600">·</span> Day {currentDayNumber}/100
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Phase 1 / Phase 2 / Phase 3 Segmented Pill */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#14181D] border border-[#222933]">
            <button
              type="button"
              onClick={() => onSwitchPhase('phase1')}
              title="Preview Phase 1 (does not change your plan)"
              className={`px-2 min-h-[36px] min-w-[36px] text-[11px] font-bold rounded-lg transition-colors ${
                activePhase === 'phase1'
                  ? 'bg-[#B6FF3B] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              P1
            </button>

            <button
              type="button"
              onClick={() => onSwitchPhase('phase2')}
              title="Preview Phase 2 (does not change your plan)"
              className={`px-2 min-h-[36px] min-w-[36px] text-[11px] font-bold rounded-lg transition-colors ${
                activePhase === 'phase2'
                  ? 'bg-[#B6FF3B] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              P2
            </button>

            <button
              type="button"
              onClick={() => onSwitchPhase('phase3')}
              title="Preview Phase 3 (does not change your plan)"
              className={`px-2 min-h-[36px] min-w-[36px] text-[11px] font-bold rounded-lg transition-colors ${
                activePhase === 'phase3'
                  ? 'bg-[#B6FF3B] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              P3
            </button>
          </div>

          {currentUser ? (
            <button
              type="button"
              onClick={onOpenProfile}
              aria-label="View user profile"
              className="min-w-[36px] min-h-[36px] px-2 rounded-xl bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white hover:border-[#B6FF3B]/40 active:scale-95 transition-all text-xs font-semibold flex items-center gap-1"
            >
              <span className="text-sm">{currentUser.avatarEmoji || '💪'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              aria-label="Log in to the cloud"
              className="min-h-[36px] px-3 rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider hover:bg-[#a6ec31] active:scale-95 transition-all"
            >
              Login
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white hover:border-[#B6FF3B]/40 active:scale-95 transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
      {syncStatus && (
        <div className="max-w-2xl mx-auto px-4 pb-1.5 flex items-center justify-end">
          <SyncBadge status={syncStatus} onRetry={onSyncRetry ?? (() => {})} onOpenSettings={onOpenSyncSettings ?? onOpenSettings} />
        </div>
      )}
    </header>
  );
};

export const BottomTabBar: React.FC<{
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}> = ({
  activeTab,
  onChangeTab
}) => {
  // User constraint (26 Oct): max 4 tabs. Today lives behind Home's "full Today view" door;
  // Learn lives behind Progress. No function is removed, only grouped.
  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'train', label: 'Train', icon: Dumbbell },
    { id: 'eat', label: 'Eat', icon: UtensilsCrossed },
    { id: 'progress', label: 'Progress', icon: TrendingUp }
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0D10]/95 backdrop-blur-lg border-t border-[#222933] pb-safe"
    >
      <div className="max-w-md mx-auto grid grid-cols-4 h-16 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className="flex flex-col items-center justify-center min-h-[44px] py-1 transition-all group active:scale-95"
            >
              <div
                className={`flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-[#B6FF3B]/15 text-[#B6FF3B]'
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-105' : ''}`} />
              </div>
              <span
                className={`text-[10px] font-semibold tracking-tight transition-colors mt-0.5 ${
                  isActive ? 'text-[#B6FF3B]' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
