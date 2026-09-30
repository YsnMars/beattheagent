import { STAGES } from "../challenge/types";
import type { RunSummary } from "../game/agentRuns";
import type { RunResult } from "../game/run";
import { formatDelta, formatDuration } from "../lib/format";
import { verdictText } from "./Verdict";

const stageTime = (splits: number[], i: number) => (i < splits.length ? splits[i] - (splits[i - 1] ?? 0) : null);

/** Split comparison bars: one row per stage, human vs agent. */
export function SplitBars({ human, agent, humanLabel = "You" }: { human: RunResult; agent: RunSummary | null; humanLabel?: string }) {
  const times = STAGES.flatMap((_, i) => [stageTime(human.splits, i), agent ? stageTime(agent.splits, i) : null]).filter((x): x is number => x !== null);
  const max = Math.max(1, ...times);
  return (
    <div className="splits">
      {STAGES.map((s, i) => {
        const h = stageTime(human.splits, i);
        const a = agent ? stageTime(agent.splits, i) : null;
        return (
          <div className="split-row" key={s.id}>
            <div className="split-name">
              <span className="split-num">{i + 1}</span> {s.title}
              {h !== null && a !== null && <span className={`split-delta ${h <= a ? "good" : "bad"}`}>{formatDelta(h - a)}</span>}
            </div>
            <div className="split-bar-line">
              <span className="who">{humanLabel}</span>
              <span className="bar human">
                <i style={{ width: h === null ? 0 : `${(h / max) * 100}%` }} />
              </span>
              <span className="split-val">{h === null ? "—" : formatDuration(h)}</span>
            </div>
            {agent && (
              <div className="split-bar-line">
                <span className="who">Agent</span>
                <span className="bar agent">
                  <i style={{ width: a === null ? 0 : `${(a / max) * 100}%` }} />
                </span>
                <span className="split-val">{a === null ? "—" : formatDuration(a)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Renders a 1200×630 PNG scorecard for downloading / sharing as an image. */
export async function scorecardPng(human: RunResult, agent: RunSummary | null): Promise<Blob | null> {
  const W = 1200;
  const H = 630;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#0b0d12");
  grad.addColorStop(1, "#151b2b");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(124,242,154,0.08)";
  g.beginPath();
  g.arc(W - 80, 60, 260, 0, Math.PI * 2);
  g.fill();

  const font = (w: number, s: number) => `${w} ${s}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  g.fillStyle = "#7cf29a";
  g.font = font(800, 28);
  g.fillText("◆ BEAT THE AGENT", 64, 84);
  g.fillStyle = "#8b93a7";
  g.font = font(600, 24);
  g.fillText(`Challenge #${human.seed}`, 64, 124);

  const who = human.name || "Anonymous";
  g.fillStyle = "#e8ecf4";
  g.font = font(800, 64);
  g.fillText(human.finished ? formatDuration(human.totalMs) : `${human.stagesCleared}/3 stages`, 64, 230);
  g.font = font(600, 28);
  g.fillStyle = "#c3c9d8";
  g.fillText(`${who}${human.penalties ? ` · ${human.penalties} penalty` + (human.penalties > 1 ? "s" : "") : ""}`, 64, 276);

  if (agent) {
    const v = verdictText(human, agent, who);
    g.font = font(800, 40);
    g.fillStyle = v.win === true ? "#7cf29a" : v.win === false ? "#ffb454" : "#e8ecf4";
    g.fillText(v.headline, 64, 350);
    g.font = font(500, 26);
    g.fillStyle = "#c3c9d8";
    g.fillText(v.detail, 64, 390);
  }

  // splits table
  const x0 = 64;
  let y = 460;
  g.font = font(700, 22);
  STAGES.forEach((s, i) => {
    const h = stageTime(human.splits, i);
    const a = agent ? stageTime(agent.splits, i) : null;
    const x = x0 + i * 360;
    g.fillStyle = "#8b93a7";
    g.fillText(`${i + 1}. ${s.title}`, x, y);
    g.fillStyle = "#e8ecf4";
    g.font = font(800, 34);
    g.fillText(h === null ? "—" : formatDuration(h), x, y + 46);
    g.font = font(600, 22);
    if (agent) {
      g.fillStyle = "#ffb454";
      g.fillText(`Agent ${a === null ? "—" : formatDuration(a)}`, x, y + 84);
    }
    g.font = font(700, 22);
  });
  y = H - 36;
  g.fillStyle = "#5d667c";
  g.font = font(500, 20);
  g.fillText(agent ? `vs ${agent.modelLabel} · recorded in an OpenAI-hosted browser` : "Beat the Agent", 64, y);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}
