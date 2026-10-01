import { useEffect, useRef, useState } from "react";
import { STAGES } from "../challenge/types";
import type { RunSummary } from "../game/agentRuns";
import { PENALTY_MS, stageTime, type RunResult } from "../game/run";
import { copyText } from "../lib/clipboard";
import { formatDuration, formatUsd, gap } from "../lib/format";
import { href } from "../lib/router";
import { IconCheck, IconPlay, IconReplay, IconShare } from "./Icons";
import { Lanes } from "./Lanes";

type Timed = Pick<RunResult, "finished" | "stagesCleared" | "splits" | "totalMs">;

const progress = (r: Timed) => (r.finished ? "all 3 done" : `${r.stagesCleared} of 3 done`);

/** The result in one plain sentence: the card's headline. */
export function takeaway(human: Timed, agent: RunSummary): string {
  if (human.finished && agent.finished) {
    const diff = human.totalMs - agent.totalMs;
    if (Math.abs(diff) < 100) return "You tied the agent.";
    if (diff < 0) return `You beat the agent by ${gap(-diff)}.`;
    const ratio = human.totalMs / agent.totalMs;
    return ratio >= 1.5 ? `The agent was ${ratio.toFixed(1)}× faster.` : `The agent was ${gap(diff)} faster.`;
  }
  if (!human.finished) {
    const where = STAGES[Math.min(human.stagesCleared, STAGES.length - 1)].title;
    const stopped = `You stopped on ${where} at ${formatDuration(human.totalMs)}.`;
    if (!agent.finished) return `${stopped} The agent stopped after ${agent.stagesCleared} of 3.`;
    return agent.totalMs <= human.totalMs
      ? `${stopped} The agent had finished by ${formatDuration(agent.totalMs)}.`
      : `${stopped} The agent finished in ${formatDuration(agent.totalMs)}.`;
  }
  return `You finished all three. The agent stopped after ${agent.stagesCleared} of 3.`;
}

/** Who took the race, as the stamp above the headline. */
function verdict(human: Timed, agent: RunSummary): { text: string; tone: "you" | "agent" | "even" } {
  if (!human.finished) return { text: "Did not finish", tone: "agent" };
  if (!agent.finished) return { text: "You win", tone: "you" };
  const diff = human.totalMs - agent.totalMs;
  if (Math.abs(diff) < 100) return { text: "Dead heat", tone: "even" };
  return diff < 0 ? { text: "You win", tone: "you" } : { text: "Agent wins", tone: "agent" };
}

/** A line to send with the challenge's link. */
function shareText(human: Timed, agent: RunSummary | null): string {
  if (!agent) return human.finished ? `I finished Beat the Agent in ${formatDuration(human.totalMs)}. How fast are you?` : "I took on Beat the Agent. How fast are you?";
  const vs = `(${formatDuration(human.totalMs)} vs ${formatDuration(agent.totalMs)})`;
  if (!human.finished) return `I took on ${agent.modelLabel} at Beat the Agent and cleared ${human.stagesCleared} of 3. Can you beat it?`;
  const diff = human.totalMs - agent.totalMs;
  if (diff < 0) return `I beat ${agent.modelLabel} by ${gap(-diff)} at Beat the Agent ${vs}. Can you?`;
  return `${agent.modelLabel} beat me by ${gap(diff)} at Beat the Agent ${vs}. Can you beat it?`;
}

/** You-vs-agent summary shown when a run ends. */
export function Outcome({ human, agent }: { human: RunResult; agent: RunSummary }) {
  const v = verdict(human, agent);
  const head = takeaway(human, agent);
  // Where a gave-up run stopped: time spent on that stage so far.
  const partial = human.finished ? null : human.totalMs - (human.splits[human.stagesCleared - 1] ?? 0);
  return (
    <div className="outcome">
      <span className={`stamp stamp-${v.tone}`}>{v.text}</span>
      <h2 className={`outcome-head ${head.length > 40 ? "long" : ""}`} data-testid="takeaway">
        {head}
      </h2>
      <div className="outcome-times">
        <div className="side you">
          <span className="side-label">
            <i className="dot dot-you" aria-hidden />
            You
          </span>
          <b data-testid="final-time">{formatDuration(human.totalMs)}</b>
          <small>{progress(human)}</small>
          {human.penalties > 0 && (
            <small className="side-bad">
              {human.penalties} wrong answer{human.penalties > 1 ? "s" : ""} (+{(human.penalties * PENALTY_MS) / 1000}s)
            </small>
          )}
        </div>
        <div className="side agent">
          <span className="side-label">
            <i className="dot dot-agent" aria-hidden />
            {agent.modelLabel}
          </span>
          <b>{formatDuration(agent.totalMs)}</b>
          <small>{progress(agent)}</small>
          <small data-testid="agent-cost">{agent.costUsd !== null ? `${formatUsd(agent.costUsd)} in API costs` : "API cost not reported"}</small>
        </div>
      </div>
      <Lanes
        interactive
        lanes={[
          { who: "you", label: "You", splits: human.splits, totalMs: human.totalMs, partialMs: partial },
          { who: "agent", label: agent.modelLabel, splits: agent.splits, totalMs: agent.totalMs },
        ]}
      />
      <Splits human={human} agent={agent} />
    </div>
  );
}

