import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Challenge, StageId } from "../challenge/types";
import { STAGES } from "../challenge/types";
import { deriveRun, judge, type RunEvent } from "./run";
import type { AnyAction } from "./state";

const storageKey = (seed: string, rec: string | null) => `bta:run:v1:${seed}${rec ? ":rec" : ""}`;

/** Forgets a human run so the seed starts fresh the next time it's dealt. */
export function clearRun(seed: string) {
  sessionStorage.removeItem(storageKey(seed, null));
}

function loadEvents(key: string): RunEvent[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as RunEvent[]) : null;
  } catch {
    return null;
  }
}

function loadEvent(): RunEvent {
  return { k: "load", at: Date.now(), vw: window.innerWidth, vh: window.innerHeight, ua: navigator.userAgent };
}

/**
 * Owns the run's event log. With `rec` set (agent recording runs), pointer and scroll activity is
 * captured too and the whole log is POSTed to the local collector behind the tunnel.
 */
export function useRun(ch: Challenge, rec: string | null) {
  const key = storageKey(ch.seed, rec);
  const [events, setEvents] = useState<RunEvent[]>(() => {
    const saved = loadEvents(key);
    return saved ? [...saved, loadEvent()] : [loadEvent()];
  });
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const run = useMemo(() => deriveRun(ch, events), [ch, events]);
  const runRef = useRef(run);
  runRef.current = run;

  const flushTimer = useRef<number | null>(null);
  const flush = useCallback(() => {
    if (!rec) return;
    if (flushTimer.current !== null) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const body = JSON.stringify({ seed: ch.seed, token: rec, sentAt: Date.now(), events: eventsRef.current });
    fetch(`api/trace?token=${encodeURIComponent(rec)}`, { method: "POST", body, keepalive: body.length < 60_000, headers: { "content-type": "application/json" } }).catch(() => {});
  }, [ch.seed, rec]);

  const push = useCallback(
    (e: RunEvent, urgent = false) => {
      setEvents((prev) => {
        const next = [...prev, e];
        eventsRef.current = next;
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage full or disabled: the run still works in memory */
        }
        return next;
      });
      if (!rec) return;
      if (urgent) queueMicrotask(flush);
      else if (flushTimer.current === null) flushTimer.current = window.setTimeout(flush, 2000);
    },
    [key, rec, flush],
  );

  // Recording-only instrumentation: where the agent actually clicked, and how it scrolled.
  useEffect(() => {
    if (!rec) return;
    const onPointer = (ev: PointerEvent) => {
      const target = (ev.target as Element | null)?.closest?.("[data-trace]") as HTMLElement | null;
      const rect = target?.getBoundingClientRect();
      push({
        k: "ptr",
        at: Date.now(),
        x: Math.round(ev.clientX),
        y: Math.round(ev.clientY),
        vw: window.innerWidth,
        vh: window.innerHeight,
        sy: Math.round(window.scrollY),
        tgt: target?.dataset.trace ?? null,
        fx: rect && rect.width ? +((ev.clientX - rect.left) / rect.width).toFixed(3) : 0.5,
        fy: rect && rect.height ? +((ev.clientY - rect.top) / rect.height).toFixed(3) : 0.5,
      });
    };
    let last = 0;
    const onScroll = (ev: Event) => {
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      const el = ev.target instanceof HTMLElement ? ev.target : null;
      push({ k: "scroll", at: now, sy: Math.round(window.scrollY), el: el?.dataset.scroll ?? null, st: el ? Math.round(el.scrollTop) : 0 });
    };
    const onHide = () => flush();
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("pagehide", onHide);
    const heartbeat = window.setInterval(flush, 5000);
    flush();
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pagehide", onHide);
      clearInterval(heartbeat);
    };
  }, [rec, push, flush]);

  /** `brief`: stop the clock between stages for the next stage's briefing. */
  const start = useCallback(
    (brief = false) => {
      if (runRef.current.startedAt === null) push(brief ? { k: "start", at: Date.now(), brief: true } : { k: "start", at: Date.now() }, true);
    },
    [push],
  );

  /** Ends the briefing that's showing and restarts the clock. */
  const go = useCallback(() => {
    if (runRef.current.pausedSince !== null) push({ k: "go", at: Date.now() }, true);
  }, [push]);

  const act = useCallback((s: StageId, a: AnyAction) => push({ k: "act", at: Date.now(), s, a }), [push]);

  const submit = useCallback(() => {
    const r = runRef.current;
    if (r.startedAt === null || r.finishedAt !== null || r.gaveUpAt !== null || r.pausedSince !== null) return;
    const stage = STAGES[r.stageIndex].id;
    const verdict = judge(ch, stage, r.states);
    push({ k: "submit", at: Date.now(), s: stage, ok: verdict.ok, msg: verdict.message }, true);
  }, [ch, push]);

  const giveUp = useCallback(() => push({ k: "giveup", at: Date.now() }, true), [push]);

  return { events, run, start, go, act, submit, giveUp };
}

export function useNow(active: boolean, intervalMs = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
