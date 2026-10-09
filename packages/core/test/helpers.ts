import { expect } from "vitest";
import { addEdge, addNode, createEmptyModel } from "../src/index.js";
import type { ArchitectureModel, IdGenerator, ModelError, OpResult } from "../src/index.js";

/** Deterministic generator: n_1, n_2, e_3... */
export function seqIds(): IdGenerator {
  let n = 0;
  return (entity) => `${entity === "node" ? "n" : "e"}_${++n}`;
}

export function deepFreeze<T>(o: T): T {
  if (o !== null && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

/** Example from SPEC section 3. */
export const specExample = {
  schemaVersion: 1,
  revision: 42,
  meta: { name: "HotelHub", description: "Reservas de hotel" },
  nodes: [
    { id: "n_internet", name: "Internet", kind: "external", parent: null },
    { id: "n_nginx", name: "Nginx", kind: "proxy", tech: "nginx", parent: null },
    { id: "n_docker", name: "Docker", kind: "group", tech: "docker", parent: null },
    {
      id: "n_api",
      name: "API",
      kind: "service",
      tech: "spring",
      parent: "n_docker",
      lenses: { security: { authn: "jwt", authz: "rbac" } },
    },
    {
      id: "n_db",
      name: "PostgreSQL",
      kind: "database",
      tech: "postgresql",
      parent: "n_docker",
      lenses: { data: { tables: [] } },
    },
  ],
  edges: [
    { id: "e_1", source: "n_internet", target: "n_nginx", label: "HTTPS", kind: "sync" },
    { id: "e_2", source: "n_nginx", target: "n_api", label: "proxy_pass", kind: "sync" },
  ],
};

export function expectOk<T extends object>(r: OpResult<T>): asserts r is Extract<OpResult<T>, { ok: true }> {
  if (!r.ok) throw new Error("esperava sucesso: " + JSON.stringify(r.errors));
}

/** Asserts an error with the given code and path exists, with message and hint. */
export function expectError(r: { ok: boolean; errors?: ModelError[] }, code: string, path: string): ModelError {
  expect(r.ok).toBe(false);
  const e = r.errors!.find((x) => x.code === code && x.path === path);
  expect(e, JSON.stringify(r.errors)).toBeDefined();
  expect(e!.message.length).toBeGreaterThan(0);
  expect(e!.hint.length).toBeGreaterThan(0);
  return e!;
}

/** Docker (n_2) holding api (n_3), db (n_4), web (n_5); nginx (n_1) outside. Edges: nginx→api, api→db, nginx→web. */
export function sampleModel(): ArchitectureModel {
  const gen = seqIds();
  let m = createEmptyModel("Exemplo");
  const node = (name: string, kind: "proxy" | "group" | "service" | "database" | "frontend", parent: string | null) => {
    const r = addNode(m, { name, kind, parent }, gen);
    expectOk(r);
    m = r.model;
    return r.id;
  };
  const edge = (source: string, target: string) => {
    const r = addEdge(m, { source, target }, gen);
    expectOk(r);
    m = r.model;
  };
  const nginx = node("Nginx", "proxy", null);
  const docker = node("Docker", "group", null);
  const api = node("API", "service", docker);
  const db = node("DB", "database", docker);
  const web = node("Web", "frontend", docker);
  edge(nginx, api);
  edge(api, db);
  edge(nginx, web);
  return m;
}
