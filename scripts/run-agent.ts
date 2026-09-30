/**
 * Records genuine agent runs for Beat the Agent.
 *
 *   npm run agent:run -- --seeds 7K3QX,M4PZ2 [--model gpt-6.1-sol] [--effort low|medium|high]
 *   npm run agent:run -- --count 3
 *
 * Pipeline per seed:
 *   1. Serve dist/ locally with a trace collector and expose it via a Cloudflare quick tunnel
 *      (the hosted browser can't reach localhost).
 *   2. Create an Agents API session with the `computer_use` tool in an OpenAI-hosted environment
 *      whose network is restricted to the tunnel host; approve only that origin.
 *   3. Ask the agent to open /#/play/<seed>?rec=<token> and finish the challenge. The page itself
 *      logs every click/action/submission and POSTs the log to the collector.
 *   4. Save the page log, the API's computer_use_call activity + screenshots, token usage and an
 *      estimated cost to public/runs/<seed>/run.json, and update public/runs/index.json.
 */
import OpenAI from "openai";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { startServer, type TraceBody } from "./server";
import { generateChallenge } from "../src/challenge/generate";
import { deriveRun, elapsedAt, type RunEvent } from "../src/game/run";
import type { AgentRun, RunIndex, RunSummary } from "../src/game/agentRuns";
import { randomSeed } from "../src/lib/rng";

const { values: args } = parseArgs({
  options: {
    seeds: { type: "string" },
    count: { type: "string", default: "1" },
    model: { type: "string", default: "gpt-6.1-sol" },
    effort: { type: "string" },
    "timeout-min": { type: "string", default: "25" },
    "max-nudges": { type: "string", default: "2" },
    "skip-build": { type: "boolean", default: false },
    "public-url": { type: "string" }, // use an existing public URL that proxies to this machine instead of a quick tunnel
    port: { type: "string", default: "4870" },
    feature: { type: "string" },
  },
});

// Standard per-1M-token prices (USD), from https://developers.openai.com/api/docs/pricing (checked 2026-09-30).
const PRICES: Record<string, { label: string; input: number; cached: number; output: number }> = {
  "gpt-6.1-sol": { label: "GPT-6.1 Sol", input: 2.0, cached: 0.1, output: 10.0 },
  "gpt-6-astra": { label: "GPT-6 Astra", input: 10.0, cached: 1.0, output: 50.0 },
  "gpt-6-sol": { label: "GPT-6 Sol", input: 2.0, cached: 0.2, output: 10.0 },
  "gpt-6-luna": { label: "GPT-6 Luna", input: 0.1, cached: 0.01, output: 0.5 },
};
// Hosted environments bill at container rates: 4 GB (default "medium") is $0.12 per 20 minutes,
// billed by the minute with a 5-minute minimum.
const CONTAINER_PER_MIN = 0.12 / 20;

const OUT = "public/runs";
const client = new OpenAI();
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ tunnel

async function openTunnel(port: number): Promise<{ url: string; proc: ChildProcess | null }> {
  if (args["public-url"]) return { url: args["public-url"].replace(/\/$/, ""), proc: null };
  const bin = process.env.CLOUDFLARED ?? "cloudflared";
  const proc = spawn(bin, ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url", `http://127.0.0.1:${port}`], { stdio: ["ignore", "pipe", "pipe"] });
  const url = await new Promise<string>((ok, fail) => {
    const timer = setTimeout(() => fail(new Error("cloudflared did not print a tunnel URL within 60s")), 60_000);
    const onData = (buf: Buffer) => {
      const m = buf.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) {
        clearTimeout(timer);
        ok(m[0]);
      }
    };
    proc.stdout!.on("data", onData);
    proc.stderr!.on("data", onData);
    proc.on("exit", (code) => fail(new Error(`cloudflared exited (${code}). Is it installed? See README.`)));
  });
  log("tunnel", url, "— waiting for it to become reachable");
  for (let i = 0; i < 60; i++) {
    const ok = await fetch(`${url}/`, { method: "HEAD" }).then((r) => r.ok).catch(() => false);
    if (ok) return { url, proc };
    await sleep(3000);
  }
  proc.kill();
  throw new Error("Tunnel never became reachable");
}

// ------------------------------------------------------------------ prompts

