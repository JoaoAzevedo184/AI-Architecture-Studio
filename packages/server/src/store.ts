import { basename, join, resolve } from "node:path";
import {
  addEdge,
  addNode,
  checkRevision,
  createEmptyModel,
  moveNode,
  pruneLayout,
  removeEdge,
  removeNode,
  serializeLayout,
  serializeModel,
  updateEdge,
  updateNode,
  validateLayout,
  validateModel,
} from "@arquitecture/core";
import type { ArchitectureModel, ErrorCode, IdGenerator, LayoutFile, ModelError } from "@arquitecture/core";
import { defaultFs, readIfExists, writeAtomic } from "./files.js";
import type { FsOps } from "./files.js";
import { randomIdGenerator, uniqueIds } from "./ids.js";

/** Erros próprios do servidor, fora da validação do modelo. */
export type ServerErrorCode = ErrorCode | "MODEL_INVALID" | "WRITE_FAILED";
export type ServerError = Omit<ModelError, "code"> & { code: ServerErrorCode };

export const OPERATION_TYPES = [
  "addNode",
  "updateNode",
  "moveNode",
  "removeNode",
  "addEdge",
  "updateEdge",
  "removeEdge",
] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

export type Outcome<T> = ({ ok: true } & T) | { ok: false; status: number; errors: ServerError[] };

export function serverError(code: ServerErrorCode, message: string, path: string, hint: string): ServerError {
  return { code, message, path, hint };
}

/** Código do primeiro erro decide o status HTTP. */
function statusFor(errors: ServerError[]): number {
  switch (errors[0]?.code) {
    case "REVISION_CONFLICT":
      return 409;
    case "NOT_FOUND":
      return 404;
    case "MODEL_INVALID":
      return 503;
    case "WRITE_FAILED":
      return 500;
    default:
      return 422;
  }
}
const failure = (errors: ServerError[]) => ({ ok: false as const, status: statusFor(errors), errors });

export interface StoreOptions {
  rootDir: string;
  idGenerator?: IdGenerator;
  fs?: Partial<FsOps>;
}

export class Store {
  state: "valid" | "invalid" = "valid";
  model: ArchitectureModel;
  errors: ServerError[] = [];
  private layout: LayoutFile = { schemaVersion: 1, positions: {} };
  private tail: Promise<unknown> = Promise.resolve();
  private readonly fs: FsOps;
  private readonly modelPath: string;
  private readonly layoutPath: string;
  private readonly idGenerator: IdGenerator;

  constructor(opts: StoreOptions) {
    const rootDir = resolve(opts.rootDir);
    this.idGenerator = opts.idGenerator ?? randomIdGenerator;
    this.fs = { ...defaultFs, ...opts.fs };
    this.modelPath = join(rootDir, "docs", "architecture.json");
    this.layoutPath = join(rootDir, "docs", "architecture.layout.json");
    this.model = createEmptyModel(basename(rootDir) || "architecture");
  }

  /** Carrega modelo e layout. Modelo inválido deixa o estado "invalid" e nunca é sobrescrito. */
  async load(): Promise<void> {
    const text = await readIfExists(this.fs, this.modelPath);
    if (text !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        this.state = "invalid";
        this.errors = [
          serverError("SCHEMA_INVALID", `O arquivo do modelo não é um JSON válido: ${(e as Error).message}`, "", "Corrija a sintaxe do arquivo ou restaure-o com o Git"),
        ];
        return this.loadLayout();
      }
      const v = validateModel(parsed);
      if (v.ok) this.model = v.model;
      else {
        this.state = "invalid";
        this.errors = v.errors;
      }
    }
    return this.loadLayout();
  }

  private async loadLayout(): Promise<void> {
    try {
      const text = await readIfExists(this.fs, this.layoutPath);
      if (text === null) return;
      const v = validateLayout(JSON.parse(text));
      if (v.ok) this.layout = this.state === "valid" ? pruneLayout(v.layout, this.model) : v.layout;
    } catch {
      // Layout ausente, ilegível ou inválido equivale a "sem posições".
    }
  }

  /** Posições sem ids órfãos, conforme o modelo atual. */
  getLayout(): LayoutFile {
    return this.state === "valid" ? pruneLayout(this.layout, this.model) : this.layout;
  }

  /** Fila única: toda escrita (modelo e layout) passa por aqui, uma por vez. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task);
    this.tail = run.catch(() => undefined);
    return run;
  }

  applyOperation(
    type: OperationType,
    input: Record<string, unknown>,
    expectedRevision?: number,
  ): Promise<Outcome<{ revision: number; model: ArchitectureModel; result: Record<string, unknown> }>> {
    return this.enqueue(async () => {
      if (this.state === "invalid") {
        return failure([
          serverError("MODEL_INVALID", "O arquivo do modelo está inválido; escritas estão recusadas", "", "Corrija ou restaure docs/architecture.json e reinicie a ferramenta"),
        ]);
      }
      if (expectedRevision !== undefined) {
        const c = checkRevision(this.model, expectedRevision);
        if (!c.ok) return failure(c.errors);
      }
      const r = this.run(type, input);
      if (!r.ok) return failure(r.errors);

      // O núcleo não incrementa a revision; o servidor incrementa e grava a mesma revision que devolve.
      const { model: applied, ok: _ok, ...result } = r as Record<string, unknown> & { model: ArchitectureModel };
      const next: ArchitectureModel = { ...applied, revision: this.model.revision + 1 };
      try {
        await writeAtomic(this.fs, this.modelPath, serializeModel(next));
      } catch (e) {
        return failure([serverError("WRITE_FAILED", `Não foi possível gravar o modelo: ${(e as Error).message}`, "", "Verifique permissões e espaço em disco; nada foi alterado")]);
      }
      this.model = next;
      return { ok: true as const, revision: next.revision, model: next, result };
    });
  }

  private run(type: OperationType, i: Record<string, unknown>) {
    const m = this.model;
    const gen = uniqueIds(this.idGenerator, {
      nodes: new Set(m.nodes.map((n) => n.id)),
      edges: new Set(m.edges.map((e) => e.id)),
    });
    const { id, ...rest } = i;
    switch (type) {
      case "addNode":
        return addNode(m, i as never, gen);
      case "updateNode":
        return updateNode(m, id as string, rest as never);
      case "moveNode":
        return moveNode(m, id as string, i.parent as string | null);
      case "removeNode":
        return removeNode(m, id as string);
      case "addEdge":
        return addEdge(m, i as never, gen);
      case "updateEdge":
        return updateEdge(m, id as string, rest as never);
      case "removeEdge":
        return removeEdge(m, id as string);
    }
  }

  /** Grava o layout: só a forma é validada; não mexe na revision; vale a última escrita. */
  putLayout(layout: unknown): Promise<Outcome<{ layout: LayoutFile }>> {
    return this.enqueue(async () => {
      const v = validateLayout(layout);
      if (!v.ok) return failure(v.errors);
      const next = this.state === "valid" ? pruneLayout(v.layout, this.model) : v.layout;
      try {
        await writeAtomic(this.fs, this.layoutPath, serializeLayout(next));
      } catch (e) {
        return failure([serverError("WRITE_FAILED", `Não foi possível gravar o layout: ${(e as Error).message}`, "", "Verifique permissões e espaço em disco; nada foi alterado")]);
      }
      this.layout = next;
      return { ok: true as const, layout: next };
    });
  }
}
