import { useEffect, useState } from "react";
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

/** Today's challenge: the featured seed if set, otherwise rotate daily through recorded runs. */
export function dailySeed(index: RunIndex): string | null {
  if (!index.runs.length) return null;
  if (index.featured && index.runs.some((r) => r.seed === index.featured)) return index.featured;
  const sorted = [...index.runs].sort((a, b) => a.seed.localeCompare(b.seed));
  return sorted[Math.floor(Date.now() / 86_400_000) % sorted.length].seed;
}
