import type { ReactNode } from "react";
import { STAGES, type Challenge } from "../challenge/types";
import { formatSeconds } from "../lib/format";
import { href } from "../lib/router";
import { PENALTY_MS } from "../game/run";
import type { RunSummary } from "../game/agentRuns";

type Props = {
  ch: Challenge;
  onStart?: () => void;
  ghost?: RunSummary | null;
  /** Replaces the brand in the top bar (the replay puts its back link there). */
  left?: ReactNode;
};

export function Brand() {
  return <span className="brand">Beat the Agent</span>;
}

export function Intro({ ch, onStart, ghost, left }: Props) {
  return (
    <div className="intro">
      <header className="topbar">{left ?? <Brand />}</header>
      <div className="intro-body">
        <h1 className="intro-title">
          {ghost?.finished ? (
            <>
              {ghost.modelLabel} did these three tasks in <span className="agent-ink">{formatSeconds(ghost.totalMs)}</span>.
            </>
          ) : (
            "Three everyday browser tasks."
          )}
        </h1>
        <p className="intro-sub">Do the same tasks, in order. Each one is checked when you submit it; wrong answers add {PENALTY_MS / 1000} seconds.</p>
        <ol className="intro-tasks">
          {STAGES.map((s) => (
            <li key={s.id}>
              <b>{s.title}</b> <span>{s.blurb}</span>
            </li>
          ))}
        </ol>
        <div className="intro-actions">
          <button className="btn-primary" data-trace="intro:start" onClick={onStart}>
            Start challenge
          </button>
          {ghost && (
            <a className="link" href={href(`/replay/${ch.seed}`)}>
              Watch the agent first
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
