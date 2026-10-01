import { Analytics } from "@vercel/analytics/react";
import { clearCurrentSeed, requestAutoStart } from "./game/agentRuns";
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
  let content;
  let analyticsRoute = "/";
  let analyticsPath = "/";

  // Direct links to a seed: used by the agent recorder (with `rec`) and for testing specific challenges.
  if (page === "play" && isValidSeed(seed)) {
    const leave = (autoStart: boolean) => {
      clearRun(seed);
      clearCurrentSeed();
      if (autoStart) requestAutoStart();
      navigate("/");
    };
    content = <Play key={seed + (query.get("rec") ?? "")} seed={seed} rec={query.get("rec")} onNext={() => leave(true)} onHome={() => leave(false)} />;
    analyticsRoute = "/play/[seed]";
    analyticsPath = `/play/${seed}`;
  } else if (page === "replay" && isValidSeed(seed)) {
    content = <Replay key={seed} seed={seed} />;
    analyticsRoute = "/replay/[seed]";
    analyticsPath = `/replay/${seed}`;
  } else {
    content = <Home />;
  }
  return (
    <>
      {content}
      <Analytics mode={import.meta.env.DEV ? "development" : "production"} route={analyticsRoute} path={analyticsPath} />
    </>
  );
}
