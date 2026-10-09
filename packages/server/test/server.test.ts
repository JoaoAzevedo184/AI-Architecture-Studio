import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEmptyModel, serializeModel } from "@arquitecture/core";
import type { IdGenerator } from "@arquitecture/core";
import { createServer } from "../src/index.js";
import type { CreateServerOptions } from "../src/index.js";

const dirs: string[] = [];
const servers: { close(): Promise<void> }[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function tmp(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "arq-"));
  dirs.push(d);
  return d;
}

function seqIds(): IdGenerator {
  let n = 0;
  return (entity) => `${entity === "node" ? "n" : "e"}_${++n}`;
}

async function boot(rootDir: string, extra: Partial<CreateServerOptions> = {}) {
  const s = createServer({ rootDir, idGenerator: seqIds(), ...extra });
  servers.push(s);
  await s.app.ready();
  const get = async (url: string) => {
    const r = await s.app.inject({ method: "GET", url });
    return { status: r.statusCode, body: r.json() };
  };
  const send = async (method: "POST" | "PUT", url: string, payload: unknown) => {
    const r = await s.app.inject({ method, url, payload: payload as never });
    return { status: r.statusCode, body: r.json() };
  };
  const op = (type: string, input: object, expectedRevision?: number) =>
    send("POST", "/api/operations", { type, input, expectedRevision });
  return { s, get, send, op };
}

const modelFile = (d: string) => join(d, "docs", "architecture.json");
const layoutFile = (d: string) => join(d, "docs", "architecture.layout.json");
const writeModel = async (d: string, text: string) => {
  await mkdir(join(d, "docs"), { recursive: true });
  await writeFile(modelFile(d), text);
};

describe("startup", () => {
  it("without a file: empty in-memory model named after the folder, nothing created on disk", async () => {
    const d = await tmp();
    const { get } = await boot(d);
    const r = await get("/api/model");
    expect(r.body).toMatchObject({ state: "valid", revision: 0, errors: [] });
    expect(r.body.model.meta.name).toBe(basename(d));
    await expect(readdir(join(d, "docs"))).rejects.toThrow();
  });

  it("resolves a relative rootDir before naming the model", async () => {
    const d = await tmp();
    const { relative } = await import("node:path");
    const { get } = await boot(relative(process.cwd(), d));
    expect((await get("/api/model")).body.model.meta.name).toBe(basename(d));
  });

  it("creates docs/ and the file on the first accepted write", async () => {
    const d = await tmp();
    const { op } = await boot(d);
    await op("addNode", { name: "A", kind: "service" });
    expect((await readFile(modelFile(d), "utf8")).length).toBeGreaterThan(0);
  });

  it("with a valid file: loads it", async () => {
    const d = await tmp();
    const m = { ...createEmptyModel("X"), revision: 7 };
    await writeModel(d, serializeModel(m));
    const { get } = await boot(d);
    expect((await get("/api/model")).body).toMatchObject({ state: "valid", revision: 7, model: m });
  });

  it("with an invalid file: invalid state, errors reported, file untouched", async () => {
    const d = await tmp();
    const bad = '{ "schemaVersion": 1, "revision": 0 }';
    await writeModel(d, bad);
    const { get, op } = await boot(d);
    const r = await get("/api/model");
    expect(r.body.state).toBe("invalid");
    expect(r.body.model).toBeNull();
    expect(r.body.revision).toBeNull();
    expect(r.body.errors.length).toBeGreaterThan(0);
    expect(r.body.errors[0].code).toBe("SCHEMA_INVALID");
    const w = await op("addNode", { name: "A", kind: "service" });
    expect(w.status).toBe(503);
    expect(w.body.errors[0].code).toBe("MODEL_INVALID");
    expect(await readFile(modelFile(d), "utf8")).toBe(bad);
  });

  it("with malformed JSON: invalid state", async () => {
    const d = await tmp();
    await writeModel(d, "{ nope");
    const { get } = await boot(d);
    expect((await get("/api/model")).body.state).toBe("invalid");
  });

  it("with an invalid layout: no positions, nothing blocked", async () => {
    const d = await tmp();
    await writeModel(d, serializeModel(createEmptyModel("X")));
    await writeFile(layoutFile(d), '{ "schemaVersion": 1, "positions": { "n_1": { "x": "a" } } }');
    const { get, op } = await boot(d);
    expect((await get("/api/layout")).body).toEqual({ layout: { schemaVersion: 1, positions: {} } });
    expect((await op("addNode", { name: "A", kind: "service" })).status).toBe(200);
  });

  it("with a valid layout: loads it pruned of orphans", async () => {
    const d = await tmp();
    const { serializeLayout } = await import("@arquitecture/core");
    const m = {
      ...createEmptyModel("X"),
      nodes: [{ id: "n_1", name: "A", kind: "service" as const, parent: null }],
    };
    await writeModel(d, serializeModel(m));
    await writeFile(
      layoutFile(d),
      serializeLayout({ schemaVersion: 1, positions: { n_1: { x: 1, y: 2 }, ghost: { x: 3, y: 4 } } }),
    );
    const { get } = await boot(d);
    expect((await get("/api/layout")).body.layout.positions).toEqual({ n_1: { x: 1, y: 2 } });
  });
});

