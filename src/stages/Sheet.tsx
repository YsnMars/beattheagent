import { SHEET_COLUMNS, type SheetChallenge } from "../challenge/types";
import type { SheetAction, SheetState } from "../game/state";
import type { Rejection } from "../game/run";
import { RejectionNote } from "../components/RejectionNote";
import { IconDedupe, IconGrid, IconReset, IconSortDown, IconSortUp, IconTrash, IconUndo } from "../components/Icons";

type Props = {
  ch: SheetChallenge;
  state: SheetState;
  dispatch: (a: SheetAction) => void;
  onSubmit: () => void;
  /** The latest rejection, while it still describes the current answer. */
  rejection: Rejection | null;
};

const LETTERS = "ABCDEFG";

/** How a column's sort buttons describe each direction. */
function sortLabels(kind: (typeof SHEET_COLUMNS)[number]["kind"]): [string, string] {
  return kind === "number" ? ["1→9", "9→1"] : kind === "date" ? ["Old→New", "New→Old"] : ["A→Z", "Z→A"];
}

/**
 * Gridly. Still a spreadsheet on a phone (the task is to use one): the grid scrolls sideways under
 * frozen row numbers and names, the formula bar reads out the row tapped last, the tools scroll in one
 * row, and Submit is docked at the bottom.
 */
