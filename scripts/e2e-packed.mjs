// Teste de aceite da fase 1 contra o binário instalado a partir do tarball (não contra o servidor de desenvolvimento).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });
const work = mkdtempSync(join(tmpdir(), "arq-e2e-pack-"));
let status = 1;
try {
  sh("npm", ["run", "build"]);
  const out = execFileSync("npm", ["pack", "-w", "arquitecture", "--json", "--pack-destination", work], { encoding: "utf8" });
  const tarball = join(work, JSON.parse(out)[0].filename);
  const install = join(work, "install");
  mkdirSync(install);
  sh("npm", ["init", "-y"], { cwd: install, stdio: "ignore" });
  sh("npm", ["install", tarball, "--no-audit", "--no-fund"], { cwd: install, stdio: "ignore" });
  const bin = join(install, "node_modules", ".bin", "arquitecture");
  const r = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
    cwd: "packages/web",
    stdio: "inherit",
    env: { ...process.env, ARQUITECTURE_BIN: bin },
  });
  status = r.status ?? 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(status);
