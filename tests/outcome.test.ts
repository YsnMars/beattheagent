import { describe, expect, it } from "vitest";
import { takeaway } from "../src/components/Outcome";
import type { RunSummary } from "../src/game/agentRuns";

const agent = (totalMs: number, finished = true, stagesCleared = 3): RunSummary => ({
  seed: "X",
  model: "m",
  modelLabel: "M",
  recordedAt: "",
  finished,
  stagesCleared,
  splits: [],
  totalMs,
  penalties: 0,
  costUsd: 0.2,
  costBasis: "reported-usage",
});
const you = (totalMs: number, stagesCleared = 3) => ({ totalMs, stagesCleared, finished: stagesCleared === 3, splits: [] });

describe("results headline", () => {
  it("says by how much you won or lost", () => {
    expect(takeaway(you(20_000), agent(23_200))).toBe("You beat the agent by 3.2s.");
    expect(takeaway(you(25_000), agent(23_200))).toBe("The agent was 1.8s faster.");
    expect(takeaway(you(46_400), agent(23_200))).toBe("The agent was 2.0× faster.");
    expect(takeaway(you(23_250), agent(23_200))).toBe("You tied the agent.");
  });

  it("says where you stopped when you gave up", () => {
    expect(takeaway(you(46_500, 1), agent(24_900))).toBe("You stopped on Calendar at 0:46.5. The agent had finished by 0:24.9.");
    expect(takeaway(you(12_000, 0), agent(24_900))).toBe("You stopped on Shopping at 0:12.0. The agent finished in 0:24.9.");
  });

  it("handles an agent run that didn't finish", () => {
    expect(takeaway(you(30_000), agent(40_000, false, 2))).toBe("You finished all three. The agent stopped after 2 of 3.");
    expect(takeaway(you(10_000, 1), agent(40_000, false, 2))).toBe("You stopped on Calendar at 0:10.0. The agent stopped after 2 of 3.");
  });
});
