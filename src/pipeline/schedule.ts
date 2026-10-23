/** Posting-slot logic (pure, testable). Slots are wall-clock times in WIB (UTC+7, no DST). */
const WIB_OFFSET_MS = 7 * 3600_000;

/** Candidate slot instants for the next `days` days, in UTC Date objects. */
export function slotInstants(slots: string[], now: Date, days = 2): Date[] {
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth(), d = wibNow.getUTCDate();
  const out: Date[] = [];
  for (let k = 0; k <= days; k++) {
    for (const s of slots) {
      const [hh, mm] = s.split(":").map(Number);
      out.push(new Date(Date.UTC(y, m, d + k, hh, mm) - WIB_OFFSET_MS));
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Earliest slot at least `leadMin` minutes away that isn't already taken
 * (a slot counts as taken if another draft is scheduled within ±20 min of it).
 */
export function nextFreeSlot(slots: string[], taken: Date[], now = new Date(), leadMin = 10): Date {
  const minT = now.getTime() + leadMin * 60_000;
  for (const s of slotInstants(slots, now)) {
    if (s.getTime() < minT) continue;
    if (taken.some((t) => Math.abs(t.getTime() - s.getTime()) < 20 * 60_000)) continue;
    return s;
  }
  return new Date(minT); // all slots full → just go soon
}

export function formatWIB(d: Date): string {
  return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}
