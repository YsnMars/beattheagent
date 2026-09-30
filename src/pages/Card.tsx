import { useEffect } from "react";
import { SplitBars } from "../components/Scorecard";
import { verdictText } from "../components/Verdict";
import { useAgentSummary } from "../game/agentRuns";
import { decodeResult } from "../game/run";
import { formatDuration } from "../lib/format";
import { href } from "../lib/router";
import { SiteHeader } from "./Landing";
import { NotFound } from "./Results";

/** What a friend sees when they open a shared scorecard link. */
export function Card({ payload }: { payload: string }) {
  const r = decodeResult(payload);
  const agent = useAgentSummary(r?.seed ?? "");
  useEffect(() => {
    if (r) document.title = `${r.name || "A friend"} challenged you — Beat the Agent #${r.seed}`;
  }, [r]);
  if (!r) return <NotFound what="scorecard" />;
  const who = r.name || "Your friend";
  const v = agent ? verdictText(r, agent, who) : null;

  return (
    <div className="page">
      <SiteHeader />
      <main className="card-page">
        <article className="scorecard" data-testid="scorecard">
          <div className="scorecard-top">
            <span className="kicker">Challenge #{r.seed}</span>
            <span className="scorecard-brand">◆ Beat the Agent</span>
          </div>
          <div className="scorecard-who">{who}</div>
          <div className="scorecard-time">{r.finished ? formatDuration(r.totalMs) : `${r.stagesCleared}/3 stages`}</div>
          {v && (
            <div className={`scorecard-verdict ${v.win === true ? "win" : v.win === false ? "lose" : ""}`}>
              {v.headline} · <span>{v.detail}</span>
            </div>
          )}
          <SplitBars human={r} agent={agent ?? null} humanLabel={r.name ? r.name.split(" ")[0].slice(0, 8) : "Friend"} />
        </article>
        <div className="card-cta">
          <h2>Can you do better?</h2>
          <p className="muted">
            You'll get the exact same products, calendars, and spreadsheet as {who}
            {agent ? ` and ${agent.modelLabel}` : ""}.
          </p>
          <a
            className="btn-primary btn-xl"
            href={href(`/play/${r.seed}`)}
            data-testid="take-challenge"
            onClick={() => sessionStorage.removeItem(`bta:run:v1:${r.seed}`)}
          >
            Take challenge #{r.seed}
          </a>
          <a className="link" href="#/">
            What is this?
          </a>
        </div>
      </main>
    </div>
  );
}
