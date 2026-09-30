import type { ReactNode } from "react";
import { STAGES, type Challenge, type StageId } from "../challenge/types";
import { colList, sortLabel } from "../challenge/validate";
import { formatDay, formatDuration, formatMoney } from "../lib/format";
import { elapsedAt, PENALTY_MS, type DerivedRun } from "../game/run";
import type { AnyAction, CalAction, SheetAction, ShopAction } from "../game/state";
import type { RunSummary } from "../game/agentRuns";
import { Brand } from "./Intro";
import { Shopping } from "../stages/Shopping";
import { Calendar, clashFor } from "../stages/Calendar";
import { Sheet } from "../stages/Sheet";

export function TaskText({ ch, stage }: { ch: Challenge; stage: StageId }) {
  if (stage === "shopping") {
    const s = ch.shopping;
    return (
      <p>
        Buy <b>one</b> pair of headphones that costs <b>{formatMoney(s.budgetCents)} or less</b>, is rated <b>{s.minRating.toFixed(1)}★ or higher</b>, and
        arrives <b>by {formatDay(s.deadline)}</b>. Then place the order.
      </p>
    );
  }
  if (stage === "calendar") {
    const c = ch.calendar;
    const clash = clashFor(c);
    const who = clash ? (clash.who.name === "You" ? "your" : `${clash.who.name.split(" ")[0]}'s`) : "someone's";
    return (
      <p>
        “{c.meetingTitle}” now clashes with {who} calendar. Move it to a new time <b>this week (Mon–Fri)</b> when <b>all {c.attendees.length} attendees are free</b>{" "}
        and <b>within everyone's working hours</b>. It lasts <b>{c.durationMin} minutes</b> and starts on the hour or half hour. Then save.
      </p>
    );
  }
  const sh = ch.sheet;
  return (
    <p>
      Rows are duplicates when their <b>{colList(sh.dupColumns)}</b> {sh.dupColumns.length > 1 ? "all match" : "matches"} (ignore letter case). From each
      duplicate group keep only the <b>{sh.keepRule.label}</b> row. Then sort the remaining rows by <b>{sortLabel(sh.sort)}</b> and submit the sheet.
    </p>
  );
}

type Props = {
  ch: Challenge;
  run: DerivedRun;
  now: number;
  onAct?: (stage: StageId, a: AnyAction) => void;
  onSubmit?: () => void;
  onGiveUp?: () => void;
  ghost?: RunSummary | null;
  overlay?: ReactNode;
  /** Replaces the brand in the HUD (the replay puts its back link there). */
  left?: ReactNode;
};

export function GameScreen({ ch, run, now, onAct, onSubmit, onGiveUp, ghost, overlay, left }: Props) {
  const stageIndex = Math.min(run.stageIndex, STAGES.length - 1);
  const stage = STAGES[stageIndex];
  const elapsed = elapsedAt(run, now);
  const done = run.finishedAt !== null;
  const noop = () => {};
  const act = onAct ?? noop;
  const submit = onSubmit ?? noop;
  const fb = run.feedback && run.feedback.s === stage.id ? run.feedback : null;
  const recentClear =
    run.feedback?.ok && run.stageIndex > 0 && run.feedback.s === STAGES[run.stageIndex - 1].id && now - run.feedback.at < 2600 ? run.feedback : null;
  const recentPenalty = fb && !fb.ok && now - fb.at < 1600;

  return (
    <div className="game">
      {/* The HUD and the task stay pinned together so the instructions are always in view. */}
      <div className="game-head">
        <header className="hud">
          <div className="hud-left">{left ?? <Brand />}</div>
          <div className="hud-right">
            {ghost && <Ghost ghost={ghost} elapsed={elapsed} />}
            <div className={`timer ${recentPenalty ? "penalty" : ""}`} aria-live="off">
              <span className="timer-value" data-testid="timer">
                {formatDuration(elapsed)}
              </span>
              {run.penalties > 0 && <span className="timer-pen">+{(run.penalties * PENALTY_MS) / 1000}s</span>}
            </div>
            {onGiveUp && !done && run.gaveUpAt === null && (
              <button className="btn-text" data-trace="hud:giveup" onClick={onGiveUp}>
                Give up
              </button>
            )}
          </div>
        </header>

        {!done && (
          <section className="task" aria-live="polite">
            <div className="task-head">
              <span className="task-kicker">
                Stage {stageIndex + 1} of 3 · {stage.title}
              </span>
              {recentClear && <span className="task-cleared">✓ {recentClear.msg}</span>}
            </div>
            <TaskText ch={ch} stage={stage.id} />
            {fb && !fb.ok && (
              <div className={`task-feedback ${recentPenalty ? "flash" : ""}`} role="alert">
                <b>Rejected (+{PENALTY_MS / 1000}s):</b> {fb.msg}
              </div>
            )}
          </section>
        )}
      </div>

      <main className="arena">
        {!done && (
          <div className={`appwin app-${stage.id}`} key={stage.id}>
            {stage.id === "shopping" && (
              <Shopping ch={ch.shopping} state={run.states.shopping} dispatch={(a: ShopAction) => act("shopping", a)} onSubmit={submit} feedback={fb} />
            )}
            {stage.id === "calendar" && (
              <Calendar ch={ch.calendar} state={run.states.calendar} dispatch={(a: CalAction) => act("calendar", a)} onSubmit={submit} feedback={fb} />
            )}
            {stage.id === "sheet" && <Sheet ch={ch.sheet} state={run.states.sheet} dispatch={(a: SheetAction) => act("sheet", a)} onSubmit={submit} feedback={fb} />}
          </div>
        )}
        {overlay}
      </main>
    </div>
  );
}

/** Where the recorded agent run was at this point in time. */
function Ghost({ ghost, elapsed }: { ghost: RunSummary; elapsed: number }) {
  const cleared = ghost.splits.filter((s) => s <= elapsed).length;
  let text: string;
  if (ghost.totalMs <= elapsed) text = ghost.finished ? `done in ${formatDuration(ghost.totalMs)}` : `stopped after ${ghost.stagesCleared}/3`;
  else text = `on ${STAGES[Math.min(cleared, 2)].title}`;
  return (
    <div className="ghost" title="Where the recorded agent run was at this point in time">
      Agent <b>{text}</b>
    </div>
  );
}
