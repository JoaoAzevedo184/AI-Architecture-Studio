import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const PORT = 4619;
const BASE = `http://127.0.0.1:${PORT}`;
const MAIN = fileURLToPath(new URL("../../server/dist/main.js", import.meta.url));

let dir: string;
let server: ChildProcess | undefined;

async function startServer() {
  // Com ARQUITECTURE_BIN, roda o binário instalado a partir do tarball (a raiz é o diretório de trabalho).
  const bin = process.env.ARQUITECTURE_BIN;
  server = bin
    ? spawn(bin, ["--no-open", "--port", String(PORT)], { cwd: dir, stdio: "ignore" })
    : spawn(process.execPath, [MAIN, dir], { env: { ...process.env, ARQUITECTURE_PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("servidor não subiu");
}

async function stopServer() {
  if (!server) return;
  const s = server;
  server = undefined;
  await new Promise<void>((resolve) => {
    s.once("exit", () => resolve());
    s.kill();
  });
}

test.beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "arq-e2e-"));
  await startServer();
});
test.afterEach(async () => {
  await stopServer();
  await rm(dir, { recursive: true, force: true });
});

const node = (page: Page, name: string) => page.locator(`[data-testid^="node-"][data-name="${name}"]`);

/** Cria um nó pela paleta, renomeia e define a tecnologia. */
async function create(page: Page, kind: string, name: string, tech?: string) {
  await page.getByTestId(`add-${kind}`).click();
  const field = page.getByTestId("prop-name");
  await expect(field).toHaveValue(/^Novo /);
  await field.fill(name);
  await field.press("Enter");
  await expect(node(page, name)).toBeVisible();
  if (tech) {
    const t = page.getByTestId("prop-tech");
    await t.fill(tech);
    await t.press("Enter");
    await expect(node(page, name).locator(".arch-detail")).toHaveText(tech);
  }
}

