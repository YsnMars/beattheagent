// Deterministic PRNG so every player (and the agent) gets the identical challenge for a seed.

export type Rng = {
  next(): number;
  int(min: number, max: number): number; // inclusive
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  chance(p: number): boolean;
};

export function hashString(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: string): Rng {
  let a = hashString(seed) || 1;
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p) => next() < p,
  };
}

const SEED_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function randomSeed(length = 5): string {
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const b of bytes) s += SEED_ALPHABET[b % SEED_ALPHABET.length];
  return s;
}

export function isValidSeed(seed: string): boolean {
  return /^[A-Z0-9]{3,12}$/.test(seed);
}
