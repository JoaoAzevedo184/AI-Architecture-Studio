import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  addEdge,
  addNode,
  createEmptyModel,
  moveNode,
  removeEdge,
  removeNode,
  serializeModel,
  updateEdge,
  updateNode,
  validateModel,
  NODE_KINDS,
  EDGE_KINDS,
} from "../src/index.js";
import type { ArchitectureModel, OpResult } from "../src/index.js";
import { clone, deepFreeze, seqIds } from "./helpers.js";

// Escolhas são índices resolvidos contra o modelo corrente; `g` força um id inexistente.
const pick = fc.nat(50);
const maybeGarbage = fc.boolean();
const op = fc.oneof(
  { weight: 5, arbitrary: fc.record({ t: fc.constant("addNode" as const), kind: fc.nat(8), parent: pick, root: fc.boolean(), bad: fc.nat(30) }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant("updateNode" as const), who: pick, kind: fc.nat(8), g: maybeGarbage }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant("moveNode" as const), who: pick, parent: pick, root: fc.boolean(), g: maybeGarbage }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant("removeNode" as const), who: pick, g: maybeGarbage }) },
  { weight: 4, arbitrary: fc.record({ t: fc.constant("addEdge" as const), a: pick, b: pick, kind: fc.nat(2), g: maybeGarbage }) },
  fc.record({ t: fc.constant("updateEdge" as const), who: pick, a: pick, g: maybeGarbage }),
  fc.record({ t: fc.constant("removeEdge" as const), who: pick, g: maybeGarbage }),
);
type Op = any;

function apply(m: ArchitectureModel, o: Op, gen: ReturnType<typeof seqIds>): OpResult {
  const nid = (i: number, g = false) => (g ? "ghost" : m.nodes.length ? m.nodes[i % m.nodes.length]!.id : "none");
  const eid = (i: number, g = false) => (g ? "ghost" : m.edges.length ? m.edges[i % m.edges.length]!.id : "none");
  switch (o.t) {
    case "addNode":
      return addNode(m, { name: o.bad === 0 ? "" : "N", kind: o.bad === 1 ? ("x" as never) : NODE_KINDS[o.kind % 9]!, parent: o.root ? null : o.bad === 2 ? "ghost" : nid(o.parent) }, gen);
    case "updateNode":
      return updateNode(m, nid(o.who, o.g), { kind: NODE_KINDS[o.kind % 9]! });
    case "moveNode":
      return moveNode(m, nid(o.who, o.g), o.root ? null : nid(o.parent));
    case "removeNode":
      return removeNode(m, nid(o.who, o.g));
    case "addEdge":
      return addEdge(m, { source: nid(o.a), target: o.g ? "ghost" : nid(o.b), kind: EDGE_KINDS[o.kind % 3]! }, gen);
    case "updateEdge":
      return updateEdge(m, eid(o.who, o.g), { target: nid(o.a) });
    case "removeEdge":
      return removeEdge(m, eid(o.who, o.g));
    default:
      throw new Error("operação desconhecida");
  }
}

describe("property: random operation sequences", () => {
  it("accepted models always validate, rejected ops change nothing, serialization is lossless", () => {
    let accepted = 0;
    let rejected = 0;
    let maxNodes = 0;
    fc.assert(
      fc.property(fc.array(op, { minLength: 20, maxLength: 60 }), (ops) => {
        const gen = seqIds();
        let m = deepFreeze(createEmptyModel("P"));
        for (const o of ops) {
          const before = clone(m);
          const r = apply(m, o, gen);
          if (r.ok) {
            accepted++;
            expect(validateModel(r.model).ok).toBe(true);
            expect(JSON.parse(serializeModel(r.model))).toStrictEqual(r.model);
            m = deepFreeze(r.model);
            maxNodes = Math.max(maxNodes, m.nodes.length);
          } else {
            rejected++;
            expect(r.errors.length).toBeGreaterThan(0);
            for (const e of r.errors) expect(e.hint && e.message && e.path).toBeTruthy();
            expect(m).toEqual(before);
          }
        }
      }),
      { numRuns: 300 },
    );
    // evita execução vazia: modelos não triviais e rejeições reais
    expect(accepted).toBeGreaterThan(500);
    expect(rejected).toBeGreaterThan(500);
    expect(maxNodes).toBeGreaterThan(5);
  });
});
