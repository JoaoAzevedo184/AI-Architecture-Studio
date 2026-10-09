// Empacota CLI + core + server em dist/cli.js e copia a interface compilada para dist/web.
import { build } from "esbuild";
import { chmodSync, cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const pkg = JSON.parse(readFileSync(here("../package.json"), "utf8"));
const webDist = here("../../web/dist");
if (!existsSync(webDist + "/index.html")) {
  console.error("A interface ainda não foi compilada (packages/web/dist). Rode `npm run build -w @arquitecture/web` antes.");
  process.exit(1);
}

rmSync(here("../dist"), { recursive: true, force: true });
await build({
  entryPoints: [here("../src/cli.ts")],
  outfile: here("../dist/cli.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // Dependências de execução reais (fastify, ajv...) ficam fora do bundle; os pacotes privados entram nele.
  packages: "external",
  alias: {
    "@arquitecture/core": here("../../core/src/index.ts"),
    "@arquitecture/server": here("../../server/src/index.ts"),
  },
  define: { __VERSION__: JSON.stringify(pkg.version) },
});
chmodSync(here("../dist/cli.js"), 0o755);
cpSync(webDist, here("../dist/web"), { recursive: true });
console.log("CLI empacotada em packages/cli/dist");
