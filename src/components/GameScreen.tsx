import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { STAGES, type Challenge, type StageId } from "../challenge/types";
import { colList, sortLabel, type Req } from "../challenge/validate";
import { formatDay, formatDuration, formatMoney, gap } from "../lib/format";
import { elapsedAt, PENALTY_MS, stageElapsedAt, stageTime, type DerivedRun } from "../game/run";
import type { AnyAction, CalAction, SheetAction, ShopAction } from "../game/state";
import type { RunSummary } from "../game/agentRuns";
import { Brand } from "./Brand";
import { IconBack, IconCheck, IconFlag, IconLock } from "./Icons";
import { Shopping } from "../stages/Shopping";
import { Calendar, clashFor } from "../stages/Calendar";
import { Sheet } from "../stages/Sheet";

/**
 * The task, worded exactly as the recorded agent runs saw it. Its conditions are highlighted inline
 * (see `.task p b`) so they can be re-checked at a glance without a second copy of the rules. The ones
 * the last rejected submission broke are marked until the next submission. `brief` lists just the
 * conditions, for the collapsed header on small screens.
 */
export function TaskText({ ch, stage, failed = [], brief }: { ch: Challenge; stage: StageId; failed?: Req[]; brief?: boolean }) {
  const b = (req: Req | null, children: ReactNode) => <b className={req && failed.includes(req) ? "failed" : undefined}>{children}</b>;
  if (stage === "shopping") {
    const s = ch.shopping;
    const one = b("shop:one", "one");
    const budget = b("shop:budget", <>{formatMoney(s.budgetCents)} or less</>);
    const rating = b("shop:rating", <>{s.minRating.toFixed(1)}★ or higher</>);
    const deadline = b("shop:deadline", <>by {formatDay(s.deadline)}</>);
    if (brief)
      return (
        <p className="task-brief">
          <span>Buy {one}</span>
          {budget}
          {rating}
          {deadline}
        </p>
      );
    return (
      <p>
        Buy {one} pair of headphones that costs {budget}, is rated {rating}, and arrives {deadline}. Then place the order.
      </p>
    );
  }
  if (stage === "calendar") {
    const c = ch.calendar;
    const clash = clashFor(c);
    const who = clash ? (clash.who.name === "You" ? "your" : `${clash.who.name.split(" ")[0]}'s`) : "someone's";
    const week = b("cal:week", "this week (Mon–Fri)");
    const free = b("cal:free", <>all {c.attendees.length} attendees are free</>);
    const hours = b("cal:hours", "within everyone's working hours");
    const length = b(null, <>{c.durationMin} minutes</>);
    const slot = b("cal:slot", "starts on the hour or half hour");
    if (brief)
      return (
        <p className="task-brief">
          {week}
          {free}
          {hours}
          {length}
          {slot}
        </p>
      );
    return (
      <p>
        “{c.meetingTitle}” now clashes with {who} calendar. Move it to a new time {week} when {free} and {hours}. It lasts {length} and {slot}. Then save.
      </p>
    );
  }
  const sh = ch.sheet;
  const dups = b("sheet:dups", colList(sh.dupColumns));
  const keep = b("sheet:keep", sh.keepRule.label);
  const sort = b("sheet:sort", sortLabel(sh.sort));
  if (brief)
    return (
      <p className="task-brief">
        <span>Duplicates by {dups}</span>
        <span>keep {keep}</span>
        <span>sort by {sort}</span>
      </p>
    );
  return (
    <p>
      Rows are duplicates when their {dups} {sh.dupColumns.length > 1 ? "all match" : "matches"} (ignore letter case). From each duplicate group keep only
      the {keep} row. Then sort the remaining rows by {sort} and submit the sheet.
    </p>
  );
}

/** Where each simulated app "lives", for the browser bar framing it on wide screens. */
const APP_URLS: Record<StageId, string> = {
  shopping: "soundmarket.shop/headphones",
  calendar: "cadence.app/week",
  sheet: "gridly.app/customers.csv",
};

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
  /** Whose clock this is, when it isn't the player's (the replay). */
  clockLabel?: string;
};