const INSTRUCTIONS = `You are competing in "Beat the Agent", a timed browser game where your time is compared with human players.
Use the browser to complete the challenge on the given page as quickly and accurately as you can.
The store, calendar, and spreadsheet on the page are simulated test apps. You are authorized to add items to the cart, place the order, save the calendar change, and edit and submit the spreadsheet. Nothing is real and no money is spent.
The user is not watching, so do not stop to ask questions or for confirmation. Stay on the given page.`;

const taskFor = (url: string) =>
  `Open ${url} in the browser. Press "Start challenge" and complete all three stages by following the on-page instructions. The run is over when the page shows "Challenge complete". Then reply with the final time shown on the page.`;

// ------------------------------------------------------------------ one run

type Trace = { body: TraceBody; receivedAt: number };

async function recordRun(seed: string, base: string, traces: Map<string, Trace | null>): Promise<AgentRun | null> {
  const model = args.model!;
  const price = PRICES[model];
  const token = randomBytes(9).toString("hex");
  traces.set(token, null);
  const host = new URL(base).host;
  const url = `${base}/#/play/${seed}?rec=${token}`;
  const dir = join(OUT, seed);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "shots"), { recursive: true });

  const task = taskFor(url.replace(token, "<recording-token>"));
  const created = Date.now();
  const session = await client.beta.agents.sessions.create({
    agent: {
      model,
      instructions: INSTRUCTIONS,
      tools: [{ type: "computer_use", include_screenshots: true }],
      ...(args.effort ? { reasoning: { effort: args.effort as "low" } } : {}),
    },
    environment: {
      type: "openai_hosted",
      desktop: { enabled: true },
      network: { access: "restricted", allowed_domains: [host] },
    },
    metadata: { app: "beat-the-agent", seed },
  } as never);
  log(seed, "session", session.id);

  const activity: { local: number; title: string; status: string; shot: string | null }[] = [];
  const messages: { local: number; text: string }[] = [];
  let envReadyAt: number | null = null;
  let shots = 0;
  let nudges = 0;
  const handled = new Set<string>();
  const deadline = created + Number(args["timeout-min"]) * 60_000;
  const pageDone = () => {
    const t = traces.get(token);
    if (!t) return false;
    const ev = t.body.events as RunEvent[];
    return ev.some((e) => e.k === "giveup") || ev.filter((e) => e.k === "submit" && e.ok).length >= 3;
  };

  const send = (text: string) =>
    client.beta.agents.sessions.events.create(session.id, {
      events: [{ type: "agent.session.input.message", input: [{ role: "user", content: [{ type: "input_text", text }] }] }],
    } as never);

  const events = await client.beta.agents.sessions.events.stream(session.id);
  let outcome = "failed" as "completed" | "failed" | "cancelled" | "timeout";
  const watchdog = setInterval(async () => {
    if (Date.now() > deadline) {
      log(seed, "timeout — cancelling turn");
      outcome = "timeout";
      await client.beta.agents.sessions.events.create(session.id, { events: [{ type: "agent.session.input.cancel" }] } as never).catch(() => {});
      setTimeout(() => events.controller.abort(), 15_000);
    }
  }, 5000);
  try {
    await send(taskFor(url));
    for await (const raw of events as AsyncIterable<any>) {
      const ev = raw as any;
      const now = Date.now();
      if (ev.type === "agent.session.environment.ready") envReadyAt ??= now;
      if (ev.type === "agent.session.turn.item.done" && ev.item?.type === "computer_use_call") {
        let shot: string | null = null;
        const img: string | undefined = ev.item.output?.image_url;
        if (img?.startsWith("data:image/jpeg;base64,")) {
          shot = `shots/${String(++shots).padStart(3, "0")}.jpg`;
          writeFileSync(join(dir, shot), Buffer.from(img.split(",", 2)[1], "base64"));
        }
        activity.push({ local: now, title: ev.item.title ?? "Browser activity", status: ev.item.status, shot });
        log(seed, "·", ev.item.title, ev.item.status, shot ? "📷" : "");
      }
      if (ev.type === "agent.session.turn.output_text.done") {
        messages.push({ local: now, text: ev.text });
        log(seed, "💬", ev.text.slice(0, 160));
      }
      if (ev.type === "agent.session.requires_action") {
        const cur: any = await client.beta.agents.sessions.retrieve(session.id);
        for (const a of cur.required_actions ?? []) {
          const id = a.request_id ?? a.call_id;
          if (!id || handled.has(id)) continue;
          handled.add(id);
          if (a.type !== "computer_use_approval_request") continue;
          const response =
            a.request.type === "browser_origin_access"
              ? { type: "browser_origin_access", decision: new URL(a.request.origin).host === host ? "approve" : "deny" }
              : { type: "browser_authentication", action: "cancel" };
          log(seed, "approval", a.request.type, a.request.origin ?? "", JSON.stringify(response));
          await client.beta.agents.sessions.events.create(session.id, {
            events: [{ type: "agent.session.input.computer_use_approval_request_result", request_id: a.request_id, response }],
          } as never);
        }
      }
      if (["error", "agent.session.failed", "agent.session.environment.failed"].includes(ev.type)) {
        log(seed, "lifecycle failure", JSON.stringify(ev).slice(0, 600));
        outcome = "failed";
        break;
      }
      if (/^agent\.session\.turn\.(completed|failed|cancelled)$/.test(ev.type) && ev.turn?.subagent_id == null) {
        outcome = ev.type.split(".").pop() as typeof outcome;
        await sleep(2500); // let the page's final trace flush land
        if (outcome === "completed" && !pageDone() && nudges < Number(args["max-nudges"]) && Date.now() < deadline) {
          nudges++;
          log(seed, `turn ended early — nudge ${nudges}`);
          await send(`The challenge is not complete yet. Continue in the browser until the page shows "Challenge complete".`);
          continue;
        }
        break;
      }
    }
  } finally {
    clearInterval(watchdog);
    events.controller.abort();
  }
  await sleep(3000);

  // Usage is best-effort and can arrive after the turn ends; poll briefly.
  let usage: AgentRun["usage"] = null;
  for (let i = 0; i < 12; i++) {
    const turns: any[] = [];
    for await (const t of client.beta.agents.sessions.turns.list(session.id, { limit: 50 } as never) as AsyncIterable<any>) turns.push(t);
    const withUsage = turns.filter((t) => t.usage);
    if (turns.length && withUsage.length === turns.length) {
      usage = { input_tokens: 0, cached_tokens: 0, output_tokens: 0, reasoning_tokens: 0 };
      for (const t of withUsage) {
        usage.input_tokens += t.usage.input_tokens ?? 0;
        usage.cached_tokens += t.usage.input_tokens_details?.cached_tokens ?? 0;
        usage.output_tokens += t.usage.output_tokens ?? 0;
        usage.reasoning_tokens += t.usage.output_tokens_details?.reasoning_tokens ?? 0;
      }
      break;
    }
    await sleep(5000);
  }
  const sessionMs = Date.now() - created;
  const final = await client.beta.agents.sessions.retrieve(session.id).catch(() => null);
  if (!usage && (final as any)?.usage) {
    const u = (final as any).usage;
    usage = {
      input_tokens: u.input_tokens ?? 0,
      cached_tokens: u.input_tokens_details?.cached_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0,
    };
  }
  await client.beta.agents.sessions.delete(session.id).catch((e) => log(seed, "delete failed", String(e)));

  const trace = traces.get(token);
  traces.delete(token);
  if (!trace) {
    log(seed, `no page trace received (outcome: ${outcome}) — the agent never loaded the page`);
    return null;
  }
  const pageEvents = trace.body.events as RunEvent[];
  const ch = generateChallenge(seed);
  const derived = deriveRun(ch, pageEvents);
  // page clock → local clock (includes network latency; good to ~100ms)
  const offset = trace.receivedAt - trace.body.sentAt;
  const pageStart = derived.startedAt ?? pageEvents[0].at;
  const rel = (local: number) => Math.round(local - offset - pageStart);
  const load = pageEvents.find((e) => e.k === "load") as Extract<RunEvent, { k: "load" }> | undefined;

  const modelCost = usage && price ? ((usage.input_tokens - usage.cached_tokens) * price.input + usage.cached_tokens * price.cached + usage.output_tokens * price.output) / 1e6 : null;
  const container = Math.max(5, sessionMs / 60_000) * CONTAINER_PER_MIN;
  const notes = [
    usage
      ? `Model cost = reported token usage × ${price?.label ?? model} standard rates ($${price?.input}/1M input, $${price?.cached}/1M cached, $${price?.output}/1M output).`
      : "The Agents API did not report token usage for this session, so model cost is unknown.",
    `Hosted environment estimated at container rates: $${container.toFixed(3)} for ${(sessionMs / 60000).toFixed(1)} min.`,
    "Usage fields don't expose cache writes, so cache-write charges (if any) aren't included.",
  ];
  const totalMs = Math.round(elapsedAt(derived, derived.finishedAt ?? derived.gaveUpAt ?? pageEvents[pageEvents.length - 1].at));
  const run: AgentRun = {
    seed,
    model,
    modelLabel: price?.label ?? model,
    reasoningEffort: args.effort ?? null,
    recordedAt: new Date(created).toISOString(),
    finished: derived.finishedAt !== null,
    stagesCleared: derived.splits.length,
    splits: derived.splits.map(Math.round),
    totalMs,
    penalties: derived.penalties,
    costUsd: modelCost !== null ? +(modelCost + container).toFixed(4) : null,
    costBasis: usage ? "reported-usage" : "unavailable",
    sessionId: session.id,
    prompt: { instructions: INSTRUCTIONS, task },
    page: { vw: load?.vw ?? 1280, vh: load?.vh ?? 800, ua: load?.ua ?? "", startedAt: derived.startedAt },
    events: pageEvents,
    activity: activity.map((a) => ({ t: rel(a.local), title: a.title, status: a.status, shot: a.shot })),
    messages: messages.map((m) => ({ t: rel(m.local), text: m.text })),
    counts: {
      clicks: pageEvents.filter((e) => e.k === "ptr").length,
      actions: pageEvents.filter((e) => e.k === "act").length,
      browserCalls: activity.length,
      screenshots: shots,
      nudges,
    },
    timing: { sessionMs, envReadyMs: envReadyAt ? envReadyAt - created : null, pageLoadMs: load ? load.at + offset - created : null },
    usage,
    cost: { model: modelCost !== null ? +modelCost.toFixed(4) : null, container: +container.toFixed(4), total: modelCost !== null ? +(modelCost + container).toFixed(4) : null, notes },
  };
  writeFileSync(join(dir, "run.json"), JSON.stringify(run));
  log(
    seed,
    `saved — ${run.finished ? "finished" : `cleared ${run.stagesCleared}/3`} in ${(totalMs / 1000).toFixed(1)}s,`,
    `${run.counts.clicks} clicks, ${run.counts.browserCalls} browser calls, cost ${run.cost.total ?? "n/a"}`,
  );
  return run;
}

