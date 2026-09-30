import { isValidSeed } from "./lib/rng";
import { useRoute } from "./lib/router";
import { Card } from "./pages/Card";
import { Landing } from "./pages/Landing";
import { Play } from "./pages/Play";
import { NotFound, Results } from "./pages/Results";
import { Replay } from "./pages/Replay";

export function App() {
  const { path, query } = useRoute();
  const [page, arg] = path;
  const seed = (arg ?? "").toUpperCase();

  if (page === "play" && isValidSeed(seed)) return <Play key={seed + (query.get("rec") ?? "")} seed={seed} rec={query.get("rec")} />;
  if (page === "replay" && isValidSeed(seed)) return <Replay key={seed} seed={seed} />;
  if (page === "results" && arg) return <Results key={arg} payload={arg} />;
  if (page === "c" && arg) return <Card key={arg} payload={arg} />;
  if (!page || page.startsWith("#")) return <Landing anchor={page?.slice(1)} />;
  return <NotFound what="page" />;
}
