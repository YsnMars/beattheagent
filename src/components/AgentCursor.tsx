import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { StageId } from "../challenge/types";
import type { RunEvent } from "../game/run";
import type { AnyAction } from "../game/state";

/** Somewhere the agent's cursor goes: a recorded click, or an input it set without one. */
export type Move = { at: number; tgt: string; fx: number; fy: number };
/** A line in the agent's step stack: something it set out to do, or a submission verdict. */
export type Step = { at: number; text: string; kind: "act" | "ok" | "bad" };

const GLIDE_MS = 500; // cursor travel time before each click
const MIN_GLIDE_MS = 250; // even for actions a few ms apart
const SCROLL_LEAD_MS = 900; // bring the next target into view this long before the click
const STEP_FINISH_MS = 350; // a finished step shows its check this long before it moves down
const STEP_HOLD_MS = 700; // minimum time a new step stays on top before the next change

/**
 * Panels the agent can open that the player's page doesn't have open while racing it (it's their
 * page, not the agent's). Clicks inside one have nothing to land on, so the pointer waits on the
 * control that opens the panel (the first one shown) and says where it is.
 */
const PANELS: { inside: RegExp; openers: string[]; where: string }[] = [
  { inside: /^shop:(drawer$|cart-close$|remove:|order$)/, openers: ["shop:cart", "shop:cartbar"], where: "in its cart" },
  { inside: /^sheet:(dialog$|dcol:|dcancel$|dapply$)/, openers: ["sheet:dedupe"], where: "in Remove duplicates" },
];

/**
 * The agent's pointer, drawn over the live game UI at the viewer's own screen size. Clicks were
 * recorded against `data-trace` elements, so they're re-located in whatever layout the viewer
 * gets (desktop or mobile). With `follow` (the replay), the page scrolls to each target just before
 * the agent reaches it; without it (racing the agent), the page is the player's, so the pointer
 * sticks to its target as they scroll and waits at the edge of the screen when it's out of view.
 * Racing, a target in a panel only the agent has open (see PANELS) puts the pointer on the
 * panel's opener; any other missing target leaves it on the last thing it touched.
 */
type CursorProps = {
  moves: Move[];
  /** The agent's clock: a value, or read every frame. */
  cur: number | (() => number);
  speed?: number;
  /** Where the agent's targets are looked up. */
  scope: string;
  follow?: boolean;
  /** Something fixed along the bottom of the screen that the bubble stays above. */
  floor?: string;
  className?: string;
  /** Shown beside the pointer. */
  children?: ReactNode;
};

