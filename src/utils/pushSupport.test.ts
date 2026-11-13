import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifyMessage, notifyState, isIos } from './pushSupport';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';

test('P1: iPhone in Safari asks to install to the Home Screen first', () => {
  assert.equal(isIos(IPHONE), true);
  assert.equal(notifyState({ userAgent: IPHONE, hasNotification: false, standalone: false }), 'ios-install-needed');
  assert.match(notifyMessage('ios-install-needed'), /Add to Home Screen/);
});

test('P2: installed iPhone app follows the permission', () => {
  const base = { userAgent: IPHONE, hasNotification: true, standalone: true };
  assert.equal(notifyState({ ...base, permission: 'default' }), 'default');
  assert.equal(notifyState({ ...base, permission: 'granted' }), 'granted');
  assert.equal(notifyState({ ...base, permission: 'denied' }), 'denied');
});

test('P3: desktop without Notification is unsupported; granted message is honest about closed apps', () => {
  assert.equal(notifyState({ userAgent: DESKTOP, hasNotification: false, standalone: false }), 'unsupported');
  assert.match(notifyMessage('granted'), /fully closed/);
});
