import { STAGES } from "../challenge/types";
import type { RunSummary } from "../game/agentRuns";
import { PENALTY_MS, type RunResult } from "../game/run";
import { formatDuration } from "../lib/format";

type Timed = Pick<RunResult, "finished" | "stagesCleared" | "splits" | "totalMs">;

export const stageTime = (splits: number[], i: number) => (i < splits.length ? splits[i] - (splits[i - 1] ?? 0) : null);
export const gap = (ms: number) => (ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : formatDuration(ms));
const shown = (r: Timed) => (r.finished ? formatDuration(r.totalMs) : `${r.stagesCleared}/3`);

/** One plain sentence on how the two runs compare. */
export function takeaway(human: Timed, agent: RunSummary): string {
  if (human.finished && agent.finished) {
    const diff = human.totalMs - agent.totalMs;
    if (Math.abs(diff) < 100) return "You and the agent finished in the same time.";
    if (diff < 0) return `You finished ${gap(-diff)} ahead of the agent.`;
    const ratio = human.totalMs / agent.totalMs;
    return ratio >= 1.5 ? `The agent was ${ratio.toFixed(1)}× faster than you.` : `The agent finished ${gap(diff)} ahead of you.`;
  }
  const a = agent.stagesCleared === 3 ? "all three" : `${agent.stagesCleared} of 3`;
  return `You cleared ${human.stagesCleared} of 3 tasks. The agent cleared ${a}.`;
}

/** You-vs-agent summary shown when a run ends. */
export function Outcome({ human, agent }: { human: RunResult; agent: RunSummary }) {
  return (
    <div className="outcome">
      <div className="outcome-times">
        <div className="side">
          <span>You</span>
          <b data-testid="final-time">{shown(human)}</b>
          {human.penalties > 0 && (
            <small>
              incl. {human.penalties} wrong answer{human.penalties > 1 ? "s" : ""} (+{(human.penalties * PENALTY_MS) / 1000}s)
            </small>
          )}
        </div>
        <div className="side agent">
          <span>{agent.modelLabel}</span>
          <b>{shown(agent)}</b>
        </div>
      </div>
      <p className="outcome-line" data-testid="takeaway">
        {takeaway(human, agent)}
      </p>
      <div className="outcome-splits">
        <div className="osplit-head">
          <span />
          <span>You</span>
          <span>Agent</span>
        </div>
        {STAGES.map((s, i) => {
          const h = stageTime(human.splits, i);
          const a = stageTime(agent.splits, i);
          return (
            <div className="osplit" key={s.id}>
              <span>{s.title}</span>
              <span>{h === null ? "—" : gap(h)}</span>
              <span>{a === null ? "—" : gap(a)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
