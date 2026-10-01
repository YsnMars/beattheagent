import { useEffect, useRef, useState, type ReactNode } from "react";
import { STAGES, type Challenge, type StageId } from "../challenge/types";
import { colList, sortLabel, type Req } from "../challenge/validate";
import { formatDay, formatDuration, formatMoney } from "../lib/format";
import { elapsedAt, PENALTY_MS, type DerivedRun } from "../game/run";
import type { AnyAction, CalAction, SheetAction, ShopAction } from "../game/state";
import type { RunSummary } from "../game/agentRuns";
import { Brand } from "./Intro";
import { gap } from "./Outcome";
import { Shopping } from "../stages/Shopping";
import { Calendar, clashFor } from "../stages/Calendar";
import { Sheet } from "../stages/Sheet";

/**
 * The task, worded exactly as the recorded agent runs saw it. Its conditions are highlighted inline
 * (see `.task p b`) so they can be re-checked at a glance without a second copy of the rules. The ones
 * the last rejected submission broke are marked until the next submission.
 */
export function TaskText({ ch, stage, failed = [] }: { ch: Challenge; stage: StageId; failed?: Req[] }) {
  const b = (req: Req | null, children: ReactNode) => <b className={req && failed.includes(req) ? "failed" : undefined}>{children}</b>;
  if (stage === "shopping") {
    const s = ch.shopping;
    return (
      <p>
        Buy {b("shop:one", "one")} pair of headphones that costs {b("shop:budget", <>{formatMoney(s.budgetCents)} or less</>)}, is rated{" "}
        {b("shop:rating", <>{s.minRating.toFixed(1)}★ or higher</>)}, and arrives {b("shop:deadline", <>by {formatDay(s.deadline)}</>)}. Then place the order.
      </p>
    );
  }
  if (stage === "calendar") {
    const c = ch.calendar;
    const clash = clashFor(c);
    const who = clash ? (clash.who.name === "You" ? "your" : `${clash.who.name.split(" ")[0]}'s`) : "someone's";
    return (
      <p>
        “{c.meetingTitle}” now clashes with {who} calendar. Move it to a new time {b("cal:week", "this week (Mon–Fri)")} when{" "}
        {b("cal:free", <>all {c.attendees.length} attendees are free</>)} and {b("cal:hours", "within everyone's working hours")}. It lasts{" "}
        {b(null, <>{c.durationMin} minutes</>)} and {b("cal:slot", "starts on the hour or half hour")}. Then save.
      </p>
    );
  }
  const sh = ch.sheet;
  return (
    <p>
      Rows are duplicates when their {b("sheet:dups", colList(sh.dupColumns))} {sh.dupColumns.length > 1 ? "all match" : "matches"} (ignore letter
      case). From each duplicate group keep only the {b("sheet:keep", sh.keepRule.label)} row. Then sort the remaining rows by{" "}
      {b("sheet:sort", sortLabel(sh.sort))} and submit the sheet.
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
  /** Leave for the landing page (asks first while the run is going). */
  onHome?: () => void;
  ghost?: RunSummary | null;
  overlay?: ReactNode;
  /** Replaces the brand in the HUD (the replay puts its back link there). */
  left?: ReactNode;
};

export function GameScreen({ ch, run, now, onAct, onSubmit, onGiveUp, onHome, ghost, overlay, left }: Props) {
  const stageIndex = Math.min(run.stageIndex, STAGES.length - 1);
  const stage = STAGES[stageIndex];
  const elapsed = elapsedAt(run, now);
  const done = run.finishedAt !== null;
  const noop = () => {};
  const act = onAct ?? noop;
  const submit = onSubmit ?? noop;
  const fb = run.feedback && run.feedback.s === stage.id ? run.feedback : null;
  const recentClear =
    run.feedback?.ok && run.stageIndex > 0 && run.feedback.s === STAGES[run.stageIndex - 1].id && now - run.feedback.at < 4000 ? run.feedback : null;
  const recentPenalty = fb && !fb.ok && now - fb.at < 1600;
  const rejection = run.rejection?.s === stage.id ? run.rejection : null;
  const note = rejection && !rejection.edited ? rejection : null;

  return (
    <div className="game">
      {/* The HUD and the task stay pinned together so the instructions are always in view. */}
      <div className="game-head">
        <header className="hud">
          <div className="hud-left">
            {left ??
              (onHome && !done && run.gaveUpAt === null ? (
                <Confirm
                  trace="hud:home"
                  triggerClass="home-btn"
                  ariaLabel="Back to the start page"
                  label={
                    <>
                      <span className="home-arrow" aria-hidden>
                        ←
                      </span>
                      <Brand />
                    </>
                  }
                  title="Leave this run?"
                  body="Your progress on this challenge won't be saved."
                  cancel="Stay"
                  confirm="Leave"
                  onConfirm={onHome}
                  align="left"
                />
              ) : (
                <Brand />
              ))}
          </div>
          <div className="hud-right">
            {ghost && <Ghost ghost={ghost} elapsed={elapsed} youCleared={run.splits.length} />}
            <div className={`timer ${recentPenalty ? "penalty" : ""}`} aria-live="off">
              <span className="timer-value" data-testid="timer">
                {formatDuration(elapsed)}
              </span>
              {run.penalties > 0 && <span className="timer-pen">+{(run.penalties * PENALTY_MS) / 1000}s</span>}
            </div>
            {onGiveUp && !done && run.gaveUpAt === null && (
              <Confirm
                trace="hud:giveup"
                label="Give up"
                title="Give up this run?"
                body={ghost ? "You'll see how far you got next to the agent." : "You'll see how far you got."}
                cancel="Keep going"
                confirm="Give up"
                onConfirm={onGiveUp}
              />
            )}
          </div>
        </header>

        {!done && (
          <section className="task" aria-live="polite">
            <div className="task-head">
              <ol className="stage-track" aria-label={`Stage ${stageIndex + 1} of 3`}>
                {STAGES.map((s, i) => {
                  const state = i < run.splits.length ? "done" : i === stageIndex ? "current" : "todo";
                  return (
                    <li key={s.id} className={state} aria-current={state === "current" ? "step" : undefined}>
                      {state === "done" && <span aria-hidden>✓ </span>}
                      {s.title}
                    </li>
                  );
                })}
              </ol>
              {recentClear && (
                <span className="task-cleared">
                  ✓ {recentClear.msg}
                  {ghost && <SplitGap run={run} ghost={ghost} stage={recentClear.s} />}
                </span>
              )}
            </div>
            <TaskText ch={ch} stage={stage.id} failed={rejection?.reqs} />
          </section>
        )}
      </div>

      <main className="arena">
        {!done && (
          <div className={`appwin app-${stage.id}`} key={stage.id}>
            {stage.id === "shopping" && (
              <Shopping ch={ch.shopping} state={run.states.shopping} dispatch={(a: ShopAction) => act("shopping", a)} onSubmit={submit} rejection={note} />
            )}
            {stage.id === "calendar" && (
              <Calendar ch={ch.calendar} state={run.states.calendar} dispatch={(a: CalAction) => act("calendar", a)} onSubmit={submit} rejection={note} />
            )}
            {stage.id === "sheet" && <Sheet ch={ch.sheet} state={run.states.sheet} dispatch={(a: SheetAction) => act("sheet", a)} onSubmit={submit} rejection={note} />}
          </div>
        )}
        {overlay}
      </main>
    </div>
  );
}

type ConfirmProps = {
  trace: string;
  label: ReactNode;
  ariaLabel?: string;
  triggerClass?: string;
  title: string;
  body: string;
  cancel: string;
  confirm: string;
  onConfirm: () => void;
  align?: "left" | "right";
};

/**
 * A HUD button that asks before doing something that ends the run, in a small popover. The safe
 * choice is focused; Escape or a click elsewhere closes it. The clock keeps running meanwhile.
 */
function Confirm({ trace, label, ariaLabel, triggerClass = "btn-text", title, body, cancel, confirm, onConfirm, align = "right" }: ConfirmProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const stay = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    stay.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="confirm" ref={root}>
      <button className={triggerClass} data-trace={trace} aria-label={ariaLabel} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className={`confirm-pop ${align}`} role="dialog" aria-label={title}>
          <b>{title}</b>
          <p>{body}</p>
          <div className="confirm-actions">
            <button className="btn-ghost" ref={stay} data-trace={`${trace}-cancel`} onClick={() => setOpen(false)}>
              {cancel}
            </button>
            <button className="btn-primary" data-trace={`${trace}-confirm`} onClick={onConfirm}>
              {confirm}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

/** Where you stand against the recorded agent run at this point in time. */
function Ghost({ ghost, elapsed, youCleared }: { ghost: RunSummary; elapsed: number; youCleared: number }) {
  const agentCleared = ghost.splits.filter((s) => s <= elapsed).length;
  const stages = (n: number) => `${n} stage${n > 1 ? "s" : ""}`;
  let text: string;
  let lead: "agent" | "you" | "even";
  if (ghost.totalMs <= elapsed) {
    text = ghost.finished ? `Agent finished · ${formatDuration(ghost.totalMs)}` : `Agent stopped after ${ghost.stagesCleared}/3`;
    lead = ghost.finished ? "agent" : "you";
  } else if (agentCleared > youCleared) {
    text = `Agent ${stages(agentCleared - youCleared)} ahead`;
    lead = "agent";
  } else if (agentCleared < youCleared) {
    text = `You're ${stages(youCleared - agentCleared)} ahead`;
    lead = "you";
  } else {
    text = `Agent also on ${STAGES[Math.min(agentCleared, 2)].title}`;
    lead = "even";
  }
  return (
    <div className={`ghost lead-${lead}`} title="Where the recorded agent run was at this point in time">
      {text}
    </div>
  );
}

/** Your gap to the agent when you cleared a stage, like a split time in a race. */
function SplitGap({ run, ghost, stage }: { run: DerivedRun; ghost: RunSummary; stage: StageId }) {
  const i = STAGES.findIndex((s) => s.id === stage);
  const yours = run.splits[i];
  const theirs = ghost.splits[i];
  if (yours === undefined || theirs === undefined) return null;
  const d = yours - theirs;
  if (Math.abs(d) < 100) return <span className="split-gap even"> · level with the agent</span>;
  return d > 0 ? (
    <span className="split-gap behind" data-testid="split-gap">
      {" "}
      · {gap(d)} behind the agent
    </span>
  ) : (
    <span className="split-gap ahead" data-testid="split-gap">
      {" "}
      · {gap(-d)} ahead of the agent
    </span>
  );
}
