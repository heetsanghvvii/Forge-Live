import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addReport,
  compareMarkers,
  confirmReport,
  unconfirmReport,
  removeReport,
  validateReportInput,
  loadReports,
  saveReports,
  LAB_STORAGE_KEY,
  COMMON_MARKERS,
  type LabReport,
  type LabReportInput,
} from './labMarkers';

const TODAY = '2026-11-11';
const input = (date: string, hba1c: number | null, unit = '%'): LabReportInput => ({
  date,
  lab: ' Test Lab ',
  values: [
    { code: 'hba1c', name: 'HbA1c', value: hba1c, unit, refText: ' 4 - 5.6 ' },
    { code: 'ldl', name: 'LDL cholesterol', value: null, unit: 'mg/dL' },
  ],
});
const add = (reports: LabReport[], i: LabReportInput, id: string) =>
  addReport(reports, i, { id, now: `2026-11-11T00:00:0${id}Z`, today: TODAY });

function memStorage(initial?: string) {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set(LAB_STORAGE_KEY, initial);
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

test('L1: a new report is unconfirmed, trimmed, and drops empty values', () => {
  const [r] = add([], input('2026-08-01', 5.9), '1');
  assert.equal(r.doctorConfirmed, false);
  assert.equal(r.lab, 'Test Lab');
  assert.equal(r.values.length, 1);
  assert.equal(r.values[0].refText, '4 - 5.6');
});

test('L2: validation rejects bad input with a reason', () => {
  assert.ok(validateReportInput(input('2026-13-40', 5), TODAY).length > 0);
  assert.ok(validateReportInput(input('2026-12-01', 5), TODAY).some((e) => e.includes('future')));
  assert.ok(validateReportInput(input('2026-08-01', null), TODAY).some((e) => e.includes('at least one')));
  assert.ok(validateReportInput(input('2026-08-01', -1), TODAY).length > 0);
  assert.ok(validateReportInput(input('2026-08-01', 5, ' '), TODAY).some((e) => e.includes('unit')));
  assert.ok(validateReportInput({ ...input('2026-08-01', 5), lab: '' }, TODAY).some((e) => e.includes('lab')));
  assert.throws(() => add([], input('2026-08-01', null), '1'));
  assert.deepEqual(validateReportInput(input('2026-08-01', 0), TODAY), []);
});

test('L3: unconfirmed reports never appear in a comparison', () => {
  let reports = add([], input('2026-08-01', 6.1), '1');
  reports = add(reports, input('2026-11-09', 5.6), '2');
  assert.deepEqual(compareMarkers(reports), []);
  reports = confirmReport(reports, '1', 'Dr A', TODAY);
  const one = compareMarkers(reports);
  assert.equal(one.length, 1);
  assert.equal(one[0].latest, null);
  assert.equal(one[0].delta, null);
});

test('L4: start versus latest uses confirmed reports in date order', () => {
  let reports = add([], input('2026-11-09', 5.6), '1'); // added out of order
  reports = add(reports, input('2026-08-01', 6.1), '2');
  reports = add(reports, input('2026-09-15', 5.9), '3');
  for (const id of ['1', '2', '3']) reports = confirmReport(reports, id, ' Dr A ', TODAY);
  const [c] = compareMarkers(reports);
  assert.deepEqual(c.first, { date: '2026-08-01', value: 6.1 });
  assert.deepEqual(c.latest, { date: '2026-11-09', value: 5.6 });
  assert.equal(c.delta, -0.5);
  assert.equal(reports.find((r) => r.id === '1')?.doctorName, 'Dr A');
});

test('L5: differing units give no delta', () => {
  let reports = add([], input('2026-08-01', 6.1, '%'), '1');
  reports = add(reports, input('2026-11-09', 43, 'mmol/mol'), '2');
  reports = confirmReport(confirmReport(reports, '1', 'Dr A', TODAY), '2', 'Dr A', TODAY);
  const [c] = compareMarkers(reports);
  assert.equal(c.unitsDiffer, true);
  assert.equal(c.delta, null);
});

test('L6: confirming needs a doctor name and an existing report; it can be undone', () => {
  let reports = add([], input('2026-08-01', 6.1), '1');
  assert.throws(() => confirmReport(reports, '1', '  ', TODAY));
  assert.throws(() => confirmReport(reports, 'nope', 'Dr A', TODAY));
  reports = confirmReport(reports, '1', 'Dr A', TODAY);
  reports = unconfirmReport(reports, '1');
  assert.equal(reports[0].doctorConfirmed, false);
  assert.equal('doctorName' in reports[0], false);
  assert.deepEqual(removeReport(reports, '1'), []);
});

test('L7: storage round trip, and malformed data is dropped not thrown', () => {
  const s = memStorage();
  const reports = add([], input('2026-08-01', 6.1), '1');
  assert.equal(saveReports(s, reports), true);
  assert.deepEqual(loadReports(s), reports);
  assert.deepEqual(loadReports(memStorage('not json')), []);
  assert.deepEqual(loadReports(memStorage('{"a":1}')), []);
  assert.deepEqual(loadReports(memStorage(JSON.stringify([{ id: 1 }, reports[0]]))), reports);
  const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(saveReports(full, reports), false);
});

test('L8: the module carries no interpretation of values', () => {
  for (const m of COMMON_MARKERS) {
    assert.deepEqual(Object.keys(m).sort(), ['code', 'group', 'name', 'unit']);
  }
  let reports = add([], input('2026-08-01', 6.1), '1');
  reports = confirmReport(reports, '1', 'Dr A', TODAY);
  const keys = Object.keys(compareMarkers(reports)[0]).sort();
  assert.deepEqual(keys, ['code', 'delta', 'first', 'latest', 'name', 'unit', 'unitsDiffer']);
});
