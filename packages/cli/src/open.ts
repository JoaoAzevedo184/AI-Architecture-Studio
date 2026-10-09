import { spawn } from "node:child_process";

/** Abre a URL no navegador padrão; falhas são ignoradas (o endereço já foi impresso). */
export function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd!, args as string[], { stdio: "ignore", detached: true });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    /* sem navegador disponível */
  }
}
