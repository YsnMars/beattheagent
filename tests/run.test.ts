import { describe, expect, it } from "vitest";
import { generateChallenge } from "../src/challenge/generate";
import { solveChallenge } from "../src/challenge/solve";
import { deriveRun, judge, PENALTY_MS, toResult, type RunEvent } from "../src/game/run";
import { applyAction, initialStates } from "../src/game/state";
import type { StageId } from "../src/challenge/types";

const seed = "RUNTEST";
const ch = generateChallenge(seed);
const sol = solveChallenge(ch);

function play(): RunEvent[] {
  const events: RunEvent[] = [{ k: "start", at: 1000 }];
  let t = 1000;
  let states = initialStates(ch);
  const act = (s: StageId, a: any) => {
    events.push({ k: "act", at: (t += 500), s, a });
    states = applyAction(ch, states, s, a);
  };
  const submit = (s: StageId) => {
    const v = judge(ch, s, states);
    events.push({ k: "submit", at: (t += 500), s, ok: v.ok, msg: v.message });
  };
  const wrong = ch.shopping.products.find((p) => p.id !== sol.productIds[0])!.id;
  act("shopping", { type: "add", id: wrong });
  submit("shopping"); // rejected
  act("shopping", { type: "remove", id: wrong });
  act("shopping", { type: "add", id: sol.productIds[0] });
  submit("shopping");
  act("calendar", { type: "pick", ...sol.slots[0] });
  submit("calendar");
  act("sheet", { type: "sort", column: "updated", dir: "desc" });
  act("sheet", { type: "dedupeOpen", open: true });
  for (const c of ch.sheet.dupColumns) act("sheet", { type: "dedupeCol", column: c });
  act("sheet", { type: "dedupeApply" });
  act("sheet", { type: "sort", column: ch.sheet.sort.column, dir: ch.sheet.sort.dir });
  submit("sheet");
  return events;
}

describe("run log", () => {
  it("derives splits, penalties, and finish from the log (replayable)", () => {
    const events = play();
    const run = deriveRun(ch, events);
    expect(run.finishedAt).not.toBeNull();
    expect(run.penalties).toBe(1);
    expect(run.attempts).toEqual([1, 0, 0]);
    expect(run.splits).toHaveLength(3);
    const last = events[events.length - 1].at;
    expect(run.splits[2]).toBe(last - 1000 + PENALTY_MS);
    // Replay to an intermediate time reproduces the intermediate state.
    const mid = deriveRun(ch, events, events.find((e) => e.k === "submit" && e.ok)!.at);
    expect(mid.stageIndex).toBe(1);
    expect(mid.states.shopping.cart).toEqual([sol.productIds[0]]);
  });

  it("explains the latest rejection until the answer changes", () => {
    const wrong = ch.shopping.products.find((p) => p.id !== sol.productIds[0])!.id;
    const v = judge(ch, "shopping", { ...initialStates(ch), shopping: { ...initialStates(ch).shopping, cart: [wrong] } });
    const events: RunEvent[] = [
      { k: "start", at: 0 },
      { k: "act", at: 1, s: "shopping", a: { type: "add", id: wrong } },
      { k: "submit", at: 2, s: "shopping", ok: false, msg: v.message },
    ];
    const rejected = deriveRun(ch, events).rejection!;
    expect(rejected.title).toMatch(/doesn't qualify/);
    expect(rejected.problems.length).toBeGreaterThan(0);
    expect(rejected.reqs.length).toBeGreaterThan(0);
    expect(rejected.edited).toBe(false);
    // Filters don't change the answer; the cart does, and undoing the change restores the explanation.
    events.push({ k: "act", at: 3, s: "shopping", a: { type: "minRating", value: 4 } });
    expect(deriveRun(ch, events).rejection!.edited).toBe(false);
    events.push({ k: "act", at: 4, s: "shopping", a: { type: "remove", id: wrong } });
    expect(deriveRun(ch, events).rejection!.edited).toBe(true);
    events.push({ k: "act", at: 5, s: "shopping", a: { type: "add", id: wrong } });
    expect(deriveRun(ch, events).rejection!.edited).toBe(false);
    // An accepted submission clears it.
    expect(deriveRun(ch, play()).rejection).toBeNull();
  });

  it("ignores actions after finishing and submissions for the wrong stage", () => {
    const events = play();
    const extra: RunEvent[] = [...events, { k: "submit", at: 1e9, s: "calendar", ok: true, msg: "x" }];
    expect(deriveRun(ch, extra).splits).toHaveLength(3);
    const early: RunEvent[] = [{ k: "start", at: 0 }, { k: "submit", at: 5, s: "sheet", ok: true, msg: "x" }];
    expect(deriveRun(ch, early).splits).toHaveLength(0);
  });

  it("summarizes a run into a result", () => {
    const r = toResult(deriveRun(ch, play()));
    expect(r.finished).toBe(true);
    expect(r.stagesCleared).toBe(3);
    expect(r.penalties).toBe(1);
    expect(r.totalMs).toBe(r.splits[2]);
  });
});
