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
  stagesCleared: number;
  splits: number[];
  totalMs: number; // final elapsed (finish or give-up), incl. penalties
  penalties: number;
  attempts: number[]; // rejected submissions per stage
  finished: boolean;
};

export function toResult(run: DerivedRun): RunResult {
  return {
    stagesCleared: run.splits.length,
    splits: run.splits.map(Math.round),
    totalMs: Math.round(elapsedAt(run, run.finishedAt ?? run.gaveUpAt ?? Date.now())),
    penalties: run.penalties,
    attempts: [...run.attempts],
    finished: run.finishedAt !== null,
  };
}
