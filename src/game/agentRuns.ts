import { useEffect, useState } from "react";
import { randomSeed } from "../lib/rng";
import type { RunEvent } from "./run";

export type RunSummary = {
  seed: string;
  model: string;
  modelLabel: string;
  recordedAt: string;
  finished: boolean;
  stagesCleared: number;
  splits: number[];
  totalMs: number;
  penalties: number;
  costUsd: number | null;
  costBasis: "reported-usage" | "unavailable";
};

export type Activity = { t: number; title: string; status: string; shot: string | null };

export type AgentRun = RunSummary & {
  sessionId: string;
  reasoningEffort: string | null;
  prompt: { instructions: string; task: string };
  page: { vw: number; vh: number; ua: string; startedAt: number | null };
  events: RunEvent[]; // the page's own log, exactly as the agent's browser produced it
  activity: Activity[]; // computer_use_call items from the Agents API, t = ms relative to page start
  messages: { t: number; text: string }[];
  counts: { clicks: number; actions: number; browserCalls: number; screenshots: number; nudges: number };
  timing: { sessionMs: number; envReadyMs: number | null; pageLoadMs: number | null };
  usage: { input_tokens: number; cached_tokens: number; output_tokens: number; reasoning_tokens: number } | null;
  cost: { model: number | null; container: number; total: number | null; notes: string[] };
};

export type RunIndex = { featured: string | null; runs: RunSummary[] };

let indexPromise: Promise<RunIndex> | null = null;

export function loadRunIndex(): Promise<RunIndex> {
  indexPromise ??= fetch("runs/index.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : { featured: null, runs: [] }))
    .catch(() => ({ featured: null, runs: [] }));
  return indexPromise;
}

export function useRunIndex(): RunIndex | null {
  const [index, setIndex] = useState<RunIndex | null>(null);
  useEffect(() => {
    let live = true;
    loadRunIndex().then((i) => live && setIndex(i));
    return () => {
      live = false;
    };
  }, []);
  return index;
}

export function useAgentSummary(seed: string): RunSummary | null | undefined {
  const index = useRunIndex();
  if (!index) return undefined;
  return index.runs.find((r) => r.seed === seed) ?? null;
}

export function useAgentRun(seed: string): AgentRun | null | undefined {
  const [run, setRun] = useState<AgentRun | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setRun(undefined);
    fetch(`runs/${encodeURIComponent(seed)}/run.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => live && setRun(j));
    return () => {
      live = false;
    };
  }, [seed]);
  return run;
}

const SEEN = "bta:seen";
const CURRENT = "bta:current";

/** The seed this tab is playing, if one was already picked. */
export function currentSeed(): string | null {
  return sessionStorage.getItem(CURRENT);
}

export function clearCurrentSeed() {
  sessionStorage.removeItem(CURRENT);
}

/**
 * Picks the next challenge for this tab: the featured seed on a first visit if set, otherwise a
 * recorded seed this browser hasn't been dealt yet, so repeat visits rotate through the pool.
 */
export function nextSeed(index: RunIndex): string {
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(SEEN) ?? "[]");
  } catch {
    /* corrupt entry: start over */
  }
  const seeds = index.runs.map((r) => r.seed);
  let seed: string;
  if (!seeds.length) seed = randomSeed();
  else if (!seen.length && index.featured && seeds.includes(index.featured)) seed = index.featured;
  else {
    const fresh = seeds.filter((s) => !seen.includes(s));
    const pool = fresh.length ? fresh : seeds.length > 1 ? seeds.filter((s) => s !== seen[seen.length - 1]) : seeds;
    seed = pool[Math.floor(Math.random() * pool.length)];
  }
  localStorage.setItem(SEEN, JSON.stringify([...seen.filter((s) => s !== seed), seed].slice(-50)));
  sessionStorage.setItem(CURRENT, seed);
  return seed;
}
