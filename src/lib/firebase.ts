import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { resolveFirebaseTarget } from './firebaseTarget';

// Production unless VITE_USE_EMULATOR=true on a local dev server (see firebaseTarget.ts). Throws rather than falling back.
const target = resolveFirebaseTarget({
  flag: import.meta.env?.VITE_USE_EMULATOR,
  hostname: typeof location !== 'undefined' ? location.hostname : '',
  isProd: import.meta.env?.PROD,
  production: firebaseConfig,
});
export const EMULATOR_MODE = target.emulator;

const app = getApps().length === 0 ? initializeApp(target.config as any) : getApps()[0];

export const auth = getAuth(app);
if (target.emulator) connectAuthEmulator(auth, target.authUrl!, { disableWarnings: true });
// Belt and braces with sanitizeForFirestore(): never let an `undefined` field reject a whole write.
// initializeFirestore throws if this database was already initialised (e.g. hot reload), so fall back to getFirestore.
function createDb() {
  try {
    return target.databaseId
      ? initializeFirestore(app, { ignoreUndefinedProperties: true }, target.databaseId)
      : initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return target.databaseId ? getFirestore(app, target.databaseId) : getFirestore(app);
  }
}
export const db = createDb();
if (target.emulator) {
  try { connectFirestoreEmulator(db, target.firestoreHost!, target.firestorePort!); } catch { /* already connected (hot reload) */ }
  // Hard stop if either service is not actually pointed at the emulator: never run emulator mode half-connected.
  const authHost = (auth as any).emulatorConfig?.host;
  const fsHost = (db as any)._settings?.host;
  if (authHost !== '127.0.0.1' || !String(fsHost || '').startsWith('127.0.0.1')) {
    throw new Error(`Emulator isolation check failed (auth host: ${authHost}, firestore host: ${fsHost}). Refusing to run.`);
  }
}
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test helper
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, running in offline mode.');
    }
    return false;
  }
}
