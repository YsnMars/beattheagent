import { useEffect, useId, useMemo, useRef, useState } from "react";
import { generateChallenge } from "../challenge/generate";
import { STAGES } from "../challenge/types";
import { AgentCursor, buildMoves, StepStack, type Step } from "../components/AgentCursor";
import { GameScreen } from "../components/GameScreen";
import { Brand } from "../components/Brand";
import { IconBack, IconChevronRight, IconPause, IconPlay, IconReplay } from "../components/Icons";
import { Intro } from "../components/Intro";
import { useAgentRun, type AgentRun } from "../game/agentRuns";
import { deriveRun, elapsedAt, type RunEvent } from "../game/run";
import { formatDuration, formatInt, formatUsd } from "../lib/format";
import { href } from "../lib/router";

const SPEEDS = [1, 2, 4];

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
          <a className="btn btn-quiet" href="#/">
            <IconBack size={18} />
            Back
          </a>
        </header>
        <p className={`page-note ${run === undefined ? "loading" : ""}`}>{run === undefined ? "Loading replay…" : "There's no recorded agent run for this challenge."}</p>
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
    .map((e) => {
      const n = STAGES.findIndex((s) => s.id === e.s) + 1;
      return { at: e.at, n, label: e.ok ? `${STAGES[n - 1].title} done` : "Rejected", cls: e.ok ? "ok" : "bad" };
    });
  const pctOf = (at: number) => Math.max(0, ((at - t0) / (tEnd - t0)) * 100);
  const title = (
    <span className="replay-title">
      <a className="replay-back" href="#/" aria-label="Back">
        <IconBack size={20} />
      </a>
      <span className="replay-badge">
        <i className={`rec-dot ${playing ? "" : "paused"}`} aria-hidden />
        Replay
      </span>
      <h1>{run.modelLabel} replay</h1>
    </span>
  );

  return (
    <div className="replay">
      <div className="replay-stage">
        {derived.startedAt === null ? (
          <div className="game">
            <Intro ch={ch} ghost={run} left={title} />
          </div>
        ) : (
          <GameScreen ch={ch} run={derived} now={cur} left={title} clockLabel="Agent" />
        )}
      </div>

      {!ended && (
        <>
          {/* Frames the screen while the agent is the one driving. */}
          <div className={`agent-vignette ${playing ? "" : "paused"}`} aria-hidden />
          <AgentCursor moves={moves} cur={cur} speed={speed} scope=".replay-stage" follow floor=".replay-bar">
            <StepStack steps={steps} target={stepIdx} playing={playing} />
          </AgentCursor>
        </>
      )}

      {ended && (
        <div className="finish sheet-scrim" role="dialog" aria-label="Replay finished">
          <div className="sheet finish-card">
            <div className="finish-body solo">
              <div className="eyebrow finish-kicker">{derived.finishedAt ? `${run.modelLabel} finished in` : `${run.modelLabel} stopped after`}</div>
              <div className="finish-time">{derived.finishedAt ? formatDuration(elapsedAt(derived, cur)) : `${run.stagesCleared}/3`}</div>
              <dl className="replay-stats">
                <div>
                  <dt>Clicks</dt>
                  <dd>{formatInt(run.counts.clicks)}</dd>
                </div>
                <div>
                  <dt>Wrong answers</dt>
                  <dd>{run.penalties || "None"}</dd>
                </div>
                <div>
                  <dt>API cost</dt>
                  <dd>{run.cost.total !== null ? formatUsd(run.cost.total) : "Not reported"}</dd>
                </div>
              </dl>
              <Disclosure label="What the agent was told">
                <pre>{run.prompt.instructions}</pre>
                <pre>{run.prompt.task}</pre>
                <p className="prompt-note">
                  Everything else came from the page itself. The agent ran in an OpenAI-hosted browser; this replay is rebuilt from the page's log of its
                  clicks and inputs.
                </p>
              </Disclosure>
            </div>
            <div className="finish-actions">
              <div className="finish-row">
                <button className="btn btn-go btn-lg" onClick={restart}>
                  <IconReplay size={18} />
                  Watch again
                </button>
                <a className="btn btn-quiet btn-lg" href={href("/")}>
                  Back
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="replay-bar">
        <button className="play-btn" onClick={() => (atEnd ? restart() : setPlaying(!playing))} aria-label={playing ? "Pause" : "Play"} data-testid="replay-play">
          {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
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
          <div className="scrub-rail">
            <div className="scrub-fill" style={{ width: `${pctOf(cur)}%` }} />
          </div>
          {markers.map((m, i) => (
            <span key={i} className={`scrub-mark ${m.cls} ${cur >= m.at ? "passed" : ""}`} style={{ left: `${pctOf(m.at)}%` }} title={m.label}>
              {m.cls === "ok" ? m.n : "!"}
            </span>
          ))}
          <span className="scrub-knob" style={{ left: `${pctOf(cur)}%` }} />
        </div>
        <span className="scrub-time">{formatDuration(cur - startAt, 0)}</span>
        <div className="speeds" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} className={s === speed ? "on" : ""} aria-pressed={s === speed} onClick={() => setSpeed(s)}>
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
        <IconChevronRight size={16} />
        {label}
      </button>
      <div className="prompt-body" id={id} inert={!open}>
        <div>{children}</div>
      </div>
    </div>
  );
}

function buildSteps(run: AgentRun, startAt: number): Step[] {
  const steps: Step[] = [];
  // Environment boot ("Connecting to the challenge" ×N) happens off the clock; keep only the lead-up to Start.
  for (const a of run.activity) if (a.t > -2500 && a.title) steps.push({ at: startAt + a.t, text: a.title, kind: "act" });
  for (const e of run.events) if (e.k === "submit") steps.push({ at: e.at, text: e.msg, kind: e.ok ? "ok" : "bad" });
  return steps.sort((a, b) => a.at - b.at).filter((s, i, all) => s.text !== all[i - 1]?.text);
}
