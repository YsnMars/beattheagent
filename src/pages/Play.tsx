import { useEffect, useMemo, useState } from "react";
import { generateChallenge } from "../challenge/generate";
import { STAGES } from "../challenge/types";
import { GameScreen } from "../components/GameScreen";
import { Intro } from "../components/Intro";
import { Verdict } from "../components/Verdict";
import { useAgentSummary } from "../game/agentRuns";
import { encodeResult, toResult } from "../game/run";
import { useNow, useRun } from "../game/useRun";
import { formatDuration } from "../lib/format";
import { href, navigate } from "../lib/router";

export function Play({ seed, rec }: { seed: string; rec: string | null }) {
  const ch = useMemo(() => generateChallenge(seed), [seed]);
  const { run, start, act, submit, giveUp, reset } = useRun(ch, rec);
  const agent = useAgentSummary(seed);
  const ghost = rec ? null : agent ?? null;
  const running = run.startedAt !== null && run.finishedAt === null && run.gaveUpAt === null;
  const now = useNow(running || (run.feedback !== null && Date.now() - run.feedback.at < 3000));
  const [name, setName] = useState(() => localStorage.getItem("bta:name") ?? "");

  useEffect(() => {
    document.title = run.finishedAt ? `Done in ${formatDuration(toResult(seed, run).totalMs)} — Beat the Agent` : `Challenge #${seed} — Beat the Agent`;
  }, [run, seed]);

  if (run.startedAt === null) {
    return (
      <div className="game">
        <header className="hud">
          <div className="hud-left">
            <a className="hud-logo" href="#/">
              <span className="logo-mark">◆</span>
              <span className="hud-logo-text">Beat the Agent</span>
            </a>
          </div>
        </header>
        <Intro ch={ch} ghost={ghost} onStart={start} />
      </div>
    );
  }

  const ended = run.finishedAt !== null || run.gaveUpAt !== null;
  const result = toResult(seed, run, name.trim());
  const openResults = () => {
    localStorage.setItem("bta:name", name.trim());
    navigate(`/results/${encodeResult(result)}`);
  };

  const overlay = ended ? (
    <div className="finish" role="dialog" aria-label="Run complete">
      <div className="finish-card">
        <div className="finish-kicker">{run.finishedAt ? "Challenge complete" : "Run ended"}</div>
        <div className="finish-time" data-testid="final-time">
          {formatDuration(result.totalMs)}
        </div>
        <div className="finish-sub">
          {result.stagesCleared}/3 stages · {result.penalties} penalt{result.penalties === 1 ? "y" : "ies"}
        </div>
        <ol className="finish-splits">
          {STAGES.map((s, i) => (
            <li key={s.id} className={i < result.splits.length ? "" : "dim"}>
              <span>{s.title}</span>
              <b>{i < result.splits.length ? formatDuration(result.splits[i] - (result.splits[i - 1] ?? 0)) : "—"}</b>
            </li>
          ))}
        </ol>
        {!rec && agent && <Verdict human={result} agent={agent} compact />}
        {!rec && (
          <>
            <label className="finish-name">
              <span>Name on your scorecard</span>
              <input value={name} maxLength={24} placeholder="Anonymous" onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="finish-actions">
              <button className="btn-primary" onClick={openResults} data-testid="see-results">
                See results & share
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  reset();
                }}
              >
                Play again
              </button>
            </div>
            {agent && (
              <a className="link" href={href(`/replay/${seed}`)}>
                Watch the agent's run →
              </a>
            )}
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <GameScreen
      ch={ch}
      run={run}
      now={now}
      onAct={act}
      onSubmit={submit}
      onGiveUp={() => {
        if (window.confirm("Give up? Your completed stages still count.")) giveUp();
      }}
      ghost={ghost}
      overlay={overlay}
    />
  );
}
