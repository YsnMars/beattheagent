import { useEffect, useState } from "react";
import { clearCurrentSeed, currentSeed, nextSeed, takeAutoStart, useRunIndex } from "../game/agentRuns";
import { clearRun } from "../game/useRun";
import { Play } from "./Play";

/**
 * The whole human experience: a challenge dealt in the background, ready to start. "Try again"
 * deals the next one and starts its clock straight away.
 */
export function Home() {
  const index = useRunIndex();
  const [seed, setSeed] = useState(currentSeed);
  const [go, setGo] = useState(takeAutoStart);

  useEffect(() => {
    if (!seed && index) setSeed(nextSeed(index));
  }, [seed, index]);

  if (!seed) return <div className="game" />;
  return (
    <Play
      key={seed}
      seed={seed}
      rec={null}
      autoStart={go}
      onNext={() => {
        clearRun(seed);
        clearCurrentSeed();
        setGo(true);
        setSeed(null);
      }}
    />
  );
}
