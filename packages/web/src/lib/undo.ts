import type { ArchitectureModel } from "@arquitecture/core";

export interface Op {
  type: string;
  input: Record<string, unknown>;
}

const NODE_FIELDS = ["name", "kind", "tech", "description"] as const;
const EDGE_FIELDS = ["source", "target", "label", "kind"] as const;

function restoring(fields: readonly string[], input: Record<string, unknown>, before: Record<string, unknown>) {
  const out: Record<string, unknown> = { id: input.id };
  for (const f of fields) if (input[f] !== undefined) out[f] = before[f] ?? null;
  return out;
}

/**
 * Operação inversa de `op`, calculada com o modelo de antes.
 * "clear" = não há inversa (remoção de nó não recria os ids): a pilha é esvaziada.
 */
export function inverseOf(op: Op, before: ArchitectureModel, result: Record<string, unknown>): Op | "clear" {
  const { type, input } = op;
  switch (type) {
    case "addNode":
      return { type: "removeNode", input: { id: result.id } };
    case "addEdge":
      return { type: "removeEdge", input: { id: result.id } };
    case "updateNode": {
      const n = before.nodes.find((x) => x.id === input.id);
      return n ? { type, input: restoring(NODE_FIELDS, input, n as never) } : "clear";
    }
    case "updateEdge": {
      const e = before.edges.find((x) => x.id === input.id);
      return e ? { type, input: restoring(EDGE_FIELDS, input, e as never) } : "clear";
    }
    case "moveNode": {
      const n = before.nodes.find((x) => x.id === input.id);
      return n ? { type, input: { id: n.id, parent: n.parent } } : "clear";
    }
    case "removeEdge": {
      const e = before.edges.find((x) => x.id === input.id);
      if (!e) return "clear";
      const { id: _id, ...rest } = e;
      return { type: "addEdge", input: rest };
    }
    default:
      return "clear";
  }
}
