import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { STAGES, type Challenge } from "../challenge/types";
import { gap } from "../lib/format";
import { href } from "../lib/router";
import { PENALTY_MS, stageTime } from "../game/run";
import type { RunSummary } from "../game/agentRuns";
import { bestFor } from "../game/bests";
import { Brand } from "./Brand";
import { IconArrowRight, IconPlay, STAGE_ICONS } from "./Icons";

type Props = {
  ch: Challenge;
  onStart?: () => void;
  ghost?: RunSummary | null;
  /** Replaces the brand in the top bar (the replay puts its back link there). */
  left?: ReactNode;
};

/**
 * The landing page. Racing a recorded agent, it leads with the agent's time as the one big number (the
 * dare), and the tasks double as a bar chart of the agent's lap on each.
 */
export function Intro({ ch, onStart, ghost, left }: Props) {
  const [best] = useState(() => (onStart ? bestFor(ch.seed) : null));
  const laps = STAGES.map((_, i) => (ghost ? stageTime(ghost.splits, i) : null));
  const longest = Math.max(1, ...laps.map((t) => t ?? 0));

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
      <div className="intro-bg" aria-hidden />
      <header className="topbar">{left ?? <Brand />}</header>

      <main className="intro-main">
        {/* On phones the hero's parts join the page's flow (display: contents), so the course can sit between the dare and the fine print. */}
        <div className="intro-hero">
          {ghost?.finished ? (
            <>
              <p className="eyebrow intro-eyebrow">
                <i className="dot dot-agent" aria-hidden />
                {ghost.modelLabel} · time to beat
              </p>
              <h1 className="intro-title">
                <span className="intro-figure">{gap(ghost.totalMs)}</span>
                <span className="intro-claim">An AI agent's time on three everyday browser tasks.</span>
                <span className="intro-dare">Can you do them faster?</span>
              </h1>
            </>
          ) : (
            <>
              <p className="eyebrow intro-eyebrow">
                <i className="dot dot-you" aria-hidden />
                Time trial · 3 races
              </p>
              <h1 className="intro-title">
                <span className="intro-claim intro-claim-lg">Three everyday browser tasks.</span>
                <span className="intro-dare">How fast can you do them?</span>
              </h1>
            </>
          )}
          <p className="intro-sub">
            Same tasks, same page, one clock. Wrong answers cost {PENALTY_MS / 1000}&nbsp;seconds.
          </p>
          {/* On phones Start is pinned to the bottom, under the thumb. The replay shows it too: the agent's first click lands here. */}
          <div className="intro-cta">
            <button className="btn btn-go btn-lg intro-start" data-trace="intro:start" onClick={onStart}>
              Start
              <IconArrowRight size={20} />
              {onStart && (
                <kbd className="intro-kbd" aria-hidden>
                  Enter
                </kbd>
              )}
            </button>
            {ghost && onStart && (
              <a className="btn btn-quiet btn-lg intro-watch" href={href(`/replay/${ch.seed}`)}>
                <span className="intro-watch-icon">
                  <IconPlay size={12} />
                </span>
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

        {/* The course, and with an agent to race, a bar chart of its lap on each task (one series, one baseline). */}
        <section className={`intro-card ${ghost ? "laps" : ""}`} aria-label="The three races">
          {ghost && (
            <div className="intro-card-head">
              <span className="eyebrow">The course</span>
              <span className="eyebrow">{ghost.modelLabel}'s laps</span>
            </div>
          )}
          <ol className="intro-tasks">
            {STAGES.map((s, i) => {
              const Icon = STAGE_ICONS[s.id];
              const t = laps[i];
              return (
                <li key={s.id}>
                  <span className={`it-icon it-${s.id}`}>
                    <Icon size={17} />
                  </span>
                  <b className="it-title">{s.title}</b>
                  {t !== null && (
                    <>
                      <span className="it-bar" style={{ "--w": `${(t / longest) * 100}%` } as CSSProperties} aria-hidden />
                      <span className="it-time" title={`${ghost!.modelLabel}'s time on this task`}>
                        {gap(t)}
                      </span>
                    </>
                  )}
                  <span className="it-blurb">{s.blurb}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}