export function GameScreen({ ch, run, now, onAct, onSubmit, onGiveUp, onHome, ghost, overlay, left, clockLabel }: Props) {
  const stageIndex = Math.min(run.stageIndex, STAGES.length - 1);
  const stage = STAGES[stageIndex];
  const elapsed = elapsedAt(run, now);
  const done = run.finishedAt !== null;
  const over = done || run.gaveUpAt !== null;
  // With briefings, each stage is a race of its own: the clock shows this race, and the total beside it.
  // Behind the first briefing the run hasn't started yet, but it's the first race all the same.
  const race = (run.briefed || run.startedAt === null) && !over ? stageElapsedAt(run, now) : null;
  const racePenalties = run.attempts[stageIndex] ?? 0;
  const noop = () => {};
  const act = onAct ?? noop;
  const submit = onSubmit ?? noop;
  const fb = run.feedback && run.feedback.s === stage.id ? run.feedback : null;
  // Runs with briefings say this on the next stage's briefing instead.
  const recentClear =
    !run.briefed &&
    run.feedback?.ok && run.stageIndex > 0 && run.feedback.s === STAGES[run.stageIndex - 1].id && now - run.feedback.at < 4000 ? run.feedback : null;
  const recentPenalty = fb && !fb.ok && now - fb.at < 1600;
  const rejection = run.rejection?.s === stage.id ? run.rejection : null;
  const note = rejection && !rejection.edited ? rejection : null;

  // On small screens the header shrinks to the conditions alone once you scroll into the app (CSS
  // applies it only there). It collapses only after scrolling past its own height and expands again
  // only back at the top, so the change in its height can't flip it back and forth.
  const head = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 4) {
        setCompact(false);
        setPeek(false);
      } else if (head.current && !head.current.classList.contains("compact") && y > head.current.offsetHeight) setCompact(true);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setPeek(false), [stage.id]);
  // Each stage starts at the top of its app.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage.id]);

  // The pinned header's height, for things that stick just below it (the calendar's day tabs).
  useLayoutEffect(() => {
    const el = head.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--head-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pens = race !== null ? racePenalties : run.penalties;
  const racing = !!ghost && race !== null;
  const theirs = racing ? stageTime(ghost!.splits, stageIndex) : null;

  return (
    <div className="game">
      {/* The HUD and the task stay pinned together so the instructions are always in view. */}
      <div className={`game-head ${compact ? "compact" : ""} ${peek ? "peek" : ""}`} ref={head}>
        <header className="hud">
          <div className="hud-home">
            {left ??
              (onHome && !over ? (
                <Confirm
                  trace="hud:home"
                  triggerClass="home-btn"
                  ariaLabel="Back to the start page"
                  label={
                    <>
                      <span className="home-arrow" aria-hidden>
                        <IconBack size={20} />
                      </span>
                      <Brand />
                    </>
                  }
                  title="Leave this run?"
                  body="Your progress on this challenge won't be saved."
                  cancel="Stay"
                  confirm="Leave"
                  onConfirm={onHome}
                />
              ) : (
                <Brand />
              ))}
          </div>

          {!done && (
            <ol className="stage-track" aria-label={`Stage ${stageIndex + 1} of 3`}>
              {STAGES.map((s, i) => {
                const state = i < run.splits.length ? "done" : i === stageIndex ? "current" : "todo";
                return (
                  <li key={s.id} className={state} aria-current={state === "current" ? "step" : undefined}>
                    <span className="st-pip" aria-hidden>
                      {state === "done" ? <IconCheck size={12} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="st-label">{s.title}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <div className={`score ${racing ? "vs" : ""}`} aria-live="off">
            <div className={`score-cell you ${recentPenalty ? "penalty" : ""}`}>
              <span className="score-label">
                {racing ? "You" : clockLabel ?? (race !== null ? `Race ${stageIndex + 1}` : "Time")}
                {pens > 0 && <span className="timer-pen">+{(pens * PENALTY_MS) / 1000}s</span>}
              </span>
              <span className="timer-value" data-testid="timer">
                {formatDuration(race ?? elapsed)}
              </span>
            </div>
            {racing ? (
              <Ghost ghost={ghost!} stage={stageIndex} race={race!} />
            ) : (
              race !== null &&
              run.splits.length > 0 && (
                <div className="score-cell total">
                  <span className="score-label">Total</span>
                  <span className="timer-value" data-testid="total">
                    {formatDuration(elapsed)}
                  </span>
                </div>
              )
            )}
          </div>

          <div className="hud-end">
            {onGiveUp && !over && (
              <Confirm
                trace="hud:giveup"
                triggerClass="giveup-btn"
                ariaLabel="Give up"
                label={
                  <>
                    <IconFlag size={18} />
                    <span className="giveup-text">Give up</span>
                  </>
                }
                title="Give up this run?"
                body={ghost ? "You'll see how far you got next to the agent." : "You'll see how far you got."}
                cancel="Keep going"
                confirm="Give up"
                tone="danger"
                onConfirm={onGiveUp}
              />
            )}
          </div>
        </header>

        {!done && (
          <section className="task" aria-live="polite">
            <TaskText ch={ch} stage={stage.id} failed={rejection?.reqs} />
            <div className="task-compact">
              <TaskText ch={ch} stage={stage.id} failed={rejection?.reqs} brief />
              <button className="task-toggle" aria-expanded={peek} onClick={() => setPeek(!peek)}>
                {peek ? "Less" : "Full task"}
              </button>
            </div>
            {recentClear && (
              <span className="task-cleared" role="status">
                <IconCheck size={14} strokeWidth={3} /> {recentClear.msg}
              </span>
            )}
          </section>
        )}

        {/* The agent's lap on this race, filling toward the moment it finished: the time you have to beat. */}
        {racing && theirs !== null && (
          <div className={`lap ${race! >= theirs ? "lap-over" : ""}`} style={{ "--p": Math.min(1, race! / theirs) } as CSSProperties} aria-hidden />
        )}
      </div>

      <main className="arena">
        {!done && (
          <div className={`appwin app-${stage.id}`} key={stage.id}>
            <div className="appwin-bar" aria-hidden>
              <i />
              <i />
              <i />
              <span className="appwin-url">
                <IconLock size={11} />
                {APP_URLS[stage.id]}
              </span>
            </div>
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
  triggerClass: string;
  title: string;
  body: string;
  cancel: string;
  confirm: string;
  tone?: "danger";
  onConfirm: () => void;
};

/**
 * A HUD button that asks before doing something that ends the run: an action sheet from the bottom on
 * phones (in reach of the thumb), a small dialog on wide screens. The safe choice is focused; Escape
 * or a tap outside closes it. The clock keeps running meanwhile.
 */
function Confirm({ trace, label, ariaLabel, triggerClass, title, body, cancel, confirm, tone, onConfirm }: ConfirmProps) {
  const [open, setOpen] = useState(false);
  const stay = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    stay.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className={triggerClass} data-trace={trace} aria-label={ariaLabel} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        {label}
      </button>
      {/* In <body>: the pinned header's backdrop blur would otherwise trap a fixed sheet inside it. */}
      {open &&
        createPortal(
          <div className="sheet-scrim confirm-scrim" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="sheet confirm-sheet" role="dialog" aria-modal="true" aria-label={title}>
              <span className="sheet-grip" aria-hidden />
              <b className="confirm-title">{title}</b>
              <p className="confirm-body">{body}</p>
              <div className="confirm-actions">
                <button className={`btn btn-lg ${tone === "danger" ? "btn-danger" : "btn-ink"}`} data-trace={`${trace}-confirm`} onClick={onConfirm}>
                  {confirm}
                </button>
                <button className="btn btn-quiet btn-lg" ref={stay} data-trace={`${trace}-cancel`} onClick={() => setOpen(false)}>
                  {cancel}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * The agent in the race you're running: still going, or done and in what time. It's labelled and
 * formatted like your own clock beside it so the two read as a pair ("You 0:46.8 · Agent ✓ 0:07.5").
 */
function Ghost({ ghost, stage, race }: { ghost: RunSummary; stage: number; race: number }) {
  const theirs = stageTime(ghost.splits, stage);
  let text: string;
  let full: string;
  let lead: "agent" | "you" | "even";
  if (theirs === null) {
    text = ghost.stagesCleared === stage ? "stopped" : "out";
    full = ghost.stagesCleared === stage ? "Agent stopped in this race" : "Agent didn't get this far";
    lead = "you";
  } else if (theirs <= race) {
    text = `✓ ${formatDuration(theirs)}`;
    full = `Agent finished in ${gap(theirs)}`;
    lead = "agent";
  } else {
    // Still going: its clock runs alongside yours.
    text = formatDuration(race);
    full = "Agent still racing";
    lead = "even";
  }
  return (
    <div className={`score-cell ghost lead-${lead}`} title="Where the recorded agent run was at this point in this race" aria-label={full}>
      <span className="score-label">
        <i className="dot dot-agent" aria-hidden />
        Agent
      </span>
      <span className="timer-value ghost-value">{text}</span>
    </div>
  );
}
