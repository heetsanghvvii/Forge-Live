/** '-' when there is nothing to compare, '+1.5' for gains, '-2' for losses, '0' for no change. */
export function fmtDelta(d: number | null | undefined): string {
  if (d === null || d === undefined || !Number.isFinite(d)) return '-';
  return d > 0 ? `+${d}` : String(d);
}

/** Direction arrow for a total change: none when the change is exactly 0 or unknown. */
export function deltaDirection(d: number | null | undefined): 'up' | 'down' | 'none' {
  if (d === null || d === undefined || !Number.isFinite(d) || d === 0) return 'none';
  return d > 0 ? 'up' : 'down';
}
