import { create } from "zustand";
import type { ArchEdge, ArchNode, ArchitectureModel, NodeKind, Position } from "@arquitecture/core";
import { NetworkError, getLayout, getModel, postOperation, putLayout } from "./api.js";
import type { ApiError } from "./api.js";
import { placeOnGrid } from "./lib/grid.js";
import { hashFor, parseHash, resolveLevel } from "./lib/route.js";
import { inverseOf } from "./lib/undo.js";
import type { Op } from "./lib/undo.js";

export type Status = "loading" | "ready" | "unreachable" | "invalid";
export type Selection = { kind: "node" | "edge"; id: string } | null;
export interface Toast {
  id: number;
  text: string;
  tone: "error" | "info";
}
export interface RemoveRequest {
  nodeId: string;
  nodes: number;
  edges: number;
}

export const KIND_LABEL: Record<NodeKind, string> = {
  external: "Externo",
  proxy: "Proxy",
  group: "Grupo",
  service: "Serviço",
  frontend: "Frontend",
  database: "Banco de dados",
  cache: "Cache",
  queue: "Fila",
  storage: "Armazenamento",
};

interface State {
  status: Status;
  model: ArchitectureModel | null;
  revision: number;
  errors: ApiError[];
  layout: Record<string, Position>;
  /** Caminho de ids vindo da URL; o nível é o último que ainda existe. */
  path: string[];
  selection: Selection;
  tab: "diagram" | "json";
  toasts: Toast[];
  undoStack: Op[];
  removeRequest: RemoveRequest | null;
}

export const useStore = create<State>(() => ({
  status: "loading",
  model: null,
  revision: 0,
  errors: [],
  layout: {},
  path: parseHash(typeof location === "undefined" ? "" : location.hash),
  selection: null,
  tab: "diagram",
  toasts: [],
  undoStack: [],
  removeRequest: null,
}));

const set = useStore.setState;
const get = useStore.getState;

/** Nível atual (id do nó em que se entrou; null = raiz). */
export function currentLevel(s: Pick<State, "model" | "path">): string | null {
  return s.model ? resolveLevel(s.model, s.path) : null;
}

let toastSeq = 0;
export function notify(text: string, tone: Toast["tone"] = "error"): void {
  const id = ++toastSeq;
  set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
  setTimeout(() => dismissToast(id), 6000);
}
export const dismissToast = (id: number) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));

const showErrors = (errors: ApiError[]) => {
  if (!errors.length) notify("Erro desconhecido do servidor");
  for (const e of errors) notify(e.message + (e.hint ? ` — ${e.hint}` : ""));
};

/** Carrega modelo e layout do servidor. */
export async function load(): Promise<void> {
  try {
    const m = await getModel();
    if (!m.ok) return void set({ status: "unreachable" });
    if (m.data.state === "invalid" || !m.data.model) {
      return void set({ status: "invalid", errors: m.data.errors, model: null });
    }
    const l = await getLayout();
    set({
      status: "ready",
      model: m.data.model,
      revision: m.data.model.revision,
      errors: [],
      layout: l.ok ? l.data.layout.positions : {},
    });
    syncHash();
  } catch (e) {
    if (e instanceof NetworkError) set({ status: "unreachable" });
    else throw e;
  }
}

/** Mantém a URL no caminho canônico do nível atual (ex.: ancestral, se o nó sumiu). */
function syncHash(): void {
  const s = get();
  if (!s.model) return;
  const want = hashFor(s.model, currentLevel(s));
  if (location.hash !== want && !(want === "#/" && (location.hash === "" || location.hash === "#"))) {
    history.replaceState(null, "", want);
    set({ path: parseHash(want) });
  }
}

export function onHashChange(): void {
  set({ path: parseHash(location.hash) });
}

export function navigate(id: string | null): void {
  const m = get().model;
  if (m) location.hash = hashFor(m, id);
}

export const select = (selection: Selection) => set({ selection });
export const setTab = (tab: State["tab"]) => set({ tab });

// Fila no cliente: cada edição usa a revision devolvida pela anterior.
let chain: Promise<unknown> = Promise.resolve();

export function exec(op: Op, opts: { fromUndo?: boolean } = {}): Promise<{ ok: boolean; result: Record<string, unknown> }> {
  const run = chain.then(() => execNow(op, opts));
  chain = run.catch(() => undefined);
  return run;
}

