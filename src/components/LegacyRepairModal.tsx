import React, { useMemo, useState } from 'react';
import { X, Wrench, Download, RotateCcw, ClipboardCheck } from 'lucide-react';
import { AppState } from '../types';
import {
  LegacyRepairPreview,
  applyDateRepair,
  applySleepRepair,
  revertDateRepair,
  revertSleepRepair,
  confirmSleepEntries,
  undoSleepConfirmation,
} from '../utils/legacyRepair';
import { exportStateToJson } from '../utils/cloudSync';

/**
 * Pre-save review for older local records (legacy states).
 *
 * Shown when preflightSaveReview() finds date mismatches, unconfirmed stored values
 * or would-be save collisions. NOTHING is changed unless the person explicitly
 * applies a repair here; every repair keeps the old value on the record itself
 * (legacyDate / legacySleepHours) so it can be reviewed and reverted, and a full
 * JSON backup of the device is one tap away before anything changes.
 *
 * Unconfirmed values are treated as AMBIGUOUS, never as known placeholders:
 * the default choice for every ambiguous sleep value is "Keep".
 */
interface Props {
  appState: AppState;
  preview: LegacyRepairPreview;
  onClose: () => void;
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
  /** Called after repairs are applied so the caller can re-attempt the save. */
  onRepaired?: () => void;
}

