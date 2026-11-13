import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

/** Live Firebase auth user (null when signed out); updates on sign-in and logout. */
export function useFirebaseUser(): User | null {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}
