import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { generateChallenge } from "../challenge/generate";
import { STAGES } from "../challenge/types";
import { GameScreen } from "../components/GameScreen";
import { Intro } from "../components/Intro";
import { useAgentRun, type AgentRun } from "../game/agentRuns";
import { deriveRun, elapsedAt, type RunEvent } from "../game/run";
import { formatDuration } from "../lib/format";
import { href } from "../lib/router";
import { SiteHeader } from "./Landing";
import { AgentFacts } from "./Results";

type Ptr = Extract<RunEvent, { k: "ptr" }>;
type FeedItem = { at: number; kind: "api" | "ok" | "bad" | "msg" | "start"; text: string; shot?: string | null };

const SPEEDS = [1, 2, 4, 8];

export function Replay({ seed }: { seed: string }) {
  const run = useAgentRun(seed);
  useEffect(() => {
    document.title = `Agent replay #${seed} — Beat the Agent`;
  }, [seed]);
  if (run === undefined)
    return (
      <div className="page">
        <SiteHeader />
        <main className="results">
          <div className="card muted">Loading replay…</div>
        </main>
      </div>
    );
  if (run === null)
    return (
      <div className="page">
        <SiteHeader />
        <main className="results">
          <div className="card">
            <h1>No agent run for #{seed}</h1>
            <p className="muted">This seed hasn't been recorded. You can still play it, just without an opponent.</p>
            <a className="btn-primary" href={href(`/play/${seed}`)}>
              Play #{seed}
            </a>
          </div>
        </main>
      </div>
    );
  return <ReplayPlayer run={run} />;
}

