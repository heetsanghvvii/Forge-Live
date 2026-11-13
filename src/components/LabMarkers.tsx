import React, { useState } from 'react';
import { FlaskConical, Plus, CheckCircle2, Trash2 } from 'lucide-react';
import { getTodayDateString } from '../utils/storage';
import { parseNumberInput } from '../utils/inputs';
import { fmtDelta } from '../utils/deltaFormat';
import {
  COMMON_MARKERS,
  addReport,
  compareMarkers,
  confirmReport,
  unconfirmReport,
  removeReport,
  loadReports,
  saveReports,
  validateReportInput,
  type LabReport,
  type LabReportInput,
} from '../utils/labMarkers';

interface LabMarkersProps {
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning', undo?: () => void) => void;
}

interface Row {
  code: string;
  name: string;
  unit: string;
  valueText: string;
  refText: string;
  custom: boolean;
}

const emptyRows = (): Row[] =>
  COMMON_MARKERS.map((m) => ({ code: m.code, name: m.name, unit: m.unit, valueText: '', refText: '', custom: false }));

const num = (t: string): number | null => {
  const r = parseNumberInput(t, { decimals: 3 });
  return r.ok ? r.value : null;
};

const inputCls =
  'w-full h-11 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#B6FF3B]';

export const LabMarkers: React.FC<LabMarkersProps> = ({ onShowToast }) => {
  const [reports, setReports] = useState<LabReport[]>(() => loadReports(localStorage));
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(getTodayDateString());
  const [lab, setLab] = useState('');
  const [rows, setRows] = useState<Row[]>(emptyRows);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState('');

  const commit = (next: LabReport[], message: string, undo?: () => void) => {
    if (!saveReports(localStorage, next)) {
      onShowToast('Could not save on this device. Nothing was changed.', 'warning');
      return false;
    }
    setReports(next);
    onShowToast(message, 'success', undo);
    return true;
  };

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleSave = () => {
    const bad = rows.filter((r) => r.valueText.trim() !== '' && num(r.valueText) === null);
    const input: LabReportInput = {
      date,
      lab,
      values: rows.map((r) => ({
        code: r.code,
        name: r.name,
        value: r.valueText.trim() === '' ? null : num(r.valueText),
        unit: r.unit,
        refText: r.refText,
      })),
    };
    const problems = [
      ...bad.map((r) => `${r.name || 'A marker'}: enter a number.`),
      ...validateReportInput(input, getTodayDateString()),
    ];
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    const next = addReport(reports, input, {
      id: `lab_${Date.now().toString(36)}`,
      now: new Date().toISOString(),
      today: getTodayDateString(),
    });
    if (commit(next, 'Report saved. It counts in your comparison once a doctor confirms it.')) {
      setShowForm(false);
      setRows(emptyRows());
      setLab('');
      setErrors([]);
    }
  };

  const handleConfirm = (id: string) => {
    try {
      const next = confirmReport(reports, id, doctorName, getTodayDateString());
      const before = reports;
      if (commit(next, 'Marked as confirmed by your doctor.', () => commit(before, 'Confirmation undone.'))) {
        setConfirmingId(null);
        setDoctorName('');
      }
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Could not confirm.', 'warning');
    }
  };

  const handleRemove = (id: string) => {
    const before = reports;
    commit(removeReport(reports, id), 'Report removed.', () => commit(before, 'Report restored.'));
  };

  const comparison = compareMarkers(reports);

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[#B6FF3B]">
          <FlaskConical className="w-5 h-5" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Lab markers</h3>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="h-11 px-4 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add report
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Record blood test results your doctor has ordered and compare them over the programme. Which tests to
        take, and what a result means, is your doctor's decision. Forge only stores and displays the numbers.
        Reports stay on this device and are not synced.
      </p>

      {showForm && (
        <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-300">
              Sample date
              <input
                type="date"
                value={date}
                max={getTodayDateString()}
                onChange={(e) => setDate(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Lab name on the report
              <input
                type="text"
                value={lab}
                maxLength={60}
                onChange={(e) => setLab(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
          </div>

          <p className="text-[11px] text-slate-500">
            Fill in only the markers on your report. Copy the value, unit and reference range exactly as printed.
          </p>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.code} className="grid grid-cols-12 gap-2 items-center">
                {r.custom ? (
                  <input
                    type="text"
                    aria-label="Marker name"
                    placeholder="Marker name"
                    value={r.name}
                    maxLength={40}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                    className={`${inputCls} col-span-12 sm:col-span-4`}
                  />
                ) : (
                  <span className="col-span-12 sm:col-span-4 text-xs font-semibold text-slate-200">{r.name}</span>
                )}
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`${r.name || 'Marker'} value`}
                  placeholder="Value"
                  maxLength={10}
                  value={r.valueText}
                  onChange={(e) => setRow(i, { valueText: e.target.value })}
                  className={`${inputCls} col-span-4 sm:col-span-2`}
                />
                <input
                  type="text"
                  aria-label={`${r.name || 'Marker'} unit`}
                  placeholder="Unit"
                  maxLength={12}
                  value={r.unit}
                  onChange={(e) => setRow(i, { unit: e.target.value })}
                  className={`${inputCls} col-span-3 sm:col-span-2`}
                />
                <input
                  type="text"
                  aria-label={`${r.name || 'Marker'} reference range from the report`}
                  placeholder="Range on report"
                  maxLength={30}
                  value={r.refText}
                  onChange={(e) => setRow(i, { refText: e.target.value })}
                  className={`${inputCls} col-span-5 sm:col-span-4`}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setRows((rs) => [
                ...rs,
                { code: `custom_${Date.now().toString(36)}`, name: '', unit: '', valueText: '', refText: '', custom: true },
              ])
            }
            className="h-11 px-4 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300"
          >
            Add another marker
          </button>

          {errors.length > 0 && (
            <ul role="alert" className="text-xs text-[#FF8C3B] space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222933]">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setErrors([]);
              }}
              className="h-11 px-4 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-11 px-5 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold uppercase tracking-wider"
            >
              Save report
            </button>
          </div>
        </div>
      )}

      {reports.length === 0 && !showForm && (
        <p className="text-xs text-slate-500">No reports yet. Add your first report to start a comparison.</p>
      )}

      {reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">
                    {r.date} · {r.lab}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {r.values.length} marker{r.values.length === 1 ? '' : 's'} ·{' '}
                    {r.doctorConfirmed
                      ? `Confirmed by ${r.doctorName} on ${r.confirmedOn}`
                      : 'Not yet confirmed by a doctor'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove report of ${r.date}`}
                  onClick={() => handleRemove(r.id)}
                  className="h-11 w-11 shrink-0 rounded-xl border border-slate-700 text-slate-400 flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {r.doctorConfirmed ? (
                <button
                  type="button"
                  onClick={() => commit(unconfirmReport(reports, r.id), 'Confirmation removed.')}
                  className="text-[11px] font-semibold text-slate-400 underline min-h-[36px]"
                >
                  Undo confirmation
                </button>
              ) : confirmingId === r.id ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    aria-label="Doctor's name"
                    placeholder="Doctor's name"
                    value={doctorName}
                    maxLength={60}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => handleConfirm(r.id)}
                    className="h-11 px-4 shrink-0 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold uppercase tracking-wider"
                  >
                    Confirm
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingId(r.id);
                    setDoctorName('');
                  }}
                  className="h-11 px-4 rounded-xl border border-[#B6FF3B] text-[#B6FF3B] text-xs font-bold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> My doctor has reviewed this report
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {comparison.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Start and latest, doctor-confirmed reports only
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-200">
              <thead>
                <tr className="text-left text-[11px] text-slate-500">
                  <th className="py-1.5 pr-2 font-semibold">Marker</th>
                  <th className="py-1.5 pr-2 font-semibold">Start</th>
                  <th className="py-1.5 pr-2 font-semibold">Latest</th>
                  <th className="py-1.5 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => (
                  <tr key={c.code} className="border-t border-[#222933]">
                    <td className="py-2 pr-2 font-semibold">{c.name}</td>
                    <td className="py-2 pr-2">
                      {c.first.value} {c.unit}
                      <span className="block text-[10px] text-slate-500">{c.first.date}</span>
                    </td>
                    <td className="py-2 pr-2">
                      {c.latest ? (
                        <>
                          {c.latest.value}
                          <span className="block text-[10px] text-slate-500">{c.latest.date}</span>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2">{c.unitsDiffer ? 'Units differ' : fmtDelta(c.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">
            A change is shown as a plain number. Ask your doctor what it means for you.
          </p>
        </div>
      )}
    </div>
  );
};
