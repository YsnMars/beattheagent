import { useEffect } from "react";
import { STAGES } from "../challenge/types";
import { dailySeed, useRunIndex, type RunSummary } from "../game/agentRuns";
import { formatDuration, formatUsd } from "../lib/format";
import { randomSeed } from "../lib/rng";
import { href } from "../lib/router";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="hud-logo" href="#/">
        <span className="logo-mark">◆</span>
        <span className="hud-logo-text">Beat the Agent</span>
      </a>
      <nav>
        <a href="#/#how">How it works</a>
        <a href="#/#challenges">Challenges</a>
      </nav>
    </header>
  );
}

const STAGE_ICONS = ["🎧", "📅", "📊"];

export function Landing({ anchor }: { anchor?: string }) {
  const index = useRunIndex();
  const seed = index ? dailySeed(index) : null;
  const today = index?.runs.find((r) => r.seed === seed) ?? null;

  useEffect(() => {
    document.title = "Beat the Agent — race GPT-6.1 Sol through three browser tasks";
  }, []);
  useEffect(() => {
    if (anchor && index) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
  }, [anchor, index]);

  return (
    <div className="page landing">
      <SiteHeader />
      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">A browser race against an AI agent</div>
          <h1>
            Beat the <span className="grad">Agent</span>
          </h1>
          <p className="hero-sub">
            Shop, schedule, and wrangle a spreadsheet on one clock. Your opponent is {today?.modelLabel ?? "GPT-6.1 Sol"}, which ran the exact same seeded challenge in
            a real OpenAI-hosted browser. Every click it made was recorded.
          </p>
          <div className="hero-actions">
            {seed ? (
              <a className="btn-primary btn-xl" href={href(`/play/${seed}`)} data-testid="play-today">
                Play today's challenge
              </a>
            ) : (
              <a className="btn-primary btn-xl" href={href(`/play/${randomSeed()}`)}>
                Play a practice challenge
              </a>
            )}
            {seed && (
              <a className="btn-ghost btn-xl" href={href(`/replay/${seed}`)}>
                Watch the agent (spoilers)
              </a>
            )}
          </div>
          {index && !index.runs.length && (
            <p className="muted small">No agent runs are recorded yet. Record some with <code>npm run agent:run</code> (see README).</p>
          )}
        </div>
        <HeroTrack run={today} />
      </section>

      <section className="stage-cards">
        {STAGES.map((s, i) => (
          <article className="stage-card" key={s.id}>
            <div className="stage-icon" aria-hidden>
              {STAGE_ICONS[i]}
            </div>
            <div className="stage-num">Stage {i + 1}</div>
            <h3>{s.title}</h3>
            <p>{s.blurb}</p>
          </article>
        ))}
      </section>

      <section className="how" id="how">
        <h2>How it works</h2>
        <ol className="how-steps">
          <li>
            <b>One seed, one world.</b> A seed generates every product, calendar, and spreadsheet row. You, your friends, and the agent all get identical
            starting states and on-screen instructions.
          </li>
          <li>
            <b>A real agent run.</b> The agent is {today?.modelLabel ?? "GPT-6.1 Sol"} on OpenAI's Agents API with hosted-browser computer use. It opened this same
            page and played it by clicking. The page logged every click, keystroke, and submission, and the API logged its browser activity and token usage.
          </li>
          <li>
            <b>Precomputed, so it's free to play.</b> Agent runs are recorded ahead of time. Playing never calls the API. You race the agent's recorded
            splits live.
          </li>
          <li>
            <b>Scored fairly.</b> Your timer starts when you press Start, same as the agent's. Each stage must pass validation before you advance, and a
            rejected submission costs 15 seconds. If both runs finish, total time decides. Otherwise, whoever cleared more stages wins.
          </li>
        </ol>
      </section>

      <section className="pool" id="challenges">
        <h2>Challenges</h2>
        {!index && <div className="muted">Loading…</div>}
        <div className="pool-grid">
          {index?.runs.map((r) => <PoolCard key={r.seed} run={r} today={r.seed === seed} />)}
          <article className="pool-card practice">
            <div className="pool-seed">Practice</div>
            <p className="muted small">A fresh random seed with no recorded agent. Good for warming up.</p>
            <a className="btn-ghost" href={href(`/play/${randomSeed()}`)}>
              Random seed
            </a>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <span>Beat the Agent · simulated store, calendar, and spreadsheet. Nothing real is bought or sent.</span>
        <span className="muted">Agent runs recorded with the OpenAI Agents API (computer use, beta).</span>
      </footer>
    </div>
  );
}

function PoolCard({ run, today }: { run: RunSummary; today: boolean }) {
  return (
    <article className={`pool-card ${today ? "today" : ""}`}>
      <div className="pool-top">
        <span className="pool-seed">#{run.seed}</span>
        {today && <span className="pill">Today</span>}
      </div>
      <div className="pool-agent">
        <span className="muted small">{run.modelLabel}</span>
        <b>{run.finished ? formatDuration(run.totalMs) : `${run.stagesCleared}/3 stages`}</b>
      </div>
      <div className="pool-meta muted small">
        {run.penalties} penalt{run.penalties === 1 ? "y" : "ies"}
        {run.costUsd !== null && ` · ${formatUsd(run.costUsd)} API cost`}
      </div>
      <div className="pool-actions">
        <a className="btn-primary" href={href(`/play/${run.seed}`)}>
          Race it
        </a>
        <a className="btn-ghost" href={href(`/replay/${run.seed}`)}>
          Replay
        </a>
      </div>
    </article>
  );
}

function HeroTrack({ run }: { run: RunSummary | null }) {
  return (
    <div className="hero-track" aria-hidden={!run}>
      <div className="track-head">
        <span className="kicker">{run ? `Challenge #${run.seed}` : "Challenge"}</span>
        <span className="track-time">{run ? (run.finished ? formatDuration(run.totalMs) : `${run.stagesCleared}/3`) : "--:--"}</span>
      </div>
      <div className="track-label">Time to beat · {run?.modelLabel ?? "agent"}</div>
      <ol className="track-stages">
        {STAGES.map((s, i) => {
          const split = run && i < run.splits.length ? run.splits[i] - (run.splits[i - 1] ?? 0) : null;
          return (
            <li key={s.id} style={{ animationDelay: `${i * 0.15}s` }}>
              <span className="track-icon">{STAGE_ICONS[i]}</span>
              <span className="track-name">{s.title}</span>
              <span className="track-split">{split !== null ? formatDuration(split) : "—"}</span>
            </li>
          );
        })}
      </ol>
      <div className="track-lanes">
        <div className="lane agent">
          <span>Agent</span>
          <i />
        </div>
        <div className="lane you">
          <span>You</span>
          <i />
        </div>
      </div>
    </div>
  );
}
