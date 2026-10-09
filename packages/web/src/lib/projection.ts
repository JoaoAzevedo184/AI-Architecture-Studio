import type { ArchEdge, ArchitectureModel } from "@arquitecture/core";

export interface DrawnEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: ArchEdge["kind"];
  /** Algum extremo foi redirecionado para o ancestral visível. */
  aggregated: boolean;
}

export interface ExternalLink {
  edge: ArchEdge;
  /** Se o extremo de dentro do nível é a origem ou o destino. */
  direction: "out" | "in";
}

export interface Projection {
  drawn: DrawnEdge[];
  /** Conexões com um extremo fora do nível, por nó visível. */
  external: Map<string, ExternalLink[]>;
}

/** Filho direto de `level` que contém `id` (ou é o próprio `id`); null se `id` está fora do nível. */
export function visibleAncestor(model: ArchitectureModel, id: string, level: string | null): string | null {
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  let cur = byId.get(id);
  // O limite de passos protege contra ciclos em modelos corrompidos.
  for (let i = 0; cur && i <= model.nodes.length; i++) {
    if (cur.parent === level) return cur.id;
    cur = cur.parent === null ? undefined : byId.get(cur.parent);
  }
  return null;
}

export function projectEdges(model: ArchitectureModel, level: string | null): Projection {
  const drawn: DrawnEdge[] = [];
  const external = new Map<string, ExternalLink[]>();
  const addExternal = (id: string, link: ExternalLink) => external.set(id, [...(external.get(id) ?? []), link]);

  for (const e of model.edges) {
    const s = visibleAncestor(model, e.source, level);
    const t = visibleAncestor(model, e.target, level);
    if (s && t) {
      if (s === t) continue; // os dois extremos caem no mesmo nó visível
      drawn.push({ id: e.id, source: s, target: t, label: e.label, kind: e.kind, aggregated: s !== e.source || t !== e.target });
    } else if (s) addExternal(s, { edge: e, direction: "out" });
    else if (t) addExternal(t, { edge: e, direction: "in" });
  }
  return { drawn, external };
}
