import { EDGE_KINDS, NODE_KINDS, SCHEMA_VERSION } from "./types.js";

const str = { type: "string", minLength: 1 } as const;

export const modelSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "revision", "meta", "nodes", "edges"],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    revision: { type: "integer", minimum: 0 },
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: { name: str, description: { type: "string" } },
    },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "kind", "parent"],
        properties: {
          id: str,
          name: str,
          kind: { enum: [...NODE_KINDS] },
          tech: str,
          description: { type: "string" },
          parent: { type: ["string", "null"], minLength: 1 },
          // Lente desconhecida é preservada: valor livre.
          lenses: { type: "object" },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "source", "target", "kind"],
        properties: {
          id: str,
          source: str,
          target: str,
          label: { type: "string" },
          kind: { enum: [...EDGE_KINDS] },
        },
      },
    },
  },
} as const;

export const layoutSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "positions"],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    positions: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        required: ["x", "y"],
        properties: { x: { type: "number" }, y: { type: "number" } },
      },
    },
  },
} as const;
