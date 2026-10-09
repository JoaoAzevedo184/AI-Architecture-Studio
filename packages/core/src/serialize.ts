import type { ArchEdge, ArchNode, ArchitectureModel, LayoutFile } from "./types.js";

/** Sorts object keys recursively; arrays keep their order. */
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .map((k) => [k, sortKeys(o[k])]),
    );
  }
  return v;
}

/** Builds an object with keys in the given order, skipping undefined ones. */
function ordered(src: object, keys: readonly string[]): Record<string, unknown> {
  const s = src as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (s[k] !== undefined) out[k] = s[k];
  return out;
}

const text = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

const node = (n: ArchNode) => {
  const o = ordered(n, ["id", "name", "kind", "tech", "description", "parent"]);
  if (n.lenses !== undefined) o.lenses = sortKeys(n.lenses);
  return o;
};
const edge = (e: ArchEdge) => ordered(e, ["id", "source", "target", "label", "kind"]);

export function serializeModel(model: ArchitectureModel): string {
  return text({
    schemaVersion: model.schemaVersion,
    revision: model.revision,
    meta: ordered(model.meta, ["name", "description"]),
    nodes: model.nodes.map(node),
    edges: model.edges.map(edge),
  });
}

export function serializeLayout(layout: LayoutFile): string {
  const positions: Record<string, unknown> = {};
  for (const id of Object.keys(layout.positions).sort()) {
    positions[id] = ordered(layout.positions[id]!, ["x", "y"]);
  }
  return text({ schemaVersion: layout.schemaVersion, positions });
}
