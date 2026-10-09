import type { NodeKind } from "@arquitecture/core";

// SVGs do Devicon copiados para src/icons/tech; nenhuma requisição externa.
const files = import.meta.glob("../icons/tech/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

/** As 41 chaves do catálogo inicial (SPEC §9). */
export const TECH_KEYS = [
  "java", "python", "typescript", "javascript", "go", "rust", "csharp", "php",
  "spring", "fastapi", "django", "nodejs", "express", "fastify", "nestjs", "dotnet", "laravel",
  "react", "nextjs", "vue", "angular", "svelte", "reactnative",
  "postgresql", "mysql", "mongodb", "redis", "sqlite", "elasticsearch",
  "kafka", "rabbitmq",
  "docker", "kubernetes", "nginx", "traefik", "caddy", "githubactions",
  "aws", "gcp", "azure", "cloudflare",
] as const;

const byTech = new Map<string, string>();
for (const [path, url] of Object.entries(files)) byTech.set(path.split("/").pop()!.replace(/\.svg$/, ""), url);

export type ResolvedIcon = { type: "tech"; url: string } | { type: "kind"; kind: NodeKind };

/** Ícone da tecnologia; sem `tech` ou com chave desconhecida, cai no ícone do `kind`. */
export function resolveIcon(tech: string | undefined, kind: NodeKind): ResolvedIcon {
  const url = tech ? byTech.get(tech) : undefined;
  return url ? { type: "tech", url } : { type: "kind", kind };
}
