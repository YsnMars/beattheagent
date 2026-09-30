import { clearCurrentSeed } from "./game/agentRuns";
import { clearRun } from "./game/useRun";
import { isValidSeed } from "./lib/rng";
import { navigate, useRoute } from "./lib/router";
import { Home } from "./pages/Home";
import { Play } from "./pages/Play";
import { Replay } from "./pages/Replay";

export function App() {
  const { path, query } = useRoute();
  const [page, arg] = path;
  const seed = (arg ?? "").toUpperCase();

  // Direct links to a seed: used by the agent recorder (with `rec`) and for testing specific challenges.
  if (page === "play" && isValidSeed(seed)) {
    const next = () => {
      clearRun(seed);
      clearCurrentSeed();
      navigate("/");
    };
    return <Play key={seed + (query.get("rec") ?? "")} seed={seed} rec={query.get("rec")} onNext={next} />;
  }
  if (page === "replay" && isValidSeed(seed)) return <Replay key={seed} seed={seed} />;
  return <Home />;
}
