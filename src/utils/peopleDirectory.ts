/**
 * People directory (creator CRM) - LOCAL/EMULATOR CANDIDATE. Not published, not wired to production.
 *
 * Builds on the existing multi-grant model (users/{owner}/coachAccess/{coachUid} consent records).
 * Adds owner-only per-person labels/notes in users/{owner}/coachLabels/{coachUid}.
 *
 * RULES GATE: current firestore.rules restrict coachAccess docs to
 * [coachUid, ownerUid, status, grantedAt, revokedAt] and have no coachLabels match block,
 * so label storage requires the additive rules block in rules-tests/candidate/firestore.crm.rules.
 * That deploy is a separate explicit decision - this module changes nothing live.
 *
 * Every function takes an injected Firestore handle so tests run entirely against the emulator.
 */
import {
  Firestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection
} from 'firebase/firestore';

export interface PersonGrant {
  coachUid: string;
  ownerUid: string;
  status: 'authorized' | 'revoked';
  grantedAt?: string;
  revokedAt?: string;
}

export interface PersonLabel {
  coachUid: string;
  label: string;   // owner-chosen display name, e.g. "Rohan (cousin)"
  note?: string;   // owner-only context, never shared with the coach
  updatedAt: string;
}

export interface Person {
  grant: PersonGrant;
  label?: PersonLabel;
}

export const PERSON_LABEL_LIMITS = { labelMax: 60, noteMax: 500 } as const;

export function validateLabel(label: string, note?: string): string | null {
  const t = (label || '').trim();
  if (!t) return 'A name or label is required.';
  if (t.length > PERSON_LABEL_LIMITS.labelMax) return `Label must be ${PERSON_LABEL_LIMITS.labelMax} characters or fewer.`;
  if (note && note.length > PERSON_LABEL_LIMITS.noteMax) return `Note must be ${PERSON_LABEL_LIMITS.noteMax} characters or fewer.`;
  return null;
}

/** Merges cloud consent records with owner labels; a label without a grant is reported, never silently kept. */
export function mergePeople(grants: PersonGrant[], labels: PersonLabel[]): { people: Person[]; orphanLabels: PersonLabel[] } {
  const byUid = new Map(labels.map((l) => [l.coachUid, l]));
  const people: Person[] = grants
    .filter((g) => g.status === 'authorized')
    .map((g) => ({ grant: g, label: byUid.get(g.coachUid) }));
  people.sort((a, b) => (b.grant.grantedAt || '').localeCompare(a.grant.grantedAt || ''));
  const grantedUids = new Set(grants.map((g) => g.coachUid));
  return { people, orphanLabels: labels.filter((l) => !grantedUids.has(l.coachUid)) };
}

export async function listPeople(db: Firestore, ownerUid: string): Promise<{ people: Person[]; orphanLabels: PersonLabel[] }> {
  const grantsSnap = await getDocs(collection(db, 'users', ownerUid, 'coachAccess'));
  const grants = grantsSnap.docs.map((d) => d.data() as PersonGrant);
  const labelsSnap = await getDocs(collection(db, 'users', ownerUid, 'coachLabels'));
  const labels = labelsSnap.docs.map((d) => d.data() as PersonLabel);
  return mergePeople(grants, labels);
}

/**
 * Grants access with a label. Consent record first (the security-relevant write),
 * then the label. If the label write fails, the grant still stands and the caller
 * gets labelSaved:false - no half-hidden state, the UI can retry the label.
 */
export async function grantPerson(
  db: Firestore, ownerUid: string, coachUid: string, label: string, note?: string, nowIso: string = new Date().toISOString()
): Promise<{ success: boolean; labelSaved?: boolean; error?: string }> {
  const uid = (coachUid || '').trim();
  if (!uid) return { success: false, error: 'Person UID is required.' };
  const invalid = validateLabel(label, note);
  if (invalid) return { success: false, error: invalid };
  try {
    await setDoc(doc(db, 'users', ownerUid, 'coachAccess', uid), {
      coachUid: uid, ownerUid, status: 'authorized', grantedAt: nowIso
    });
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save the consent record.' };
  }
  try {
    await setDoc(doc(db, 'users', ownerUid, 'coachLabels', uid), {
      coachUid: uid, label: label.trim(), ...(note ? { note } : {}), updatedAt: nowIso
    });
    return { success: true, labelSaved: true };
  } catch {
    return { success: true, labelSaved: false };
  }
}

export async function updatePersonLabel(
  db: Firestore, ownerUid: string, coachUid: string, label: string, note?: string, nowIso: string = new Date().toISOString()
): Promise<{ success: boolean; error?: string }> {
  const invalid = validateLabel(label, note);
  if (invalid) return { success: false, error: invalid };
  try {
    await setDoc(doc(db, 'users', ownerUid, 'coachLabels', coachUid), {
      coachUid, label: label.trim(), ...(note ? { note } : {}), updatedAt: nowIso
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to update the label.' };
  }
}

/** Revokes one person: consent record and label are both removed (label is owner-only data about that person). */
export async function revokePerson(
  db: Firestore, ownerUid: string, coachUid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'users', ownerUid, 'coachAccess', coachUid));
    await deleteDoc(doc(db, 'users', ownerUid, 'coachLabels', coachUid));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to revoke access.' };
  }
}

/** Read-only check a coach's own view: returns the grant doc the coach is allowed to get. */
export async function getOwnGrant(db: Firestore, ownerUid: string, coachUid: string): Promise<PersonGrant | null> {
  const snap = await getDoc(doc(db, 'users', ownerUid, 'coachAccess', coachUid));
  return snap.exists() ? (snap.data() as PersonGrant) : null;
}
