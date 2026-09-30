import { STAGES, type Challenge } from "../challenge/types";
import { formatDuration } from "../lib/format";
import { PENALTY_MS } from "../game/run";
import type { RunSummary } from "../game/agentRuns";

type Props = {
  ch: Challenge;
  onStart?: () => void;
  ghost?: RunSummary | null;
};

export const RULES = [
  "Three stages in a row: Shopping → Calendar → Spreadsheet.",
  "One timer runs across the whole challenge, starting when you press Start.",
  "Each stage is checked when you submit it. You advance only when it's correct.",
  `A rejected submission adds ${PENALTY_MS / 1000} seconds to your time.`,
  "The store, calendar, and spreadsheet are simulated. Nothing real is bought or sent.",
];

export function Intro({ ch, onStart, ghost }: Props) {
  return (
    <div className="intro">
      <div className="intro-card">
        <div className="intro-kicker">Challenge #{ch.seed}</div>
        <h1 className="intro-title">Three tasks. One clock.</h1>
        <p className="intro-sub">Every player and the AI agent get exactly this challenge: the same products, calendars, and spreadsheet, generated from seed {ch.seed}.</p>
        <ol className="intro-stages">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <span className="intro-stage-num">{i + 1}</span>
              <div>
                <b>{s.title}</b>
                <span>{s.blurb}</span>
              </div>
            </li>
          ))}
        </ol>
        <ul className="intro-rules">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {ghost && (
          <div className="intro-ghost">
            <span className="ghost-chip">{ghost.modelLabel}</span>
            {ghost.finished ? (
              <>
                finished this challenge in <b>{formatDuration(ghost.totalMs)}</b>
              </>
            ) : (
              <>
                cleared <b>{ghost.stagesCleared} of 3</b> stages
              </>
            )}
            . Its progress appears live beside your timer.
          </div>
        )}
        <button className="btn-primary btn-xl" data-trace="intro:start" onClick={onStart}>
          Start challenge
        </button>
      </div>
    </div>
  );
}
