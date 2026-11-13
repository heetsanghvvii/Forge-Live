import React, { useState, useEffect } from 'react';
import {
  loadCoachDashboardData,
  CoachDashboardData,
  exportDailyLogsToCsv,
  exportWorkoutSetsToCsv,
  ensureGoogleSignIn
} from '../utils/cloudSync';
import type { DailyLog } from '../types';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { EnteredMetric, metricStatus, rawMetricValue, MetricStatus } from '../utils/entered';
import { loggedDaySummary } from '../utils/coachSummary';
import {
  Shield,
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  Download,
  Dumbbell,
  Heart,
  Scale,
  Utensils,
  Droplets,
  Footprints,
  Moon,
  Info,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Copy,
  Check,
  LogIn
} from 'lucide-react';

interface CoachViewProps {
  coachUid: string;
  coachEmail?: string;
  initialOwnerUid?: string;
  onLogout: () => void;
}

const STATUS_CHIP: Record<MetricStatus, { text: string; cls: string }> = {
  entered: { text: 'Entered', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  unconfirmed: { text: 'Unconfirmed', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  missing: { text: 'Not logged', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' }
};

/** Raw stored value plus a status chip. Never shows a number for 'missing'. */
const MetricCell: React.FC<{ log: DailyLog; metric: EnteredMetric; unit: string }> = ({ log, metric, unit }) => {
  const status = metricStatus(log, metric);
  const raw = rawMetricValue(log, metric);
  const chip = STATUS_CHIP[status];
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {status !== 'missing' && typeof raw === 'number' && (
        <span className="font-mono font-bold text-white text-sm">
          {raw.toLocaleString()}
          {unit && <span className="text-[10px] text-slate-400 ml-0.5">{unit}</span>}
          {status === 'unconfirmed' && <span className="text-[10px] font-normal text-amber-300 ml-1">(unconfirmed)</span>}
        </span>
      )}
      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${chip.cls}`}>
        {chip.text}
      </span>
    </span>
  );
};

export const CoachView: React.FC<CoachViewProps> = ({
  coachUid: initialCoachUid,
  coachEmail,
  initialOwnerUid = '',
  onLogout
}) => {
  const [firebaseCoachUser, setFirebaseCoachUser] = useState<User | null>(auth.currentUser);
  const [targetOwnerUid, setTargetOwnerUid] = useState<string>(
    initialOwnerUid || localStorage.getItem('bb_last_coach_owner_uid') || ''
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<CoachDashboardData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [copiedCoachUid, setCopiedCoachUid] = useState<boolean>(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseCoachUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleCopyCoachUid = () => {
    const uidToCopy = firebaseCoachUser?.uid || initialCoachUid;
    if (uidToCopy) {
      navigator.clipboard.writeText(uidToCopy);
      setCopiedCoachUid(true);
      setTimeout(() => setCopiedCoachUid(false), 2000);
    }
  };

  const handleGoogleSignIn = async () => {
    setSignInError(null);
    try {
      const user = await ensureGoogleSignIn();
      setFirebaseCoachUser(user);
      if (targetOwnerUid) {
        fetchDashboard(targetOwnerUid);
      }
    } catch (err: any) {
      setSignInError(err?.message || 'Google sign-in was cancelled or failed.');
    }
  };

  const fetchDashboard = async (ownerUid: string) => {
    if (!ownerUid.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      localStorage.setItem('bb_last_coach_owner_uid', ownerUid.trim());
      const res = await loadCoachDashboardData(ownerUid.trim());
      if (res.success && res.data) {
        setDashboardData(res.data);
      } else {
        setErrorMsg(res.error || 'Could not load athlete records. Check authorization.');
      }
    } catch (err: any) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetOwnerUid && firebaseCoachUser) {
      fetchDashboard(targetOwnerUid);
    }
  }, [firebaseCoachUser]);

  // Compute 7-day metrics from available days only (no invented days)
  const logs = dashboardData?.dailyLogs || [];
  const recentLogs = logs.slice(-7);

  const SUMMARY_METRICS: { key: EnteredMetric; label: string; unit: string }[] = [
    { key: 'sleep', label: 'Sleep', unit: 'h' },
    { key: 'calories', label: 'Calories', unit: 'kcal' },
    { key: 'protein', label: 'Protein', unit: 'g' },
    { key: 'steps', label: 'Steps', unit: '' },
    { key: 'water', label: 'Water', unit: 'ml' },
    { key: 'energy', label: 'Energy', unit: '/10' }
  ];

  const missingDataWarnings: string[] = [];
  if (recentLogs.length < 5) {
    missingDataWarnings.push(`Only ${recentLogs.length} of the last 7 days have logged records.`);
  }
  SUMMARY_METRICS.forEach(({ key, label }) => {
    const s = loggedDaySummary(recentLogs, key);
    if (s.totalDays > 0 && s.entered < s.totalDays) {
      const parts: string[] = [];
      if (s.unconfirmed) parts.push(`${s.unconfirmed} unconfirmed`);
      if (s.missing) parts.push(`${s.missing} not logged`);
      missingDataWarnings.push(`${label}: only ${s.entered} of ${s.totalDays} days entered (${parts.join(', ')}).`);
    }
  });
  const daysWithPainNotes = recentLogs.filter((l) => Boolean(l.painOrIllnessNotes));

  const selectedLog = logs[logs.length - 1 - selectedDayIndex] || logs[logs.length - 1];

  const activeCoachUid = firebaseCoachUser?.uid || initialCoachUid;

  return (
    <div className="min-h-screen bg-[#0B0D10] text-slate-100 flex flex-col font-sans pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full bg-[#0B0D10]/95 backdrop-blur-md border-b border-[#222933]">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-extrabold text-sm shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-white">Coach Dashboard</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  Read-Only Mode
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 truncate">
                {firebaseCoachUser
                  ? `Signed in: ${firebaseCoachUser.email || firebaseCoachUser.displayName}`
                  : coachEmail
                  ? `Coach: ${coachEmail}`
                  : `UID: ${activeCoachUid.slice(0, 10)}...`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {firebaseCoachUser && (
              <button
                type="button"
                onClick={() => fetchDashboard(targetOwnerUid)}
                disabled={loading || !targetOwnerUid}
                className="min-h-[38px] px-3 rounded-xl bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#B6FF3B]' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="min-h-[38px] px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-500/20 active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Medical & Legal Disclaimer Banner */}
        <div className="p-3.5 rounded-2xl bg-[#14181D] border border-amber-500/30 flex items-start gap-3 text-xs shadow-md">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-amber-300 block">Coach Review Notice</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              This dashboard is strictly intended for scheduled fitness programming reviews and habit audits. It does not provide real-time medical monitoring, vital signs telemetry, or emergency clinical alerts.
            </p>
          </div>
        </div>

        {/* Coach Google Authentication Requirement */}
        {!firebaseCoachUser ? (
          <div className="p-6 rounded-3xl bg-[#14181D] border border-purple-500/40 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 mx-auto">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Coach Google Sign-In Required</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                Cloud Firestore security rules require your coach identity to be authenticated via Google before accessing private athlete records.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="h-11 px-6 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-slate-200 active:scale-95 shadow-lg transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign in with Google as Coach</span>
            </button>

            {signInError && (
              <p className="text-xs text-rose-300 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30 max-w-md mx-auto">
                {signInError}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Coach Firebase UID Card with Copy Button */}
            <div className="p-4 rounded-3xl bg-[#14181D] border border-purple-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] text-purple-400 uppercase font-bold tracking-wider block">
                  Your Coach Firebase UID
                </span>
                <span className="font-mono text-xs text-white font-semibold break-all select-all block">
                  {firebaseCoachUser.uid}
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Share this UID with your athlete. They must paste it into their App Settings under "Read-Only Coach Access" and tap Authorize and Sync Now.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyCoachUid}
                className="h-10 px-4 rounded-xl bg-purple-500 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 active:scale-95 transition-all shadow-md shadow-purple-500/10 hover:bg-purple-400"
              >
                {copiedCoachUid ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Coach UID</span>
                  </>
                )}
              </button>
            </div>

            {/* Athlete UID Lookup Bar */}
            <div className="p-4 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="w-full sm:w-auto flex-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Athlete Owner Firebase UID
                </label>
                <input
                  type="text"
                  placeholder="Paste athlete's Firebase Owner UID..."
                  value={targetOwnerUid}
                  onChange={(e) => setTargetOwnerUid(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono text-xs focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto self-end">
                <button
                  type="button"
                  onClick={() => fetchDashboard(targetOwnerUid)}
                  disabled={loading || !targetOwnerUid}
                  className="flex-1 sm:flex-none min-h-[44px] px-5 rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#a6ec31] active:scale-95 disabled:opacity-40"
                >
                  <span>Load Athlete Records</span>
                </button>
              </div>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {dashboardData && (
              <>
                {/* Athlete Profile Overview Card */}
                <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222933]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#0B0D10] border border-[#222933] flex items-center justify-center text-2xl shrink-0">
                        💪
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-white tracking-tight">
                          {dashboardData.ownerProfile.displayName || 'Athlete'}
                        </h2>
                        <p className="text-xs font-mono text-slate-400">
                          Phase: {dashboardData.ownerProfile.currentPhase || 'Phase 1'} · Timezone: {dashboardData.ownerProfile.timezone || 'Asia/Kolkata'}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right text-xs">
                      <span className="block text-[10px] text-slate-500 uppercase font-semibold">Last Cloud Sync</span>
                      <span className="font-mono text-slate-300 font-semibold">
                        {new Date(dashboardData.lastUpdated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                  </div>

                  {/* Private Health Attributes Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933]">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Starting Weight</span>
                      <span className="text-base font-extrabold text-white font-mono">
                        {dashboardData.ownerProfile.startingWeightKg !== undefined
                          ? `${dashboardData.ownerProfile.startingWeightKg} kg`
                          : 'Not set'}
                      </span>
                    </div>

                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    You can read the shared summary, this athlete's daily logs (including notes) and workout logs. Height, age, diet and injury details stay private.
                  </p>
                </div>

                {/* Missing Data Warnings */}
                {missingDataWarnings.length > 0 && (
                  <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-xs text-amber-300">
                    <div className="flex items-center gap-2 font-bold text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Missing Data Advisory</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                      {missingDataWarnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pain / Illness Alerts */}
                {daysWithPainNotes.length > 0 && (
                  <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 space-y-2 text-xs text-rose-300">
                    <div className="flex items-center gap-2 font-bold text-rose-400">
                      <Heart className="w-4 h-4" />
                      <span>Reported Pain or Illness Entries ({daysWithPainNotes.length} notes)</span>
                    </div>
                    <div className="space-y-1.5">
                      {daysWithPainNotes.slice(-3).map((noteLog, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-[#0B0D10] border border-[#222933] text-[11px]">
                          <span className="font-mono font-bold text-slate-300 mr-2">{noteLog.date}:</span>
                          <span className="text-rose-200">{noteLog.painOrIllnessNotes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7-Day Logged Days (averages paused until entries are confirmed) */}
                <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4">
                  <div className="flex items-center gap-2 text-white">
                    <Activity className="w-4 h-4 text-[#B6FF3B]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">7-Day Logged Days</h3>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Averages are paused until entries are confirmed by the athlete.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {SUMMARY_METRICS.map(({ key, label }) => {
                      const s = loggedDaySummary(recentLogs, key);
                      return (
                        <div key={key} className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933]">
                          <span className="block text-[10px] text-slate-500 uppercase font-semibold">{label}</span>
                          <span className="text-sm font-bold text-white">
                            {s.entered} of {s.totalDays} days entered
                          </span>
                          {(s.unconfirmed > 0 || s.missing > 0) && (
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              {s.unconfirmed} unconfirmed, {s.missing} not logged
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Raw daily rows */}
                  <div className="space-y-2">
                    {recentLogs.map((l) => (
                      <div key={l.date} className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933]">
                        <span className="font-mono text-[11px] font-bold text-slate-300">{l.date}</span>
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
                          {SUMMARY_METRICS.map(({ key, label, unit }) => (
                            <div key={key} className="text-[11px]">
                              <span className="block text-[10px] text-slate-500 uppercase font-semibold">{label}</span>
                              <MetricCell log={l} metric={key} unit={unit} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Individual Day Deep Dive */}
                {selectedLog && (
                  <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#222933]">
                      <div>
                        <span className="text-xs font-bold text-[#B6FF3B] uppercase tracking-wider">
                          Day Detail Inspection: {selectedLog.date}
                        </span>
                        <h3 className="text-lg font-extrabold text-white">
                          Day {selectedLog.dayNumber || 'N/A'} ({selectedLog.phase || 'Phase 1'})
                        </h3>
                      </div>

                      {/* Day Picker Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                        {logs.slice(-7).map((l, idx) => (
                          <button
                            key={l.date}
                            type="button"
                            onClick={() => setSelectedDayIndex(logs.slice(-7).length - 1 - idx)}
                            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-colors ${
                              selectedLog.date === l.date
                                ? 'bg-[#B6FF3B] text-black font-bold'
                                : 'bg-[#0B0D10] border border-[#222933] text-slate-400 hover:text-white'
                            }`}
                          >
                            {l.date.slice(5)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Planned vs Actual Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933]">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Calories</span>
                        <span className="font-mono font-bold text-white text-base">
                          <MetricCell log={selectedLog} metric="calories" unit="kcal" />
                        </span>
                        {dashboardData.ownerProfile.startingWeightKg && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Target: {selectedLog.plannedMacros?.calories || Math.round(dashboardData.ownerProfile.startingWeightKg * 29 - 500)} kcal
                          </span>
                        )}
                      </div>

                      <div className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933]">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Protein</span>
                        <span className="font-mono font-bold text-[#B6FF3B] text-base">
                          <MetricCell log={selectedLog} metric="protein" unit="g" />
                        </span>
                        {dashboardData.ownerProfile.startingWeightKg && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Target: {Math.round(dashboardData.ownerProfile.startingWeightKg * 2)} g
                          </span>
                        )}
                      </div>

                      <div className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933]">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Hydration</span>
                        <span className="font-mono font-bold text-sky-400 text-base">
                          <MetricCell log={selectedLog} metric="water" unit="ml" />
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Target: 3.0 L min
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933]">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Daily Steps</span>
                        <span className="font-mono font-bold text-purple-400 text-base">
                          <MetricCell log={selectedLog} metric="steps" unit="" />
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Target: 10,000 steps
                        </span>
                      </div>
                    </div>

                    {/* Subjective Biofeedback: Energy, Hunger, Soreness */}
                    <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-3">
                      <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        Subjective Biofeedback & Recovery
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2.5 rounded-xl bg-[#14181D] border border-[#222933]">
                          <span className="block text-[10px] text-slate-500 uppercase font-semibold">Energy</span>
                          <span className="text-base font-extrabold text-amber-400 font-mono">
                            <MetricCell log={selectedLog} metric="energy" unit="/10" />
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#14181D] border border-[#222933]">
                          <span className="block text-[10px] text-slate-500 uppercase font-semibold">Hunger</span>
                          <span className="text-base font-extrabold text-sky-400 font-mono">
                            {selectedLog.hungerRating ? `${selectedLog.hungerRating}/5` : 'Not rated'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#14181D] border border-[#222933]">
                          <span className="block text-[10px] text-slate-500 uppercase font-semibold">Muscle Soreness</span>
                          <span className="text-base font-extrabold text-rose-400 font-mono">
                            {selectedLog.sorenessRating ? `${selectedLog.sorenessRating}/5` : 'Not rated'}
                          </span>
                        </div>
                      </div>

                      {selectedLog.generalNotes && (
                        <div className="pt-1">
                          <span className="text-[10px] text-slate-500 uppercase block font-semibold">General Notes</span>
                          <p className="text-xs text-slate-300 italic mt-0.5">{selectedLog.generalNotes}</p>
                        </div>
                      )}
                    </div>

                    {/* Session Workout Log if recorded */}
                    {dashboardData.workoutLogs[String(selectedLog.dayNumber)] && (
                      <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-white">
                            <Dumbbell className="w-4 h-4 text-[#B6FF3B]" />
                            <span className="text-xs font-bold uppercase tracking-wider">
                              Workout Session Log ({dashboardData.workoutLogs[String(selectedLog.dayNumber)].workoutType})
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#B6FF3B]">
                            Volume: {dashboardData.workoutLogs[String(selectedLog.dayNumber)].totalVolumeKg || 0} kg
                          </span>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {(dashboardData.workoutLogs[String(selectedLog.dayNumber)].exercises || []).map((ex) => (
                            <div key={ex.exerciseId} className="p-2.5 rounded-xl bg-[#14181D] border border-[#222933] text-xs">
                              <div className="flex items-center justify-between font-bold text-slate-200">
                                <span>{ex.name}</span>
                                <span className="font-mono text-[11px] text-[#B6FF3B]">
                                  {ex.sets.filter((s) => s.completed).length} / {ex.sets.length} sets
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-400">
                                {ex.sets.map((s) => (
                                  <span
                                    key={s.setNumber}
                                    className={`px-1.5 py-0.5 rounded ${
                                      s.completed ? 'bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'bg-[#0B0D10] text-slate-600'
                                    }`}
                                  >
                                    S{s.setNumber}: {s.weight}kg×{s.reps} {s.rpeEffort ? `(RPE ${s.rpeEffort})` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Coach Export Controls */}
                <div className="p-5 rounded-3xl bg-[#14181D] border border-[#222933] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Export Athlete Audit Data</h4>
                    <p className="text-[11px] text-slate-400">Download formatted CSV reports for scheduled reviews.</p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const logsMap: { [day: number]: any } = {};
                        logs.forEach((l) => {
                          if (l.dayNumber) logsMap[l.dayNumber] = l;
                        });
                        exportDailyLogsToCsv(logsMap, `athlete_${targetOwnerUid}_daily_logs.csv`);
                      }}
                      className="flex-1 sm:flex-none min-h-[40px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#222933] hover:border-slate-600 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5 text-[#B6FF3B]" />
                      <span>Daily Logs CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        exportWorkoutSetsToCsv(dashboardData.workoutLogs, `athlete_${targetOwnerUid}_workouts.csv`);
                      }}
                      className="flex-1 sm:flex-none min-h-[40px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#222933] hover:border-slate-600 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5 text-purple-400" />
                      <span>Workouts CSV</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};
