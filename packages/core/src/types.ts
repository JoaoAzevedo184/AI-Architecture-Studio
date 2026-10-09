export const NODE_KINDS = [
  "external",
  "proxy",
  "group",
  "service",
  "frontend",
  "database",
  "cache",
  "queue",
  "storage",
] as const;
export const EDGE_KINDS = ["sync", "async", "data"] as const;

export type NodeKind = (typeof NODE_KINDS)[number];
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const SCHEMA_VERSION = 1;

export interface ModelMeta {
  name: string;
  description?: string;
}

export interface ArchNode {
  id: string;
  name: string;
  kind: NodeKind;
  tech?: string;
  description?: string;
  parent: string | null;
  lenses?: Record<string, unknown>;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: EdgeKind;
}

export interface ArchitectureModel {
  schemaVersion: 1;
  revision: number;
  meta: ModelMeta;
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface Position {
  x: number;
  y: number;
}

export interface LayoutFile {
  schemaVersion: 1;
  positions: Record<string, Position>;
}

/** Lens name to JSON Schema for the `node.lenses[name]` fragment. */
export type LensSchemas = Record<string, object>;

/** Injected id generator; the server provides the real one. */
export type IdGenerator = (entity: "node" | "edge") => string;

export type ErrorCode =
  | "SCHEMA_INVALID"
  | "DUPLICATE_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_CYCLE"
  | "EDGE_ENDPOINT_NOT_FOUND"
  | "EDGE_SELF_LOOP"
  | "EDGE_TO_ANCESTOR"
  | "LENS_INVALID"
  | "REVISION_CONFLICT";

export interface ModelError {
  code: ErrorCode;
  message: string;
  /** JSON pointer (RFC 6901) inside the validated document; "" is the root. */
  path: string;
  hint: string;
  /** Only on REVISION_CONFLICT. */
  currentRevision?: number;
}

export type Failure = { ok: false; errors: ModelError[] };
