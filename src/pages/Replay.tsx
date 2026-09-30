import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { generateChallenge } from "../challenge/generate";
import { STAGES, type StageId } from "../challenge/types";
import { GameScreen } from "../components/GameScreen";
import { Brand, Intro } from "../components/Intro";
import { useAgentRun, type AgentRun } from "../game/agentRuns";
import { deriveRun, elapsedAt, type RunEvent } from "../game/run";
import type { AnyAction } from "../game/state";
import { formatDuration, formatUsd } from "../lib/format";
import { href } from "../lib/router";

/** Somewhere the agent's cursor goes: a recorded click, or an input it set without one. */
type Move = { at: number; tgt: string; fx: number; fy: number };
/** A line in the agent's step stack: something it set out to do, or a submission verdict. */
type Step = { at: number; text: string; kind: "act" | "ok" | "bad" };

const SPEEDS = [1, 2, 4];
const GLIDE_MS = 500; // cursor travel time before each click
const MIN_GLIDE_MS = 250; // even for actions a few ms apart
const SCROLL_LEAD_MS = 900; // bring the next target into view this long before the click
const STEP_FINISH_MS = 350; // a finished step shows its check this long before it moves down
const STEP_HOLD_MS = 700; // minimum time a new step stays on top before the next change

export function Replay({ seed }: { seed: string }) {
  const run = useAgentRun(seed);
  useEffect(() => {
    document.title = "Agent replay — Beat the Agent";
  }, []);
  if (!run)
    return (
      <div className="page">
        <header className="topbar">
          <Brand />
          <a className="btn-text" href="#/">
            ← Back
          </a>
        </header>
        <p className="muted page-note">{run === undefined ? "Loading replay…" : "There's no recorded agent run for this challenge."}</p>
      </div>
    );
  return <ReplayPlayer run={run} />;
}

