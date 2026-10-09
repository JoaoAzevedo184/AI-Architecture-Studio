import { makeError, validateModel } from "./validate.js";
import type {
  ArchEdge,
  ArchNode,
  ArchitectureModel,
  EdgeKind,
  Failure,
  IdGenerator,
  ModelError,
  NodeKind,
} from "./types.js";
import { SCHEMA_VERSION } from "./types.js";

export type Success<T = unknown> = { ok: true; model: ArchitectureModel } & T;
export type OpResult<T = unknown> = Success<T> | Failure;

export interface NewNode {
  name: string;
  kind: NodeKind;
  tech?: string;
  description?: string;
  parent?: string | null;
}
/** `null` removes the optional field; `undefined` keeps it. */
export interface NodePatch {
  name?: string;
  kind?: NodeKind;
  tech?: string | null;
  description?: string | null;
}
export interface NewEdge {
  source: string;
  target: string;
  label?: string;
  /** Defaults to "sync". */
  kind?: EdgeKind;
}
export interface EdgePatch {
  source?: string;
  target?: string;
  label?: string | null;
  kind?: EdgeKind;
}

export function createEmptyModel(name: string, description?: string): ArchitectureModel {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    meta: description === undefined ? { name } : { name, description },
    nodes: [],
    edges: [],
  };
}

/** Validates the whole resulting model before returning success. */
function finish<T extends object>(model: ArchitectureModel, extra: T): OpResult<T> {
  const v = validateModel(model);
  return v.ok ? { ok: true, model, ...extra } : { ok: false, errors: v.errors };
}

const fail = (e: ModelError): Failure => ({ ok: false, errors: [e] });

const notFound = (what: "nó" | "conexão", id: string): Failure =>
  fail(
    makeError(
      "SCHEMA_INVALID",
      `O ${what} "${id}" não existe`,
      "/id",
      what === "nó" ? "Use um id de nó existente (veja list_nodes)" : "Use um id de conexão existente",
    ),
  );

/** Applies the patch to whitelisted fields only; `null` deletes the field. */
function applyPatch<T extends object>(base: T, patch: object, fields: readonly string[]): T {
  const out = { ...base } as Record<string, unknown>;
  const p = patch as Record<string, unknown>;
  for (const f of fields) {
    if (p[f] === undefined) continue;
    if (p[f] === null) delete out[f];
    else out[f] = p[f];
  }
  return out as T;
}

export function addNode(model: ArchitectureModel, input: NewNode, generateId: IdGenerator): OpResult<{ id: string }> {
  const id = generateId("node");
  const node: ArchNode = { id, name: input.name, kind: input.kind, parent: input.parent ?? null };
  if (input.tech !== undefined) node.tech = input.tech;
  if (input.description !== undefined) node.description = input.description;
  return finish({ ...model, nodes: [...model.nodes, node] }, { id });
}

export function updateNode(model: ArchitectureModel, id: string, patch: NodePatch): OpResult {
  const i = model.nodes.findIndex((n) => n.id === id);
  if (i < 0) return notFound("nó", id);
  const nodes = [...model.nodes];
  nodes[i] = applyPatch(model.nodes[i]!, patch, ["name", "kind", "tech", "description"]);
  return finish({ ...model, nodes }, {});
}

export function moveNode(model: ArchitectureModel, id: string, parent: string | null): OpResult {
  const i = model.nodes.findIndex((n) => n.id === id);
  if (i < 0) return notFound("nó", id);
  const nodes = [...model.nodes];
  nodes[i] = { ...model.nodes[i]!, parent };
  return finish({ ...model, nodes }, {});
}

export function removeNode(
  model: ArchitectureModel,
  id: string,
): OpResult<{ removedNodeIds: string[]; removedEdgeIds: string[] }> {
  if (!model.nodes.some((n) => n.id === id)) return notFound("nó", id);
  // Collects descendants; the visited set guards against cycles in external models.
  const doomed = new Set<string>([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const n of model.nodes) {
      if (n.parent !== null && doomed.has(n.parent) && !doomed.has(n.id)) {
        doomed.add(n.id);
        grew = true;
      }
    }
  }
  const removedNodeIds = model.nodes.filter((n) => doomed.has(n.id)).map((n) => n.id);
  const gone = model.edges.filter((e) => doomed.has(e.source) || doomed.has(e.target));
  const removedEdgeIds = gone.map((e) => e.id);
  const next: ArchitectureModel = {
    ...model,
    nodes: model.nodes.filter((n) => !doomed.has(n.id)),
    edges: model.edges.filter((e) => !gone.includes(e)),
  };
  return finish(next, { removedNodeIds, removedEdgeIds });
}

export function addEdge(model: ArchitectureModel, input: NewEdge, generateId: IdGenerator): OpResult<{ id: string }> {
  const id = generateId("edge");
  const edge: ArchEdge = { id, source: input.source, target: input.target, kind: input.kind ?? "sync" };
  if (input.label !== undefined) edge.label = input.label;
  return finish({ ...model, edges: [...model.edges, edge] }, { id });
}

export function updateEdge(model: ArchitectureModel, id: string, patch: EdgePatch): OpResult {
  const i = model.edges.findIndex((e) => e.id === id);
  if (i < 0) return notFound("conexão", id);
  const edges = [...model.edges];
  edges[i] = applyPatch(model.edges[i]!, patch, ["source", "target", "label", "kind"]);
  return finish({ ...model, edges }, {});
}

export function removeEdge(model: ArchitectureModel, id: string): OpResult {
  if (!model.edges.some((e) => e.id === id)) return notFound("conexão", id);
  return finish({ ...model, edges: model.edges.filter((e) => e.id !== id) }, {});
}

export function checkRevision(model: ArchitectureModel, expectedRevision: number): { ok: true } | Failure {
  if (model.revision === expectedRevision) return { ok: true };
  return {
    ok: false,
    errors: [
      {
        ...makeError(
          "REVISION_CONFLICT",
          `A operação usou a revisão ${expectedRevision}, mas a revisão corrente é ${model.revision}`,
          "/revision",
          "Releia o modelo e refaça a operação sobre a revisão corrente",
        ),
        currentRevision: model.revision,
      },
    ],
  };
}
