import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";
import type { IdGenerator } from "@arquitecture/core";
import type { FsOps } from "./files.js";
import { OPERATION_TYPES, Store, serverError } from "./store.js";
import type { OperationType, ServerError } from "./store.js";

export const HOST = "127.0.0.1";
export const DEFAULT_PORT = 4517;

export interface CreateServerOptions {
  rootDir: string;
  port?: number;
  idGenerator?: IdGenerator;
  /** Pasta com a interface compilada, servida em "/". Sem ela, só a API responde. */
  webDir?: string;
  /** Substitui operações de disco (testes). */
  fs?: Partial<FsOps>;
}

export interface ArchitectureServer {
  app: FastifyInstance;
  store: Store;
  host: string;
  port: number;
  /** Começa a escutar em 127.0.0.1 e devolve o endereço efetivo. */
  start(): Promise<{ host: string; port: number }>;
  close(): Promise<void>;
}

const badRequest = (reply: FastifyReply, path: string, message: string, hint: string) =>
  reply.code(400).send({ errors: [serverError("SCHEMA_INVALID", message, path, hint)] });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function createServer(opts: CreateServerOptions): ArchitectureServer {
  const app = Fastify();
  const store = new Store({ rootDir: opts.rootDir, idGenerator: opts.idGenerator, fs: opts.fs });
  const port = opts.port ?? DEFAULT_PORT;

  app.addHook("onReady", () => store.load());

  if (opts.webDir && existsSync(opts.webDir)) {
    // A API é registrada com rotas próprias, que têm precedência sobre o curinga dos arquivos estáticos.
    void app.register(fastifyStatic, { root: opts.webDir });
  }

  // JSON malformado ou outro erro de parse do corpo vira 400 no formato de erros do núcleo.
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    if (err.statusCode && err.statusCode < 500) {
      return badRequest(reply, "", "O corpo da requisição não é um JSON válido", "Envie um corpo JSON bem formado com Content-Type application/json");
    }
    return reply.code(500).send({ errors: [serverError("WRITE_FAILED", "Erro interno do servidor", "", "Veja o log do servidor")] });
  });

  app.get("/api/health", async () => ({ status: "ok" }));

  app.get("/api/model", async () => ({
    state: store.state,
    revision: store.state === "valid" ? store.model.revision : null,
    model: store.state === "valid" ? store.model : null,
    errors: store.errors,
  }));

  app.post("/api/operations", async (req, reply) => {
    const body = req.body;
    if (!isObject(body)) return badRequest(reply, "", "O corpo deve ser um objeto JSON", "Envie { type, input, expectedRevision? }");
    const { type, input, expectedRevision } = body;
    if (typeof type !== "string" || !(OPERATION_TYPES as readonly string[]).includes(type)) {
      return badRequest(reply, "/type", "Tipo de operação desconhecido", `Use um destes tipos: ${OPERATION_TYPES.join(", ")}`);
    }
    if (!isObject(input)) return badRequest(reply, "/input", "O campo input deve ser um objeto", "Envie os dados da operação em input");
    if (expectedRevision !== undefined && !Number.isInteger(expectedRevision)) {
      return badRequest(reply, "/expectedRevision", "expectedRevision deve ser um inteiro", "Envie a revision lida de GET /api/model");
    }
    const needsId: OperationType[] = ["updateNode", "moveNode", "removeNode", "updateEdge", "removeEdge"];
    if (needsId.includes(type as OperationType) && typeof input.id !== "string") {
      return badRequest(reply, "/input/id", "O campo id é obrigatório e deve ser texto", "Informe o id do nó ou da conexão");
    }
    if (type === "restoreSubtree" && !(Array.isArray(input.nodes) && Array.isArray(input.edges))) {
      return badRequest(reply, "/input", "restoreSubtree exige as listas nodes e edges", "Envie { nodes: [...], edges: [...] } com os itens devolvidos por removeNode");
    }
    if (type === "moveNode" && !("parent" in input && (input.parent === null || typeof input.parent === "string"))) {
      return badRequest(reply, "/input/parent", "O campo parent é obrigatório (id ou null)", "Use o id do novo pai ou null para a raiz");
    }
    const out = await store.applyOperation(type as OperationType, input, expectedRevision as number | undefined);
    if (!out.ok) return reply.code(out.status).send({ errors: out.errors });
    return { revision: out.revision, model: out.model, result: out.result };
  });

  app.get("/api/layout", async () => ({ layout: store.getLayout() }));

  app.put("/api/layout", async (req, reply) => {
    const body = req.body;
    if (!isObject(body) || !("layout" in body)) {
      return badRequest(reply, "/layout", "O corpo deve ter o campo layout", "Envie { layout: { schemaVersion, positions } }");
    }
    const out = await store.putLayout(body.layout);
    if (!out.ok) return reply.code(out.status).send({ errors: out.errors });
    return { layout: out.layout };
  });

  return {
    app,
    store,
    host: HOST,
    port,
    async start() {
      await app.listen({ host: HOST, port });
      const a = app.server.address();
      return { host: HOST, port: typeof a === "object" && a ? a.port : port };
    },
    async close() {
      // Para de aceitar conexões, conclui as requisições em andamento e espera a fila de escrita.
      await app.close();
      await store.drain();
    },
  };
}

export type { ServerError };
