import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  User
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export const MIN_PASSWORD_LENGTH = 8;

export function mapEmailAuthError(error: any): string {
  const code: string = error?.code || '';
  console.error('Email auth error:', code, error?.message);
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled for this project.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in or resetting your password.';
    case 'auth/weak-password':
      return `Password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Email or password is incorrect.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/unauthorized-domain':
      return `This site (${window.location.hostname}) is not authorised in Firebase. Add it under Authentication > Settings > Authorised domains.`;
    default:
      return `Something went wrong${code ? ` (${code})` : ''}. Please try again.`;
  }
}

function checkEmail(email: string): string {
  const e = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('Enter a valid email address.');
  return e;
}

export async function signUpWithEmail(email: string, password: string): Promise<{ user: User; verificationSent: boolean }> {
  const e = checkEmail(email);
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, e, password);
    let verificationSent = false;
    try {
      await sendEmailVerification(cred.user);
      verificationSent = true;
    } catch (err) {
      console.error('Verification email failed:', err);
    }
    return { user: cred.user, verificationSent };
  } catch (err: any) {
    throw new Error(mapEmailAuthError(err));
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const e = checkEmail(email);
  if (!password) throw new Error('Enter your password.');
  try {
    const cred = await signInWithEmailAndPassword(auth, e, password);
    return cred.user;
  } catch (err: any) {
    throw new Error(mapEmailAuthError(err));
  }
}

/** Always resolves the same way for unknown emails so the form does not reveal which emails have accounts. */
export async function sendResetEmail(email: string): Promise<void> {
  const e = checkEmail(email);
  try {
    await sendPasswordResetEmail(auth, e);
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') return;
    throw new Error(mapEmailAuthError(err));
  }
}
