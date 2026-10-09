export const FALLBACK_PORTS = 10;

export class PortInUseError extends Error {}

const isBusy = (e: unknown) => (e as NodeJS.ErrnoException)?.code === "EADDRINUSE";

/**
 * Tenta `attempt` na porta pedida. Sem `explicit`, tenta também as 10 seguintes;
 * com `explicit`, falha na primeira porta ocupada. `attempt` deve lançar EADDRINUSE se a porta estiver ocupada.
 */
export async function startOnFreePort<T>(
  start: number,
  explicit: boolean,
  attempt: (port: number) => Promise<T>,
): Promise<{ port: number; value: T }> {
  const last = explicit || start === 0 ? start : Math.min(start + FALLBACK_PORTS, 65535);
  for (let port = start; port <= last; port++) {
    try {
      return { port, value: await attempt(port) };
    } catch (e) {
      if (!isBusy(e)) throw e;
    }
  }
  throw new PortInUseError(
    explicit
      ? `A porta ${start} já está em uso. Escolha outra com --port ou libere a porta.`
      : `As portas de ${start} a ${last} estão em uso. Escolha outra com --port.`,
  );
}