describe("POST /api/operations", () => {
  it("addNode / addEdge return the generated id and a new revision", async () => {
    const { op } = await boot(await tmp());
    const a = await op("addNode", { name: "A", kind: "service" });
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ revision: 1, result: { id: "n_1" } });
    const b = await op("addNode", { name: "B", kind: "database", parent: null, tech: "postgresql" });
    expect(b.body.result.id).toBe("n_2");
    const e = await op("addEdge", { source: "n_1", target: "n_2", label: "sql" });
    expect(e.body).toMatchObject({ revision: 3, result: { id: "e_3" } });
    expect(e.body.model.edges[0]).toMatchObject({ kind: "sync", label: "sql" });
  });

  it("addNode fails with 422 PARENT_NOT_FOUND and changes nothing", async () => {
    const { op, get } = await boot(await tmp());
    const r = await op("addNode", { name: "A", kind: "service", parent: "ghost" });
    expect(r.status).toBe(422);
    expect(r.body.errors[0]).toMatchObject({ code: "PARENT_NOT_FOUND", path: "/nodes/0/parent" });
    expect((await get("/api/model")).body.revision).toBe(0);
  });

  it("updateNode renames keeping the id; 404 NOT_FOUND for unknown id", async () => {
    const { op } = await boot(await tmp());
    await op("addNode", { name: "A", kind: "service" });
    const r = await op("updateNode", { id: "n_1", name: "Z", tech: "spring" });
    expect(r.body.model.nodes[0]).toMatchObject({ id: "n_1", name: "Z", tech: "spring" });
    const nf = await op("updateNode", { id: "nope", name: "Z" });
    expect(nf.status).toBe(404);
    expect(nf.body.errors[0]).toMatchObject({ code: "NOT_FOUND", path: "/id" });
  });

  it("moveNode moves; 422 PARENT_CYCLE", async () => {
    const { op } = await boot(await tmp());
    await op("addNode", { name: "P", kind: "group" });
    await op("addNode", { name: "C", kind: "service", parent: "n_1" });
    const cyc = await op("moveNode", { id: "n_1", parent: "n_2" });
    expect(cyc.status).toBe(422);
    expect(cyc.body.errors[0].code).toBe("PARENT_CYCLE");
    const ok = await op("moveNode", { id: "n_2", parent: null });
    expect(ok.body.model.nodes[1].parent).toBeNull();
  });

  it("removeNode cascades and lists what was removed; 404 for unknown id", async () => {
    const { op } = await boot(await tmp());
    await op("addNode", { name: "P", kind: "group" });
    await op("addNode", { name: "C", kind: "service", parent: "n_1" });
    await op("addNode", { name: "O", kind: "service" });
    await op("addEdge", { source: "n_2", target: "n_3" });
    const r = await op("removeNode", { id: "n_1" });
    expect(r.body.result).toEqual({ removedNodeIds: ["n_1", "n_2"], removedEdgeIds: ["e_4"] });
    expect(r.body.model.nodes.map((n: { id: string }) => n.id)).toEqual(["n_3"]);
    expect((await op("removeNode", { id: "n_1" })).status).toBe(404);
  });

  it("updateEdge and removeEdge; 422 EDGE_SELF_LOOP; 404 for unknown ids", async () => {
    const { op } = await boot(await tmp());
    await op("addNode", { name: "A", kind: "service" });
    await op("addNode", { name: "B", kind: "service" });
    await op("addEdge", { source: "n_1", target: "n_2" });
    const u = await op("updateEdge", { id: "e_3", label: "grpc", kind: "async" });
    expect(u.body.model.edges[0]).toMatchObject({ label: "grpc", kind: "async" });
    const loop = await op("updateEdge", { id: "e_3", target: "n_1" });
    expect(loop.status).toBe(422);
    expect(loop.body.errors[0].code).toBe("EDGE_SELF_LOOP");
    expect((await op("updateEdge", { id: "x" })).status).toBe(404);
    expect((await op("removeEdge", { id: "e_3" })).body.model.edges).toEqual([]);
    expect((await op("removeEdge", { id: "e_3" })).status).toBe(404);
  });

  it("400 for malformed bodies", async () => {
    const { s, send } = await boot(await tmp());
    const raw = await s.app.inject({
      method: "POST",
      url: "/api/operations",
      headers: { "content-type": "application/json" },
      payload: "{ nope",
    });
    expect(raw.statusCode).toBe(400);
    expect(raw.json().errors[0].message).toBeTruthy();
    expect((await send("POST", "/api/operations", { type: "boom", input: {} })).status).toBe(400);
    expect((await send("POST", "/api/operations", { type: "addNode" })).status).toBe(400);
    expect((await send("POST", "/api/operations", { type: "removeNode", input: {} })).status).toBe(400);
    expect((await send("POST", "/api/operations", { type: "moveNode", input: { id: "a" } })).status).toBe(400);
    expect((await send("POST", "/api/operations", { type: "addNode", input: {}, expectedRevision: "1" })).status).toBe(400);
  });

  it("uses the real random id generator by default and retries on collision", async () => {
    const d = await tmp();
    const real = await boot(d, { idGenerator: undefined });
    const r = await real.op("addNode", { name: "A", kind: "service" });
    expect(r.body.result.id).toMatch(/^n_[a-z0-9]{6}$/);

    const seq = ["n_a", "n_a", "n_a", "n_b"];
    let i = 0;
    const colliding = await boot(await tmp(), { idGenerator: () => seq[i++]! });
    expect((await colliding.op("addNode", { name: "A", kind: "service" })).body.result.id).toBe("n_a");
    expect((await colliding.op("addNode", { name: "B", kind: "service" })).body.result.id).toBe("n_b");
  });
});