async function connect(page: Page, from: string, to: string) {
  const a = await node(page, from).locator(".react-flow__handle.source").boundingBox();
  const b = await node(page, to).locator(".react-flow__handle.target").boundingBox();
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function snapshot() {
  const model = await (await fetch(`${BASE}/api/model`)).json();
  const layout = await (await fetch(`${BASE}/api/layout`)).json();
  return { model, layout };
}

test("phase 1 acceptance: build, edit, restart and reopen without loss", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByTestId("breadcrumb")).toContainText("Raiz");

  // Raiz: Internet → Nginx → Docker
  await create(page, "external", "Internet");
  await create(page, "proxy", "Nginx", "nginx");
  await create(page, "group", "Docker", "docker");
  await connect(page, "Internet", "Nginx");
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await connect(page, "Nginx", "Docker");
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  // Propriedades da conexão: rótulo
  await page.locator(".react-flow__edge").first().dispatchEvent("click");
  await page.getByTestId("prop-label").fill("HTTPS");
  await page.getByTestId("prop-label").press("Enter");
  await expect(page.locator(".react-flow__edge-text").first()).toHaveText("HTTPS");

  // Mover um nó: a posição é gravada ao soltar
  const box = (await node(page, "Internet").boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 240, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Object.keys((await snapshot()).layout.layout.positions).length).toBeGreaterThan(0);

  // Entrar no Docker e criar front, API e banco
  await node(page, "Docker").dblclick();
  await expect(page).toHaveURL(/#\/n_[a-z0-9]+$/);
  await expect(page.getByTestId("breadcrumb")).toContainText("Docker");
  await expect(page.locator('[data-testid^="node-"]')).toHaveCount(0);
  await create(page, "frontend", "Front", "react");
  await create(page, "service", "API", "spring");
  await create(page, "database", "PostgreSQL", "postgresql");
  await connect(page, "Front", "API");
  await connect(page, "API", "PostgreSQL");
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  // Conexão de fora do nível: indicador no nó, nada desenhado
  await node(page, "API").click();

  // Volta para a raiz: Docker mostra o contador de filhos
  await page.getByTestId("breadcrumb").getByRole("button", { name: "Raiz" }).click();
  await expect(node(page, "Docker").getByTestId("children-count")).toHaveText("3");

  const before = await snapshot();
  expect(before.model.model.nodes).toHaveLength(6);
  expect(before.model.model.edges).toHaveLength(4);
  expect(Object.keys(before.layout.layout.positions)).toHaveLength(6);

  // Reiniciar o servidor e reabrir
  await stopServer();
  await startServer();
  await page.reload();
  await expect(node(page, "Docker")).toBeVisible();
  const after = await snapshot();
  expect(after.model).toEqual(before.model);
  expect(after.layout).toEqual(before.layout);

  // A tela mostra o mesmo desenho
  await expect(page.locator('[data-testid^="node-"]')).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  const moved = before.layout.layout.positions;
  const internetId = before.model.model.nodes.find((n: { name: string }) => n.name === "Internet").id;
  const t = await node(page, "Internet").evaluate((el) => el.closest(".react-flow__node")!.getAttribute("style"));
  expect(t).toContain(`translate(${moved[internetId].x}px, ${moved[internetId].y}px)`);

  await node(page, "Docker").dblclick();
  await expect(page.locator('[data-testid^="node-"]')).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(node(page, "API").locator("img")).toBeVisible();

  // Aba JSON somente leitura e Ctrl+Z
  await page.getByTestId("tab-json").click();
  await expect(page.getByTestId("json")).toContainText('"name": "PostgreSQL"');
  await page.getByTestId("tab-diagram").click();
  await page.getByTestId("add-cache").click();
  await expect(page.locator('[data-testid^="node-"]')).toHaveCount(4);
  await page.locator(".canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-testid^="node-"]')).toHaveCount(3);
});

test("cascade removal asks for confirmation with counts", async ({ page }) => {
  await page.goto(BASE);
  await create(page, "group", "Docker");
  await node(page, "Docker").dblclick();
  await create(page, "service", "API");
  await page.getByTestId("breadcrumb").getByRole("button", { name: "Raiz" }).click();
  await node(page, "Docker").click();
  await page.getByTestId("remove").click();
  await expect(page.getByTestId("confirm-remove")).toContainText("2 nós e 0 conexões");
  await page.getByTestId("confirm-ok").click();
  await expect(page.locator('[data-testid^="node-"]')).toHaveCount(0);
});

test("undo of a cascade removal restores nodes, edges, ids and positions", async ({ page }) => {
  await page.goto(BASE);
  await create(page, "external", "Internet");
  await create(page, "group", "Docker");
  await connect(page, "Internet", "Docker");
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await node(page, "Docker").dblclick();
  await create(page, "service", "API");
  await create(page, "database", "DB");
  await connect(page, "API", "DB");
  await page.getByTestId("breadcrumb").getByRole("button", { name: "Raiz" }).click();

  // Move o Docker para uma posição própria antes de remover
  const box = (await node(page, "Docker").boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 200, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot()).layout.layout.positions).not.toEqual({});
  await page.waitForTimeout(300);
  const before = await snapshot();
  const ids = (m: any) => [m.nodes.map((n: any) => n.id).sort(), m.edges.map((e: any) => e.id).sort()];

  await node(page, "Docker").click();
  await page.getByTestId("remove").click();
  await expect(page.getByTestId("confirm-remove")).toContainText("3 nós e 2 conexões");
  await page.getByTestId("confirm-ok").click();
  await expect(node(page, "Docker")).toHaveCount(0);

  await page.locator(".canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  await expect(node(page, "Docker")).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);

  const after = await snapshot();
  expect(ids(after.model.model)).toEqual(ids(before.model.model));
  expect(after.model.model.nodes.find((n: any) => n.name === "API")).toEqual(before.model.model.nodes.find((n: any) => n.name === "API"));
  expect(after.layout).toEqual(before.layout);
  await node(page, "Docker").dblclick();
  await expect(page.locator('[data-testid^="node-"]')).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
});

test("invalid model on disk: full-screen errors, no editing, file untouched", async ({ page }) => {
  await stopServer();
  await mkdir(join(dir, "docs"), { recursive: true });
  const bad = '{ "schemaVersion": 1 }';
  await writeFile(join(dir, "docs", "architecture.json"), bad);
  await startServer();
  await page.goto(BASE);
  await expect(page.getByTestId("invalid")).toContainText("SCHEMA_INVALID");
  await expect(page.getByTestId("canvas")).toHaveCount(0);
  expect(await readFile(join(dir, "docs", "architecture.json"), "utf8")).toBe(bad);
});

test("server going away shows a non-blocking warning", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByTestId("add-service")).toBeVisible();
  await stopServer();
  await page.getByTestId("add-service").click();
  await expect(page.getByTestId("toast")).toContainText("Servidor inacessível");
  await expect(page.getByTestId("canvas")).toBeVisible();
});