function ReplayPlayer({ run }: { run: AgentRun }) {
  const ch = useMemo(() => generateChallenge(run.seed), [run.seed]);
  const events = run.events;
  const startAt = events.find((e) => e.k === "start")?.at ?? events[0]?.at ?? 0;
  const t0 = Math.min(events[0]?.at ?? startAt, startAt - 1000);
  const final = useMemo(() => deriveRun(ch, events), [ch, events]);
  const tEnd = (final.finishedAt ?? final.gaveUpAt ?? events[events.length - 1]?.at ?? startAt) + 4000;

  const [cur, setCur] = useState(t0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const curRef = useRef(cur);
  curRef.current = cur;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) * speed;
      last = now;
      const next = Math.min(tEnd, curRef.current + dt);
      setCur(next);
      if (next >= tEnd) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, tEnd]);

  const derived = useMemo(() => deriveRun(ch, events, cur), [ch, events, cur]);
  const ptrs = useMemo(() => events.filter((e): e is Ptr => e.k === "ptr"), [events]);
  const feed = useMemo(() => buildFeed(run, startAt), [run, startAt]);
  const shot = [...feed].reverse().find((f) => f.shot && f.at <= cur)?.shot ?? null;
  const activeFeed = [...feed].reverse().find((f) => f.at <= cur);

  const markers = [
    { at: startAt, label: "Start", cls: "start" },
    ...events
      .filter((e): e is Extract<RunEvent, { k: "submit" }> => e.k === "submit")
      .map((e) => ({ at: e.at, label: e.ok ? `${STAGES.find((s) => s.id === e.s)!.title} ✓` : "Rejected", cls: e.ok ? "ok" : "bad" })),
  ];
  const pctOf = (at: number) => ((at - t0) / (tEnd - t0)) * 100;
  const rel = cur - startAt;

  return (
    <div className="page replay-page">
      <SiteHeader />
      <main className="replay">
        <div className="replay-head">
          <div>
            <div className="kicker">Recorded agent run · challenge #{run.seed}</div>
            <h1>
              {run.modelLabel} {run.finished ? `finished in ${formatDuration(run.totalMs)}` : `cleared ${run.stagesCleared}/3 stages`}
            </h1>
            <p className="muted small">
              Rebuilt from the page's own log of the agent's clicks and inputs in an OpenAI-hosted browser (viewport {run.page.vw}×{run.page.vh}). Screenshots and
              activity titles come from the Agents API.
            </p>
          </div>
          <a className="btn-primary" href={href(`/play/${run.seed}`)}>
            Race this run
          </a>
        </div>

        <div className="replay-grid">
          <div className="replay-stage">
            <ScaledFrame run={run} cur={cur} ptrs={ptrs}>
              {derived.startedAt === null ? (
                <div className="game">
                  <header className="hud">
                    <div className="hud-left">
                      <span className="hud-logo">
                        <span className="logo-mark">◆</span>
                        <span className="hud-logo-text">Beat the Agent</span>
                      </span>
                    </div>
                  </header>
                  <Intro ch={ch} />
                </div>
              ) : (
                <GameScreen
                  ch={ch}
                  run={derived}
                  now={cur}
                  overlay={
                    derived.finishedAt !== null || derived.gaveUpAt !== null ? (
                      <div className="finish">
                        <div className="finish-card">
                          <div className="finish-kicker">{derived.finishedAt ? "Challenge complete" : "Run ended"}</div>
                          <div className="finish-time">{formatDuration(elapsedAt(derived, cur))}</div>
                        </div>
                      </div>
                    ) : null
                  }
                />
              )}
            </ScaledFrame>

            <div className="scrubber">
              <button className="btn-primary small" onClick={() => (cur >= tEnd ? (setCur(t0), setPlaying(true)) : setPlaying(!playing))} data-testid="replay-play">
                {playing ? "❚❚ Pause" : cur >= tEnd ? "↺ Replay" : "▶ Play"}
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
              <span className="scrub-time">{rel < 0 ? `−${formatDuration(-rel, 0)}` : formatDuration(rel, 0)}</span>
              <div className="speeds">
                {SPEEDS.map((s) => (
                  <button key={s} className={s === speed ? "on" : ""} onClick={() => setSpeed(s)}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            <div className="jump">
              <span className="muted small">Jump to:</span>
              <button onClick={() => setCur(startAt)}>Start</button>
              {final.splits.map((_, i) => {
                const at = events.filter((e) => e.k === "submit" && e.ok)[i]?.at;
                return at ? (
                  <button key={i} onClick={() => setCur(at - 3000)}>
                    {STAGES[i].title} clear
                  </button>
                ) : null;
              })}
            </div>
          </div>

          <aside className="replay-side">
            <div className="shot">
              <div className="shot-label">Hosted-browser screenshot</div>
              {shot ? <img src={`runs/${run.seed}/${shot}`} alt="Screenshot from the agent's hosted browser" /> : <div className="shot-empty">No screenshot yet</div>}
            </div>
            <ol className="feed">
              {feed.map((f, i) => (
                <li
                  key={i}
                  className={`feed-${f.kind} ${f === activeFeed ? "active" : ""} ${f.at > cur ? "future" : ""}`}
                  onClick={() => setCur(f.at)}
                >
                  <span className="feed-t">{f.at - startAt < 0 ? "pre" : formatDuration(f.at - startAt, 0)}</span>
                  <span className="feed-text">{f.text}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>

        <AgentFacts run={run} />
        <PromptCard run={run} />
      </main>
    </div>
  );
}

function PromptCard({ run }: { run: AgentRun }) {
  return (
    <section className="card">
      <h2 className="card-title">Exactly what the agent was told</h2>
      <div className="prompt-block">
        <div className="kicker">Agent instructions</div>
        <pre>{run.prompt.instructions}</pre>
        <div className="kicker">Task message</div>
        <pre>{run.prompt.task}</pre>
      </div>
      <p className="muted small">Everything else, including the rules and each stage's task, came from the same page you play.</p>
    </section>
  );
}

function buildFeed(run: AgentRun, startAt: number): FeedItem[] {
  const items: FeedItem[] = [];
  for (const a of run.activity) items.push({ at: startAt + a.t, kind: "api", text: a.title || "Browser activity", shot: a.shot });
  for (const m of run.messages) items.push({ at: startAt + m.t, kind: "msg", text: `“${m.text}”` });
  for (const e of run.events) {
    if (e.k === "start") items.push({ at: e.at, kind: "start", text: "Pressed Start — timer running" });
    if (e.k === "submit") items.push({ at: e.at, kind: e.ok ? "ok" : "bad", text: e.ok ? `✓ ${e.msg}` : `✗ ${e.msg}` });
  }
  items.sort((a, b) => a.at - b.at);
  // Collapse runs of identical API activity ("Connecting to challenge browser" ×10).
  const out: FeedItem[] = [];
  let repeat = 1;
  for (const it of items) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === "api" && it.kind === "api" && prev.text.replace(/ ×\d+$/, "") === it.text && !it.shot) {
      repeat++;
      prev.text = `${it.text} ×${repeat}`;
      continue;
    }
    repeat = 1;
    out.push({ ...it });
  }
  return out;
}

/** Renders children at the agent's viewport size, scaled to fit, with a ghost cursor. */
function ScaledFrame({ run, cur, ptrs, children }: { run: AgentRun; cur: number; ptrs: Ptr[]; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const vw = run.page.vw || 1280;
  const vh = run.page.vh || 800;
  const scale = width / vw;

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    // Window scroll and inner scroll containers, as recorded.
    const scrolls = run.events.filter((e): e is Extract<RunEvent, { k: "scroll" }> => e.k === "scroll" && e.at <= cur);
    const winScroll = [...scrolls].reverse().find((s) => s.el === null);
    vp.scrollTop = winScroll?.sy ?? 0;
    for (const name of ["sheet", "cal-grid"]) {
      const s = [...scrolls].reverse().find((x) => x.el === name);
      const el = vp.querySelector<HTMLElement>(`[data-scroll="${name}"]`);
      if (el) el.scrollTop = s?.st ?? 0;
    }

    // Cursor: glide toward the next click during the 450ms before it lands.
    const prevIdx = ptrs.findLastIndex((p) => p.at <= cur);
    const prev = prevIdx >= 0 ? ptrs[prevIdx] : null;
    const next = ptrs[prevIdx + 1] ?? null;
    const locate = (p: Ptr) => {
      const vpRect = vp.getBoundingClientRect();
      const target = p.tgt ? vp.querySelector<HTMLElement>(`[data-trace="${CSS.escape(p.tgt)}"]`) : null;
      if (target) {
        const r = target.getBoundingClientRect();
        return {
          x: (r.left - vpRect.left + p.fx * r.width) / scale,
          y: (r.top - vpRect.top + p.fy * r.height) / scale + vp.scrollTop,
        };
      }
      return { x: p.x, y: p.y + p.sy };
    };
    const c = cursor.current;
    const rp = ripple.current;
    if (!c || !rp) return;
    if (!prev && !next) {
      c.style.opacity = "0";
      return;
    }
    let pos = prev ? locate(prev) : locate(next!);
    if (next && next.at - cur < 450) {
      const from = prev ? locate(prev) : { x: vw / 2, y: vh / 2 + vp.scrollTop };
      const to = locate(next);
      const k = 1 - (next.at - cur) / 450;
      const ease = k * k * (3 - 2 * k);
      pos = { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease };
    }
    c.style.opacity = "1";
    c.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    if (prev && cur - prev.at < 600) {
      const p = locate(prev);
      rp.style.opacity = String(1 - (cur - prev.at) / 600);
      rp.style.transform = `translate(${p.x}px, ${p.y}px) scale(${0.4 + (cur - prev.at) / 400})`;
    } else rp.style.opacity = "0";
  });

  return (
    <div className="frame-outer" ref={outer} style={{ height: vh * scale }}>
      <div className="frame-scaler" style={{ width: vw, height: vh, transform: `scale(${scale})` }}>
        <div className="frame-viewport" ref={viewport}>
          {children}
          <div className="ghost-ripple" ref={ripple} />
          <div className="ghost-cursor" ref={cursor}>
            <svg viewBox="0 0 24 24" width="26" height="26">
              <path d="M3 2l7 19 2.5-7.5L20 11z" fill="#ffb454" stroke="#1a1206" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span>Agent</span>
          </div>
        </div>
      </div>
    </div>
  );
}