export function AgentCursor({ moves, cur, speed = 1, scope, follow = false, floor, className = "", children }: CursorProps) {
  const cursor = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const props = useRef({ moves, cur, speed, scope, follow, floor });
  props.current = { moves, cur, speed, scope, follow, floor };

  useLayoutEffect(() => {
    let raf = 0;
    let scrolledFor = -1;

    const shown = (el: HTMLElement | null | undefined) => (el && el.getClientRects().length ? el : null);
    // A narrow layout may hide the control the agent clicked and offer another in its place (the sheet's
    // sort menu for its column sort buttons); that one names what it stands in for with `data-trace-for`.
    const find = (tgt: string) => {
      const { scope } = props.current;
      return (
        shown(document.querySelector<HTMLElement>(`${scope} [data-trace="${CSS.escape(tgt)}"]`)) ??
        shown([...document.querySelectorAll<HTMLElement>(`${scope} [data-trace-for]`)].find((el) => tgt.startsWith(el.dataset.traceFor!) && shown(el)))
      );
    };
    const floorY = () => (props.current.floor && document.querySelector(props.current.floor)?.getBoundingClientRect().top) || window.innerHeight;
    const headY = () =>
      (
        document.querySelector(`${props.current.scope} .game-head, ${props.current.scope} .topbar`) ?? document.querySelector(".game-head")
      )?.getBoundingClientRect().bottom ?? 0;
    const at = (el: HTMLElement, fx: number, fy: number) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + fx * r.width, y: r.top + fy * r.height };
    };
    // Racing: the panel the agent is in that the player doesn't have open, if it's in one.
    const panelOf = (m: Move | null) => (!props.current.follow && m && !find(m.tgt) ? (PANELS.find((p) => p.inside.test(m.tgt)) ?? null) : null);
    const locate = (m: Move) => {
      const el = find(m.tgt);
      if (el) return at(el, m.fx, m.fy);
      const panel = panelOf(m);
      const openers = panel ? panel.openers.map(find).filter((o) => o !== null) : [];
      const opener = openers.find(inView) ?? openers[0];
      return opener ? at(opener, 0.5, 0.5) : null;
    };
    const inView = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const top = headY();
      const bottom = floorY() - 8;
      const box = el.parentElement?.closest("[data-scroll]")?.getBoundingClientRect();
      const left = Math.max(0, box?.left ?? 0);
      const right = Math.min(window.innerWidth, box?.right ?? Infinity);
      return r.top >= top && r.bottom <= bottom && r.left >= left && r.right <= right;
    };

    // The pointer behaves like a real mouse: it stays where it was drawn (even as the page scrolls
    // or its last target disappears) and only moves by gliding to the next target.
    let pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let glide: {
      idx: number;
      from: { x: number; y: number };
      to: { x: number; y: number } | null;
      start: number;
      end: number;
    } | null = null;
    let landed = -1;
    let click: { x: number; y: number; at: number } | null = null;
    const side = { left: false, up: false };
    let offset: { x: number; y: number } | null = null;
    // The last thing the pointer landed on in the player's page, to rest on when a target is missing.
    let rest: { el: HTMLElement; fx: number; fy: number } | null = null;
    const restAt = () => (rest && rest.el.isConnected && shown(rest.el) ? at(rest.el, rest.fx, rest.fy) : null);
    const land = (m: Move) => {
      const el = find(m.tgt);
      if (el) rest = { el, fx: m.fx, fy: m.fy };
    };
    let lastFrame = performance.now();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { moves, speed, follow } = props.current;
      const cur = typeof props.current.cur === "function" ? props.current.cur() : props.current.cur;
      const c = cursor.current;
      const rp = ripple.current;
      const b = bubble.current;
      if (!c || !rp) return;

      const i = moves.findLastIndex((m) => m.at <= cur);
      const prev = moves[i] ?? null;
      const next = moves[i + 1] ?? null;

      if (follow && next && next.at - cur < SCROLL_LEAD_MS && scrolledFor !== i + 1) {
        const el = find(next.tgt);
        if (el) {
          scrolledFor = i + 1;
          if (!inView(el))
            el.scrollIntoView({
              block: "center",
              inline: "center",
              behavior: speed > 1 ? "instant" : "smooth",
            });
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
        glide = {
          idx: i,
          from: pos,
          to: null,
          start: cur,
          end: cur + MIN_GLIDE_MS,
        };
      } else if (!glide && next && next.at - cur < lead && landed !== i + 1) {
        glide = {
          idx: i + 1,
          from: pos,
          to: null,
          start: cur,
          end: Math.max(next.at, cur + MIN_GLIDE_MS),
        };
      }

      if (glide) {
        const m = moves[glide.idx];
        glide.to = locate(m) ?? restAt() ?? glide.to ?? glide.from;
        const k = Math.min(1, (cur - glide.start) / (glide.end - glide.start));
        const ease = k * k * (3 - 2 * k);
        pos = {
          x: glide.from.x + (glide.to.x - glide.from.x) * ease,
          y: glide.from.y + (glide.to.y - glide.from.y) * ease,
        };
        if (k >= 1) {
          landed = glide.idx;
          land(m);
          // A click in a panel the player can't see makes no ripple.
          click = panelOf(m) ? null : { ...pos, at: cur };
          glide = null;
        }
      } else if (prev && landed !== i) {
        // Arrived here by seeking: jump to the click if its target is still on screen.
        landed = i;
        land(prev);
        pos = locate(prev) ?? pos;
      } else if (!follow && prev && landed === i) {
        // The player scrolls their own page: stay on the target, or on what it last touched.
        pos = locate(prev) ?? restAt() ?? pos;
      }
      if (!follow) {
        const panel = panelOf(glide ? moves[glide.idx] : prev);
        c.classList.toggle("away", panel !== null);
        if (b) {
          if (panel) b.style.setProperty("--where", JSON.stringify(` · ${panel.where}`));
          else b.style.removeProperty("--where");
        }
        // Out of view, wait at the nearest edge.
        const x = Math.min(Math.max(pos.x, 8), window.innerWidth - 8);
        const y = Math.min(Math.max(pos.y, headY() + 4), floorY() - 8);
        c.classList.toggle("edge", x !== pos.x || y !== pos.y);
        if (b) b.dataset.edge = y > pos.y ? "up" : y < pos.y ? "down" : "";
        pos = { x, y };
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
        const floor = floorY() - 8;
        // A fading-out step still takes up room; measure only the ones you can see.
        const steps = b.querySelectorAll<HTMLElement>(".agent-step");
        const shown = b.querySelectorAll<HTMLElement>(".agent-step:not(.pos-2)");
        const last = shown[shown.length - 1];
        const w = b.offsetWidth;
        const h = steps.length ? (last ? last.offsetTop + last.offsetHeight : 0) : b.offsetHeight;
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
        offset = {
          x: offset.x + (goal.x - offset.x) * k,
          y: offset.y + (goal.y - offset.y) * k,
        };
        lastFrame = now;
        const x = Math.min(Math.max(8, pos.x + offset.x), window.innerWidth - w - 8);
        b.style.transform = `translate(${x}px, ${pos.y + offset.y}px)`;
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`agent-layer ${className}`} aria-hidden>
      <div className="agent-ripple" ref={ripple} />
      <div className="agent-cursor" ref={cursor}>
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M3 2l7 19 2.5-7.5L20 11z" fill="#1d1e21" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="agent-bubble" ref={bubble}>
        {children}
      </div>
    </div>
  );
}

/**
 * What the agent is doing, next to its cursor. The newest step sits on top with a spinner. When the
 * next one starts, the old one first flips to a check, then slides down (dimmed) and fades out on the
 * following change. Steps advance one at a time, paced so each can be read, even when several land
 * together (a stage's verdict and the agent's next action often arrive milliseconds apart).
 */
export function StepStack({ steps, target, playing }: { steps: Step[]; target: number; playing: boolean }) {
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
    <ol className={`agent-steps ${playing ? "" : "paused"}`}>
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

export function buildMoves(events: RunEvent[]): Move[] {
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