async function execNow(op: Op, opts: { fromUndo?: boolean }): Promise<{ ok: boolean; result: Record<string, unknown> }> {
  const before = get().model;
  if (!before) return { ok: false, result: {} };
  try {
    const r = await postOperation(op.type, op.input, get().revision);
    if (r.ok) {
      const { model, revision, result } = r.data;
      const inv = opts.fromUndo ? null : inverseOf(op, before, result);
      set((s) => ({
        model,
        revision,
        undoStack: inv === null ? s.undoStack : inv === "clear" ? [] : [...s.undoStack, inv],
        selection: stillExists(model, s.selection) ? s.selection : null,
      }));
      syncHash();
      return { ok: true, result };
    }
    if (r.status === 409) {
      set({ undoStack: [] });
      await load();
      notify("O modelo mudou no servidor e foi recarregado. Refaça a edição.", "info");
    } else if (r.status === 503) {
      await load();
    } else showErrors(r.errors);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    notify("Servidor inacessível. A edição não foi gravada.");
  }
  return { ok: false, result: {} };
}

function stillExists(model: ArchitectureModel, sel: Selection): boolean {
  if (!sel) return false;
  return sel.kind === "node" ? model.nodes.some((n) => n.id === sel.id) : model.edges.some((e) => e.id === sel.id);
}

export async function undo(): Promise<void> {
  const stack = get().undoStack;
  const op = stack[stack.length - 1];
  if (!op) return notify("Nada para desfazer", "info");
  set({ undoStack: stack.slice(0, -1) });
  await exec(op, { fromUndo: true });
}

// Posições: otimista no cliente (evita voltar ao soltar o nó); a resposta do servidor prevalece.
let layoutChain: Promise<unknown> = Promise.resolve();

export function savePosition(id: string, pos: Position): Promise<void> {
  set((s) => ({ layout: { ...s.layout, [id]: pos } }));
  const run = layoutChain.then(async () => {
    try {
      const r = await putLayout({ schemaVersion: 1, positions: get().layout });
      if (r.ok) set({ layout: r.data.layout.positions });
      else showErrors(r.errors);
    } catch (e) {
      if (!(e instanceof NetworkError)) throw e;
      notify("Servidor inacessível. A posição não foi gravada.");
    }
  });
  layoutChain = run.catch(() => undefined);
  return run;
}

/** Cria um nó no nível atual e grava a posição (a dada ou a próxima livre da grade). */
export async function createNode(kind: NodeKind, at?: Position): Promise<void> {
  const s = get();
  if (!s.model) return;
  const level = currentLevel(s);
  const r = await exec({ type: "addNode", input: { name: `Novo ${KIND_LABEL[kind].toLowerCase()}`, kind, parent: level } });
  if (!r.ok) return;
  const id = r.result.id as string;
  const after = get();
  const siblings = after.model!.nodes.filter((n) => n.parent === level).map((n) => n.id);
  const pos = at ?? placeOnGrid(siblings, after.layout)[id]!;
  set({ selection: { kind: "node", id } });
  await savePosition(id, pos);
}

export async function connect(source: string, target: string): Promise<void> {
  const r = await exec({ type: "addEdge", input: { source, target } });
  if (r.ok) set({ selection: { kind: "edge", id: r.result.id as string } });
}

/** Descendentes (inclusive o próprio nó) e conexões que seriam removidos. */
export function cascadeOf(model: ArchitectureModel, nodeId: string): { nodes: string[]; edges: string[] } {
  const doomed = new Set([nodeId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const n of model.nodes) {
      if (n.parent !== null && doomed.has(n.parent) && !doomed.has(n.id)) {
        doomed.add(n.id);
        grew = true;
      }
    }
  }
  return {
    nodes: [...doomed],
    edges: model.edges.filter((e) => doomed.has(e.source) || doomed.has(e.target)).map((e) => e.id),
  };
}

/** Remove o item selecionado; nó com cascata pede confirmação. */
export function requestRemove(sel: NonNullable<Selection>): void {
  const m = get().model;
  if (!m) return;
  if (sel.kind === "edge") return void exec({ type: "removeEdge", input: { id: sel.id } });
  const c = cascadeOf(m, sel.id);
  if (c.nodes.length > 1 || c.edges.length > 0) {
    set({ removeRequest: { nodeId: sel.id, nodes: c.nodes.length, edges: c.edges.length } });
  } else void exec({ type: "removeNode", input: { id: sel.id } });
}

export async function confirmRemove(): Promise<void> {
  const req = get().removeRequest;
  set({ removeRequest: null });
  if (req) await exec({ type: "removeNode", input: { id: req.nodeId } });
}
export const cancelRemove = () => set({ removeRequest: null });

export function findNode(model: ArchitectureModel, id: string): ArchNode | undefined {
  return model.nodes.find((n) => n.id === id);
}
export function findEdge(model: ArchitectureModel, id: string): ArchEdge | undefined {
  return model.edges.find((e) => e.id === id);
}
