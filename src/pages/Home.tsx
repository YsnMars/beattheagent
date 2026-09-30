import { useEffect, useState } from "react";
import { clearCurrentSeed, currentSeed, nextSeed, useRunIndex } from "../game/agentRuns";
import { clearRun } from "../game/useRun";
import { Play } from "./Play";

/** The whole human experience: a challenge dealt in the background, ready to start. */
export function Home() {
  const index = useRunIndex();
  const [seed, setSeed] = useState(currentSeed);

  useEffect(() => {
    if (!seed && index) setSeed(nextSeed(index));
  }, [seed, index]);

  if (!seed) return <div className="game" />;
  return (
    <Play
      key={seed}
      seed={seed}
      rec={null}
      onNext={() => {
        clearRun(seed);
        clearCurrentSeed();
        setSeed(null);
      }}
    />
  );
}
