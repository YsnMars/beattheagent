import { useEffect, useState, type ReactNode } from "react";
import { STAGES, type Challenge } from "../challenge/types";
import { formatSeconds } from "../lib/format";
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

/** The logo: the agent's cursor, as drawn in replays. */
export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path d="M4 2.5l6.6 17.8 2.3-7.1 7.1-2.3z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <Mark />
      Beat the Agent
    </span>
  );
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
      {/* The replay shows its own back link up top; the landing page keeps the name with the content. */}
      {left && <header className="topbar">{left}</header>}
      <div className="intro-body">
        {!left && (
          <p className="intro-brand">
            <Brand />
          </p>
        )}
        <h1 className="intro-title">
          {ghost?.finished ? (
            <>
              An AI agent did these three tasks in <span className="agent-ink">{formatSeconds(ghost.totalMs)}</span>.
            </>
          ) : (
            "Three everyday browser tasks."
          )}
          <span className="intro-dare">{ghost?.finished ? "Can you do them faster?" : "How fast can you do them?"}</span>
        </h1>
        <p className="intro-sub">Same tasks, same page, one clock. Wrong answers cost {PENALTY_MS / 1000} seconds.</p>
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
            Start
            {onStart && (
              <kbd className="intro-kbd" aria-hidden>
                Enter
              </kbd>
            )}
          </button>
          {ghost && (
            <a className="link" href={href(`/replay/${ch.seed}`)}>
              Watch {ghost.modelLabel} do it
            </a>
          )}
        </div>
        {best && (
          <p className="intro-best" data-testid="best">
            {best.here ? "Your best on this challenge" : "Your best so far"}: <b>{gap(best.ms)}</b>
          </p>
        )}
      </div>
    </div>
  );
}
