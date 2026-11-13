import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import {
  Person, PersonLabel, listPeople, grantPerson, updatePersonLabel, revokePerson
} from '../utils/peopleDirectory';

/**
 * Multi-person access manager (creator CRM candidate). WIRED FOR LOCAL/EMULATOR ONLY:
 * SettingsModal renders it solely when VITE_USE_EMULATOR === 'true', so a production
 * build cannot contain it. Labels need the additive coachLabels rules block
 * (rules-tests/candidate/firestore.crm.rules); current production rules reject them.
 */
export const PeopleDirectoryPanel: React.FC<{ viewerMode?: boolean }> = ({ viewerMode }) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [orphans, setOrphans] = useState<PersonLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [uid, setUid] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');

  const ownerUid = auth.currentUser?.uid || '';

  const refresh = useCallback(async () => {
    if (!ownerUid) { setPeople([]); setOrphans([]); return; }
    setLoading(true);
    try {
      const r = await listPeople(db, ownerUid);
      setPeople(r.people);
      setOrphans(r.orphanLabels);
    } catch (e: any) {
      setError(e?.message || 'Could not load the people list.');
    } finally {
      setLoading(false);
    }
  }, [ownerUid]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!ownerUid) {
    return (
      <div className="p-4 rounded-2xl bg-[#0B0D10] border border-dashed border-amber-500/40">
        <p className="text-[11px] text-amber-300">People with access (preview, emulator only): sign in to manage who can view your records.</p>
      </div>
    );
  }

  const grant = async () => {
    setBusy(true); setError(''); setStatus('');
    const r = await grantPerson(db, ownerUid, uid, label, note || undefined);
    if (!r.success) setError(r.error || 'Grant failed.');
    else {
      setStatus(r.labelSaved
        ? `Granted access to ${label.trim()}.`
        : 'Access granted, but the label could not be saved. Use Edit to add it again.');
      setUid(''); setLabel(''); setNote('');
      await refresh();
    }
    setBusy(false);
  };

  const saveEdit = async (coachUid: string) => {
    setBusy(true); setError(''); setStatus('');
    const r = await updatePersonLabel(db, ownerUid, coachUid, editLabel, editNote || undefined);
    if (!r.success) setError(r.error || 'Could not update the label.');
    else { setStatus('Label updated.'); setEditing(null); await refresh(); }
    setBusy(false);
  };

  const revoke = async (p: Person) => {
    const name = p.label?.label || p.grant.coachUid;
    if (!window.confirm(`Revoke access for ${name}? They immediately lose read access. This cannot be undone.`)) return;
    setBusy(true); setError(''); setStatus('');
    const r = await revokePerson(db, ownerUid, p.grant.coachUid);
    if (!r.success) setError(r.error || 'Could not revoke access.');
    else { setStatus(`Revoked access for ${name}.`); await refresh(); }
    setBusy(false);
  };

  const inputCls = 'h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white text-xs focus:outline-none focus:border-amber-400';

  return (
    <div className="p-4 rounded-2xl bg-[#0B0D10] border border-dashed border-amber-500/40 space-y-3">
      <div className="flex items-center gap-2 text-amber-300">
        <Users className="w-4 h-4" />
        <span className="font-bold text-slate-200 text-sm">People with access</span>
        <span className="text-[10px] uppercase tracking-wider">preview - emulator only</span>
      </div>

      {loading && <p className="text-[10px] text-slate-500">Loading people...</p>}
      {!loading && people.length === 0 && (
        <p className="text-[11px] text-slate-400">Nobody has access yet. Grant a coach UID below.</p>
      )}

      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.grant.coachUid} className="p-3 rounded-xl bg-[#14181D] border border-[#222933] space-y-2">
            {editing === p.grant.coachUid ? (
              <div className="space-y-2">
                <input aria-label="Edit label" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={`${inputCls} w-full`} placeholder="Label" />
                <input aria-label="Edit note" value={editNote} onChange={(e) => setEditNote(e.target.value)} className={`${inputCls} w-full`} placeholder="Note (only you see this)" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void saveEdit(p.grant.coachUid)}
                    className="min-h-[36px] px-3 rounded-xl bg-amber-400 text-black font-extrabold text-xs active:scale-95 disabled:opacity-40">Save label</button>
                  <button type="button" disabled={busy} onClick={() => setEditing(null)}
                    className="min-h-[36px] px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-slate-300 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{p.label?.label || '(no label)'}</p>
                  <p className="text-[10px] font-mono text-slate-400 truncate">{p.grant.coachUid}</p>
                  {p.label?.note && <p className="text-[10px] text-slate-500 truncate">{p.label.note}</p>}
                  {p.grant.grantedAt && <p className="text-[10px] text-slate-500">granted {p.grant.grantedAt.slice(0, 10)}</p>}
                </div>
                <button type="button" aria-label={`Edit ${p.label?.label || p.grant.coachUid}`} disabled={busy || viewerMode}
                  onClick={() => { setEditing(p.grant.coachUid); setEditLabel(p.label?.label || ''); setEditNote(p.label?.note || ''); }}
                  className="min-h-[36px] px-2.5 rounded-xl bg-[#0B0D10] border border-[#222933] text-slate-300 text-xs active:scale-95 disabled:opacity-40">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" aria-label={`Revoke ${p.label?.label || p.grant.coachUid}`} disabled={busy || viewerMode}
                  onClick={() => void revoke(p)}
                  className="min-h-[36px] px-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs active:scale-95 disabled:opacity-40">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {orphans.length > 0 && (
        <p className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20" role="alert">
          {orphans.length} saved label(s) have no matching grant and were not shown: {orphans.map((o) => o.label).join(', ')}
        </p>
      )}

      <div className="space-y-2 pt-1 border-t border-[#222933]">
        <div className="flex items-center gap-2 text-slate-300">
          <UserPlus className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">Grant a new person</span>
        </div>
        <input aria-label="New person UID" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="Their Firebase UID" className={`${inputCls} w-full font-mono`} />
        <input aria-label="New person label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Rohan (cousin)" className={`${inputCls} w-full`} />
        <input aria-label="New person note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (only you see this)" className={`${inputCls} w-full`} />
        <button type="button" onClick={() => void grant()} disabled={busy || viewerMode || !uid.trim() || !label.trim()}
          className="min-h-[40px] px-4 rounded-xl bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider active:scale-95 disabled:opacity-40">
          {busy ? 'Working...' : 'Grant access'}
        </button>
      </div>

      {status && <p className="text-[11px] text-emerald-300" role="status">{status}</p>}
      {error && <p className="text-[11px] text-rose-300 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20" role="alert">{error}</p>}
    </div>
  );
};
