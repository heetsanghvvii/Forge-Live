import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSleepInput } from './sleep';

const ok = (s: string, v: number) => test(`accepts ${JSON.stringify(s)}`, () => assert.deepEqual(parseSleepInput(s), { ok: true, value: v }));
const bad = (s: string) => test(`rejects ${JSON.stringify(s)}`, () => assert.equal(parseSleepInput(s).ok, false));

ok('7.5', 7.5);
ok('7,5', 7.5);
ok('0', 0);
ok('24', 24);
ok('  8 ', 8);
bad('24.5');
bad('-1');
bad('abc');
bad('');
bad('8h');
bad('NaN');
bad('1,2,3');