export const LegacyRepairModal: React.FC<Props> = ({ appState, preview, onClose, onUpdateAppState, onRepaired }) => {
  const [clearSleepDays, setClearSleepDays] = useState<Set<number>>(new Set());
  const [datesFixed, setDatesFixed] = useState(preview.dateMismatches.length === 0);
  const [sleepsResolved, setSleepsResolved] = useState(preview.ambiguousSleep.length === 0);
  const [note, setNote] = useState<string | null>(null);
  const [appliedAny, setAppliedAny] = useState(false);

  const hasLegacyDate = useMemo(
    () => Object.values(appState.dailyLogs || {}).some((l: any) => l?.legacyDate !== undefined),
    [appState.dailyLogs]
  );
  const hasLegacySleep = useMemo(
    () => Object.values(appState.dailyLogs || {}).some((l: any) => l?.legacySleepHours !== undefined),
    [appState.dailyLogs]
  );
  const hasReviewConfirmation = useMemo(
    () => Object.values(appState.dailyLogs || {}).some((l: any) => l?.legacySleepConfirmedByReview === true),
    [appState.dailyLogs]
  );

  const toggleSleepDay = (day: number) => {
    setClearSleepDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const handleBackup = () => {
    exportStateToJson(appState);
    setNote('Backup downloaded. Keep it somewhere safe before applying fixes.');
  };

  const handleFixDates = () => {
    onUpdateAppState((prev) => applyDateRepair(prev));
    setDatesFixed(true);
    setAppliedAny(true);
    setNote('Dates re-derived from your programme start. Each fixed record keeps its old date (shown as "was:") so the change stays reviewable and reversible below.');
  };

  // Explicit choice per value: either CLEAR the ones ticked (provenance kept, undoable),
  // or CONFIRM the rest as the owner's real entries (native entered semantics, undoable).
  // Nothing is reinterpreted by default; "Decide later" closes without resolving and the
  // save honestly stays gated until the values are reviewed.
  const handleApplySleepChoices = () => {
    const clearedDays = Array.from(clearSleepDays);
    const confirmedDays = preview.ambiguousSleep.map((a) => a.day).filter((d) => !clearSleepDays.has(d));
    if (clearedDays.length > 0) {
      onUpdateAppState((prev) => applySleepRepair(prev, clearedDays));
    }
    if (confirmedDays.length > 0) {
      onUpdateAppState((prev) => confirmSleepEntries(prev, confirmedDays));
    }
    setAppliedAny(true);
    setSleepsResolved(true);
    const parts: string[] = [];
    if (confirmedDays.length > 0) {
      parts.push(`Confirmed ${confirmedDays.length} value(s) as your real entries - they will sync to the cloud and count as logged.`);
    }
    if (clearedDays.length > 0) {
      parts.push(`Cleared the stored sleep value on ${clearedDays.length} day(s); the old values stay on the records as "was:" and can be restored below.`);
    }
    parts.push('Both choices can be undone below.');
    setNote(parts.join(' '));
  };

  const handleDecideLater = () => {
    setNote('No problem - nothing was resolved, so saving to the cloud will ask again until these values are reviewed. Any repairs already applied stay applied (undo below).');
    onClose();
  };

  const handleRevertDates = () => {
    onUpdateAppState((prev) => revertDateRepair(prev));
    setDatesFixed(preview.dateMismatches.length === 0);
    setNote('Date fix reverted: records are back to their previous dates.');
  };

  const handleRevertSleeps = () => {
    onUpdateAppState((prev) => revertSleepRepair(prev));
    setSleepsResolved(preview.ambiguousSleep.length === 0);
    setNote('Cleared sleep values restored.');
  };

  const handleUndoConfirmations = () => {
    onUpdateAppState((prev) => undoSleepConfirmation(prev));
    setSleepsResolved(preview.ambiguousSleep.length === 0);
    setNote('Review confirmations removed: those values are unconfirmed again and saving will ask about them once more. The values themselves were never changed.');
  };

  const ready = datesFixed && sleepsResolved;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-[#0B0D10] border border-amber-500/30 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-amber-300">
            <Wrench className="w-4 h-4" />
            <h2 className="font-bold text-white">Review older records before saving</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[12px] text-slate-300">
          Some records on this device were created by an older version and do not line up with your programme start.
          Nothing is changed unless you choose it here, and every change keeps the old value on the record so it can be
          reviewed and undone.
        </p>

        <button
          type="button"
          onClick={handleBackup}
          className="min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white flex items-center gap-1.5 active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download a full backup first (recommended)</span>
        </button>

        {preview.dateMismatches.length > 0 && (
          <div className="rounded-xl border border-[#222933] p-3 space-y-2">
            <p className="text-[12px] font-semibold text-white">
              {preview.dateMismatches.length} record(s) have a date that does not match your programme start
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {preview.dateMismatches.slice(0, 20).map((m) => (
                <p key={m.day} className="text-[11px] text-slate-400">
                  Day {m.day}: <span className="text-amber-300">was {m.currentDate ?? 'unknown'}</span> → {m.derivedDate}
                </p>
              ))}
              {preview.dateMismatches.length > 20 && (
                <p className="text-[11px] text-slate-500">…and {preview.dateMismatches.length - 20} more</p>
              )}
            </div>
            {!datesFixed ? (
              <button
                type="button"
                onClick={handleFixDates}
                className="min-h-[36px] px-3 rounded-lg bg-[#B6FF3B] text-black font-extrabold flex items-center gap-1.5 active:scale-95"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Fix dates to match my programme (reversible)</span>
              </button>
            ) : (
              <p className="text-[11px] text-emerald-300">Dates fixed. Your entries were kept; only the dates moved.</p>
            )}
          </div>
        )}

        {preview.ambiguousSleep.length > 0 && (
          <div className="rounded-xl border border-[#222933] p-3 space-y-2">
            <p className="text-[12px] font-semibold text-white">
              {preview.ambiguousSleep.length} day(s) have a stored sleep value nobody confirmed
            </p>
            <p className="text-[11px] text-slate-400">
              These may be real entries from before, or values an older version pre-filled. Unticked values are
              CONFIRMED as your real entries and will sync; ticked values are cleared (kept as "was:" so you can
              restore them). Not sure? Use "Decide later" - nothing is changed for values you have not reviewed.
            </p>
            <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-1">
              {preview.ambiguousSleep.map((a) => (
                <label key={a.day} className={`flex items-center gap-2 text-[11px] ${sleepsResolved ? 'text-slate-600' : 'text-slate-300'}`}>
                  <input
                    type="checkbox"
                    checked={clearSleepDays.has(a.day)}
                    onChange={() => toggleSleepDay(a.day)}
                    disabled={sleepsResolved}
                  />
                  <span>Day {a.day} ({a.sleepHours} h) - clear</span>
                </label>
              ))}
            </div>
            {!sleepsResolved ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplySleepChoices}
                  className="min-h-[36px] px-3 rounded-lg bg-[#B6FF3B] text-black font-extrabold flex items-center gap-1.5 active:scale-95"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>{clearSleepDays.size > 0 ? `Confirm ${preview.ambiguousSleep.length - clearSleepDays.size} as mine, clear ${clearSleepDays.size}` : 'These are all my real entries'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDecideLater}
                  className="min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white active:scale-95"
                >
                  Decide later
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-emerald-300">Sleep values reviewed.</p>
            )}
          </div>
        )}

        {(hasLegacyDate || hasLegacySleep || hasReviewConfirmation) && (
          <div className="rounded-xl border border-[#222933] p-3 space-y-2">
            <p className="text-[12px] font-semibold text-white">Undo repairs</p>
            <div className="flex flex-wrap gap-2">
              {hasLegacyDate && (
                <button
                  type="button"
                  onClick={handleRevertDates}
                  className="min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white flex items-center gap-1.5 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore previous dates</span>
                </button>
              )}
              {hasLegacySleep && (
                <button
                  type="button"
                  onClick={handleRevertSleeps}
                  className="min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white flex items-center gap-1.5 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore cleared sleep values</span>
                </button>
              )}
              {hasReviewConfirmation && (
                <button
                  type="button"
                  onClick={handleUndoConfirmations}
                  className="min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white flex items-center gap-1.5 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Un-mark review confirmations</span>
                </button>
              )}
            </div>
          </div>
        )}

        {note && <p className="text-[11px] text-sky-200 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30">{note}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white active:scale-95"
          >
            {appliedAny ? 'Close (repairs stay applied - undo above)' : 'Cancel (nothing changed)'}
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => { onClose(); if (onRepaired) onRepaired(); }}
            className="min-h-[36px] px-3 rounded-lg bg-[#B6FF3B] text-black font-extrabold active:scale-95 disabled:opacity-40"
          >
            {ready ? 'Save to cloud' : 'Review the items above first'}
          </button>
        </div>
      </div>
    </div>
  );
};
