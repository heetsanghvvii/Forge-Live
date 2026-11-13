import { useCallback, useEffect, useState } from 'react';
import { HabitStore, loadStore, saveStore } from '../utils/habits';

const CHANGED = 'forge-habits-changed';

/**
 * Habit store kept in localStorage. Every instance of the hook stays in step through a window
 * event, so the reminder runner and the habits card always show the same data.
 */
export function useHabitStore(): [HabitStore, (next: HabitStore) => boolean] {
  const [store, setStore] = useState<HabitStore>(() => loadStore(localStorage, new Date().toISOString()));

  useEffect(() => {
    const onChange = () => setStore(loadStore(localStorage, new Date().toISOString()));
    window.addEventListener(CHANGED, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CHANGED, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const update = useCallback((next: HabitStore) => {
    if (!saveStore(localStorage, next)) return false;
    setStore(next);
    window.dispatchEvent(new Event(CHANGED));
    return true;
  }, []);

  return [store, update];
}
