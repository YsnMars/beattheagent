// A run is an append-only event log. Everything on screen — timer, stage, per-stage UI state —
// is derived from it, which is what makes reload-resume and exact agent replays possible.
import type { Challenge, StageId } from "../challenge/types";
import { STAGES } from "../challenge/types";
import { checkCalendar, checkSheet, checkShopping, type Verdict } from "../challenge/validate";
import { applyAction, initialStates, makeSheetReducer, type AnyAction, type StageStates } from "./state";

export const PENALTY_MS = 15_000;

export type RunEvent =
  | { k: "load"; at: number; vw: number; vh: number; ua: string }
  | { k: "start"; at: number }
  | { k: "act"; at: number; s: StageId; a: AnyAction }
  | { k: "submit"; at: number; s: StageId; ok: boolean; msg: string }
  | { k: "giveup"; at: number }
  | { k: "ptr"; at: number; x: number; y: number; vw: number; vh: number; sy: number; tgt: string | null; fx: number; fy: number }
  | { k: "scroll"; at: number; sy: number; el: string | null; st: number };

export type DerivedRun = {
  startedAt: number | null;
  stageIndex: number; // 0..3 (3 = all cleared)
  splits: number[]; // elapsed (incl. penalties) when each stage cleared
  penalties: number;
  attempts: number[]; // rejected submissions per stage
  feedback: { ok: boolean; msg: string; at: number; s: StageId } | null;
  states: StageStates;
  finishedAt: number | null;
  gaveUpAt: number | null;
};

export function deriveRun(ch: Challenge, events: RunEvent[], until = Infinity): DerivedRun {
  const sheetReducer = makeSheetReducer(ch);
  const run: DerivedRun = {
    startedAt: null,
    stageIndex: 0,
    splits: [],
    penalties: 0,
    attempts: [0, 0, 0],
    feedback: null,
    states: initialStates(ch),
    finishedAt: null,
    gaveUpAt: null,
  };
  for (const e of events) {
    if (e.at > until) break;
    switch (e.k) {
      case "start":
        run.startedAt ??= e.at;
        break;
      case "act":
        if (run.startedAt !== null && run.finishedAt === null && run.gaveUpAt === null) {
          run.states = applyAction(ch, run.states, e.s, e.a, sheetReducer);
        }
        break;
      case "submit": {
        if (run.startedAt === null || run.finishedAt !== null || run.gaveUpAt !== null) break;
        const idx = STAGES.findIndex((x) => x.id === e.s);
        if (idx !== run.stageIndex) break;
        run.feedback = { ok: e.ok, msg: e.msg, at: e.at, s: e.s };
        if (e.ok) {
          run.splits.push(e.at - run.startedAt + run.penalties * PENALTY_MS);
          run.stageIndex++;
          if (run.stageIndex === STAGES.length) run.finishedAt = e.at;
        } else {
          run.penalties++;
          run.attempts[idx]++;
        }
        break;
      }
      case "giveup":
        if (run.startedAt !== null && run.finishedAt === null) run.gaveUpAt ??= e.at;
        break;
    }
  }
  return run;
}

export function elapsedAt(run: DerivedRun, now: number): number {
  if (run.startedAt === null) return 0;
  const end = run.finishedAt ?? run.gaveUpAt ?? now;
  return end - run.startedAt + run.penalties * PENALTY_MS;
}

export function judge(ch: Challenge, stage: StageId, states: StageStates): Verdict {
  switch (stage) {
    case "shopping":
      return checkShopping(ch.shopping, states.shopping.cart);
    case "calendar":
      return checkCalendar(ch.calendar, states.calendar.pick);
    case "sheet":
      return checkSheet(ch.sheet, states.sheet.rows);
  }
}

// ---------------------------------------------------------------- results

export type RunResult = {
  seed: string;
  name: string;
  stagesCleared: number;
  splits: number[];
  totalMs: number; // final elapsed (finish or give-up), incl. penalties
  penalties: number;
  finished: boolean;
};

export function toResult(seed: string, run: DerivedRun, name = ""): RunResult {
  return {
    seed,
    name,
    stagesCleared: run.splits.length,
    splits: run.splits.map(Math.round),
    totalMs: Math.round(elapsedAt(run, run.finishedAt ?? run.gaveUpAt ?? Date.now())),
    penalties: run.penalties,
    finished: run.finishedAt !== null,
  };
}

/**
 * Head-to-head: finished runs compare total time; otherwise more stages cleared wins, and a tie
 * on stages goes to whoever cleared their last stage sooner. Returns <0 if `a` wins.
 */
export function compareResults(a: Pick<RunResult, "stagesCleared" | "splits" | "totalMs" | "finished">, b: typeof a): number {
  if (a.finished && b.finished) return a.totalMs - b.totalMs;
  if (a.stagesCleared !== b.stagesCleared) return b.stagesCleared - a.stagesCleared;
  if (a.stagesCleared === 0) return 0;
  return a.splits[a.stagesCleared - 1] - b.splits[b.stagesCleared - 1];
}

function b64urlEncode(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  return decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
}

export function encodeResult(r: RunResult): string {
  return b64urlEncode(JSON.stringify([1, r.seed, r.name.slice(0, 24), r.splits, r.totalMs, r.penalties, r.finished ? 1 : 0]));
}

export function decodeResult(payload: string): RunResult | null {
  try {
    const [v, seed, name, splits, totalMs, penalties, finished] = JSON.parse(b64urlDecode(payload));
    if (v !== 1 || typeof seed !== "string" || !Array.isArray(splits)) return null;
    const clean = splits.slice(0, 3).map((x: unknown) => Math.max(0, Number(x) || 0));
    return {
      seed,
      name: String(name ?? "").slice(0, 24),
      splits: clean,
      stagesCleared: clean.length,
      totalMs: Math.max(0, Number(totalMs) || 0),
      penalties: Math.max(0, Number(penalties) || 0),
      finished: finished === 1 && clean.length === 3,
    };
  } catch {
    return null;
  }
}
