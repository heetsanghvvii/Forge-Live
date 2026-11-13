import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFirebaseTarget, EMULATOR_PROJECT_ID } from './firebaseTarget';

const production = { apiKey: 'prod-key', projectId: 'real-project', firestoreDatabaseId: 'real-db' };

test('flag unset or not exactly "true": production, untouched', () => {
  for (const flag of [undefined, '', 'false', '1', 'TRUE', 'yes']) {
    const t = resolveFirebaseTarget({ flag, hostname: 'localhost', isProd: false, production });
    assert.equal(t.emulator, false);
    assert.equal(t.config, production);
    assert.equal(t.databaseId, 'real-db');
    assert.equal(t.authUrl, undefined);
  }
});

test('flag true on localhost in dev: emulator with a fake demo project, never the real ids', () => {
  for (const hostname of ['localhost', '127.0.0.1', '::1']) {
    const t = resolveFirebaseTarget({ flag: 'true', hostname, isProd: false, production });
    assert.equal(t.emulator, true);
    assert.equal((t.config as any).projectId, EMULATOR_PROJECT_ID);
    assert.ok(String(EMULATOR_PROJECT_ID).startsWith('demo-'));
    assert.notEqual((t.config as any).apiKey, 'prod-key');
    assert.equal(t.databaseId, undefined);
    assert.match(t.authUrl!, /^http:\/\/127\.0\.0\.1:/);
    assert.equal(t.firestoreHost, '127.0.0.1');
  }
});

test('flag true but not local: refuses (throws), never falls back to production', () => {
  for (const hostname of ['service-100-day-bollywood-body-phase-2.ai.studio', 'example.com', '192.168.1.5', 'localhost.evil.com']) {
    assert.throws(() => resolveFirebaseTarget({ flag: 'true', hostname, isProd: false, production }), /refused/);
  }
});

test('flag true in a production build: refuses (throws)', () => {
  assert.throws(() => resolveFirebaseTarget({ flag: 'true', hostname: 'localhost', isProd: true, production }), /production build/);
});
