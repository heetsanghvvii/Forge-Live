import React, { useSyncExternalStore, useState } from 'react';
import { getStorageNotices, subscribeStorageNotices, dismissCorruptNotice, getPendingUnsavedText } from '../utils/storageNotices';
import { STORAGE_KEY } from '../utils/storage';
import { downloadTextFile } from '../utils/download';

const btn = 'min-h-[36px] px-3 rounded-lg text-xs font-bold border border-current';

/** Honest, persistent notices about unreadable or unsaved data. Mounted next to the app in main.tsx. */
export const StorageNotices: React.FC = () => {
  const n = useSyncExternalStore(subscribeStorageNotices, getStorageNotices, getStorageNotices);
  const [, force] = useState(0);

  const downloadCopy = () => {
    let text: string | null = null;
    try { if (n.corruptCopyKey) text = localStorage.getItem(n.corruptCopyKey); } catch { /* ignore */ }
    if (text) downloadTextFile('forge-unreadable-data-copy.json', text, 'text/plain');
  };
  const downloadBackup = () => {
    let text: string | null = getPendingUnsavedText();
    try { text = text ?? localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (text) downloadTextFile(`forge-backup-${new Date().toISOString().slice(0, 10)}.json`, text);
  };

  if (!n.unsaved && !(n.corruptCopyKey && !n.dismissedCorrupt)) return null;
  // In normal flow (not fixed): it must never cover the header, phase pills, Login or Settings.
  return (
    <div className="relative w-full p-2 space-y-2">
      {n.unsaved && (
        <div role="alert" className="mx-auto max-w-md rounded-xl bg-[#2a1a10] border border-[#FF8C3B]/50 text-[#FF8C3B] p-3 text-xs space-y-2">
          <p className="font-bold">Not saved on this device</p>
          <p className="text-[#ffbb85]">{n.unsavedError || 'Your latest changes could not be saved.'} We will retry on your next change.</p>
          <button type="button" className={btn} onClick={downloadBackup}>Download backup</button>
        </div>
      )}
      {n.corruptCopyKey && !n.dismissedCorrupt && (
        <div role="status" className="mx-auto max-w-md rounded-xl bg-[#14181D] border border-slate-600 text-slate-200 p-3 text-xs space-y-2">
          <p className="font-bold">We couldn't read your saved data. A copy was kept.</p>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={downloadCopy}>Download copy</button>
            <button type="button" className={btn} onClick={() => { dismissCorruptNotice(); force((x) => x + 1); }}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
};
