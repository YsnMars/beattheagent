// Personal bests, per challenge, kept in this browser. Only complete runs count.
const KEY = "bta:best";

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function recordBest(seed: string, ms: number) {
  const bests = load();
  if (bests[seed] !== undefined && bests[seed] <= ms) return;
  bests[seed] = ms;
  try {
    localStorage.setItem(KEY, JSON.stringify(bests));
  } catch {
    /* storage full or disabled */
  }
}

/** The best time on this challenge, or failing that, the best on any challenge. */
export function bestFor(seed: string): { ms: number; here: boolean } | null {
  const bests = load();
  if (bests[seed] !== undefined) return { ms: bests[seed], here: true };
  const all = Object.values(bests);
  return all.length ? { ms: Math.min(...all), here: false } : null;
}
