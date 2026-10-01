import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { STAGES, type Challenge } from "../challenge/types";
import type { AgentRun, RunSummary } from "../game/agentRuns";
import type { DerivedRun } from "../game/run";
import { useNow } from "../game/useRun";
import { AgentCursor, buildMoves } from "./AgentCursor";
import { SplitGap, TaskText } from "./GameScreen";
import { gap } from "./Outcome";

const COUNT_MS = 800; // per number in the countdown

/**
 * The task for the stage that's about to start, on its own before the stage's app is in play. The
 * clock is stopped meanwhile (the agent read its instructions on the clock, which the card says).
 */
export function Briefing({ ch, run, ghost, onReady }: { ch: Challenge; run: DerivedRun; ghost: RunSummary | null; onReady: () => void }) {
  const i = Math.min(run.stageIndex, STAGES.length - 1);
  const stage = STAGES[i];
  const cleared = i > 0 ? STAGES[i - 1] : null;
  const theirs = ghost?.splits[i] !== undefined ? ghost.splits[i] - (i > 0 ? ghost.splits[i - 1] : 0) : null;

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
    <div className="race-overlay brief" role="dialog" aria-label={`${stage.title} briefing`}>
      <div className="brief-card">
        {cleared && run.feedback?.ok && (
          <p className="brief-cleared" data-testid="brief-cleared">
            ✓ {cleared.title} done
            {ghost && <SplitGap run={run} ghost={ghost} stage={cleared.id} />}
          </p>
        )}
        <div className="brief-kicker">
          Stage {i + 1} of {STAGES.length} · {stage.app}
        </div>
        <h2 className="brief-title">{stage.title}</h2>
        <div className="brief-task task">
          <TaskText ch={ch} stage={stage.id} />
        </div>
        {theirs !== null && (
          <p className="brief-agent">
            {ghost!.modelLabel} did this one in <span className="agent-ink">{gap(theirs)}</span>. Its cursor races you on the page.
          </p>
        )}
        <button className="btn-primary brief-go" data-trace="brief:ready" onClick={onReady} autoFocus>
          Ready
          <kbd className="intro-kbd" aria-hidden>
            Enter
          </kbd>
        </button>
        <p className="brief-note">
          The clock is stopped while you read.
          {ghost && " The agent read its instructions on the clock, so this is a head start."}
        </p>
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
        <span className="count-n" key={n}>
          {n}
        </span>
      )}
    </div>
  );
}

/** The "Go!" that flashes as the clock starts. */
export function GoFlash() {
  return (
    <div className="race-overlay go" aria-hidden>
      <span className="count-n">Go!</span>
    </div>
  );
}

/**
 * Two lanes, you and the agent, across the three stages, on the race clock. The agent's marker moves
 * evenly between its recorded stage splits; yours sits on the stage you're on and jumps when you clear it.
 */
export function RaceTrack({ run, ghost, elapsed }: { run: DerivedRun; ghost: RunSummary; elapsed: number }) {
  const n = STAGES.length;
  const agentAt = (() => {
    const i = ghost.splits.findIndex((s) => s > elapsed);
    if (i === -1) return ghost.finished ? 1 : ghost.stagesCleared / n;
    const from = i > 0 ? ghost.splits[i - 1] : 0;
    return (i + (elapsed - from) / (ghost.splits[i] - from)) / n;
  })();
  const youAt = run.splits.length / n;
  const agentDone = ghost.finished && ghost.totalMs <= elapsed;
  const lane = (who: "you" | "agent", label: ReactNode, at: number, done: boolean) => (
    <div className={`lane lane-${who} ${done ? "done" : ""}`}>
      <span className="lane-label">{label}</span>
      <span className="lane-track">
        <span className="lane-fill" style={{ width: `${at * 100}%` }} />
        {STAGES.slice(1).map((s, i) => (
          <span key={s.id} className="lane-tick" style={{ left: `${((i + 1) / n) * 100}%` }} />
        ))}
        <span className="lane-mark" style={{ left: `${at * 100}%` }} />
      </span>
    </div>
  );
  return (
    <div className="race" aria-label="Race progress" data-testid="race">
      {lane("you", "You", youAt, run.finishedAt !== null)}
      {lane("agent", "Agent", agentAt, agentDone)}
    </div>
  );
}

/**
 * The agent's cursor on your page, stage by stage: when you start a stage, it starts the same stage,
 * doing exactly what it did in its recorded run. (The race track shows the overall race.)
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
    return {
      from,
      to,
      moves: buildMoves(agent.events).filter((m) => m.at > from && m.at <= to),
    };
  }, [agent, i]);
  const stageFrom = run.stageFrom;
  const live = lap !== null && stageFrom !== null && run.pausedSince === null && run.finishedAt === null && run.gaveUpAt === null;
  const now = useNow(live, 200);
  if (!live) return null;
  const t = now - stageFrom;
  const done = t >= lap.to - lap.from;
  // Done: say so for a moment, then step out of the way.
  if (done && t - (lap.to - lap.from) > 2500) return null;
  return (
    <AgentCursor key={i} className={`ghost-race ${done ? "lap-done" : ""}`} moves={lap.moves} cur={() => lap.from + (Date.now() - stageFrom)} scope=".arena">
      <span className="ghost-tag">{done ? `✓ ${STAGES[i].title} in ${gap(lap.to - lap.from)}` : agent.modelLabel}</span>
    </AgentCursor>
  );
}