describe("persistence and atomicity", () => {
  it("file equals serializeModel and a new instance loads the same model", async () => {
    const d = await tmp();
    const a = await boot(d);
    await a.op("addNode", { name: "A", kind: "service" });
    const r = await a.op("addNode", { name: "B", kind: "database", parent: null });
    expect(await readFile(modelFile(d), "utf8")).toBe(serializeModel(r.body.model));
    expect(JSON.parse(await readFile(modelFile(d), "utf8")).revision).toBe(r.body.revision);
    await a.s.close();
    const b = await boot(d);
    expect((await b.get("/api/model")).body.model).toEqual(r.body.model);
  });

  it("leaves no temp file behind", async () => {
    const d = await tmp();
    const { op, send } = await boot(d);
    await op("addNode", { name: "A", kind: "service" });
    await send("PUT", "/api/layout", { layout: { schemaVersion: 1, positions: {} } });
    expect((await readdir(join(d, "docs"))).sort()).toEqual(["architecture.json", "architecture.layout.json"]);
  });

  it("a simulated write failure keeps the file and the revision", async () => {
    const d = await tmp();
    let fail = false;
    const { op, get } = await boot(d, {
      fs: {
        rename: async (from, to) => {
          if (fail) throw new Error("disco cheio");
          return rename(from, to);
        },
      },
    });
    await op("addNode", { name: "A", kind: "service" });
    const before = await readFile(modelFile(d), "utf8");
    fail = true;
    const r = await op("addNode", { name: "B", kind: "service" });
    expect(r.status).toBe(500);
    expect(r.body.errors[0].code).toBe("WRITE_FAILED");
    expect(await readFile(modelFile(d), "utf8")).toBe(before);
    expect((await readdir(join(d, "docs"))).filter((f) => f.endsWith(".tmp"))).toEqual([]);
    expect((await get("/api/model")).body.revision).toBe(1);
    fail = false;
    expect((await op("addNode", { name: "B", kind: "service" })).body.revision).toBe(2);
  });
});

