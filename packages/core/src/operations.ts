import { makeError, validateModel } from "./validate.js";
import type {
  ArchEdge,
  ArchNode,
  ArchitectureModel,
  EdgeKind,
  Failure,
  IdGenerator,
  LensSchemas,
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
/** `null` remove o campo opcional; `undefined` mantém. */
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
  /** Padrão: "sync". */
  kind?: EdgeKind;
}
export interface EdgePatch {
  source?: string;
  target?: string;
  label?: string | null;
  kind?: EdgeKind;
}

/** Nós e conexões removidos por inteiro; serve de entrada para `restoreSubtree`. */
export interface Subtree {
  nodes: ArchNode[];
  edges: ArchEdge[];
}
export interface RemovedSubtree {
  removedNodeIds: string[];
  removedEdgeIds: string[];
  removedNodes: ArchNode[];
  removedEdges: ArchEdge[];
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

/** Valida o modelo resultante inteiro antes de devolver sucesso. */
function finish<T extends object>(model: ArchitectureModel, extra: T, lensSchemas?: LensSchemas): OpResult<T> {
  const v = validateModel(model, lensSchemas);
  return v.ok ? { ok: true, model, ...extra } : { ok: false, errors: v.errors };
}

const fail = (e: ModelError): Failure => ({ ok: false, errors: [e] });

const notFound = (what: "nó" | "conexão", id: string): Failure =>
  fail(
    makeError(
      "NOT_FOUND",
      `O ${what} "${id}" não existe`,
      "/id",
      what === "nó" ? "Consulte a lista de nós (list_nodes) e use um id existente" : "Consulte a lista de conexões do modelo e use um id existente",
    ),
  );

/** Aplica o patch só nos campos permitidos; `null` apaga o campo. */
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

export function addNode(model: ArchitectureModel, input: NewNode, generateId: IdGenerator, lensSchemas?: LensSchemas): OpResult<{ id: string }> {
  const id = generateId("node");
  const node: ArchNode = { id, name: input.name, kind: input.kind, parent: input.parent ?? null };
  if (input.tech !== undefined) node.tech = input.tech;
  if (input.description !== undefined) node.description = input.description;
  return finish({ ...model, nodes: [...model.nodes, node] }, { id }, lensSchemas);
}

export function updateNode(model: ArchitectureModel, id: string, patch: NodePatch, lensSchemas?: LensSchemas): OpResult {
  const i = model.nodes.findIndex((n) => n.id === id);
  if (i < 0) return notFound("nó", id);
  const nodes = [...model.nodes];
  nodes[i] = applyPatch(model.nodes[i]!, patch, ["name", "kind", "tech", "description"]);
  return finish({ ...model, nodes }, {}, lensSchemas);
}

export function moveNode(model: ArchitectureModel, id: string, parent: string | null, lensSchemas?: LensSchemas): OpResult {
  const i = model.nodes.findIndex((n) => n.id === id);
  if (i < 0) return notFound("nó", id);
  const nodes = [...model.nodes];
  nodes[i] = { ...model.nodes[i]!, parent };
  return finish({ ...model, nodes }, {}, lensSchemas);
}

export function removeNode(
  model: ArchitectureModel,
  id: string,
  lensSchemas?: LensSchemas,
): OpResult<RemovedSubtree> {
  if (!model.nodes.some((n) => n.id === id)) return notFound("nó", id);
  // Coleta descendentes; o conjunto `doomed` protege contra ciclos em modelos externos.
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
  const removedNodes = model.nodes.filter((n) => doomed.has(n.id));
  const removedNodeIds = removedNodes.map((n) => n.id);
  const gone = model.edges.filter((e) => doomed.has(e.source) || doomed.has(e.target));
  const removedEdgeIds = gone.map((e) => e.id);
  const removedEdges = gone;
  const next: ArchitectureModel = {
    ...model,
    nodes: model.nodes.filter((n) => !doomed.has(n.id)),
    edges: model.edges.filter((e) => !gone.includes(e)),
  };
  return finish(next, { removedNodeIds, removedEdgeIds, removedNodes, removedEdges }, lensSchemas);
}

/**
 * Reinsere nós e conexões com os ids originais (inversa de `removeNode`).
 * Operação interna da interface; não é ferramenta MCP. Ids repetidos geram DUPLICATE_ID.
 */
export function restoreSubtree(model: ArchitectureModel, subtree: Subtree, lensSchemas?: LensSchemas): OpResult {
  return finish({ ...model, nodes: [...model.nodes, ...subtree.nodes], edges: [...model.edges, ...subtree.edges] }, {}, lensSchemas);
}

export function addEdge(model: ArchitectureModel, input: NewEdge, generateId: IdGenerator, lensSchemas?: LensSchemas): OpResult<{ id: string }> {
  const id = generateId("edge");
  const edge: ArchEdge = { id, source: input.source, target: input.target, kind: input.kind ?? "sync" };
  if (input.label !== undefined) edge.label = input.label;
  return finish({ ...model, edges: [...model.edges, edge] }, { id }, lensSchemas);
}

export function updateEdge(model: ArchitectureModel, id: string, patch: EdgePatch, lensSchemas?: LensSchemas): OpResult {
  const i = model.edges.findIndex((e) => e.id === id);
  if (i < 0) return notFound("conexão", id);
  const edges = [...model.edges];
  edges[i] = applyPatch(model.edges[i]!, patch, ["source", "target", "label", "kind"]);
  return finish({ ...model, edges }, {}, lensSchemas);
}

export function removeEdge(model: ArchitectureModel, id: string, lensSchemas?: LensSchemas): OpResult {
  if (!model.edges.some((e) => e.id === id)) return notFound("conexão", id);
  return finish({ ...model, edges: model.edges.filter((e) => e.id !== id) }, {}, lensSchemas);
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
