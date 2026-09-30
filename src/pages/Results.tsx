import { useEffect, useState } from "react";
import { SplitBars, scorecardPng } from "../components/Scorecard";
import { Verdict } from "../components/Verdict";
import { useAgentRun, useAgentSummary, type RunSummary, type AgentRun } from "../game/agentRuns";
import { decodeResult, encodeResult, type RunResult } from "../game/run";
import { formatDuration, formatInt, formatUsd } from "../lib/format";
import { href, shareUrl } from "../lib/router";
import { SiteHeader } from "./Landing";

export function Results({ payload }: { payload: string }) {
  const decoded = decodeResult(payload);
  const [name, setName] = useState(decoded?.name ?? "");
  const agent = useAgentSummary(decoded?.seed ?? "");
  const full = useAgentRun(decoded?.seed ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = "Your results — Beat the Agent";
  }, []);

  if (!decoded) return <NotFound what="result" />;
  const result: RunResult = { ...decoded, name: name.trim() };
  const cardPath = `/c/${encodeResult(result)}`;
  const link = shareUrl(cardPath);

  const share = async () => {
    localStorage.setItem("bta:name", name.trim());
    const text = agent ? shareText(result, agent) : `I finished Beat the Agent challenge #${result.seed}.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Beat the Agent", text, url: link });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    await navigator.clipboard?.writeText(`${text} ${link}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const download = async () => {
    const blob = await scorecardPng(result, agent ?? null);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `beat-the-agent-${result.seed}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  return (
    <div className="page">
      <SiteHeader />
      <main className="results">
        <div className="results-head">
          <div className="kicker">Challenge #{result.seed} · results</div>
          <h1 className="results-time" data-testid="results-time">
            {result.finished ? formatDuration(result.totalMs) : `${result.stagesCleared}/3 stages`}
          </h1>
          <div className="muted">
            {result.finished ? "Total time, including penalties" : "Run ended before the final stage"}
            {result.penalties > 0 && ` · ${result.penalties} rejected submission${result.penalties > 1 ? "s" : ""} (+${result.penalties * 15}s)`}
          </div>
        </div>

        {agent === undefined ? (
          <div className="card muted">Loading the agent's run…</div>
        ) : agent ? (
          <Verdict human={result} agent={agent} />
        ) : (
          <div className="card muted">No recorded agent run exists for this seed yet, so there's no head-to-head.</div>
        )}

        <section className="card">
          <h2 className="card-title">Per-stage splits</h2>
          <SplitBars human={result} agent={agent ?? null} />
        </section>

        {full && <AgentFacts run={full} />}

        <section className="card share">
          <h2 className="card-title">Challenge a friend</h2>
          <p className="muted">Your link opens a scorecard with a button that starts this exact challenge.</p>
          <label className="field">
            <span>Name on scorecard</span>
            <input value={name} maxLength={24} placeholder="Anonymous" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="share-link">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" data-testid="share-link" />
          </div>
          <div className="row-actions">
            <button className="btn-primary" onClick={share}>
              {copied ? "Link copied ✓" : "Share scorecard"}
            </button>
            <button className="btn-ghost" onClick={download}>
              Download image
            </button>
            <a className="btn-ghost" href={href(cardPath)}>
              Preview card
            </a>
          </div>
        </section>

        <div className="row-actions center">
          <a className="btn-ghost" href={href(`/play/${result.seed}`)} onClick={() => sessionStorage.removeItem(`bta:run:v1:${result.seed}`)}>
            Play this challenge again
          </a>
          {agent && (
            <a className="btn-ghost" href={href(`/replay/${result.seed}`)}>
              Watch the agent's replay
            </a>
          )}
          <a className="btn-ghost" href="#/">
            All challenges
          </a>
        </div>
      </main>
    </div>
  );
}

export function shareText(r: RunResult, agent: RunSummary) {
  const t = r.finished ? formatDuration(r.totalMs) : `${r.stagesCleared}/3 stages`;
  const a = agent.finished ? formatDuration(agent.totalMs) : `${agent.stagesCleared}/3`;
  return `Beat the Agent #${r.seed}: I got ${t} vs ${agent.modelLabel}'s ${a}. Your turn:`;
}

export function AgentFacts({ run }: { run: AgentRun }) {
  return (
    <section className="card">
      <h2 className="card-title">About the agent's run</h2>
      <dl className="facts">
        <div>
          <dt>Model</dt>
          <dd>
            {run.modelLabel} <span className="muted">({run.model}{run.reasoningEffort ? `, ${run.reasoningEffort} reasoning` : ""})</span>
          </dd>
        </div>
        <div>
          <dt>Environment</dt>
          <dd>OpenAI Agents API · hosted browser (computer use)</dd>
        </div>
        <div>
          <dt>Clicks on the page</dt>
          <dd>{formatInt(run.counts.clicks)}</dd>
        </div>
        <div>
          <dt>Browser tool calls</dt>
          <dd>{formatInt(run.counts.browserCalls)}</dd>
        </div>
        <div>
          <dt>API cost</dt>
          <dd>
            {run.cost.total !== null ? formatUsd(run.cost.total) : "Not reported"}
            {run.usage && (
              <span className="muted">
                {" "}
                · {formatInt(run.usage.input_tokens)} in ({formatInt(run.usage.cached_tokens)} cached) / {formatInt(run.usage.output_tokens)} out
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Recorded</dt>
          <dd>{new Date(run.recordedAt).toLocaleString()}</dd>
        </div>
      </dl>
      {run.cost.notes.length > 0 && (
        <ul className="notes">
          {run.cost.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <div className="page">
      <SiteHeader />
      <main className="results">
        <div className="card">
          <h1>That {what} link looks broken.</h1>
          <p className="muted">It may have been cut off when it was copied.</p>
          <a className="btn-primary" href="#/">
            Go to today's challenge
          </a>
        </div>
      </main>
    </div>
  );
}
