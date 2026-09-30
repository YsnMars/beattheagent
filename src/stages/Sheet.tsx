import { SHEET_COLUMNS, type SheetChallenge } from "../challenge/types";
import type { SheetAction, SheetState } from "../game/state";

type Props = {
  ch: SheetChallenge;
  state: SheetState;
  dispatch: (a: SheetAction) => void;
  onSubmit: () => void;
  feedback: { ok: boolean; msg: string } | null;
};

const LETTERS = "ABCDEFG";

export function Sheet({ ch, state, dispatch, onSubmit, feedback }: Props) {
  const byId = new Map(ch.rows.map((r) => [r.id, r]));
  const rows = state.rows.map((id) => byId.get(id)!);
  const allSelected = state.selected.length > 0 && state.selected.length === rows.length;

  return (
    <div className="sheet">
      <div className="sheet-top">
        <div className="sheet-logo">
          <span className="sheet-logo-mark">▦</span> Gridly
        </div>
        <div className="sheet-file">customers.csv</div>
        <div className="sheet-count">{rows.length} rows</div>
      </div>

      <div className="sheet-toolbar">
        <button className="tb" data-trace="sheet:delete" onClick={() => dispatch({ type: "delete" })} disabled={!state.selected.length}>
          🗑 Delete selected{state.selected.length ? ` (${state.selected.length})` : ""}
        </button>
        <button className="tb" data-trace="sheet:dedupe" onClick={() => dispatch({ type: "dedupeOpen", open: true })}>
          ⧉ Remove duplicates…
        </button>
        <span className="tb-sep" />
        <button className="tb" data-trace="sheet:undo" onClick={() => dispatch({ type: "undo" })} disabled={!state.history.length}>
          ↶ Undo
        </button>
        <button className="tb" data-trace="sheet:reset" onClick={() => dispatch({ type: "reset" })}>
          Reset
        </button>
        <span className="tb-grow" />
        <button className="btn-sheet" data-trace="sheet:submit" onClick={onSubmit}>
          Submit sheet
        </button>
      </div>
      {(state.toast || (feedback && !feedback.ok)) && (
        <div className="sheet-msgs">
          {state.toast && <div className="sheet-toast">{state.toast}</div>}
          {feedback && !feedback.ok && <div className="inline-error">{feedback.msg}</div>}
        </div>
      )}

      <div className="sheet-scroll" data-scroll="sheet">
        <table className="grid">
          <thead>
            <tr className="letters">
              <th className="corner" />
              {SHEET_COLUMNS.map((c, i) => (
                <th key={c.key}>{LETTERS[i]}</th>
              ))}
            </tr>
            <tr className="names">
              <th className="rownum">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  data-trace="sheet:all"
                  checked={allSelected}
                  onChange={() => dispatch({ type: "toggleAll" })}
                />
              </th>
              {SHEET_COLUMNS.map((c) => {
                const active = state.sort?.column === c.key ? state.sort.dir : null;
                const [ascLabel, descLabel] = c.kind === "number" ? ["1→9", "9→1"] : c.kind === "date" ? ["Old→New", "New→Old"] : ["A→Z", "Z→A"];
                return (
                  <th key={c.key}>
                    <div className="colhead">
                      <span>{c.label}</span>
                      <span className="sortbtns">
                        <button
                          className={active === "asc" ? "on" : ""}
                          data-trace={`sheet:sort:${c.key}:asc`}
                          title={`Sort ${c.label} ${ascLabel}`}
                          aria-label={`Sort ${c.label} ${ascLabel}`}
                          onClick={() => dispatch({ type: "sort", column: c.key, dir: "asc" })}
                        >
                          ▲
                        </button>
                        <button
                          className={active === "desc" ? "on" : ""}
                          data-trace={`sheet:sort:${c.key}:desc`}
                          title={`Sort ${c.label} ${descLabel}`}
                          aria-label={`Sort ${c.label} ${descLabel}`}
                          onClick={() => dispatch({ type: "sort", column: c.key, dir: "desc" })}
                        >
                          ▼
                        </button>
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const sel = state.selected.includes(r.id);
              return (
                <tr key={r.id} className={sel ? "sel" : ""} data-trace={`sheet:row:${r.id}`} onClick={() => dispatch({ type: "toggle", id: r.id })}>
                  <td className="rownum">
                    <label onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        data-trace={`sheet:check:${r.id}`}
                        checked={sel}
                        onChange={() => dispatch({ type: "toggle", id: r.id })}
                        aria-label={`Select row ${i + 1}`}
                      />
                      <span>{i + 1}</span>
                    </label>
                  </td>
                  <td>{r.name}</td>
                  <td className="mono">{r.email}</td>
                  <td>{r.company}</td>
                  <td>{r.plan}</td>
                  <td className="num">{r.seats}</td>
                  <td className="mono">{r.updated}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {state.dedupeOpen && (
        <div className="modal-scrim" onClick={() => dispatch({ type: "dedupeOpen", open: false })}>
          <div className="modal" role="dialog" aria-label="Remove duplicates" onClick={(e) => e.stopPropagation()} data-trace="sheet:dialog">
            <h3>Remove duplicates</h3>
            <p className="muted small">
              Rows count as duplicates when <b>all</b> checked columns match. Letter case and surrounding spaces are ignored. The <b>first (top-most)</b> row of
              each group is kept; the rest are deleted.
            </p>
            <div className="modal-cols">
              {SHEET_COLUMNS.map((c) => (
                <label key={c.key} className="modal-col">
                  <input
                    type="checkbox"
                    data-trace={`sheet:dcol:${c.key}`}
                    checked={state.dedupeCols.includes(c.key)}
                    onChange={() => dispatch({ type: "dedupeCol", column: c.key })}
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="tb" data-trace="sheet:dcancel" onClick={() => dispatch({ type: "dedupeOpen", open: false })}>
                Cancel
              </button>
              <button className="btn-sheet" data-trace="sheet:dapply" onClick={() => dispatch({ type: "dedupeApply" })}>
                Remove duplicates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
