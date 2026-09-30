import { useEffect, useMemo } from "react";
import { generateChallenge } from "../challenge/generate";
import { GameScreen } from "../components/GameScreen";
import { Intro } from "../components/Intro";
import { Outcome } from "../components/Outcome";
import { useAgentSummary } from "../game/agentRuns";
import { toResult } from "../game/run";
import { useNow, useRun } from "../game/useRun";
import { formatDuration } from "../lib/format";
import { href } from "../lib/router";

type Props = {
  seed: string;
  rec: string | null;
  /** Deals a fresh challenge. */
  onNext: () => void;
};

export function Play({ seed, rec, onNext }: Props) {
  const ch = useMemo(() => generateChallenge(seed), [seed]);
  const { run, start, act, submit, giveUp } = useRun(ch, rec);
  const agent = useAgentSummary(seed);
  const ghost = rec ? null : agent ?? null;
  const running = run.startedAt !== null && run.finishedAt === null && run.gaveUpAt === null;
  const now = useNow(running || (run.feedback !== null && Date.now() - run.feedback.at < 3000));

  useEffect(() => {
    document.title = "Beat the Agent";
  }, []);

  if (run.startedAt === null) {
    return (
      <div className="game">
        <Intro ch={ch} ghost={ghost} onStart={start} />
      </div>
    );
  }

  const ended = run.finishedAt !== null || run.gaveUpAt !== null;
  const result = toResult(run);

  const overlay = ended ? (
    <div className="finish" role="dialog" aria-label="Run complete">
      <div className="finish-card">
        <div className="finish-kicker">{run.finishedAt ? "Challenge complete" : "Run ended"}</div>
        {ghost ? (
          <Outcome human={result} agent={ghost} />
        ) : (
          <>
            <div className="finish-time" data-testid="final-time">
              {formatDuration(result.totalMs)}
            </div>
            <div className="finish-sub">
              {result.stagesCleared}/3 stages
              {result.penalties > 0 && ` · ${result.penalties} wrong answer${result.penalties > 1 ? "s" : ""}`}
            </div>
          </>
        )}
        {!rec && (
          <div className="finish-actions">
            {ghost && (
              <a className="btn-primary" href={href(`/replay/${seed}`)} data-testid="watch-agent">
                Watch how the agent did it
              </a>
            )}
            <button className={ghost ? "btn-ghost" : "btn-primary"} onClick={onNext} data-testid="next">
              Try another
            </button>
          </div>
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
        if (window.confirm("Give up? You'll see how the agent compares.")) giveUp();
      }}
      ghost={ghost}
      overlay={overlay}
    />
  );
}
