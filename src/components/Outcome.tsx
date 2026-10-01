import { STAGES } from "../challenge/types";
import type { RunSummary } from "../game/agentRuns";
import { PENALTY_MS, type RunResult } from "../game/run";
import { formatDuration, formatUsd } from "../lib/format";

type Timed = Pick<RunResult, "finished" | "stagesCleared" | "splits" | "totalMs">;

export const stageTime = (splits: number[], i: number) => (i < splits.length ? splits[i] - (splits[i - 1] ?? 0) : null);
export const gap = (ms: number) => (ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : formatDuration(ms));
const progress = (r: Timed) => (r.finished ? "all 3 done" : `${r.stagesCleared} of 3 done`);

/** The result in one plain sentence: the card's headline. */
export function takeaway(human: Timed, agent: RunSummary): string {
  if (human.finished && agent.finished) {
    const diff = human.totalMs - agent.totalMs;
    if (Math.abs(diff) < 100) return "You tied the agent.";
    if (diff < 0) return `You beat the agent by ${gap(-diff)}.`;
    const ratio = human.totalMs / agent.totalMs;
    return ratio >= 1.5 ? `The agent was ${ratio.toFixed(1)}× faster.` : `The agent was ${gap(diff)} faster.`;
  }
  if (!human.finished) {
    const where = STAGES[Math.min(human.stagesCleared, STAGES.length - 1)].title;
    const stopped = `You stopped on ${where} at ${formatDuration(human.totalMs)}.`;
    if (!agent.finished) return `${stopped} The agent stopped after ${agent.stagesCleared} of 3.`;
    return agent.totalMs <= human.totalMs
      ? `${stopped} The agent had finished by ${formatDuration(agent.totalMs)}.`
      : `${stopped} The agent finished in ${formatDuration(agent.totalMs)}.`;
  }
  return `You finished all three. The agent stopped after ${agent.stagesCleared} of 3.`;
}

/** You-vs-agent summary shown when a run ends. */
export function Outcome({ human, agent }: { human: RunResult; agent: RunSummary }) {
  return (
    <div className="outcome">
      <h2 className="outcome-head" data-testid="takeaway">
        {takeaway(human, agent)}
      </h2>
      <div className="outcome-times">
        <div className="side">
          <span>You</span>
          <b data-testid="final-time">{formatDuration(human.totalMs)}</b>
          <small>{progress(human)}</small>
          {human.penalties > 0 && (
            <small className="side-bad">
              {human.penalties} wrong answer{human.penalties > 1 ? "s" : ""} (+{(human.penalties * PENALTY_MS) / 1000}s)
            </small>
          )}
        </div>
        <div className="side agent">
          <span>{agent.modelLabel}</span>
          <b>{formatDuration(agent.totalMs)}</b>
          <small>{progress(agent)}</small>
          <small data-testid="agent-cost">{agent.costUsd !== null ? `${formatUsd(agent.costUsd)} in API costs` : "API cost not reported"}</small>
        </div>
      </div>
      <div className="outcome-splits">
        <div className="osplit-head">
          <span />
          <span>You</span>
          <span>Agent</span>
        </div>
        {STAGES.map((s, i) => {
          const h = stageTime(human.splits, i);
          const a = stageTime(agent.splits, i);
          // Where a gave-up run stopped: time spent on that stage so far.
          const stoppedHere = !human.finished && i === human.stagesCleared;
          const partial = stoppedHere ? human.totalMs - (human.splits[i - 1] ?? 0) : null;
          const youWon = h !== null && (a === null || h < a);
          const agentWon = a !== null && (h === null || a < h);
          const wrong = human.attempts[i] ?? 0;
          return (
            <div className="osplit" key={s.id} data-testid={`split-${s.id}`}>
              <span>{s.title}</span>
              <span className={youWon ? "win" : ""}>
                {h !== null ? gap(h) : partial !== null ? <em>stopped at {gap(partial)}</em> : "—"}
                {wrong > 0 && <i className="osplit-pen">+{(wrong * PENALTY_MS) / 1000}s</i>}
              </span>
              <span className={agentWon ? "win" : ""}>{a === null ? "—" : gap(a)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
