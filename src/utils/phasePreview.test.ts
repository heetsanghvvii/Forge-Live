import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayState, switchPlan, phaseStartDay, switchPlanQuestion, previewChipText } from './phasePreview';

const base: any = { settings: { activePhase: 'phase2' }, selectedDayNumber: 10, dailyLogs: {} };

test('previewing never changes the persistent phase or selected day', () => {
  const v = displayState(base, { phase: 'phase3', day: 36 });
  assert.equal(v.selectedDayNumber, 36);
  assert.equal(v.settings.activePhase, 'phase2');
  assert.equal(base.selectedDayNumber, 10);
  assert.equal(displayState(base, null), base);
});

test('only switchPlan changes the active phase', () => {
  const s = switchPlan(base, 'phase3');
  assert.equal(s.settings.activePhase, 'phase3');
  assert.equal(s.selectedDayNumber, phaseStartDay('phase3'));
  assert.equal(base.settings.activePhase, 'phase2');
});

test('texts', () => {
  assert.equal(switchPlanQuestion('phase1'), 'Switch your plan to Phase 1?');
  assert.equal(previewChipText('phase3'), 'Previewing Phase 3');
});
