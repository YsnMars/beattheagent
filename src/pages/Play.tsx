import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { generateChallenge } from "../challenge/generate";
import { GameScreen } from "../components/GameScreen";
import { Intro } from "../components/Intro";
import { Outcome } from "../components/Outcome";
import { Briefing, Countdown, GhostCursor, GoFlash } from "../components/Race";
import { useAgentRun, useAgentSummary } from "../game/agentRuns";
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
  /** Skip the intro: go straight to the first stage's briefing. */
  autoStart?: boolean;
};

export function Play({ seed, rec, onNext, onHome, autoStart }: Props) {
  const ch = useMemo(() => generateChallenge(seed), [seed]);
  const { run, start, go, act, submit, giveUp } = useRun(ch, rec);
  const agent = useAgentSummary(seed);
  const ghost = rec ? null : agent ?? null;
  // The full recording, for the agent's cursor on your page.
  const agentRun = useAgentRun(ghost ? seed : null);
  const ended = run.finishedAt !== null || run.gaveUpAt !== null;
  const running = run.startedAt !== null && !ended && run.pausedSince === null;
  // Before the clock starts and between stages, people play (agent recordings skip this): the
  // intro, then each stage's briefing, then a countdown.
  const [phase, setPhase] = useState<"intro" | "brief" | "count">(autoStart ? "brief" : "intro");
  const [goAt, setGoAt] = useState<number | null>(null);
  const briefing = !rec && !ended && (run.startedAt === null ? phase !== "intro" : run.pausedSince !== null);
  const goShowing = goAt !== null && Date.now() - goAt < 700;
  const now = useNow(running || goShowing || (run.feedback !== null && Date.now() - run.feedback.at < 3000));

  const begin = useCallback(() => {
    if (run.startedAt === null) start(true);
    else go();
    setPhase("brief");
    setGoAt(Date.now());
  }, [run.startedAt, start, go]);

  useEffect(() => {
    document.title = "Beat the Agent";
  }, []);

  useEffect(() => {
    if (!rec && run.finishedAt !== null) recordBest(seed, toResult(run).totalMs);
  }, [rec, seed, run]);

  // Agent recordings start the clock right away. Before paint, so the intro never flashes. A resumed
  // run keeps its original start time.
  useLayoutEffect(() => {
    if (autoStart && rec) start();
  }, [autoStart, rec, start]);

  if (run.startedAt === null && !briefing) {
    return (
      <div className="game">
        <Intro ch={ch} ghost={ghost} onStart={rec ? start : () => setPhase("brief")} />
      </div>
    );
  }

  const result = toResult(run);

  const overlay = ended ? (
    <div className="finish" role="dialog" aria-label="Run complete">
      <div className="finish-card">
        {!ghost && <div className="finish-kicker">{run.finishedAt ? "Challenge complete" : "Run ended"}</div>}
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
  ) : briefing ? (
    phase === "count" ? (
      <Countdown onDone={begin} />
    ) : (
      <Briefing ch={ch} run={run} ghost={ghost} onReady={() => setPhase("count")} />
    )
  ) : goShowing ? (
    <GoFlash />
  ) : null;

  return (
    <>
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
      {agentRun && running && <GhostCursor agent={agentRun} run={run} />}
    </>
  );
}
