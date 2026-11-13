/**
 * Decides WHICH Firebase backend the app talks to. Pure (no Firebase imports) so it can be unit tested.
 *
 * Production is the default. The local emulator is used ONLY when ALL of these hold:
 *   - the build-time flag VITE_USE_EMULATOR is exactly 'true' (it is never set in a normal or production build),
 *   - this is not a production build,
 *   - the page is served from localhost / 127.0.0.1 / ::1.
 * If the flag is 'true' but a safety condition fails we THROW instead of falling back to production, so a
 * mis-set flag can never silently write to the real project (and vice versa).
 *
 * In emulator mode the real project id, API key and custom database id are never used: a fake 'demo-' project
 * and the (default) database are used, so even a broken emulator connection cannot reach real data.
 */
export interface FirebaseTarget {
  emulator: boolean;
  config: Record<string, unknown>;
  databaseId?: string;
  authUrl?: string;
  firestoreHost?: string;
  firestorePort?: number;
}

export const EMULATOR_AUTH_URL = 'http://127.0.0.1:9099';
export const EMULATOR_FIRESTORE_HOST = '127.0.0.1';
export const EMULATOR_FIRESTORE_PORT = 8089;
export const EMULATOR_PROJECT_ID = 'demo-forge-test';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

export function resolveFirebaseTarget(opts: {
  flag: string | undefined;
  hostname: string;
  isProd: boolean;
  production: Record<string, unknown> & { firestoreDatabaseId?: string };
}): FirebaseTarget {
  if (opts.flag !== 'true') {
    return { emulator: false, config: opts.production, databaseId: opts.production.firestoreDatabaseId };
  }
  if (opts.isProd) {
    throw new Error('Emulator mode is not allowed in a production build.');
  }
  if (!LOCAL_HOSTS.includes(opts.hostname)) {
    throw new Error(`Emulator mode refused: page host "${opts.hostname}" is not localhost.`);
  }
  return {
    emulator: true,
    config: { apiKey: 'demo-emulator-key', authDomain: 'localhost', projectId: EMULATOR_PROJECT_ID, appId: 'demo-forge-test-app' },
    databaseId: undefined,
    authUrl: EMULATOR_AUTH_URL,
    firestoreHost: EMULATOR_FIRESTORE_HOST,
    firestorePort: EMULATOR_FIRESTORE_PORT,
  };
}
