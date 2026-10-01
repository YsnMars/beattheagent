import { PENALTY_MS, type Rejection } from "../game/run";

/**
 * Why a submission was rejected, next to the button that submitted it. Each new rejection remounts it
 * (keyed by time), so it shakes again even when the reasons haven't changed.
 */
export function RejectionNote({ rejection: r }: { rejection: Rejection }) {
  return (
    <div className="inline-error" role="alert" key={r.at}>
      <div className="inline-error-head">
        <b>{r.title}</b>
        <span className="inline-error-pen">+{PENALTY_MS / 1000}s</span>
      </div>
      {r.problems.length === 1 && <p>{r.problems[0]}</p>}
      {r.problems.length > 1 && (
        <ul>
          {r.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
