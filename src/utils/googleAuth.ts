import { signInWithPopup, signInWithRedirect, getRedirectResult, User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export const REDIRECTING_MESSAGE = 'Redirecting to Google…';

function codeOf(error: unknown): string {
  return (error as { code?: string } | null)?.code || '';
}

export function mapAuthError(error: unknown): string {
  const code = codeOf(error);
  switch (code) {
    case 'auth/unauthorized-domain':
      return `This domain (${window.location.hostname}) is not authorized for Google sign-in. Add it under Firebase console > Authentication > Settings > Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project. Enable it under Firebase console > Authentication > Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Google. Check your internet connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window was closed before finishing. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in window was already open, so this request was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.';
    case 'auth/internal-error':
      return 'Google sign-in hit an internal error. Please try again in a moment.';
    default: {
      const msg = (error as { message?: string } | null)?.message;
      return `Google sign-in failed (${code || 'unknown error'})${msg ? `: ${msg}` : ''}`;
    }
  }
}

export async function ensureGoogleSignIn(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (error: unknown) {
    const code = codeOf(error);
    console.error('Google sign-in error code:', code, error);
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError: unknown) {
        console.error('Google redirect sign-in error code:', codeOf(redirectError), redirectError);
        throw new Error(mapAuthError(redirectError));
      }
      throw new Error(REDIRECTING_MESSAGE);
    }
    throw new Error(mapAuthError(error));
  }
}

export async function completeRedirectSignIn(): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await getRedirectResult(auth);
    return { user: result?.user ?? null, error: null };
  } catch (error: unknown) {
    console.error('Google redirect result error code:', codeOf(error), error);
    return { user: null, error: mapAuthError(error) };
  }
}
