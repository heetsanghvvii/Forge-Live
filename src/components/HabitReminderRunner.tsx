import React, { useCallback, useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useHabitStore } from '../hooks/useHabitStore';
import {
  dueNow,
  loadNotified,
  markNotified,
  reminderText,
  saveNotified,
  setDone,
  toLocalNow,
  type Habit,
} from '../utils/habits';

/**
 * Runs once for the whole app. While Forge is open or in the background it checks every 30
 * seconds, and when a tab is brought back to the front, which habits are due. It shows a system
 * notification when permission is granted, and always shows a small banner inside the app.
 * It cannot fire while the app is fully closed: that needs a push server, which is not built.
 */
export const HabitReminderRunner: React.FC = () => {
  const [store, updateStore] = useHabitStore();
  const [banner, setBanner] = useState<Habit[]>([]);

  const check = useCallback(async () => {
    const now = toLocalNow(new Date());
    const notified = loadNotified(localStorage);
    const due = dueNow(store, now, notified);
    if (due.length === 0) return;
    saveNotified(localStorage, markNotified(notified, due.map((h) => h.id), now.date));
    setBanner((b) => [...b, ...due.filter((h) => !b.some((x) => x.id === h.id))]);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
        for (const h of due) {
          const t = reminderText(h);
          if (reg) await reg.showNotification(t.title, { body: t.body, tag: `habit-${h.id}-${now.date}` });
          else new Notification(t.title, { body: t.body, tag: `habit-${h.id}-${now.date}` });
        }
      } catch {
        /* the in-app banner still shows */
      }
    }
  }, [store]);

  useEffect(() => {
    check();
    const id = window.setInterval(check, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  if (banner.length === 0) return null;
  const today = toLocalNow(new Date()).date;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="habit-banner"
      className="fixed top-2 left-2 right-2 z-[60] max-w-md mx-auto space-y-2"
    >
      {banner.map((h) => (
        <div
          key={h.id}
          className="flex items-center gap-3 p-3 rounded-2xl bg-[#14181D] border border-[#B6FF3B]/40 shadow-2xl"
        >
          <Bell className="w-5 h-5 text-[#B6FF3B] shrink-0" />
          <p className="flex-1 text-sm font-semibold text-white">{h.name}</p>
          <button
            type="button"
            onClick={() => {
              try {
                updateStore(setDone(store, h.id, today, true, today));
              } catch {
                /* ignore */
              }
              setBanner((b) => b.filter((x) => x.id !== h.id));
            }}
            className="h-11 px-4 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold uppercase tracking-wider"
          >
            Done
          </button>
          <button
            type="button"
            aria-label={`Dismiss reminder for ${h.name}`}
            onClick={() => setBanner((b) => b.filter((x) => x.id !== h.id))}
            className="h-11 w-11 rounded-xl border border-slate-700 text-slate-400 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
