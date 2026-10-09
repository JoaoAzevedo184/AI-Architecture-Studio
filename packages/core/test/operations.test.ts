import { describe, expect, it } from "vitest";
import {
  addEdge,
  addNode,
  checkRevision,
  createEmptyModel,
  moveNode,
  removeEdge,
  removeNode,
  updateEdge,
  updateNode,
  validateModel,
} from "../src/index.js";
import type { LensSchemas } from "../src/index.js";
import { clone, deepFreeze, expectError, expectOk, sampleModel, seqIds } from "./helpers.js";

describe("addNode", () => {
  it("adds a root node with the injected id and does not touch revision", () => {
    const m = deepFreeze(createEmptyModel("X"));
    const r = addNode(m, { name: "Nginx", kind: "proxy", tech: "nginx" }, seqIds());
    expectOk(r);
    expect(r.id).toBe("n_1");
    expect(r.model.nodes).toEqual([{ id: "n_1", name: "Nginx", kind: "proxy", tech: "nginx", parent: null }]);
    expect(r.model.revision).toBe(0);
    expect(m.nodes).toHaveLength(0);
  });

  it("never derives the id from the name", () => {
    const r = addNode(createEmptyModel("X"), { name: "Nginx", kind: "proxy" }, seqIds());
    expectOk(r);
    expect(r.id).not.toMatch(/nginx/i);
  });

  it("accepts an unknown tech", () => {
    const r = addNode(createEmptyModel("X"), { name: "A", kind: "service", tech: "cobol" }, seqIds());
    expect(r.ok).toBe(true);
  });

  it("fails with PARENT_NOT_FOUND", () => {
    const r = addNode(createEmptyModel("X"), { name: "A", kind: "service", parent: "n_x" }, seqIds());
    expectError(r, "PARENT_NOT_FOUND", "/nodes/0/parent");
  });

  it("fails with DUPLICATE_ID when the generator repeats an id", () => {
    const m = sampleModel();
    const r = addNode(m, { name: "A", kind: "service" }, () => "n_1");
    expectError(r, "DUPLICATE_ID", `/nodes/${m.nodes.length}/id`);
  });

  it("fails with SCHEMA_INVALID for a kind outside the set", () => {
    const r = addNode(createEmptyModel("X"), { name: "A", kind: "banana" as never }, seqIds());
    expectError(r, "SCHEMA_INVALID", "/nodes/0/kind");
  });

  it("fails with SCHEMA_INVALID for an empty name", () => {
    const r = addNode(createEmptyModel("X"), { name: "", kind: "service" }, seqIds());
    expectError(r, "SCHEMA_INVALID", "/nodes/0/name");
  });
});

describe("updateNode", () => {
  it("renames preserving id and edges", () => {
    const m = deepFreeze(sampleModel());
    const r = updateNode(m, "n_3", { name: "Gateway" });
    expectOk(r);
    const n = r.model.nodes.find((x) => x.id === "n_3")!;
    expect(n.name).toBe("Gateway");
    expect(r.model.edges).toEqual(m.edges);
    expect(r.model.nodes.map((x) => x.id)).toEqual(m.nodes.map((x) => x.id));
  });

  it("changes kind, tech and description; null clears optional fields", () => {
    let r = updateNode(sampleModel(), "n_3", { kind: "frontend", tech: "react", description: "UI" });
    expectOk(r);
    expect(r.model.nodes[2]).toMatchObject({ kind: "frontend", tech: "react", description: "UI" });
    r = updateNode(r.model, "n_3", { tech: null, description: null });
    expectOk(r);
    expect(r.model.nodes[2]).not.toHaveProperty("tech");
    expect(r.model.nodes[2]).not.toHaveProperty("description");
  });

  it("ignores id and parent smuggled into the patch", () => {
    const m = sampleModel();
    const r = updateNode(m, "n_3", { name: "Z", id: "hack", parent: null } as never);
    expectOk(r);
    expect(r.model.nodes[2]).toMatchObject({ id: "n_3", parent: "n_2", name: "Z" });
  });

  it("fails for an unknown id", () => {
    expectError(updateNode(sampleModel(), "nope", { name: "A" }), "NOT_FOUND", "/id");
  });

  it("fails with SCHEMA_INVALID for an invalid kind", () => {
    expectError(updateNode(sampleModel(), "n_3", { kind: "x" as never }), "SCHEMA_INVALID", "/nodes/2/kind");
  });

  it("preserves unknown lenses", () => {
    const m = sampleModel();
    const withLens = clone(m);
    withLens.nodes[2]!.lenses = { custom: 7 as never };
    const r = updateNode(withLens, "n_3", { name: "Q" });
    expectOk(r);
    expect(r.model.nodes[2]!.lenses).toEqual({ custom: 7 });
  });
});

