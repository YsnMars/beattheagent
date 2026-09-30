import { useEffect, useLayoutEffect, useMemo } from "react";
import { generateChallenge } from "../challenge/generate";
import { GameScreen } from "../components/GameScreen";
import { Intro } from "../components/Intro";
import { Outcome } from "../components/Outcome";
import { useAgentSummary } from "../game/agentRuns";
import { recordBest } from "../game/bests";
import { toResult } from "../game/run";
import { useNow, useRun } from "../game/useRun";
import { formatDuration } from "../lib/format";
import { href } from "../lib/router";

type Props = {
  seed: string;
  rec: string | null;
  /** Deals a fresh challenge that starts right away. */
  onNext: () => void;
  /** Back to the landing page with a fresh challenge. */
  onHome: () => void;
  /** Skip the intro: start the clock as soon as the challenge is dealt. */
  autoStart?: boolean;
};

export function Play({ seed, rec, onNext, onHome, autoStart }: Props) {
  const ch = useMemo(() => generateChallenge(seed), [seed]);
  const { run, start, act, submit, giveUp } = useRun(ch, rec);
  const agent = useAgentSummary(seed);
  const ghost = rec ? null : agent ?? null;
  const running = run.startedAt !== null && run.finishedAt === null && run.gaveUpAt === null;
  const now = useNow(running || (run.feedback !== null && Date.now() - run.feedback.at < 3000));

  useEffect(() => {
    document.title = "Beat the Agent";
  }, []);

  useEffect(() => {
    if (!rec && run.finishedAt !== null) recordBest(seed, toResult(run).totalMs);
  }, [rec, seed, run]);

  // Before paint, so the intro never flashes. A resumed run keeps its original start time.
  useLayoutEffect(() => {
    if (autoStart) start();
  }, [autoStart, start]);

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
              Try again
            </button>
          </div>
        )}
        {!rec && (
          <button className="btn-text finish-home" onClick={onHome} data-testid="home">
            Back to start
          </button>
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
      onGiveUp={giveUp}
      onHome={rec ? undefined : onHome}
      ghost={ghost}
      overlay={overlay}
    />
  );
}