// ------------------------------------------------------------------ main

function updateIndex(runs: AgentRun[]) {
  const path = join(OUT, "index.json");
  const index: RunIndex = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { featured: null, runs: [] };
  for (const r of runs) {
    const summary: RunSummary = {
      seed: r.seed,
      model: r.model,
      modelLabel: r.modelLabel,
      recordedAt: r.recordedAt,
      finished: r.finished,
      stagesCleared: r.stagesCleared,
      splits: r.splits,
      totalMs: r.totalMs,
      penalties: r.penalties,
      costUsd: r.costUsd,
      costBasis: r.costBasis,
    };
    index.runs = [...index.runs.filter((x) => x.seed !== r.seed), summary];
  }
  index.runs.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  if (args.feature) index.featured = args.feature;
  writeFileSync(path, JSON.stringify(index, null, 2));
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY (e.g. in .env)");
  const seeds = args.seeds
    ? args.seeds.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : Array.from({ length: Number(args.count) }, () => randomSeed());
  if (!args["skip-build"]) {
    log("building…");
    execSync("npx vite build", { stdio: "inherit" });
  }
  mkdirSync(OUT, { recursive: true });
  const traces = new Map<string, Trace | null>();
  const port = Number(args.port);
  const server = await startServer({
    port,
    root: "dist",
    acceptToken: (t) => traces.has(t),
    onTrace: (token, body, receivedAt) => traces.set(token, { body, receivedAt }),
  });
  const tunnel = await openTunnel(port);
  const done: AgentRun[] = [];
  try {
    for (const seed of seeds) {
      log(`=== ${seed} (${args.model}) ===`);
      try {
        const run = await recordRun(seed, tunnel.url, traces);
        if (run) {
          done.push(run);
          updateIndex([run]);
        }
      } catch (err) {
        log(seed, "run failed:", err instanceof Error ? err.message : err);
      }
    }
  } finally {
    tunnel.proc?.kill();
    server.close();
  }
  log(`recorded ${done.length}/${seeds.length} run(s). Rebuild (npm run build) to publish them.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
