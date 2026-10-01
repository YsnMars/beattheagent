import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { generateChallenge } from "../challenge/generate";
import { GameScreen } from "../components/GameScreen";
import { Intro } from "../components/Intro";
import { Finish } from "../components/Outcome";
import { Briefing, Countdown, GhostCursor, GoFlash } from "../components/Race";
import { useAgentRun, useAgentSummary } from "../game/agentRuns";
import { recordBest } from "../game/bests";
import { toResult } from "../game/run";
import { useNow, useRun } from "../game/useRun";
import { buzz } from "../lib/haptics";

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

  // A tap of feedback on phones that have it: a short one for a cleared stage, a double for a penalty.
  // Keyed on the verdict's time, so only one that just arrived buzzes, not one restored by a reload.
  const verdict = run.feedback;
  useEffect(() => {
    if (!rec && verdict && Date.now() - verdict.at < 1000) buzz(verdict.ok ? 25 : [35, 60, 35]);
  }, [rec, verdict?.at]);

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
    <Finish human={result} agent={ghost} seed={seed} recording={!!rec} onNext={onNext} onHome={onHome} />
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
