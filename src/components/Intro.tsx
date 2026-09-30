import { STAGES, type Challenge } from "../challenge/types";
import { formatSeconds } from "../lib/format";
import { href } from "../lib/router";
import { PENALTY_MS } from "../game/run";
import type { RunSummary } from "../game/agentRuns";

type Props = {
  ch: Challenge;
  onStart?: () => void;
  ghost?: RunSummary | null;
};

export const STAGE_ICONS = ["🎧", "📅", "📊"];

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">◆</span>
      <span className="brand-name">Beat the Agent</span>
    </span>
  );
}

export function Intro({ ch, onStart, ghost }: Props) {
  return (
    <div className="intro">
      <header className="topbar">
        <Brand />
      </header>
      <div className="intro-body">
        {ghost?.finished ? (
          <>
            <p className="intro-eyebrow">{ghost.modelLabel} · browser use</p>
            <h1 className="intro-title">
              An AI agent did these three tasks in <span className="agent-ink">{formatSeconds(ghost.totalMs)}</span>.
            </h1>
            <p className="intro-sub">Try them yourself. You'll see where the agent was at each moment.</p>
          </>
        ) : (
          <>
            <h1 className="intro-title">Three everyday browser tasks.</h1>
            <p className="intro-sub">Complete them in order. The timer starts when you press Start.</p>
          </>
        )}
        <ol className="intro-tasks">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <span className="intro-task-icon" aria-hidden>
                {STAGE_ICONS[i]}
              </span>
              <b>{s.title}</b>
              <span>{s.blurb}</span>
            </li>
          ))}
        </ol>
        <div className="intro-actions">
          <button className="btn-primary btn-xl" data-trace="intro:start" onClick={onStart}>
            Start challenge
          </button>
          {ghost && (
            <a className="link" href={href(`/replay/${ch.seed}`)}>
              or watch the agent first
            </a>
          )}
        </div>
        <p className="intro-note">Each task is checked when you submit it. Wrong answers add {PENALTY_MS / 1000} seconds.</p>
      </div>
    </div>
  );
}