describe("moveNode", () => {
  it("moves to another parent and to the root", () => {
    let r = moveNode(sampleModel(), "n_3", null);
    expectOk(r);
    expect(r.model.nodes[2]!.parent).toBeNull();
    r = moveNode(r.model, "n_3", "n_2");
    expectOk(r);
    expect(r.model.nodes[2]!.parent).toBe("n_2");
  });

  it("fails with PARENT_NOT_FOUND", () => {
    expectError(moveNode(sampleModel(), "n_3", "ghost"), "PARENT_NOT_FOUND", "/nodes/2/parent");
  });

  it("fails with PARENT_CYCLE when moving into a descendant", () => {
    expectError(moveNode(sampleModel(), "n_2", "n_3"), "PARENT_CYCLE", "/nodes/1/parent");
  });

  it("fails with PARENT_CYCLE when moving into itself", () => {
    expectError(moveNode(sampleModel(), "n_2", "n_2"), "PARENT_CYCLE", "/nodes/1/parent");
  });

  it("fails with EDGE_TO_ANCESTOR when the move makes an edge touch an ancestor", () => {
    // api→db: mover db para dentro de api faz db descender de api
    const r = moveNode(sampleModel(), "n_4", "n_3");
    expectError(r, "EDGE_TO_ANCESTOR", "/edges/1/target");
  });

  it("fails for an unknown id", () => {
    expectError(moveNode(sampleModel(), "nope", null), "NOT_FOUND", "/id");
  });
});

describe("removeNode", () => {
  it("cascades to descendants and touching edges, listing them", () => {
    const m = deepFreeze(sampleModel());
    const r = removeNode(m, "n_2");
    expectOk(r);
    expect(r.removedNodeIds).toEqual(["n_2", "n_3", "n_4", "n_5"]);
    expect(r.removedEdgeIds).toEqual(["e_6", "e_7", "e_8"]);
    expect(r.model.nodes.map((n) => n.id)).toEqual(["n_1"]);
    expect(r.model.edges).toEqual([]);
    expect(validateModel(r.model).ok).toBe(true);
  });

  it("removes a leaf and only its edges", () => {
    const r = removeNode(sampleModel(), "n_4");
    expectOk(r);
    expect(r.removedNodeIds).toEqual(["n_4"]);
    expect(r.removedEdgeIds).toEqual(["e_7"]);
    expect(r.model.edges.map((e) => e.id)).toEqual(["e_6", "e_8"]);
  });

  it("fails for an unknown id", () => {
    expectError(removeNode(sampleModel(), "nope"), "NOT_FOUND", "/id");
  });

  it("terminates on a corrupted parent cycle", () => {
    const m = clone(sampleModel());
    m.nodes[1]!.parent = "n_3"; // n_2 ↔ n_3
    const r = removeNode(m, "n_2");
    expect(r.ok).toBe(true);
  });
});

describe("addEdge", () => {
  it("adds an edge with default kind sync", () => {
    const m = sampleModel();
    const r = addEdge(m, { source: "n_3", target: "n_5", label: "rest" }, seqIds());
    expectOk(r);
    expect(r.model.edges.at(-1)).toEqual({ id: "e_1", source: "n_3", target: "n_5", label: "rest", kind: "sync" });
  });

  it("fails with EDGE_ENDPOINT_NOT_FOUND for source and target", () => {
    const m = sampleModel();
    const n = m.edges.length;
    expectError(addEdge(m, { source: "x", target: "n_3" }, seqIds()), "EDGE_ENDPOINT_NOT_FOUND", `/edges/${n}/source`);
    expectError(addEdge(m, { source: "n_3", target: "x" }, seqIds()), "EDGE_ENDPOINT_NOT_FOUND", `/edges/${n}/target`);
  });

  it("fails with EDGE_SELF_LOOP", () => {
    const m = sampleModel();
    expectError(addEdge(m, { source: "n_3", target: "n_3" }, seqIds()), "EDGE_SELF_LOOP", `/edges/${m.edges.length}/target`);
  });

  it("fails with EDGE_TO_ANCESTOR in both directions", () => {
    const m = sampleModel();
    const p = `/edges/${m.edges.length}/target`;
    expectError(addEdge(m, { source: "n_3", target: "n_2" }, seqIds()), "EDGE_TO_ANCESTOR", p);
    expectError(addEdge(m, { source: "n_2", target: "n_3" }, seqIds()), "EDGE_TO_ANCESTOR", p);
  });

  it("fails with DUPLICATE_ID when the generator repeats an edge id", () => {
    const m = sampleModel();
    expectError(addEdge(m, { source: "n_3", target: "n_5" }, () => "e_6"), "DUPLICATE_ID", `/edges/${m.edges.length}/id`);
  });

  it("fails with SCHEMA_INVALID for a kind outside the set", () => {
    const m = sampleModel();
    expectError(addEdge(m, { source: "n_3", target: "n_5", kind: "x" as never }, seqIds()), "SCHEMA_INVALID", `/edges/${m.edges.length}/kind`);
  });
});

