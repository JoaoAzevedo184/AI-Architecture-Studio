import type { ArchitectureModel } from "@arquitecture/core";

export interface Crumb {
  id: string | null;
  name: string;
}

/** Ids do caminho do nó até a raiz, do mais externo ao próprio nó. */
export function ancestry(model: ArchitectureModel, id: string | null): string[] {
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const chain: string[] = [];
  let cur = id === null ? undefined : byId.get(id);
  for (let i = 0; cur && i <= model.nodes.length; i++) {
    chain.unshift(cur.id);
    cur = cur.parent === null ? undefined : byId.get(cur.parent);
  }
  return chain;
}

/** Trilha "Raiz / Docker / API". */
export function breadcrumb(model: ArchitectureModel, level: string | null): Crumb[] {
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  return [{ id: null, name: "Raiz" }, ...ancestry(model, level).map((id) => ({ id, name: byId.get(id)!.name }))];
}

export function parseHash(hash: string): string[] {
  return hash
    .replace(/^#/, "")
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

/** Último id do caminho que ainda existe; se nenhum existir, a raiz. */
export function resolveLevel(model: ArchitectureModel, ids: string[]): string | null {
  const exists = new Set(model.nodes.map((n) => n.id));
  for (let i = ids.length - 1; i >= 0; i--) if (exists.has(ids[i]!)) return ids[i]!;
  return null;
}

export function hashFor(model: ArchitectureModel, level: string | null): string {
  return "#/" + ancestry(model, level).map(encodeURIComponent).join("/");
}