describe("concurrency", () => {
  it("two simultaneous writes with the same expectedRevision: one accepted, one REVISION_CONFLICT", async () => {
    const { op } = await boot(await tmp());
    const [a, b] = await Promise.all([
      op("addNode", { name: "A", kind: "service" }, 0),
      op("addNode", { name: "B", kind: "service" }, 0),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.errors[0]).toMatchObject({ code: "REVISION_CONFLICT", currentRevision: 1 });
  });

  it("N simultaneous writes without expectedRevision are all applied", async () => {
    const d = await tmp();
    const { op, get } = await boot(d);
    const N = 25;
    const rs = await Promise.all(Array.from({ length: N }, (_, i) => op("addNode", { name: `N${i}`, kind: "service" })));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(rs.map((r) => r.body.revision).sort((x, y) => x - y)).toEqual(Array.from({ length: N }, (_, i) => i + 1));
    const m = (await get("/api/model")).body;
    expect(m.revision).toBe(N);
    expect(m.model.nodes).toHaveLength(N);
    expect(JSON.parse(await readFile(modelFile(d), "utf8")).revision).toBe(N);
  });
});

describe("layout", () => {
  const layout = { schemaVersion: 1, positions: { n_1: { x: 10, y: 20 }, ghost: { x: 1, y: 1 } } };

  it("PUT keeps the revision, drops orphan ids and persists", async () => {
    const d = await tmp();
    const { op, send, get } = await boot(d);
    await op("addNode", { name: "A", kind: "service" });
    const r = await send("PUT", "/api/layout", { layout });
    expect(r.status).toBe(200);
    expect(r.body.layout.positions).toEqual({ n_1: { x: 10, y: 20 } });
    expect((await get("/api/model")).body.revision).toBe(1);
    expect(JSON.parse(await readFile(modelFile(d), "utf8")).revision).toBe(1);
    expect(JSON.parse(await readFile(layoutFile(d), "utf8")).positions).toEqual({ n_1: { x: 10, y: 20 } });
    expect((await get("/api/layout")).body.layout.positions).toEqual({ n_1: { x: 10, y: 20 } });
  });

  it("removing a node hides its position on the next read", async () => {
    const { op, send, get } = await boot(await tmp());
    await op("addNode", { name: "A", kind: "service" });
    await send("PUT", "/api/layout", { layout });
    await op("removeNode", { id: "n_1" });
    expect((await get("/api/layout")).body.layout.positions).toEqual({});
  });

  it("PUT never raises REVISION_CONFLICT", async () => {
    const { send } = await boot(await tmp());
    const r = await send("PUT", "/api/layout", { layout: { schemaVersion: 1, positions: {} }, expectedRevision: 99 });
    expect(r.status).toBe(200);
  });

  it("malformed shape is refused with SCHEMA_INVALID, path inside the layout, nothing written", async () => {
    const d = await tmp();
    const { send } = await boot(d);
    const r = await send("PUT", "/api/layout", { layout: { schemaVersion: 1, positions: { n_1: { x: 1 } } } });
    expect(r.status).toBe(422);
    expect(r.body.errors[0]).toMatchObject({ code: "SCHEMA_INVALID", path: "/positions/n_1/y" });
    await expect(readFile(layoutFile(d), "utf8")).rejects.toThrow();
    expect((await send("PUT", "/api/layout", {})).status).toBe(400);
  });

  it("still accepts layout writes in the invalid model state", async () => {
    const d = await tmp();
    await writeModel(d, "{ nope");
    const { send } = await boot(d);
    expect((await send("PUT", "/api/layout", { layout })).status).toBe(200);
  });
});

describe("health and binding", () => {
  it("GET /api/health", async () => {
    const { get } = await boot(await tmp());
    expect((await get("/api/health")).body).toEqual({ status: "ok" });
  });

  it("listens only on 127.0.0.1", async () => {
    const s = createServer({ rootDir: await tmp(), port: 0 });
    servers.push(s);
    const addr = await s.start();
    expect(addr.host).toBe("127.0.0.1");
    const real = s.app.server.address();
    expect(real).toMatchObject({ address: "127.0.0.1", family: "IPv4" });
    const res = await fetch(`http://127.0.0.1:${addr.port}/api/health`);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
