import { parseArgs } from "node:util";

export const DEFAULT_PORT = 4517;

export class UsageError extends Error {}

export interface CliOptions {
  help: boolean;
  version: boolean;
  open: boolean;
  /** Porta inicial: --port, senão ARQUITECTURE_PORT, senão a padrão. */
  port: number;
  /** Só --port conta como explícito: a variável de ambiente permite procurar outra porta. */
  portExplicit: boolean;
}

function toPort(raw: string, origin: string): number {
  if (!/^\d+$/.test(raw) || Number(raw) > 65535) {
    throw new UsageError(`Porta inválida em ${origin}: "${raw}". Use um número de 0 a 65535.`);
  }
  return Number(raw);
}

export function parseCliArgs(argv: string[], env: Record<string, string | undefined> = {}): CliOptions {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      allowPositionals: false,
      options: {
        port: { type: "string" },
        "no-open": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    }));
  } catch (e) {
    throw new UsageError(`${(e as Error).message}\nUse --help para ver as opções.`);
  }
  const fromFlag = values.port !== undefined;
  const fromEnv = !fromFlag && env.ARQUITECTURE_PORT !== undefined && env.ARQUITECTURE_PORT !== "";
  return {
    help: values.help === true,
    version: values.version === true,
    open: values["no-open"] !== true,
    port: fromFlag ? toPort(values.port!, "--port") : fromEnv ? toPort(env.ARQUITECTURE_PORT!, "ARQUITECTURE_PORT") : DEFAULT_PORT,
    portExplicit: fromFlag,
  };
}

export const HELP = `arquitecture — editor local de arquitetura de software

Uso:
  arquitecture [opções]

Usa o diretório atual como raiz do projeto: o modelo fica em docs/architecture.json.

Opções:
  --port <n>   Porta do servidor (padrão ${DEFAULT_PORT}; também lida de ARQUITECTURE_PORT).
               Com --port, a porta é exigida: se estiver ocupada, o comando encerra.
               Sem --port, tenta as 10 portas seguintes e usa a primeira livre.
  --no-open    Não abre o navegador.
  -h, --help   Mostra esta ajuda.
  -v, --version  Mostra a versão.
`;
