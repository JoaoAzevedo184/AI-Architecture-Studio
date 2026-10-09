import { describe, expect, it } from "vitest";
import { pruneLayout, validateLayout } from "../src/index.js";
import { deepFreeze, expectError, sampleModel } from "./helpers.js";

describe("validateLayout", () => {
  it("accepts a valid layout and an empty one", () => {
    expect(validateLayout({ schemaVersion: 1, positions: { n_1: { x: 1, y: -2.5 } } }).ok).toBe(true);
    expect(validateLayout({ schemaVersion: 1, positions: {} }).ok).toBe(true);
  });

  it("SCHEMA_INVALID with path inside the layout document", () => {
    expectError(validateLayout({ schemaVersion: 1 }), "SCHEMA_INVALID", "/positions");
    expectError(validateLayout({ schemaVersion: 2, positions: {} }), "SCHEMA_INVALID", "/schemaVersion");
    expectError(validateLayout({ schemaVersion: 1, positions: { n_1: { x: 1 } } }), "SCHEMA_INVALID", "/positions/n_1/y");
    expectError(validateLayout({ schemaVersion: 1, positions: { n_1: { x: "1", y: 2 } } }), "SCHEMA_INVALID", "/positions/n_1/x");
    expectError(validateLayout({ schemaVersion: 1, positions: [] }), "SCHEMA_INVALID", "/positions");
    expectError(validateLayout({ schemaVersion: 1, positions: {}, extra: 1 }), "SCHEMA_INVALID", "/extra");
    expectError(validateLayout("x"), "SCHEMA_INVALID", "");
  });

  it("escapes JSON pointer characters in ids", () => {
    expectError(validateLayout({ schemaVersion: 1, positions: { "a/b": { x: 1 } } }), "SCHEMA_INVALID", "/positions/a~1b/y");
  });
});

describe("pruneLayout", () => {
  it("drops orphan ids and keeps the rest, without mutating the input", () => {
    const layout = deepFreeze({
      schemaVersion: 1 as const,
      positions: { n_1: { x: 1, y: 2 }, ghost: { x: 9, y: 9 }, n_3: { x: 3, y: 4 } },
    });
    const out = pruneLayout(layout, sampleModel());
    expect(out).toEqual({ schemaVersion: 1, positions: { n_1: { x: 1, y: 2 }, n_3: { x: 3, y: 4 } } });
    expect(layout.positions).toHaveProperty("ghost");
  });
});
