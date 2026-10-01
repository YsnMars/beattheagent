import { useEffect, useMemo, useRef, useState } from "react";
import { STAGES, type Challenge } from "../challenge/types";
import type { AgentRun, RunSummary } from "../game/agentRuns";
import { stageElapsedAt, stageTime, type DerivedRun } from "../game/run";
import { useNow } from "../game/useRun";
import { formatDuration, gap } from "../lib/format";
import { AgentCursor, buildMoves } from "./AgentCursor";
import { TaskText } from "./GameScreen";
import { STAGE_ICONS, IconArrowRight, IconCheck } from "./Icons";
import { Lanes } from "./Lanes";

const COUNT_MS = 800; // per number in the countdown

/**
 * The task for the stage that's about to start, on its own before the stage's app is in play. Each
 * stage is a race of its own, like a grand prix: the card opens with the result of the last one. The
 * clock is stopped meanwhile (the agent read its instructions on the clock). A sheet from the bottom
 * on phones, so Ready is under the thumb.
 */
export function Briefing({ ch, run, ghost, onReady }: { ch: Challenge; run: DerivedRun; ghost: RunSummary | null; onReady: () => void }) {
  const i = Math.min(run.stageIndex, STAGES.length - 1);
  const stage = STAGES[i];
  const cleared = i > 0 && run.feedback?.ok ? i - 1 : null;
  const Icon = STAGE_ICONS[stage.id];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat) return;
      const el = document.activeElement;
      if (el && el !== document.body && !el.closest(".brief") && el.closest("a, button, input, select, textarea")) return;
      e.preventDefault();
      onReady();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReady]);

  return (
    <div className="race-overlay brief sheet-scrim" role="dialog" aria-label={`${stage.title} briefing`}>
      <div className="sheet brief-card">
        <span className="sheet-grip" aria-hidden />
        {cleared !== null && <RaceResult run={run} ghost={ghost} i={cleared} />}
        <div className="brief-head">
          <span className={`brief-icon it-${stage.id}`}>
            <Icon size={22} />
          </span>
          <div>
            <div className="eyebrow brief-kicker">
              Race {i + 1} of {STAGES.length}
            </div>
            <h2 className="brief-title">{stage.title}</h2>
          </div>
          <ol className="brief-pips" aria-hidden>
            {STAGES.map((s, k) => (
              <li key={s.id} className={k < i ? "done" : k === i ? "current" : ""} />
            ))}
          </ol>
        </div>
        <div className="brief-task task">
          <TaskText ch={ch} stage={stage.id} />
        </div>
        <div className="brief-foot">
          <p className="brief-note">
            {ghost && ghost.stagesCleared >= i ? (
              <>
                <i className="dot dot-agent" aria-hidden />
                <span>
                  <b className="agent-ink">{ghost.modelLabel}</b>'s cursor races you on the page.
                </span>
              </>
            ) : (
              "The clock waits while you read."
            )}
          </p>
          <button className="btn btn-go btn-lg brief-go" data-trace="brief:ready" onClick={onReady} autoFocus>
            Ready
            <IconArrowRight size={20} />
            <kbd className="intro-kbd" aria-hidden>
              Enter
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

/** 3, 2, 1 over the stage's app (visible but not yet in play), then `onDone`. */
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (n === 0) {
      done.current();
      return;
    }
    const id = window.setTimeout(() => setN(n - 1), COUNT_MS);
    return () => clearTimeout(id);
  }, [n]);
  return (
    <div className="race-overlay counting" role="status" aria-label="Countdown">
      {n > 0 && (
        <div className="count" key={n}>
          <svg className="count-ring" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="46" />
          </svg>
          <span className="count-n">{n}</span>
        </div>
      )}
    </div>
  );
}

/** The "GO" that flashes as the clock starts. */
export function GoFlash() {
  return (
    <div className="race-overlay go" aria-hidden>
      <span className="count-n">GO</span>
    </div>
  );
}

/**
 * How the race just run went, and the standings after it (both times include wrong-answer penalties):
 * the verdict as a headline, the two times as labelled stats, then the standings as lanes.
 */
