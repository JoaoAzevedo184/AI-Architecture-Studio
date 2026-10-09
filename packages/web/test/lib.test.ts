import { describe, expect, it } from "vitest";
import { NODE_KINDS, createEmptyModel } from "@arquitecture/core";
import type { ArchitectureModel } from "@arquitecture/core";
import { placeOnGrid, NODE_H, NODE_W } from "../src/lib/grid.js";
import { TECH_KEYS, resolveIcon } from "../src/lib/icons.js";
import { projectEdges } from "../src/lib/projection.js";
import { breadcrumb, hashFor, parseHash, resolveLevel } from "../src/lib/route.js";
import { inverseOf } from "../src/lib/undo.js";

// internet, nginx na raiz; docker > (api > (handler), db); edges: internet→nginx, nginx→api, api→db, handler→db, nginx→docker
const model: ArchitectureModel = {
  ...createEmptyModel("T"),
  nodes: [
    { id: "n_internet", name: "Internet", kind: "external", parent: null },
    { id: "n_nginx", name: "Nginx", kind: "proxy", parent: null },
    { id: "n_docker", name: "Docker", kind: "group", parent: null },
    { id: "n_api", name: "API", kind: "service", parent: "n_docker" },
    { id: "n_handler", name: "Handler", kind: "service", parent: "n_api" },
    { id: "n_db", name: "DB", kind: "database", parent: "n_docker" },
  ],
  edges: [
    { id: "e_1", source: "n_internet", target: "n_nginx", kind: "sync" },
    { id: "e_2", source: "n_nginx", target: "n_api", kind: "sync" },
    { id: "e_3", source: "n_api", target: "n_db", kind: "data" },
    { id: "e_4", source: "n_handler", target: "n_db", kind: "data" },
    { id: "e_5", source: "n_nginx", target: "n_handler", kind: "sync" },
  ],
};

describe("projectEdges", () => {
  it("root: draws edges to the visible ancestor and hides edges internal to one visible node", () => {
    const p = projectEdges(model, null);
    const byId = Object.fromEntries(p.drawn.map((d) => [d.id, d]));
    expect(byId.e_1).toMatchObject({ source: "n_internet", target: "n_nginx", aggregated: false });
    expect(byId.e_2).toMatchObject({ source: "n_nginx", target: "n_docker", aggregated: true });
    expect(byId.e_5).toMatchObject({ source: "n_nginx", target: "n_docker", aggregated: true });
    expect(byId.e_3).toBeUndefined(); // api e db caem em Docker
    expect(byId.e_4).toBeUndefined();
    expect(p.external.size).toBe(0);
  });

  it("inside a node: edge with an endpoint outside the level is not drawn and counts as external", () => {
    const p = projectEdges(model, "n_docker");
    expect(p.drawn.map((d) => d.id)).toEqual(["e_3", "e_4"].filter((id) => id === "e_3" || id === "e_4"));
    expect(p.drawn.find((d) => d.id === "e_4")).toMatchObject({ source: "n_api", target: "n_db", aggregated: true });
    const ext = p.external.get("n_api")!;
    expect(ext.map((x) => [x.edge.id, x.direction])).toEqual([["e_2", "in"], ["e_5", "in"]]);
    expect(p.drawn.find((d) => d.id === "e_1")).toBeUndefined();
  });

  it("both endpoints in the same visible node: not drawn, not external", () => {
    const p = projectEdges(model, "n_docker");
    expect(p.drawn.some((d) => d.id === "e_5")).toBe(false);
    const p2 = projectEdges(model, "n_api");
    expect(p2.drawn).toEqual([]);
    expect(p2.external.get("n_handler")!.map((x) => x.edge.id)).toEqual(["e_4", "e_5"].sort());
  });

  it("terminates on a corrupted parent cycle", () => {
    const bad = { ...model, nodes: model.nodes.map((n) => (n.id === "n_docker" ? { ...n, parent: "n_api" } : n)) };
    expect(() => projectEdges(bad, null)).not.toThrow();
  });
});

describe("route", () => {
  it("builds the breadcrumb", () => {
    expect(breadcrumb(model, null)).toEqual([{ id: null, name: "Raiz" }]);
    expect(breadcrumb(model, "n_api").map((c) => c.name)).toEqual(["Raiz", "Docker", "API"]);
  });

  it("parses and builds hashes", () => {
    expect(parseHash("#/n_docker/n_api")).toEqual(["n_docker", "n_api"]);
    expect(parseHash("")).toEqual([]);
    expect(parseHash("#/")).toEqual([]);
    expect(hashFor(model, "n_api")).toBe("#/n_docker/n_api");
    expect(hashFor(model, null)).toBe("#/");
  });

  it("falls back to the nearest existing ancestor", () => {
    expect(resolveLevel(model, ["n_docker", "n_api"])).toBe("n_api");
    expect(resolveLevel(model, ["n_docker", "n_gone"])).toBe("n_docker");
    expect(resolveLevel(model, ["n_gone", "n_gone2"])).toBeNull();
    expect(resolveLevel(model, [])).toBeNull();
  });
});

