#!/usr/bin/env node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "@arquitecture/server";
import { HELP, UsageError, parseCliArgs } from "./args.js";
import { openBrowser } from "./open.js";
import { PortInUseError, startOnFreePort } from "./ports.js";

declare const __VERSION__: string;
const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "dev";

async function main(): Promise<number> {
  const opts = parseCliArgs(process.argv.slice(2), process.env);
  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    console.log(VERSION);
    return 0;
  }

  const rootDir = process.cwd();
  // A interface compilada vem junto do pacote, em dist/web.
  const webDir = fileURLToPath(new URL("./web", import.meta.url));

  const { port, value: server } = await startOnFreePort(opts.port, opts.portExplicit, async (p) => {
    const s = createServer({ rootDir, port: p, webDir });
    try {
      await s.start();
      return s;
    } catch (e) {
      await s.app.close().catch(() => undefined);
      throw e;
    }
  });
  // start() com porta 0 escolhe uma porta livre; lemos a efetiva.
  const addr = server.app.server.address();
  const real = typeof addr === "object" && addr ? addr.port : port;
  const url = `http://${server.host}:${real}`;

  const modelPath = server.store.modelPath;
  const exists = existsSync(modelPath);
  console.log(`Arquitecture em ${url}`);
  if (real !== opts.port && opts.port !== 0) console.log(`(a porta ${opts.port} estava ocupada)`);
  if (!exists) console.log(`Modelo: ${modelPath} — ainda não existe; será criado na primeira edição.`);
  else if (server.store.state === "valid") console.log(`Modelo: ${modelPath} — existe e está válido.`);
  else {
    console.log(`Modelo: ${modelPath} — existe, mas está INVÁLIDO (${server.store.errors.length} erro(s)).`);
    console.log("As edições ficam recusadas até você corrigir o arquivo e reiniciar. Os erros aparecem na interface.");
  }
  console.log("Ctrl+C para encerrar.");
  if (opts.open) openBrowser(url);

  return new Promise<number>((resolve) => {
    let closing = false;
    const stop = () => {
      if (closing) {
        console.log("Encerrando à força.");
        process.exit(130);
      }
      closing = true;
      console.log("\nEncerrando… aguardando gravações pendentes.");
      server.close().then(
        () => resolve(0),
        (e) => {
          console.error(`Falha ao encerrar: ${(e as Error).message}`);
          resolve(1);
        },
      );
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}

main().then(
  (code) => process.exit(code),
  (e) => {
    if (e instanceof UsageError || e instanceof PortInUseError) {
      console.error(e.message);
      process.exit(e instanceof UsageError ? 2 : 1);
    }
    console.error(`Erro inesperado: ${(e as Error).message}`);
    process.exit(1);
  },
);