function RaceResult({ run, ghost, i }: { run: DerivedRun; ghost: RunSummary | null; i: number }) {
  const title = STAGES[i].title;
  const yours = stageTime(run.splits, i)!;
  const theirs = ghost ? stageTime(ghost.splits, i) : null;
  const by = (ms: number) => (Math.abs(ms) < 100 ? null : gap(Math.abs(ms)));
  let verdict: string;
  let lead: "you" | "agent" | "even" = "you";
  if (!ghost) verdict = `Cleared in ${gap(yours)}`;
  else if (theirs === null) verdict = `You won · ${ghost.modelLabel} never finished`;
  else {
    const d = by(yours - theirs);
    lead = d === null ? "even" : yours < theirs ? "you" : "agent";
    verdict = d === null ? "A dead heat" : lead === "you" ? `You won by ${d}` : `${ghost.modelLabel} won by ${d}`;
  }
  // Overall, over the races both have run (after the first race that's just the verdict again).
  const both = i > 0 && ghost && ghost.splits[i] !== undefined;
  const total = both ? by(run.splits[i] - ghost.splits[i]) : null;
  return (
    <div className={`brief-result lead-${lead}`} data-testid="brief-cleared">
      <div className="eyebrow brief-cleared">
        <IconCheck size={13} strokeWidth={3} />
        {title}
      </div>
      <p className="brief-verdict">{verdict}</p>
      {ghost && (
        <>
          <div className="brief-stats">
            <div className="stat stat-you">
              <span className="stat-label">
                <i className="dot dot-you" aria-hidden />
                You
              </span>
              <b>{formatDuration(yours)}</b>
            </div>
            <div className="stat stat-agent">
              <span className="stat-label">
                <i className="dot dot-agent" aria-hidden />
                {ghost.modelLabel}
              </span>
              <b>{theirs === null ? "—" : formatDuration(theirs)}</b>
            </div>
            {both && (
              <div className="stat stat-standing">
                <span className="stat-label">
                  After {i + 1} of {STAGES.length}
                </span>
                <b className="brief-standing">
                  {total === null ? "Level" : run.splits[i] < ghost.splits[i] ? `You lead by ${total}` : `Agent leads by ${total}`}
                </b>
              </div>
            )}
          </div>
          {both && (
            <Lanes
              lanes={[
                { who: "you", label: "You", splits: run.splits.slice(0, i + 1), totalMs: run.splits[i] },
                { who: "agent", label: ghost.modelLabel, splits: ghost.splits.slice(0, i + 1), totalMs: ghost.splits[i] },
              ]}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * The agent's cursor on your page: when you start a race, it starts the same one, doing exactly what it
 * did in its recorded run, on the race's clock (so a wrong answer's penalty lets it jump ahead).
 */
export function GhostCursor({ agent, run }: { agent: AgentRun; run: DerivedRun }) {
  const i = run.stageIndex;
  const lap = useMemo(() => {
    const start = agent.events.find((e) => e.k === "start")?.at;
    if (start === undefined) return null;
    const bounds = [start, ...agent.events.filter((e) => e.k === "submit" && e.ok).map((e) => e.at)];
    if (bounds[i] === undefined) return null;
    const from = bounds[i];
    const to = bounds[i + 1] ?? Infinity;
    return { from, moves: buildMoves(agent.events).filter((m) => m.at > from && m.at <= to), ms: stageTime(agent.splits, i) ?? Infinity };
  }, [agent, i]);
  const live = lap !== null && run.stageFrom !== null && run.pausedSince === null && run.finishedAt === null && run.gaveUpAt === null;
  const now = useNow(live, 200);
  if (!live) return null;
  const t = stageElapsedAt(run, now);
  const done = t >= lap.ms;
  // Done: say so for a moment, then step out of the way.
  if (done && t - lap.ms > 2500) return null;
  return (
    <AgentCursor key={i} className={`ghost-race ${done ? "lap-done" : ""}`} moves={lap.moves} cur={() => lap.from + stageElapsedAt(run, Date.now())} scope=".arena">
      <span className="ghost-tag">{done ? `✓ ${STAGES[i].title} in ${gap(lap.ms)}` : agent.modelLabel}</span>
    </AgentCursor>
  );
}
