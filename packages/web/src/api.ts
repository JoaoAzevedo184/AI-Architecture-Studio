import type { ArchitectureModel, LayoutFile, ModelError } from "@arquitecture/core";

/** Erros do núcleo mais os de transporte do servidor. */
export type ApiError = Omit<ModelError, "code"> & { code: string };

export interface ModelResponse {
  state: "valid" | "invalid";
  revision: number | null;
  model: ArchitectureModel | null;
  errors: ApiError[];
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; errors: ApiError[] };

/** Servidor inacessível (falha de rede). */
export class NetworkError extends Error {}

async function request<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError("Servidor inacessível");
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new NetworkError("Resposta inválida do servidor");
  }
  if (res.ok) return { ok: true, data: json as T };
  const errors = (json as { errors?: ApiError[] }).errors ?? [];
  return { ok: false, status: res.status, errors };
}

export const getModel = () => request<ModelResponse>("GET", "/api/model");
export const getLayout = () => request<{ layout: LayoutFile }>("GET", "/api/layout");
export const putLayout = (layout: LayoutFile) => request<{ layout: LayoutFile }>("PUT", "/api/layout", { layout });
export const postOperation = (type: string, input: Record<string, unknown>, expectedRevision: number) =>
  request<{ revision: number; model: ArchitectureModel; result: Record<string, unknown> }>("POST", "/api/operations", {
    type,
    input,
    expectedRevision,
  });
