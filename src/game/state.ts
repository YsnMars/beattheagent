// All in-stage UI state lives in reducers so a recorded action log can be replayed exactly.
import type { Challenge, SheetColumn, SheetSortRule } from "../challenge/types";
import { removeDuplicates, sortRows } from "../challenge/validate";

export type ShopSort = "featured" | "price-asc" | "price-desc" | "rating" | "delivery";

export type ShopState = {
  query: string;
  sort: ShopSort;
  maxPrice: string; // raw input text
  minRating: number; // 0 = any
  arriveBy: number; // 0 = any, else day number
  cart: string[];
  cartOpen: boolean;
  detail: string | null;
};

export type ShopAction =
  | { type: "query"; value: string }
  | { type: "sort"; value: ShopSort }
  | { type: "maxPrice"; value: string }
  | { type: "minRating"; value: number }
  | { type: "arriveBy"; value: number }
  | { type: "clearFilters" }
  | { type: "add"; id: string }
  | { type: "remove"; id: string }
  | { type: "cart"; open: boolean }
  | { type: "detail"; id: string | null };

export type CalState = {
  pick: { dayIndex: number; startMin: number } | null;
  mobileDay: number;
  hidden: string[]; // attendee ids hidden from the grid
};

export type CalAction =
  | { type: "pick"; dayIndex: number; startMin: number }
  | { type: "pickDay"; dayIndex: number }
  | { type: "pickStart"; startMin: number }
  | { type: "mobileDay"; dayIndex: number }
  | { type: "toggleAttendee"; id: string };

export type SheetState = {
  rows: string[];
  selected: string[];
  history: string[][];
  sort: SheetSortRule | null;
  dedupeOpen: boolean;
  dedupeCols: SheetColumn[];
  toast: string | null;
};

export type SheetAction =
  | { type: "toggle"; id: string }
  | { type: "toggleAll" }
  | { type: "delete" }
  | { type: "sort"; column: SheetColumn; dir: "asc" | "desc" }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "dedupeOpen"; open: boolean }
  | { type: "dedupeCol"; column: SheetColumn }
  | { type: "dedupeApply" };

export type StageStates = { shopping: ShopState; calendar: CalState; sheet: SheetState };
export type AnyAction = ShopAction | CalAction | SheetAction;

export function initialStates(ch: Challenge): StageStates {
  return {
    shopping: { query: "", sort: "featured", maxPrice: "", minRating: 0, arriveBy: 0, cart: [], cartOpen: false, detail: null },
    calendar: { pick: null, mobileDay: 0, hidden: [] },
    sheet: {
      rows: ch.sheet.rows.map((r) => r.id),
      selected: [],
      history: [],
      sort: null,
      dedupeOpen: false,
      dedupeCols: [],
      toast: null,
    },
  };
}

export function shopReducer(s: ShopState, a: ShopAction): ShopState {
  switch (a.type) {
    case "query":
      return { ...s, query: a.value };
    case "sort":
      return { ...s, sort: a.value };
    case "maxPrice":
      return { ...s, maxPrice: a.value.replace(/[^0-9.]/g, "").slice(0, 7) };
    case "minRating":
      return { ...s, minRating: a.value };
    case "arriveBy":
      return { ...s, arriveBy: a.value };
    case "clearFilters":
      return { ...s, query: "", maxPrice: "", minRating: 0, arriveBy: 0 };
    case "add":
      return s.cart.includes(a.id) ? { ...s, cartOpen: true, detail: null } : { ...s, cart: [...s.cart, a.id], cartOpen: true, detail: null };
    case "remove":
      return { ...s, cart: s.cart.filter((id) => id !== a.id) };
    case "cart":
      return { ...s, cartOpen: a.open, detail: null };
    case "detail":
      return { ...s, detail: a.id };
  }
}