describe("updateEdge", () => {
  it("changes label and kind; null clears the label", () => {
    let r = updateEdge(sampleModel(), "e_6", { label: "grpc", kind: "async" });
    expectOk(r);
    expect(r.model.edges[0]).toMatchObject({ label: "grpc", kind: "async" });
    r = updateEdge(r.model, "e_6", { label: null });
    expectOk(r);
    expect(r.model.edges[0]).not.toHaveProperty("label");
  });

  it("keeps the id even if the patch carries one", () => {
    const r = updateEdge(sampleModel(), "e_6", { label: "a", id: "hack" } as never);
    expectOk(r);
    expect(r.model.edges[0]!.id).toBe("e_6");
  });

  it("fails when retargeting breaks integrity", () => {
    expectError(updateEdge(sampleModel(), "e_6", { target: "ghost" }), "EDGE_ENDPOINT_NOT_FOUND", "/edges/0/target");
    expectError(updateEdge(sampleModel(), "e_6", { target: "n_1" }), "EDGE_SELF_LOOP", "/edges/0/target");
  });

  it("fails for an unknown id and an invalid kind", () => {
    expectError(updateEdge(sampleModel(), "nope", {}), "NOT_FOUND", "/id");
    expectError(updateEdge(sampleModel(), "e_6", { kind: "x" as never }), "SCHEMA_INVALID", "/edges/0/kind");
  });
});

describe("removeEdge", () => {
  it("removes only that edge", () => {
    const m = deepFreeze(sampleModel());
    const r = removeEdge(m, "e_7");
    expectOk(r);
    expect(r.model.edges.map((e) => e.id)).toEqual(["e_6", "e_8"]);
    expect(r.model.nodes).toEqual(m.nodes);
  });

  it("fails for an unknown id", () => {
    expectError(removeEdge(sampleModel(), "nope"), "NOT_FOUND", "/id");
  });
});

describe("checkRevision", () => {
  it("passes on equal revision", () => {
    expect(checkRevision({ ...createEmptyModel("X"), revision: 3 }, 3)).toEqual({ ok: true });
  });

  it("returns REVISION_CONFLICT with the current revision", () => {
    const r = checkRevision({ ...createEmptyModel("X"), revision: 5 }, 3);
    const e = expectError(r, "REVISION_CONFLICT", "/revision");
    expect(e.currentRevision).toBe(5);
    expect(e.message).toContain("5");
  });
});

describe("lensSchemas parameter", () => {
  const schemas: LensSchemas = { security: { type: "object", required: ["authn"] } };
  const bad = () => {
    const m = clone(sampleModel());
    m.nodes[2]!.lenses = { security: {} };
    return m;
  };

  it("every operation reports LENS_INVALID when the model has an invalid registered lens", () => {
    const path = "/nodes/2/lenses/security/authn";
    expectError(addNode(bad(), { name: "A", kind: "service" }, seqIds(), schemas), "LENS_INVALID", path);
    expectError(updateNode(bad(), "n_1", { name: "A" }, schemas), "LENS_INVALID", path);
    expectError(moveNode(bad(), "n_1", null, schemas), "LENS_INVALID", path);
    expectError(removeNode(bad(), "n_5", schemas), "LENS_INVALID", path);
    expectError(addEdge(bad(), { source: "n_3", target: "n_5" }, seqIds(), schemas), "LENS_INVALID", path);
    expectError(updateEdge(bad(), "e_6", { label: "x" }, schemas), "LENS_INVALID", path);
    expectError(removeEdge(bad(), "e_6", schemas), "LENS_INVALID", path);
  });

  it("without the map the same operation succeeds", () => {
    expect(updateNode(bad(), "n_1", { name: "A" }).ok).toBe(true);
  });
});
