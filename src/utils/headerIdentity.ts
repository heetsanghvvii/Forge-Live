export interface HeaderIdentity { displayName?: string; username: string; avatarEmoji?: string }
export interface FirebaseUserLike { email?: string | null; displayName?: string | null }

/** Who the header shows: legacy local account wins, else the Firebase user, else null (Login). */
export function deriveHeaderIdentity(
  legacy: HeaderIdentity | null,
  fb: FirebaseUserLike | null,
): HeaderIdentity | null {
  if (legacy) return legacy;
  if (!fb) return null;
  const name = fb.displayName?.trim() || undefined;
  return { displayName: name, username: fb.email || name || 'Account', avatarEmoji: '☁️' };
}

/** Profile modal only makes sense for a legacy account; Firebase-only users go to sync/account settings. */
export function profileTarget(legacy: unknown | null): 'profile' | 'syncSettings' {
  return legacy ? 'profile' : 'syncSettings';
}