describe("placeOnGrid", () => {
  it("keeps saved positions and places others without overlap", () => {
    const saved = { a: { x: 0, y: 0 }, b: { x: 240, y: 0 } };
    const out = placeOnGrid(["a", "b", "c", "d", "e", "f"], saved);
    expect(out.a).toEqual(saved.a);
    expect(out.b).toEqual(saved.b);
    const ps = Object.values(out);
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const clash = Math.abs(ps[i]!.x - ps[j]!.x) < NODE_W && Math.abs(ps[i]!.y - ps[j]!.y) < NODE_H;
        expect(clash).toBe(false);
      }
  });

  it("is deterministic and fills the first free cells", () => {
    expect(placeOnGrid(["a", "b"], {})).toEqual({ a: { x: 0, y: 0 }, b: { x: 240, y: 0 } });
  });
});

describe("inverseOf", () => {
  it("add* are undone by remove*", () => {
    expect(inverseOf({ type: "addNode", input: {} }, model, { id: "n_x" })).toEqual({ type: "removeNode", input: { id: "n_x" } });
    expect(inverseOf({ type: "addEdge", input: {} }, model, { id: "e_x" })).toEqual({ type: "removeEdge", input: { id: "e_x" } });
  });

  it("updateNode restores previous values; absent fields become null", () => {
    const m = { ...model, nodes: model.nodes.map((n) => (n.id === "n_api" ? { ...n, tech: "spring" } : n)) };
    expect(inverseOf({ type: "updateNode", input: { id: "n_api", name: "X", tech: "go", description: "d" } }, m, {})).toEqual({
      type: "updateNode",
      input: { id: "n_api", name: "API", tech: "spring", description: null },
    });
  });

  it("updateEdge and moveNode restore previous values", () => {
    expect(inverseOf({ type: "updateEdge", input: { id: "e_1", label: "x", kind: "async" } }, model, {})).toEqual({
      type: "updateEdge",
      input: { id: "e_1", label: null, kind: "sync" },
    });
    expect(inverseOf({ type: "moveNode", input: { id: "n_api", parent: null } }, model, {})).toEqual({
      type: "moveNode",
      input: { id: "n_api", parent: "n_docker" },
    });
  });

  it("removeEdge is undone by addEdge with the same data", () => {
    expect(inverseOf({ type: "removeEdge", input: { id: "e_3" } }, model, {})).toEqual({
      type: "addEdge",
      input: { source: "n_api", target: "n_db", kind: "data" },
    });
  });

  it("removeNode is undone by restoreSubtree, carrying the saved positions of the removed nodes", () => {
    const result = { removedNodes: [model.nodes[3], model.nodes[4]], removedEdges: [model.edges[3]] };
    const inv = inverseOf({ type: "removeNode", input: { id: "n_api" } }, model, result, {
      n_api: { x: 1, y: 2 },
      n_nginx: { x: 9, y: 9 },
    });
    expect(inv).toEqual({
      type: "restoreSubtree",
      input: { nodes: result.removedNodes, edges: result.removedEdges },
      positions: { n_api: { x: 1, y: 2 } },
    });
  });

  it("operations without a known inverse clear the stack", () => {
    expect(inverseOf({ type: "mystery", input: {} }, model, {})).toBe("clear");
  });
});

describe("resolveIcon", () => {
  it("resolves all catalog keys but caddy (no Devicon icon) to a tech icon", () => {
    const missing = TECH_KEYS.filter((k) => resolveIcon(k, "service").type !== "tech");
    expect(TECH_KEYS).toHaveLength(41);
    expect(missing).toEqual(["caddy"]);
  });

  it("falls back to the kind icon for unknown or absent tech", () => {
    expect(resolveIcon("xyz", "database")).toEqual({ type: "kind", kind: "database" });
    expect(resolveIcon(undefined, "cache")).toEqual({ type: "kind", kind: "cache" });
    expect(resolveIcon("caddy", "proxy")).toEqual({ type: "kind", kind: "proxy" });
    for (const k of NODE_KINDS) expect(resolveIcon(undefined, k).type).toBe("kind");
  });
});