/** Stage by stage: the table view of the lanes, with the faster time on each marked. */
function Splits({ human, agent }: { human: RunResult; agent: RunSummary | null }) {
  return (
    <div className="outcome-splits" role="table" aria-label="Times by stage">
      <div className="osplit-head" role="row">
        <span role="columnheader">Stage</span>
        <span role="columnheader">You</span>
        {agent && <span role="columnheader">Agent</span>}
      </div>
      {STAGES.map((s, i) => {
        const h = stageTime(human.splits, i);
        const a = agent ? stageTime(agent.splits, i) : null;
        const stoppedHere = !human.finished && i === human.stagesCleared;
        const partial = stoppedHere ? human.totalMs - (human.splits[i - 1] ?? 0) : null;
        const youWon = !!agent && h !== null && (a === null || h < a);
        const agentWon = a !== null && (h === null || a < h);
        const wrong = human.attempts[i] ?? 0;
        return (
          <div className="osplit" key={s.id} data-testid={`split-${s.id}`} role="row">
            <span role="cell">
              <span className="osplit-n">{i + 1}</span>
              {s.title}
            </span>
            <span role="cell" className={youWon ? "win" : ""}>
              {youWon && <IconCheck size={13} strokeWidth={3} aria-label="faster" />}
              {h !== null ? gap(h) : partial !== null ? <em>stopped at {gap(partial)}</em> : "—"}
              {wrong > 0 && <i className="osplit-pen">+{(wrong * PENALTY_MS) / 1000}s</i>}
            </span>
            {agent && (
              <span role="cell" className={agentWon ? "win" : ""}>
                {agentWon && <IconCheck size={13} strokeWidth={3} aria-label="faster" />}
                {a === null ? "—" : gap(a)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

type FinishProps = {
  human: RunResult;
  agent: RunSummary | null;
  seed: string;
  /** An agent recording: just the result, no ways onward. */
  recording: boolean;
  onNext: () => void;
  onHome: () => void;
};

/**
 * The end of a run. Racing a recorded agent, it's the you-vs-agent result; otherwise your time on its own.
 * A full-height sheet on phones with the ways onward pinned under the thumb.
 */
export function Finish({ human, agent, seed, recording, onNext, onHome }: FinishProps) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    card.current?.focus();
  }, []);
  return (
    <div className="finish sheet-scrim" role="dialog" aria-label="Run complete">
      <div className="sheet finish-card" ref={card} tabIndex={-1}>
        <div className="finish-body">
          {agent ? (
            <Outcome human={human} agent={agent} />
          ) : (
            <div className="solo">
              <div className={`eyebrow finish-kicker ${human.finished ? "" : "ended"}`}>{human.finished ? "Challenge complete" : "Run ended"}</div>
              <div className="finish-time" data-testid="final-time">
                {formatDuration(human.totalMs)}
              </div>
              <div className="finish-sub">
                {human.stagesCleared}/3 stages
                {human.penalties > 0 && ` · ${human.penalties} wrong answer${human.penalties > 1 ? "s" : ""}`}
              </div>
              {human.splits.length > 0 && <Splits human={human} agent={null} />}
            </div>
          )}
        </div>
        {!recording && (
          <div className="finish-actions">
            {agent && (
              <a className="btn btn-go btn-lg" href={href(`/replay/${seed}`)} data-testid="watch-agent">
                <IconPlay size={15} />
                Watch how the agent did it
              </a>
            )}
            <div className="finish-row">
              <button className={`btn btn-lg ${agent ? "btn-quiet" : "btn-go"}`} onClick={onNext} data-testid="next">
                <IconReplay size={18} />
                Try again
              </button>
              <ShareButton text={shareText(human, agent)} seed={agent ? seed : null} />
            </div>
            <button className="btn-text finish-home" onClick={onHome} data-testid="home">
              Back to start
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The phone's share sheet where there is one; otherwise the line and link go to the clipboard. */
function ShareButton({ text, seed }: { text: string; seed: string | null }) {
  const [copied, setCopied] = useState(false);
  // A recorded challenge links straight to itself, so a friend races the same agent run.
  const url = `${location.origin}${location.pathname}${seed ? `#/play/${seed}` : ""}`;
  const share = async () => {
    const data = { title: "Beat the Agent", text, url };
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {
        // Closing the sheet is a choice; anything else (a permissions policy, a webview) falls through to copying.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    const line = `${text} ${url}`;
    if (await copyText(line)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      // No share sheet and no clipboard: hand over the line to copy by hand.
      window.prompt("Copy this link to share it", line);
    }
  };
  return (
    <button className="btn btn-quiet btn-lg" onClick={share} aria-live="polite">
      {copied ? <IconCheck size={18} /> : <IconShare size={18} />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
