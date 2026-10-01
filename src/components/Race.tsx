import { useEffect, useMemo, useRef, useState } from "react";
import { STAGES, type Challenge } from "../challenge/types";
import type { AgentRun, RunSummary } from "../game/agentRuns";
import { stageElapsedAt, type DerivedRun } from "../game/run";
import { useNow } from "../game/useRun";
import { AgentCursor, buildMoves } from "./AgentCursor";
import { TaskText } from "./GameScreen";
import { gap, stageTime } from "./Outcome";

const COUNT_MS = 800; // per number in the countdown

/**
 * The task for the stage that's about to start, on its own before the stage's app is in play. Each
 * stage is a race of its own, like a grand prix: the card opens with the result of the last one. The
 * clock is stopped meanwhile (the agent read its instructions on the clock, which the card says).
 */
export function Briefing({ ch, run, ghost, onReady }: { ch: Challenge; run: DerivedRun; ghost: RunSummary | null; onReady: () => void }) {
  const i = Math.min(run.stageIndex, STAGES.length - 1);
  const stage = STAGES[i];
  const cleared = i > 0 && run.feedback?.ok ? i - 1 : null;

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
        {cleared !== null && <RaceResult run={run} ghost={ghost} i={cleared} />}
        <div className="brief-kicker">
          Race {i + 1} of {STAGES.length} · {stage.app}
        </div>
        <h2 className="brief-title">{stage.title}</h2>
        <div className="brief-task task">
          <TaskText ch={ch} stage={stage.id} />
        </div>
        {ghost && ghost.stagesCleared >= i && (
          <p className="brief-agent">
            <span className="agent-ink">{ghost.modelLabel}</span>'s cursor races you on the page.
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

/** How the race just run went, and the standings after it (both times include wrong-answer penalties). */
function RaceResult({ run, ghost, i }: { run: DerivedRun; ghost: RunSummary | null; i: number }) {
  const title = STAGES[i].title;
  const yours = stageTime(run.splits, i)!;
  const theirs = ghost ? stageTime(ghost.splits, i) : null;
  const by = (ms: number) => (Math.abs(ms) < 100 ? null : gap(Math.abs(ms)));
  let verdict = null;
  if (ghost && theirs === null) verdict = <>{ghost.modelLabel} never finished this one.</>;
  else if (ghost && theirs !== null) {
    const d = by(yours - theirs);
    verdict = (
      <>
        {ghost.modelLabel}: <span className="agent-ink">{gap(theirs)}</span>. {d === null ? "A dead heat." : yours < theirs ? `You won by ${d}.` : `It won by ${d}.`}
      </>
    );
  }
  // Overall, over the races both have run.
  const total = ghost && ghost.splits[i] !== undefined ? by(run.splits[i] - ghost.splits[i]) : null;
  return (
    <div className="brief-result" data-testid="brief-cleared">
      <p className="brief-cleared">
        ✓ {title} in {gap(yours)}
      </p>
      {verdict && <p className="brief-verdict">{verdict}</p>}
      {ghost && ghost.splits[i] !== undefined && (
        <p className="brief-standing">
          Overall after {i + 1} of {STAGES.length}:{" "}
          {total === null ? "level with the agent" : run.splits[i] < ghost.splits[i] ? `you lead by ${total}` : `the agent leads by ${total}`}
        </p>
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
