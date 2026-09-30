import type { RunSummary } from "../game/agentRuns";
import { compareResults, type RunResult } from "../game/run";
import { formatDuration } from "../lib/format";

const gap = (ms: number) => (ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : formatDuration(ms));

export function verdictText(human: RunResult, agent: RunSummary, you = "You") {
  const cmp = compareResults(human, agent);
  const bothDone = human.finished && agent.finished;
  if (bothDone) {
    const diff = Math.abs(human.totalMs - agent.totalMs);
    if (cmp < 0) return { win: true as const, headline: `${you} beat the agent`, detail: `${gap(diff)} faster than ${agent.modelLabel}` };
    if (cmp > 0) return { win: false as const, headline: `${agent.modelLabel} wins`, detail: `The agent was ${gap(diff)} faster` };
    return { win: null, headline: "Dead heat", detail: "Identical times" };
  }
  const hs = human.stagesCleared;
  const as = agent.stagesCleared;
  const stages = `${you === "You" ? "You" : you} cleared ${hs}/3 · agent cleared ${as}/3`;
  if (cmp < 0) return { win: true as const, headline: `${you} beat the agent`, detail: stages };
  if (cmp > 0) return { win: false as const, headline: `${agent.modelLabel} wins`, detail: stages };
  return { win: null, headline: "It's a tie", detail: stages };
}

export function Verdict({ human, agent, compact, you }: { human: RunResult; agent: RunSummary; compact?: boolean; you?: string }) {
  const v = verdictText(human, agent, you);
  return (
    <div className={`verdict ${v.win === true ? "win" : v.win === false ? "lose" : "tie"} ${compact ? "compact" : ""}`} data-testid="verdict">
      <div className="verdict-headline">{v.headline}</div>
      <div className="verdict-detail">{v.detail}</div>
      {!compact && (
        <div className="verdict-times">
          <span>
            {you ?? "You"}: <b>{human.finished ? formatDuration(human.totalMs) : `${human.stagesCleared}/3 stages`}</b>
          </span>
          <span>
            {agent.modelLabel}: <b>{agent.finished ? formatDuration(agent.totalMs) : `${agent.stagesCleared}/3 stages`}</b>
          </span>
        </div>
      )}
    </div>
  );
}
