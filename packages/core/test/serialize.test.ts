import { describe, expect, it } from "vitest";
import { serializeLayout, serializeModel, validateModel, validateLayout } from "../src/index.js";
import type { ArchitectureModel } from "../src/index.js";
import { clone, sampleModel, specExample } from "./helpers.js";

describe("serializeModel", () => {
  it("is deterministic regardless of input key order", () => {
    const a = specExample as ArchitectureModel;
    const shuffled = JSON.parse(JSON.stringify(a, (_k, v) =>
      v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)) as ArchitectureModel;
    expect(serializeModel(shuffled)).toBe(serializeModel(a));
  });

  it("uses 2-space indent, trailing newline and fixed key order", () => {
    const out = serializeModel(specExample as ArchitectureModel);
    expect(out.endsWith("}\n")).toBe(true);
    expect(out.startsWith('{\n  "schemaVersion": 1,\n  "revision": 42,\n  "meta": {')).toBe(true);
    expect(out).toMatch(/"id": "n_nginx",\n\s+"name": "Nginx",\n\s+"kind": "proxy",\n\s+"tech": "nginx",\n\s+"parent": null/);
  });

  it("round trip: serialize, parse, serialize yields the same text", () => {
    const t1 = serializeModel(specExample as ArchitectureModel);
    const parsed = validateModel(JSON.parse(t1));
    if (!parsed.ok) throw new Error("inválido");
    expect(serializeModel(parsed.model)).toBe(t1);
  });

  it("round trip of a model with description and optional fields", () => {
    const m = clone(sampleModel());
    m.nodes[0]!.description = "desc";
    const t1 = serializeModel(m);
    expect(serializeModel(JSON.parse(t1))).toBe(t1);
  });

  it("unknown lenses survive validate and serialize, with nested keys sorted and arrays kept", () => {
    const m = clone(specExample) as any;
    m.nodes[3].lenses.mystery = { z: 1, a: [3, 1, 2], m: { y: true, b: null } };
    const v = validateModel(m);
    expect(v.ok).toBe(true);
    const out = JSON.parse(serializeModel(m));
    expect(out.nodes[3].lenses.mystery).toEqual({ z: 1, a: [3, 1, 2], m: { y: true, b: null } });
    expect(Object.keys(out.nodes[3].lenses.mystery)).toEqual(["a", "m", "z"]);
    expect(out.nodes[3].lenses.mystery.a).toEqual([3, 1, 2]);
  });

  it("keeps nodes and edges in insertion order", () => {
    const m = sampleModel();
    expect(JSON.parse(serializeModel(m)).nodes.map((n: any) => n.id)).toEqual(m.nodes.map((n) => n.id));
  });
});

describe("serializeLayout", () => {
  it("sorts positions by id and round trips", () => {
    const t = serializeLayout({ schemaVersion: 1, positions: { n_b: { y: 2, x: 1 }, n_a: { x: 3, y: 4 } } });
    expect(t).toBe(
      '{\n  "schemaVersion": 1,\n  "positions": {\n    "n_a": {\n      "x": 3,\n      "y": 4\n    },\n    "n_b": {\n      "x": 1,\n      "y": 2\n    }\n  }\n}\n',
    );
    const v = validateLayout(JSON.parse(t));
    if (!v.ok) throw new Error("inválido");
    expect(serializeLayout(v.layout)).toBe(t);
  });
});
