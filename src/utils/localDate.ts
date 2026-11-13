/** Calendar date helpers. Dates are the device's LOCAL calendar day (India-local on the owner's phone), never UTC. */

export function localYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Adds an entry; an existing entry with the same date is REPLACED (never duplicated). Result sorted by date. Pure. */
export function upsertByDate<T extends { date: string }>(list: T[] | undefined, entry: T): T[] {
  return [...(list || []).filter((x) => x.date !== entry.date), entry].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
}
