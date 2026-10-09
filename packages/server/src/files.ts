import { randomBytes } from "node:crypto";
import * as nodeFs from "node:fs/promises";
import { basename, dirname } from "node:path";

/** Operações de disco usadas pelo servidor; substituíveis nos testes. */
export interface FsOps {
  readFile(path: string, encoding: "utf8"): Promise<string>;
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options: { force: true }): Promise<void>;
}

export const defaultFs: FsOps = nodeFs;

/** Lê o arquivo; devolve null se não existir. */
export async function readIfExists(fs: FsOps, path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Grava em arquivo temporário no mesmo diretório e renomeia sobre o destino. */
export async function writeAtomic(fs: FsOps, path: string, data: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${dirname(path)}/.${basename(path)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, path);
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}
