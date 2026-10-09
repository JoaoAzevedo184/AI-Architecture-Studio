import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";
import { layoutSchema, modelSchema } from "./schema.js";
import type {
  ArchitectureModel,
  ErrorCode,
  Failure,
  LayoutFile,
  LensSchemas,
  ModelError,
} from "./types.js";

// logger: false evita console.warn (o núcleo não faz I/O); strict: false aceita esquemas de lente livres.
const ajv = new Ajv({ allErrors: true, strict: false, logger: false });
const validateModelShape = ajv.compile(modelSchema);
const validateLayoutShape = ajv.compile(layoutSchema);
const lensValidators = new WeakMap<object, ValidateFunction>();

export const pointer = (...parts: (string | number)[]): string =>
  parts.map((p) => "/" + String(p).replace(/~/g, "~0").replace(/\//g, "~1")).join("");

export function makeError(
  code: ErrorCode,
  message: string,
  path: string,
  hint: string,
): ModelError {
  return { code, message, path, hint };
}

/** Traduz um erro do Ajv para o formato estruturado, com texto em português. */
function fromAjv(err: ErrorObject, code: ErrorCode, base: string): ModelError {
  const p = err.params as Record<string, unknown>;
  let path = base + err.instancePath;
  const where = path || "/";
  switch (err.keyword) {
    case "required": {
      const prop = String(p.missingProperty);
      path += pointer(prop);
      return makeError(code, `O campo obrigatório "${prop}" está ausente`, path, `Informe o campo "${prop}" em ${where}`);
    }
    case "additionalProperties": {
      const prop = String(p.additionalProperty);
      path += pointer(prop);
      return makeError(code, `O campo "${prop}" não faz parte do esquema`, path, `Remova o campo "${prop}" ou corrija o nome`);
    }
    case "enum": {
      const allowed = (p.allowedValues as unknown[]).map((v) => `"${String(v)}"`).join(", ");
      return makeError(code, `O valor em ${where} não está entre os permitidos`, path, `Use um destes valores: ${allowed}`);
    }
    case "const":
      return makeError(code, `O valor em ${where} deve ser ${JSON.stringify(p.allowedValue)}`, path, `Use exatamente ${JSON.stringify(p.allowedValue)}`);
    case "type":
      return makeError(code, `O valor em ${where} deve ser do tipo ${[p.type].flat().join(" ou ")}`, path, `Corrija o tipo do valor em ${where}`);
    case "minLength":
      return makeError(code, `O texto em ${where} não pode ser vazio`, path, "Informe um texto não vazio");
    case "minimum":
      return makeError(code, `O número em ${where} deve ser no mínimo ${String(p.limit)}`, path, `Use um valor maior ou igual a ${String(p.limit)}`);
    default:
      return makeError(code, `O valor em ${where} não obedece ao esquema (${err.keyword})`, path, "Confira o valor contra o esquema");
  }
}

const fromAjvAll = (errs: ErrorObject[] | null | undefined, code: ErrorCode, base = ""): ModelError[] =>
  (errs ?? []).map((e) => fromAjv(e, code, base));

/** Ids dos ancestrais de `id`; seguro contra ciclos. */
function ancestorsOf(id: string, byId: Map<string, { parent: string | null }>): Set<string> {
  const seen = new Set<string>();
  let cur = byId.get(id)?.parent ?? null;
  while (cur !== null && !seen.has(cur)) {
    seen.add(cur);
    cur = byId.get(cur)?.parent ?? null;
  }
  return seen;
}

function integrityErrors(model: ArchitectureModel, lensSchemas: LensSchemas): ModelError[] {
  const errors: ModelError[] = [];
  const byId = new Map<string, ArchitectureModel["nodes"][number]>();

  model.nodes.forEach((n, i) => {
    if (byId.has(n.id)) {
      errors.push(makeError("DUPLICATE_ID", `Já existe um nó com o id "${n.id}"`, pointer("nodes", i, "id"), "Os ids de nós são gerados pelo servidor; não os repita"));
    } else byId.set(n.id, n);
  });
  const edgeIds = new Set<string>();
  model.edges.forEach((e, i) => {
    if (edgeIds.has(e.id)) {
      errors.push(makeError("DUPLICATE_ID", `Já existe uma conexão com o id "${e.id}"`, pointer("edges", i, "id"), "Os ids de conexões são gerados pelo servidor; não os repita"));
    } else edgeIds.add(e.id);
  });

  model.nodes.forEach((n, i) => {
    if (n.parent !== null && !byId.has(n.parent)) {
      errors.push(makeError("PARENT_NOT_FOUND", `O pai "${n.parent}" do nó "${n.id}" não existe`, pointer("nodes", i, "parent"), "Crie o pai antes ou use o id de um nó existente (ou null para a raiz)"));
    }
    if (n.parent !== null && (n.parent === n.id || ancestorsOf(n.id, byId).has(n.id))) {
      errors.push(makeError("PARENT_CYCLE", `O nó "${n.id}" seria ancestral de si mesmo`, pointer("nodes", i, "parent"), "Escolha um pai que não seja o próprio nó nem um de seus descendentes"));
    }
    for (const [name, data] of Object.entries(n.lenses ?? {})) {
      const schema = Object.hasOwn(lensSchemas, name) ? lensSchemas[name] : undefined;
      if (!schema) continue;
      let v = lensValidators.get(schema);
      if (!v) lensValidators.set(schema, (v = ajv.compile(schema)));
      if (!v(data)) {
        errors.push(...fromAjvAll(v.errors, "LENS_INVALID", pointer("nodes", i, "lenses", name)));
      }
    }
  });

  model.edges.forEach((e, i) => {
    const src = byId.has(e.source);
    const tgt = byId.has(e.target);
    if (!src) errors.push(makeError("EDGE_ENDPOINT_NOT_FOUND", `A origem "${e.source}" não existe`, pointer("edges", i, "source"), "Crie o nó antes ou use um id existente"));
    if (!tgt) errors.push(makeError("EDGE_ENDPOINT_NOT_FOUND", `O destino "${e.target}" não existe`, pointer("edges", i, "target"), "Crie o nó antes ou use um id existente"));
    if (!src || !tgt) return;
    if (e.source === e.target) {
      errors.push(makeError("EDGE_SELF_LOOP", `A conexão liga o nó "${e.source}" a ele mesmo`, pointer("edges", i, "target"), "Escolha um destino diferente da origem"));
    } else if (ancestorsOf(e.source, byId).has(e.target) || ancestorsOf(e.target, byId).has(e.source)) {
      errors.push(makeError("EDGE_TO_ANCESTOR", `A conexão liga "${e.source}" e "${e.target}", que são um nó e seu ancestral`, pointer("edges", i, "target"), "Conecte o nó a um nó que não seja seu ancestral nem seu descendente"));
    }
  });

  return errors;
}

export type ModelValidation = { ok: true; model: ArchitectureModel } | Failure;
export type LayoutValidation = { ok: true; layout: LayoutFile } | Failure;

/**
 * Valida forma (JSON Schema) e integridade. Se a forma falhar, só os erros de
 * forma são devolvidos: as regras de integridade pressupõem um documento bem formado.
 */
export function validateModel(model: unknown, lensSchemas: LensSchemas = {}): ModelValidation {
  if (!validateModelShape(model)) {
    return { ok: false, errors: fromAjvAll(validateModelShape.errors, "SCHEMA_INVALID") };
  }
  const typed = model as unknown as ArchitectureModel;
  const errors = integrityErrors(typed, lensSchemas);
  return errors.length ? { ok: false, errors } : { ok: true, model: typed };
}

export function validateLayout(layout: unknown): LayoutValidation {
  if (!validateLayoutShape(layout)) {
    return { ok: false, errors: fromAjvAll(validateLayoutShape.errors, "SCHEMA_INVALID") };
  }
  return { ok: true, layout: layout as unknown as LayoutFile };
}

/** Descarta posições de ids que não existem no modelo. */
export function pruneLayout(layout: LayoutFile, model: ArchitectureModel): LayoutFile {
  const ids = new Set(model.nodes.map((n) => n.id));
  const positions: LayoutFile["positions"] = {};
  for (const [id, pos] of Object.entries(layout.positions)) if (ids.has(id)) positions[id] = pos;
  return { ...layout, positions };
}