export function calReducer(s: CalState, a: CalAction): CalState {
  switch (a.type) {
    case "pick":
      return { ...s, pick: { dayIndex: a.dayIndex, startMin: a.startMin }, mobileDay: a.dayIndex };
    case "pickDay":
      return { ...s, pick: { dayIndex: a.dayIndex, startMin: s.pick?.startMin ?? 9 * 60 }, mobileDay: a.dayIndex };
    case "pickStart":
      return { ...s, pick: { dayIndex: s.pick?.dayIndex ?? s.mobileDay, startMin: a.startMin } };
    case "mobileDay":
      return { ...s, mobileDay: a.dayIndex };
    case "toggleAttendee":
      return { ...s, hidden: s.hidden.includes(a.id) ? s.hidden.filter((x) => x !== a.id) : [...s.hidden, a.id] };
  }
}

export function makeSheetReducer(ch: Challenge) {
  const byId = new Map(ch.sheet.rows.map((r) => [r.id, r]));
  const rowsOf = (ids: string[]) => ids.map((id) => byId.get(id)!);
  return function sheetReducer(s: SheetState, a: SheetAction): SheetState {
    const commit = (rows: string[], toast: string | null, extra: Partial<SheetState> = {}): SheetState => ({
      ...s,
      history: [...s.history, s.rows].slice(-50),
      rows,
      selected: s.selected.filter((id) => rows.includes(id)),
      toast,
      ...extra,
    });
    switch (a.type) {
      case "toggle":
        return { ...s, toast: null, selected: s.selected.includes(a.id) ? s.selected.filter((x) => x !== a.id) : [...s.selected, a.id] };
      case "toggleAll":
        return { ...s, toast: null, selected: s.selected.length === s.rows.length ? [] : [...s.rows] };
      case "delete": {
        if (!s.selected.length) return { ...s, toast: "Select rows to delete first." };
        const n = s.selected.length;
        return commit(
          s.rows.filter((id) => !s.selected.includes(id)),
          `Deleted ${n} row${n > 1 ? "s" : ""}.`,
          { selected: [] },
        );
      }
      case "sort": {
        const rule = { column: a.column, dir: a.dir };
        return commit(
          sortRows(rowsOf(s.rows), rule).map((r) => r.id),
          null,
          { sort: rule },
        );
      }
      case "undo": {
        if (!s.history.length) return { ...s, toast: "Nothing to undo." };
        const prev = s.history[s.history.length - 1];
        return { ...s, rows: prev, history: s.history.slice(0, -1), selected: [], sort: null, toast: "Undone." };
      }
      case "reset":
        return { ...initialStates(ch).sheet, toast: "Sheet reset to the original data." };
      case "dedupeOpen":
        return { ...s, dedupeOpen: a.open, toast: null };
      case "dedupeCol":
        return {
          ...s,
          dedupeCols: s.dedupeCols.includes(a.column) ? s.dedupeCols.filter((c) => c !== a.column) : [...s.dedupeCols, a.column],
        };
      case "dedupeApply": {
        if (!s.dedupeCols.length) return { ...s, toast: "Choose at least one column." };
        const kept = removeDuplicates(rowsOf(s.rows), s.dedupeCols).map((r) => r.id);
        const removed = s.rows.length - kept.length;
        return commit(kept, removed ? `Removed ${removed} duplicate row${removed > 1 ? "s" : ""}; kept the first of each.` : "No duplicates found.", {
          dedupeOpen: false,
        });
      }
    }
  };
}

export type StageKey = keyof StageStates;

export function applyAction(ch: Challenge, states: StageStates, stage: StageKey, action: AnyAction, sheetReducer = makeSheetReducer(ch)): StageStates {
  switch (stage) {
    case "shopping":
      return { ...states, shopping: shopReducer(states.shopping, action as ShopAction) };
    case "calendar":
      return { ...states, calendar: calReducer(states.calendar, action as CalAction) };
    case "sheet":
      return { ...states, sheet: sheetReducer(states.sheet, action as SheetAction) };
  }
}
