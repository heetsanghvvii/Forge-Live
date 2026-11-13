import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localYmd, upsertByDate } from './localDate';

test('localYmd uses local calendar fields, not UTC (00:30 IST is still that IST day)', () => {
  const d = new Date(2026, 0, 5, 0, 30); // local 00:30; toISOString would give the previous day in IST
  assert.equal(localYmd(d), '2026-01-05');
  assert.equal(localYmd(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  assert.equal(localYmd(new Date(2026, 2, 9)), '2026-03-09');
});

test('same-date weigh-in replaces the earlier entry instead of duplicating', () => {
  const a = [{ date: '2026-01-05', dayNumber: 1, weight: 90 }];
  const b = upsertByDate(a, { date: '2026-01-05', dayNumber: 1, weight: 89.5 });
  assert.deepEqual(b, [{ date: '2026-01-05', dayNumber: 1, weight: 89.5 }]);
  assert.equal(a[0].weight, 90); // input not mutated
  const c = upsertByDate(b, { date: '2026-01-02', dayNumber: 1, weight: 91 });
  assert.deepEqual(c.map((x) => x.date), ['2026-01-02', '2026-01-05']);
});