function ReplayPlayer({ run }: { run: AgentRun }) {
  const ch = useMemo(() => generateChallenge(run.seed), [run.seed]);
  const events = run.events;
  const startAt = events.find((e) => e.k === "start")?.at ?? events[0]?.at ?? 0;
  const t0 = startAt - 1500;
  const final = useMemo(() => deriveRun(ch, events), [ch, events]);
  const tEnd = (final.finishedAt ?? final.gaveUpAt ?? events[events.length - 1]?.at ?? startAt) + 500;

  // Plays on arrival, in real time: the agent's speed is the point.
  const [cur, setCur] = useState(t0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const curRef = useRef(cur);
  curRef.current = cur;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(tEnd, curRef.current + (now - last) * speed);
      last = now;
      setCur(next);
      if (next >= tEnd) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, tEnd]);

  const derived = useMemo(() => deriveRun(ch, events, cur), [ch, events, cur]);
  const moves = useMemo(() => buildMoves(events), [events]);
  const steps = useMemo(() => buildSteps(run, startAt), [run, startAt]);
  const stepIdx = steps.findLastIndex((s) => s.at <= cur);
  const ended = derived.finishedAt !== null || derived.gaveUpAt !== null;
  const atEnd = cur >= tEnd;
  const restart = () => {
    window.scrollTo(0, 0);
    setCur(t0);
    setPlaying(true);
  };

  const markers = events
    .filter((e): e is Extract<RunEvent, { k: "submit" }> => e.k === "submit")
    .map((e) => ({ at: e.at, label: e.ok ? `${STAGES.find((s) => s.id === e.s)!.title} done` : "Rejected", cls: e.ok ? "ok" : "bad" }));
  const pctOf = (at: number) => Math.max(0, ((at - t0) / (tEnd - t0)) * 100);
  const title = (
    <span className="replay-title">
      <a className="btn-text" href="#/" aria-label="Back">
        ←
      </a>
      <h1>{run.modelLabel} replay</h1>
    </span>
  );

  return (
    <div className="replay">
      <div className="replay-stage">
        {derived.startedAt === null ? (
          <div className="game">
            <Intro ch={ch} left={title} />
          </div>
        ) : (
          <GameScreen ch={ch} run={derived} now={cur} left={title} />
        )}
      </div>

      {!ended && (
        <>
          {/* Frames the screen while the agent is the one driving. */}
          <div className={`agent-vignette ${playing ? "" : "paused"}`} aria-hidden />
          <AgentCursor moves={moves} cur={cur} speed={speed} steps={steps} stepIdx={stepIdx} playing={playing} />
        </>
      )}

      {ended && (
        <div className="finish" role="dialog" aria-label="Replay finished">
          <div className="finish-card">
            <div className="finish-kicker">{derived.finishedAt ? `${run.modelLabel} finished in` : `${run.modelLabel} stopped after`}</div>
            <div className="finish-time">{derived.finishedAt ? formatDuration(elapsedAt(derived, cur)) : `${run.stagesCleared}/3`}</div>
            <div className="finish-sub">
              {[
                `${run.counts.clicks} clicks`,
                run.penalties ? `${run.penalties} wrong answer${run.penalties > 1 ? "s" : ""}` : "no wrong answers",
                run.cost.total !== null ? `${formatUsd(run.cost.total)} API cost` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <div className="finish-actions">
              <button className="btn-primary" onClick={restart}>
                Watch again
              </button>
              <a className="btn-ghost" href={href("/")}>
                Back
              </a>
            </div>
            <Disclosure label="What the agent was told">
              <pre>{run.prompt.instructions}</pre>
              <pre>{run.prompt.task}</pre>
              <p className="muted small">
                Everything else came from the page itself. The agent ran in an OpenAI-hosted browser; this replay is rebuilt from the page's log of its
                clicks and inputs.
              </p>
            </Disclosure>
          </div>
        </div>
      )}

      <div className="replay-bar">
        <button className="play-btn" onClick={() => (atEnd ? restart() : setPlaying(!playing))} aria-label={playing ? "Pause" : "Play"} data-testid="replay-play">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
            {playing ? <path d="M4 2h3v12H4zM9 2h3v12H9z" /> : <path d="M4 2l10 6-10 6z" />}
          </svg>
        </button>
        <div
          className="scrub-track"
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const seek = (x: number) => setCur(t0 + Math.min(1, Math.max(0, (x - r.left) / r.width)) * (tEnd - t0));
            seek(e.clientX);
            const move = (ev: PointerEvent) => seek(ev.clientX);
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <div className="scrub-fill" style={{ width: `${pctOf(cur)}%` }} />
          {markers.map((m, i) => (
            <span key={i} className={`scrub-mark ${m.cls}`} style={{ left: `${pctOf(m.at)}%` }} title={m.label} />
          ))}
        </div>
        <span className="scrub-time">{formatDuration(cur - startAt, 0)}</span>
        <div className="speeds">
          {SPEEDS.map((s) => (
            <button key={s} className={s === speed ? "on" : ""} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A collapsible section that eases open and closed (a native <details> snaps). */
function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`prompt ${open ? "open" : ""}`}>
      <button className="prompt-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden>
          <path d="M5 2l7 6-7 6z" />
        </svg>
        {label}
      </button>
      <div className="prompt-body" id={id} inert={!open}>
        <div>{children}</div>
      </div>
    </div>
  );
}

/**
 * The agent's pointer, drawn over the live game UI at the viewer's own screen size. Clicks were
 * recorded against `data-trace` elements, so they're re-located in whatever layout the viewer
 * gets (desktop or mobile), and the page scrolls to each target just before the agent reaches it.
 */
type CursorProps = { moves: Move[]; cur: number; speed: number; steps: Step[]; stepIdx: number; playing: boolean };

function AgentCursor({ moves, cur, speed, steps, stepIdx, playing }: CursorProps) {
  const cursor = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLOListElement>(null);
  const props = useRef({ moves, cur, speed });
  props.current = { moves, cur, speed };

  useLayoutEffect(() => {
    let raf = 0;
    let scrolledFor = -1;

    const find = (tgt: string) => {
      const el = document.querySelector<HTMLElement>(`.replay-stage [data-trace="${CSS.escape(tgt)}"]`);
      return el && el.getClientRects().length ? el : null;
    };
    const locate = (m: Move) => {
      const r = find(m.tgt)?.getBoundingClientRect();
      return r ? { x: r.left + m.fx * r.width, y: r.top + m.fy * r.height } : null;
    };
    const inView = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const top = document.querySelector(".replay-stage .game-head, .replay-stage .topbar")?.getBoundingClientRect().bottom ?? 0;
      const bottom = (document.querySelector(".replay-bar")?.getBoundingClientRect().top ?? window.innerHeight) - 8;
      const box = el.parentElement?.closest("[data-scroll]")?.getBoundingClientRect();
      const left = Math.max(0, box?.left ?? 0);
      const right = Math.min(window.innerWidth, box?.right ?? Infinity);
      return r.top >= top && r.bottom <= bottom && r.left >= left && r.right <= right;
    };

    // The pointer behaves like a real mouse: it stays where it was drawn (even as the page scrolls
    // or its last target disappears) and only moves by gliding to the next target.
    let pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let glide: { idx: number; from: { x: number; y: number }; to: { x: number; y: number } | null; start: number; end: number } | null = null;
    let landed = -1;
    let click: { x: number; y: number; at: number } | null = null;
    const side = { left: false, up: false };
    let offset: { x: number; y: number } | null = null;
    let lastFrame = performance.now();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { moves, cur, speed } = props.current;
      const c = cursor.current;
      const rp = ripple.current;
      const b = bubble.current;
      if (!c || !rp) return;

      const i = moves.findLastIndex((m) => m.at <= cur);
      const prev = moves[i] ?? null;
      const next = moves[i + 1] ?? null;

      if (next && next.at - cur < SCROLL_LEAD_MS && scrolledFor !== i + 1) {
        const el = find(next.tgt);
        if (el) {
          scrolledFor = i + 1;
          if (!inView(el)) el.scrollIntoView({ block: "center", inline: "center", behavior: speed > 1 ? "instant" : "smooth" });
        }
      }

      // Seeking cancels the glide in progress. If playback merely overtook it (fast speeds), carry on
      // from where the pointer is rather than snapping.
      if (glide && (cur < glide.start || glide.idx < i)) {
        if (cur >= glide.start && i === glide.idx + 1) landed = i;
        glide = null;
      }

      // Start gliding toward the next target shortly before its click. Glides never take less than
      // MIN_GLIDE_MS, even when two actions were only milliseconds apart, so the pointer never jumps.
      const lead = next ? Math.min(GLIDE_MS, next.at - (prev?.at ?? -Infinity)) : 0;
      if (!glide && prev && landed === i - 1) {
        // Playback stepped over this target's whole glide window in one frame (fast speeds, or
        // actions a few ms apart): catch up with a glide instead of snapping.
        glide = { idx: i, from: pos, to: null, start: cur, end: cur + MIN_GLIDE_MS };
      } else if (!glide && next && next.at - cur < lead && landed !== i + 1) {
        glide = { idx: i + 1, from: pos, to: null, start: cur, end: Math.max(next.at, cur + MIN_GLIDE_MS) };
      }

      if (glide) {
        const m = moves[glide.idx];
        glide.to = locate(m) ?? glide.to ?? glide.from;
        const k = Math.min(1, (cur - glide.start) / (glide.end - glide.start));
        const ease = k * k * (3 - 2 * k);
        pos = { x: glide.from.x + (glide.to.x - glide.from.x) * ease, y: glide.from.y + (glide.to.y - glide.from.y) * ease };
        if (k >= 1) {
          landed = glide.idx;
          click = { ...pos, at: cur };
          glide = null;
        }
      } else if (prev && landed !== i) {
        // Arrived here by seeking: jump to the click if its target is still on screen.
        landed = i;
        pos = locate(prev) ?? pos;
      }
      c.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

      const since = click ? cur - click.at : Infinity;
      if (click && since >= 0 && since < 500) {
        rp.style.opacity = String(1 - since / 500);
        rp.style.transform = `translate(${click.x}px, ${click.y}px) scale(${0.4 + since / 400})`;
      } else rp.style.opacity = "0";

      if (b) {
        // Beside the pointer, switching sides to stay on screen and clear of the replay controls.
        // Sides only flip back once there's room to spare, and the offset eases between sides.
        const floor = (document.querySelector(".replay-bar")?.getBoundingClientRect().top ?? window.innerHeight) - 8;
        // The fading-out step still takes up room; measure only the ones you can see.
        const shown = b.querySelectorAll<HTMLElement>(".agent-step:not(.pos-2)");
        const last = shown[shown.length - 1];
        const w = b.offsetWidth;
        const h = last ? last.offsetTop + last.offsetHeight : 0;
        const right = pos.x + 16 + w;
        if (!side.left && right > window.innerWidth - 8) side.left = true;
        else if (side.left && right < window.innerWidth - 48) side.left = false;
        const bottom = pos.y + 24 + h;
        if (!side.up && bottom > floor) side.up = true;
        else if (side.up && bottom < floor - 40) side.up = false;
        const goal = { x: side.left ? -w - 6 : 16, y: side.up ? -h - 10 : 24 };
        const now = performance.now();
        const k = offset ? 1 - Math.exp(-(now - lastFrame) / 110) : 1;
        offset = offset ?? goal;
        offset = { x: offset.x + (goal.x - offset.x) * k, y: offset.y + (goal.y - offset.y) * k };
        lastFrame = now;
        const x = Math.min(Math.max(8, pos.x + offset.x), window.innerWidth - w - 8);
        b.style.transform = `translate(${x}px, ${pos.y + offset.y}px)`;
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="agent-layer" aria-hidden>
      <div className="agent-ripple" ref={ripple} />
      <div className="agent-cursor" ref={cursor}>
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M3 2l7 19 2.5-7.5L20 11z" fill="#1d1e21" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <StepStack steps={steps} target={stepIdx} playing={playing} ref={bubble} />
    </div>
  );
}

/**
 * What the agent is doing, next to its cursor. The newest step sits on top with a spinner. When the
 * next one starts, the old one first flips to a check, then slides down (dimmed) and fades out on the
 * following change. Steps advance one at a time, paced so each can be read, even when several land
 * together (a stage's verdict and the agent's next action often arrive milliseconds apart).
 */
function StepStack({ steps, target, playing, ref }: { steps: Step[]; target: number; playing: boolean; ref: React.Ref<HTMLOListElement> }) {
  const [shownIdx, setShownIdx] = useState(target);
  const [finishing, setFinishing] = useState(false);
  const [ready, setReady] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const cancel = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    busy.current = false;
  };
  useEffect(() => cancel, []);

  useEffect(() => {
    if (target === shownIdx) return;
    // Seeking backwards, the first step, or too far behind to walk through: catch up at once.
    if (target < shownIdx || shownIdx < 0 || target - shownIdx > 3) {
      cancel();
      setFinishing(false);
      setShownIdx(target);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const nextIdx = shownIdx + 1;
    const finish = steps[shownIdx].kind === "act" ? STEP_FINISH_MS : 0;
    if (finish) setFinishing(true);
    timers.current.push(
      window.setTimeout(() => {
        setFinishing(false);
        setShownIdx(nextIdx);
        // Shorter holds while there's a backlog, so the stack doesn't drift far behind.
        const hold = targetRef.current - nextIdx > 1 ? STEP_HOLD_MS / 2 : STEP_HOLD_MS;
        timers.current.push(
          window.setTimeout(() => {
            busy.current = false;
            setReady((n) => n + 1);
          }, hold),
        );
      }, finish),
    );
  }, [steps, target, shownIdx, ready]);

  // Newest first: the current step, the one before it, and a third on its way out.
  const shown = useMemo(() => (shownIdx < 0 ? [] : steps.slice(Math.max(0, shownIdx - 2), shownIdx + 1).reverse()), [steps, shownIdx]);

  // FLIP: steps that moved start where they were and glide down to their new slot.
  const items = useRef(new Map<number, HTMLLIElement>());
  const lastTops = useRef(new Map<number, number>());
  useLayoutEffect(() => {
    const tops = new Map<number, number>();
    for (const [at, el] of items.current) tops.set(at, el.offsetTop);
    for (const [at, el] of items.current) {
      const before = lastTops.current.get(at);
      const after = tops.get(at)!;
      if (before === undefined || before === after) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${before - after}px)`;
      el.getBoundingClientRect();
      el.style.transition = "";
      el.style.transform = "";
    }
    lastTops.current = tops;
  }, [shown]);

  return (
    <ol className={`agent-steps ${playing ? "" : "paused"}`} ref={ref}>
      {shown.map((s, i) => {
        const state = s.kind !== "act" ? s.kind : i === 0 && !finishing ? "doing" : "done";
        return (
          <li
            key={s.at}
            className={`agent-step pos-${i}`}
            ref={(el) => {
              if (el) items.current.set(s.at, el);
              else items.current.delete(s.at);
            }}
          >
            <span className={`step-icon ${state}`} key={state}>
              {state === "done" || state === "ok" ? "✓" : state === "bad" ? "✗" : null}
            </span>
            {s.text}
          </li>
        );
      })}
    </ol>
  );
}

/** Controls the agent set without a pointer event (the hosted browser sets `<select>` values directly). */
function actTarget(s: StageId, a: AnyAction): string | null {
  if (s === "shopping") {
    if (a.type === "query") return "shop:search";
    if (a.type === "maxPrice") return "shop:maxprice";
    if (a.type === "minRating") return `shop:rating:${a.value}`;
    if (a.type === "arriveBy") return "shop:arriveby";
    if (a.type === "sort") return "shop:sort";
  }
  if (s === "calendar") {
    if (a.type === "pickDay") return "cal:form-day";
    if (a.type === "pickStart") return "cal:form-start";
  }
  return null;
}

function buildMoves(events: RunEvent[]): Move[] {
  const moves: Move[] = [];
  let lastPtr = -Infinity;
  for (const e of events) {
    if (e.k === "ptr") {
      lastPtr = e.at;
      if (e.tgt) moves.push({ at: e.at, tgt: e.tgt, fx: e.fx, fy: e.fy });
    } else if (e.k === "act" && e.at - lastPtr > 400) {
      const tgt = actTarget(e.s, e.a);
      const prev = moves[moves.length - 1];
      // Typing is one act per keystroke: keep the first.
      if (tgt && !(prev?.tgt === tgt && e.at - prev.at < 1500)) moves.push({ at: e.at, tgt, fx: 0.5, fy: 0.5 });
    }
  }
  return moves;
}

function buildSteps(run: AgentRun, startAt: number): Step[] {
  const steps: Step[] = [];
  // Environment boot ("Connecting to the challenge" ×N) happens off the clock; keep only the lead-up to Start.
  for (const a of run.activity) if (a.t > -2500 && a.title) steps.push({ at: startAt + a.t, text: a.title, kind: "act" });
  for (const e of run.events) if (e.k === "submit") steps.push({ at: e.at, text: e.msg, kind: e.ok ? "ok" : "bad" });
  return steps.sort((a, b) => a.at - b.at).filter((s, i, all) => s.text !== all[i - 1]?.text);
}
