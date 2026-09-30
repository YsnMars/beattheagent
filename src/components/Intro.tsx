import { useEffect, useState, type ReactNode } from "react";
import { STAGES, type Challenge } from "../challenge/types";
import { formatDuration, formatSeconds } from "../lib/format";
import { href } from "../lib/router";
import { PENALTY_MS } from "../game/run";
import type { RunSummary } from "../game/agentRuns";
import { bestFor } from "../game/bests";
import { gap, stageTime } from "./Outcome";

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
  const [best] = useState(() => (onStart ? bestFor(ch.seed) : null));

  // Enter starts the run, unless focus is on something else Enter should activate (a link).
  useEffect(() => {
    if (!onStart) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat) return;
      const el = document.activeElement;
      if (el && el !== document.body && el.closest("a, button, input, select, textarea")) return;
      e.preventDefault();
      onStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

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
          {STAGES.map((s, i) => {
            const t = ghost ? stageTime(ghost.splits, i) : null;
            return (
              <li key={s.id}>
                <span className="it-n">{i + 1}</span>
                <b className="it-title">{s.title}</b>
                <span className="it-blurb">{s.blurb}</span>
                {t !== null && (
                  <span className="it-time" title={`${ghost!.modelLabel}'s time on this task`}>
                    {gap(t)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="intro-actions">
          <button className="btn-primary" data-trace="intro:start" onClick={onStart}>
            Start challenge
            {onStart && <kbd className="intro-kbd">Enter</kbd>}
          </button>
          {ghost && (
            <a className="link" href={href(`/replay/${ch.seed}`)}>
              Watch the agent first
            </a>
          )}
        </div>
        {best && (
          <p className="intro-best" data-testid="best">
            {best.here ? "Your best on this challenge" : "Your best so far"}: <b>{formatDuration(best.ms)}</b>
          </p>
        )}
      </div>
    </div>
  );
}
