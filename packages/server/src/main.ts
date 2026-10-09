import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PORT, createServer } from "./app.js";

// Uso: node dist/main.js [diretório]. A porta vem de ARQUITECTURE_PORT.
const rootDir = process.argv[2] ?? process.env.INIT_CWD ?? process.cwd();
const port = process.env.ARQUITECTURE_PORT ? Number(process.env.ARQUITECTURE_PORT) : DEFAULT_PORT;

// A interface compilada fica em packages/web/dist (existe depois de `npm run build`).
const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");

const server = createServer({ rootDir, port, webDir });
const addr = await server.start();
console.log(`Servidor em http://${addr.host}:${addr.port} (modelo: ${rootDir}/docs/architecture.json)`);
