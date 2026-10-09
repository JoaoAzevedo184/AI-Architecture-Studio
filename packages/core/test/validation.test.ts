import { describe, expect, it } from "vitest";
import { validateModel } from "../src/index.js";
import type { LensSchemas } from "../src/index.js";
import { clone, expectError, sampleModel, specExample } from "./helpers.js";

const lensSchemas: LensSchemas = {
  security: {
    type: "object",
    required: ["authn"],
    properties: { authn: { enum: ["jwt", "none"] } },
  },
};

describe("validateModel", () => {
  it("accepts the SPEC example without lens schemas", () => {
    expect(validateModel(specExample).ok).toBe(true);
  });

  it("accepts an empty model", () => {
    expect(validateModel({ schemaVersion: 1, revision: 0, meta: { name: "X" }, nodes: [], edges: [] }).ok).toBe(true);
  });

  it("SCHEMA_INVALID: missing field, with path to the missing property", () => {
    const m = clone(specExample) as Record<string, any>;
    delete m.nodes[0].name;
    expectError(validateModel(m), "SCHEMA_INVALID", "/nodes/0/name");
  });

  it("SCHEMA_INVALID: unknown schemaVersion, kind outside the set, extra field, wrong type", () => {
    const m = clone(specExample) as Record<string, any>;
    m.schemaVersion = 2;
    m.nodes[0].kind = "banana";
    m.nodes[1].extra = true;
    m.revision = "1";
    const r = validateModel(m);
    expectError(r, "SCHEMA_INVALID", "/schemaVersion");
    expectError(r, "SCHEMA_INVALID", "/nodes/0/kind");
    expectError(r, "SCHEMA_INVALID", "/nodes/1/extra");
    expectError(r, "SCHEMA_INVALID", "/revision");
  });

  it("SCHEMA_INVALID: non-object input", () => {
    expectError(validateModel(null), "SCHEMA_INVALID", "");
  });

  it("emits Portuguese messages without Ajv's English text", () => {
    const m = clone(specExample) as Record<string, any>;
    m.schemaVersion = 2;
    m.nodes[0].kind = "banana";
    m.nodes[1].extra = true;
    m.revision = "1";
    delete m.meta.name;
    m.edges[0].label = 5;
    m.nodes[2].name = "";
    m.revision = -1;
    const r = validateModel(m);
    if (r.ok) throw new Error("esperava falha");
    for (const e of r.errors) {
      expect(e.message).not.toMatch(/\bmust\b|should|property/i);
      expect(e.hint).not.toMatch(/\bmust\b|should|property/i);
    }
  });

  it("DUPLICATE_ID for nodes and edges", () => {
    const m = clone(specExample) as Record<string, any>;
    m.nodes.push({ ...m.nodes[0] });
    m.edges.push({ ...m.edges[0] });
    const r = validateModel(m);
    expectError(r, "DUPLICATE_ID", "/nodes/5/id");
    expectError(r, "DUPLICATE_ID", "/edges/2/id");
  });

  it("PARENT_NOT_FOUND", () => {
    const m = clone(specExample) as Record<string, any>;
    m.nodes[3].parent = "n_ghost";
    expectError(validateModel(m), "PARENT_NOT_FOUND", "/nodes/3/parent");
  });

  it("PARENT_CYCLE, and terminates with an edge between the cycle members", () => {
    const m = clone(sampleModel());
    m.nodes[1]!.parent = "n_3"; // n_2 -> n_3 -> n_2
    m.edges.push({ id: "e_x", source: "n_2", target: "n_3", kind: "sync" });
    const r = validateModel(m);
    expectError(r, "PARENT_CYCLE", "/nodes/1/parent");
    expectError(r, "PARENT_CYCLE", "/nodes/2/parent");
  });

  it("EDGE_ENDPOINT_NOT_FOUND", () => {
    const m = clone(specExample) as Record<string, any>;
    m.edges[1].target = "n_cache";
    const e = expectError(validateModel(m), "EDGE_ENDPOINT_NOT_FOUND", "/edges/1/target");
    expect(e.message).toContain("n_cache");
  });

  it("EDGE_SELF_LOOP", () => {
    const m = clone(specExample) as Record<string, any>;
    m.edges[0].target = m.edges[0].source;
    expectError(validateModel(m), "EDGE_SELF_LOOP", "/edges/0/target");
  });

  it("EDGE_TO_ANCESTOR (direct and indirect)", () => {
    const m = clone(specExample) as Record<string, any>;
    m.edges.push({ id: "e_3", source: "n_api", target: "n_docker", kind: "data" });
    m.nodes.push({ id: "n_deep", name: "Deep", kind: "service", parent: "n_api" });
    m.edges.push({ id: "e_4", source: "n_docker", target: "n_deep", kind: "data" });
    const r = validateModel(m);
    expectError(r, "EDGE_TO_ANCESTOR", "/edges/2/target");
    expectError(r, "EDGE_TO_ANCESTOR", "/edges/3/target");
  });

  it("allows edges across levels between non-ancestors", () => {
    expect(validateModel(specExample).ok).toBe(true); // nginx → api
  });

  it("LENS_INVALID for a registered lens with invalid data, path inside the lens", () => {
    const m = clone(specExample) as Record<string, any>;
    m.nodes[3].lenses.security = { authn: "kerberos" };
    expectError(validateModel(m, lensSchemas), "LENS_INVALID", "/nodes/3/lenses/security/authn");
    m.nodes[3].lenses.security = {};
    expectError(validateModel(m, lensSchemas), "LENS_INVALID", "/nodes/3/lenses/security/authn");
  });

  it("validates a registered lens that is valid, and preserves unknown lenses unvalidated", () => {
    const m = clone(specExample) as Record<string, any>;
    m.nodes[3].lenses.mystery = { whatever: [1, 2, { deep: true }] };
    expect(validateModel(m, lensSchemas).ok).toBe(true);
    // a lens is only validated when present in the map
    m.nodes[3].lenses.security = { authn: "kerberos" };
    expect(validateModel(m).ok).toBe(true);
  });

  it("reports all errors together", () => {
    const m = clone(specExample) as Record<string, any>;
    m.nodes[3].parent = "ghost";
    m.edges[0].target = m.edges[0].source;
    const r = validateModel(m);
    expectError(r, "PARENT_NOT_FOUND", "/nodes/3/parent");
    expectError(r, "EDGE_SELF_LOOP", "/edges/0/target");
  });
});
