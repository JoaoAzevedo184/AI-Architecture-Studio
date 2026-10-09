import { execFileSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Gera o tarball com `npm pack`, instala fora do monorepo e executa o binário instalado.
const cliDir = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4631;
const BASE = `http://127.0.0.1:${PORT}`;

let work: string;
let project: string;
let bin: string;
let child: ChildProcess | undefined;
let output = "";

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), "arq-pkg-"));
  const install = join(work, "install");
  project = join(work, "project");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(install);
  await mkdir(project);
  const out = execFileSync("npm", ["pack", "--json", "--pack-destination", work], { cwd: cliDir, encoding: "utf8" });
  const tarball = join(work, JSON.parse(out)[0].filename);
  execFileSync("npm", ["init", "-y"], { cwd: install, stdio: "ignore" });
  execFileSync("npm", ["install", tarball, "--no-audit", "--no-fund"], { cwd: install, stdio: "ignore" });
  bin = join(install, "node_modules", ".bin", "arquitecture");
});

afterAll(async () => {
  child?.kill("SIGKILL");
  await rm(work, { recursive: true, force: true });
});

async function waitHealth() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      /* subindo */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("binário não subiu:\n" + output);
}

describe("installed tarball", () => {
  it("--version and --help work", () => {
    const v = execFileSync(bin, ["--version"], { encoding: "utf8" }).trim();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
    expect(execFileSync(bin, ["--help"], { encoding: "utf8" })).toContain("--no-open");
  });

  it("serves health, the interface and writes docs/architecture.json in the working directory", async () => {
    child = spawn(bin, ["--no-open", "--port", String(PORT)], { cwd: project, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout!.on("data", (d) => (output += d));
    child.stderr!.on("data", (d) => (output += d));
    await waitHealth();

    expect(await (await fetch(`${BASE}/api/health`)).json()).toEqual({ status: "ok" });
    const html = await (await fetch(`${BASE}/`)).text();
    expect(html).toContain('<div id="root">');
    const js = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    expect(js).toBeTruthy();
    expect((await fetch(BASE + js!)).status).toBe(200);

    expect(output).toContain(BASE);
    expect(output).toContain(join(project, "docs", "architecture.json"));
    expect(output).toContain("ainda não existe");
    expect(existsSync(join(project, "docs"))).toBe(false);

    const res = await fetch(`${BASE}/api/operations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "addNode", input: { name: "API", kind: "service" } }),
    });
    expect(res.status).toBe(200);
    const model = JSON.parse(await readFile(join(project, "docs", "architecture.json"), "utf8"));
    expect(model.revision).toBe(1);
    expect(model.nodes[0].name).toBe("API");
  });

  it("a busy explicit port exits non-zero with a clear message", () => {
    let failure: { status: number | null; stderr: string } | undefined;
    try {
      execFileSync(bin, ["--no-open", "--port", String(PORT)], { cwd: project, encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      const err = e as { status: number | null; stderr: string };
      failure = { status: err.status, stderr: err.stderr };
    }
    expect(failure?.status).toBe(1);
    expect(failure?.stderr).toContain(`porta ${PORT} já está em uso`);
  });

  it("without --port, falls back to a free port when the default one is taken", async () => {
    const second = spawn(bin, ["--no-open"], { cwd: project, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ARQUITECTURE_PORT: String(PORT) } });
    let out = "";
    second.stdout!.on("data", (d) => (out += d));
    for (let i = 0; i < 100 && !out.includes("Ctrl+C"); i++) await new Promise((r) => setTimeout(r, 100));
    expect(out).toContain(`http://127.0.0.1:${PORT + 1}`);
    const code = await new Promise<number | null>((resolve) => {
      second.once("exit", (c) => resolve(c));
      second.kill("SIGINT");
    });
    expect(code).toBe(0);
  });

  it("exits cleanly (code 0) on SIGINT", async () => {
    const code = await new Promise<number | null>((resolve) => {
      child!.once("exit", (c) => resolve(c));
      child!.kill("SIGINT");
    });
    expect(code).toBe(0);
    expect(output).toContain("Encerrando");
    child = undefined;
    expect(await readdir(join(project, "docs"))).toEqual(["architecture.json"]);
  });
});
