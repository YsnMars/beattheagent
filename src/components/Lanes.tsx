import type { CSSProperties } from "react";
import { STAGES } from "../challenge/types";
import { stageTime } from "../game/run";
import { gap } from "../lib/format";

export type Lane = {
  who: "you" | "agent";
  label: string;
  /** Cumulative times at each cleared stage. */
  splits: number[];
  /** Shown at the lane's end; null for a lane that hasn't run yet. */
  totalMs: number | null;
  /** Time spent on the stage where a run stopped (gave up), drawn after the cleared ones. */
  partialMs?: number | null;
};

/**
 * The race as two lanes, one per racer, each split into its stages: how far behind or ahead you were,
 * and where the time went. One scale for both lanes, so their lengths compare directly. Identity is
 * the swatch and the label (never the bar color alone); the per-stage numbers live in the tooltips and
 * in the splits table each view puts beside it.
 */
export function Lanes({ lanes, interactive = false }: { lanes: Lane[]; interactive?: boolean }) {
  const ends = lanes.map((l) => (l.splits.at(-1) ?? 0) + (l.partialMs ?? 0));
  const scale = Math.max(1, ...ends);
  return (
    <figure className="lanes">
      {lanes.map((l) => {
        const segs = l.splits.map((_, i) => ({ i, ms: stageTime(l.splits, i)!, partial: false }));
        if (l.partialMs) segs.push({ i: l.splits.length, ms: l.partialMs, partial: true });
        const summary = segs.map((s) => `${STAGES[s.i].title} ${gap(s.ms)}${s.partial ? " (stopped)" : ""}`).join(", ");
        return (
          <div className={`lane lane-${l.who}`} key={l.who}>
            <div className="lane-head">
              <span className="lane-label">
                <i className="lane-swatch" aria-hidden />
                {l.label}
              </span>
              <b className="lane-total">{l.totalMs === null ? "—" : gap(l.totalMs)}</b>
            </div>
            <div className="lane-track" role="img" aria-label={`${l.label}: ${summary || "no time yet"}`}>
              {segs.map((s) => {
                const tip = `${STAGES[s.i].title} · ${gap(s.ms)}${s.partial ? " · stopped" : ""}`;
                return (
                  <span
                    key={s.i}
                    className={`lane-seg${s.partial ? " partial" : ""}`}
                    // Each segment gives back the 2px gap after it (see .lane-seg), so a full lane spans the track.
                    style={{ "--w": `${(s.ms / scale) * 100}%` } as CSSProperties}
                    data-tip={tip}
                    tabIndex={interactive ? 0 : undefined}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </figure>
  );
}