export function Sheet({ ch, state, dispatch, onSubmit, rejection }: Props) {
  const byId = new Map(ch.rows.map((r) => [r.id, r]));
  const rows = state.rows.map((id) => byId.get(id)!);
  const allSelected = state.selected.length > 0 && state.selected.length === rows.length;
  const lastId = state.selected.at(-1);
  const activeIdx = lastId ? state.rows.indexOf(lastId) : -1;
  const active = activeIdx >= 0 ? { n: activeIdx + 1, row: rows[activeIdx] } : null;

  return (
    <div className="gridly">
      <header className="gl-top">
        <div className="gl-brand">
          <span className="gl-logo" aria-hidden>
            <IconGrid size={16} strokeWidth={2.4} />
          </span>
          Gridly
        </div>
        <div className="gl-file">customers.csv</div>
      </header>

      <div className="gl-toolbar">
        <button className="gl-tb" data-trace="sheet:delete" onClick={() => dispatch({ type: "delete" })} disabled={!state.selected.length}>
          <IconTrash size={17} />
          <span>
            Delete<span className="gl-tb-more"> selected</span>
          </span>
          {state.selected.length ? <span className="gl-tb-n">{state.selected.length}</span> : null}
        </button>
        <button className="gl-tb" data-trace="sheet:dedupe" onClick={() => dispatch({ type: "dedupeOpen", open: true })}>
          <IconDedupe size={17} />
          Remove duplicates…
        </button>
        <span className="gl-tb-sep" />
        <button className="gl-tb" data-trace="sheet:undo" onClick={() => dispatch({ type: "undo" })} disabled={!state.history.length}>
          <IconUndo size={17} />
          Undo
        </button>
        <button className="gl-tb" data-trace="sheet:reset" onClick={() => dispatch({ type: "reset" })}>
          <IconReset size={17} />
          Reset
        </button>
        <span className="gl-tb-grow" />
        <button className="gl-submit dock" data-trace="sheet:submit" onClick={onSubmit}>
          Submit sheet
        </button>
      </div>
      {(state.toast || rejection) && (
        <div className="gl-msgs">
          {state.toast && (
            <div className="gl-toast" key={state.toast + state.history.length} role="status">
              {state.toast}
            </div>
          )}
          {rejection && <RejectionNote rejection={rejection} />}
        </div>
      )}

      {/* The formula bar reads out the row tapped last: on a phone, the columns scrolled out of view. */}
      <div className="gl-fx">
        <span className="gl-namebox">{active ? `${active.n}:${active.n}` : ""}</span>
        <span className="gl-fx-mark">fx</span>
        <span className={`gl-fx-value${active ? "" : " gl-muted"}`}>
          {active ? SHEET_COLUMNS.map((c) => active.row[c.key]).join("  ·  ") : "Select a row to read it here"}
        </span>
      </div>

      <div className="gl-scroll" data-scroll="sheet">
        <table className="grid">
          <thead>
            <tr className="letters">
              <th className="corner" />
              {SHEET_COLUMNS.map((c, i) => (
                <th key={c.key} className={`c-${c.key}`}>
                  {LETTERS[i]}
                </th>
              ))}
            </tr>
            <tr className="names">
              <th className="rownum">
                <input
                  type="checkbox"
                  className="gl-check"
                  aria-label="Select all rows"
                  data-trace="sheet:all"
                  checked={allSelected}
                  onChange={() => dispatch({ type: "toggleAll" })}
                />
              </th>
              {SHEET_COLUMNS.map((c) => {
                const active = state.sort?.column === c.key ? state.sort.dir : null;
                const [ascLabel, descLabel] = sortLabels(c.kind);
                return (
                  <th key={c.key} className={`c-${c.key} ${active ? "sorted" : ""}`}>
                    <div className="colhead">
                      <span>{c.label}</span>
                      <span className="sortbtns">
                        <button
                          className={active === "asc" ? "on" : ""}
                          data-trace={`sheet:sort:${c.key}:asc`}
                          title={`Sort ${c.label} ${ascLabel}`}
                          aria-label={`Sort ${c.label} ${ascLabel}`}
                          aria-pressed={active === "asc"}
                          onClick={() => dispatch({ type: "sort", column: c.key, dir: "asc" })}
                        >
                          <IconSortUp size={15} strokeWidth={2.6} />
                        </button>
                        <button
                          className={active === "desc" ? "on" : ""}
                          data-trace={`sheet:sort:${c.key}:desc`}
                          title={`Sort ${c.label} ${descLabel}`}
                          aria-label={`Sort ${c.label} ${descLabel}`}
                          aria-pressed={active === "desc"}
                          onClick={() => dispatch({ type: "sort", column: c.key, dir: "desc" })}
                        >
                          <IconSortDown size={15} strokeWidth={2.6} />
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
                        className="gl-check"
                        data-trace={`sheet:check:${r.id}`}
                        checked={sel}
                        onChange={() => dispatch({ type: "toggle", id: r.id })}
                        aria-label={`Select row ${i + 1}`}
                      />
                      <span>{i + 1}</span>
                    </label>
                  </td>
                  <td className="c-name">{r.name}</td>
                  <td className="c-email mono">{r.email}</td>
                  <td className="c-company">{r.company}</td>
                  <td className="c-plan">{r.plan}</td>
                  <td className="c-seats num">{r.seats}</td>
                  <td className="c-updated mono">{r.updated}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="gl-foot">
        <span className="gl-tab">customers</span>
        <span className="gl-status">{state.selected.length ? `Count: ${state.selected.length}` : `${rows.length} rows`}</span>
      </div>

      {state.dedupeOpen && (
        <div className="gl-scrim" onClick={() => dispatch({ type: "dedupeOpen", open: false })}>
          <div className="gl-modal" role="dialog" aria-label="Remove duplicates" onClick={(e) => e.stopPropagation()} data-trace="sheet:dialog">
            <span className="gl-grip" aria-hidden />
            <h3>Remove duplicates</h3>
            <p className="gl-muted">
              Rows count as duplicates when <b>all</b> checked columns match. Letter case and surrounding spaces are ignored. The <b>first (top-most)</b> row of
              each group is kept; the rest are deleted.
            </p>
            <div className="gl-modal-cols">
              {SHEET_COLUMNS.map((c) => (
                <label key={c.key} className={`gl-modal-col ${state.dedupeCols.includes(c.key) ? "on" : ""}`}>
                  <input
                    type="checkbox"
                    className="gl-check"
                    data-trace={`sheet:dcol:${c.key}`}
                    checked={state.dedupeCols.includes(c.key)}
                    onChange={() => dispatch({ type: "dedupeCol", column: c.key })}
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="gl-modal-actions">
              <button className="gl-btn" data-trace="sheet:dcancel" onClick={() => dispatch({ type: "dedupeOpen", open: false })}>
                Cancel
              </button>
              <button className="gl-btn gl-btn-primary" data-trace="sheet:dapply" onClick={() => dispatch({ type: "dedupeApply" })}>
                Remove duplicates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
