import { describe, expect, it } from "vitest";
import { generateChallenge } from "../src/challenge/generate";
import { solveChallenge } from "../src/challenge/solve";
import { checkCalendar, checkSheet, checkShopping, expectedSheet, removeDuplicates, sortRows } from "../src/challenge/validate";
import { dupKey } from "../src/challenge/validate";

const seeds = Array.from({ length: 300 }, (_, i) => `T${i.toString(36).toUpperCase()}X`);

describe("challenge generation", () => {
  it("is deterministic per seed", () => {
    expect(JSON.stringify(generateChallenge("ABCDE"))).toBe(JSON.stringify(generateChallenge("ABCDE")));
    expect(JSON.stringify(generateChallenge("ABCDE"))).not.toBe(JSON.stringify(generateChallenge("ABCDF")));
  });

  it.each(seeds)("seed %s has exactly one valid product and one valid slot", (seed) => {
    const ch = generateChallenge(seed);
    const sol = solveChallenge(ch);
    expect(sol.productIds).toHaveLength(1);
    expect(sol.slots).toHaveLength(1);
    expect(checkShopping(ch.shopping, sol.productIds).ok).toBe(true);
    expect(checkCalendar(ch.calendar, sol.slots[0]).ok).toBe(true);
    expect(checkSheet(ch.sheet, sol.sheetIds).ok).toBe(true);
  });

  it.each(seeds.slice(0, 60))("seed %s sheet has real duplicates and unambiguous sort", (seed) => {
    const { sheet } = generateChallenge(seed);
    expect(sheet.rows).toHaveLength(16);
    const expected = expectedSheet(sheet);
    expect(expected.length).toBeLessThan(sheet.rows.length);
    const keys = expected.map((r) => String(r[sheet.sort.column]).toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    // The spreadsheet-tool strategy works: sort newest first, remove duplicates, sort by target.
    const viaTools = sortRows(removeDuplicates(sortRows(sheet.rows, { column: "updated", dir: "desc" }), sheet.dupColumns), sheet.sort);
    expect(viaTools.map((r) => r.id)).toEqual(expected.map((r) => r.id));
    // Naive remove-duplicates on the unsorted sheet is usually wrong somewhere across seeds (not asserted per seed).
    expect(new Set(expected.map((r) => dupKey(r, sheet.dupColumns))).size).toBe(expected.length);
  });

  it("rejects common mistakes with helpful messages", () => {
    const ch = generateChallenge("MISTAKES");
    const sol = solveChallenge(ch);
    expect(checkShopping(ch.shopping, []).ok).toBe(false);
    const wrong = ch.shopping.products.find((p) => p.id !== sol.productIds[0])!;
    expect(checkShopping(ch.shopping, [wrong.id]).message).toMatch(/doesn't qualify/);
    expect(checkShopping(ch.shopping, [sol.productIds[0], wrong.id]).message).toMatch(/exactly one/);
    expect(checkCalendar(ch.calendar, ch.calendar.current).ok).toBe(false);
    expect(checkSheet(ch.sheet, ch.sheet.rows.map((r) => r.id)).message).toMatch(/Duplicates remain/);
    expect(checkSheet(ch.sheet, [...sol.sheetIds].reverse()).message).toMatch(/wrong order/);
    expect(checkSheet(ch.sheet, sol.sheetIds.slice(1)).message).toMatch(/missing/);
  });
});
