# AI Architecture Studio

Editor local de arquitetura de software em que agentes como Claude Code e Codex leem o repositório e montam o diagrama, e você navega por níveis de profundidade e edita à mão o que quiser.

> **Status:** em definição. A especificação técnica está fechada e a fase 1 (editor) é a próxima etapa. Os comandos abaixo descrevem o comportamento planejado.

## O que é

Uma ferramenta que roda ao lado do seu código, sem serviço hospedado e sem login. Ela mantém um modelo de arquitetura em `docs/architecture.json`, versionado no Git, e o exibe em um canvas editável.

- **Níveis de profundidade:** cada bloco pode conter um subdiagrama. `Internet → Nginx → Docker`; ao entrar no Docker, aparecem front, API e banco.
- **Lentes:** o mesmo sistema visto por outro ângulo. A lente de dados abre o banco como diagrama ER; a de segurança mostra autenticação, autorização e fronteiras de confiança.
- **Agente e pessoa no mesmo modelo:** o agente altera por MCP, você altera pelo canvas, e os dois enxergam as mudanças um do outro.
- **Validação sempre:** nenhuma alteração chega ao disco sem passar pelas regras de integridade.

## Como funciona

```
Claude Code / Codex ──MCP──┐
                           ▼
                    Servidor local ──► docs/architecture.json
                           ▲            docs/architecture.layout.json
Interface web ──HTTP/WS────┘
```

Um único processo local é o dono dos arquivos. Interface e agente enviam operações; o servidor aplica em fila, valida o modelo inteiro, grava de forma atômica e publica a mudança para o canvas em tempo real.

## Uso

Na raiz do repositório:

```bash
npx arquitecture
```

Isso inicia o servidor local e abre o canvas no navegador. Se `docs/architecture.json` não existir, um modelo vazio é criado.

### Conectar um agente

Para agentes que usam stdio, registre o comando abaixo como servidor MCP:

```bash
arquitecture mcp
```

Ele é uma ponte para o servidor em execução, então continua existindo um único escritor. Recomenda-se dizer ao agente, no `CLAUDE.md` ou `AGENTS.md` do projeto, para alterar a arquitetura sempre pelas ferramentas MCP e nunca editando o JSON diretamente.

Exemplo de pedido:

```text
Analise este repositório e monte a arquitetura de runtime no Architecture Studio.
Use apply_batch. Mostre os componentes principais, as dependências externas
e coloque os contêineres dentro do grupo Docker.
```

## O modelo

Lista plana de nós e de conexões; a hierarquia vem do campo `parent`.

```json
{
  "schemaVersion": 1,
  "revision": 42,
  "meta": { "name": "HotelHub" },
  "nodes": [
    { "id": "n_nginx", "name": "Nginx", "kind": "proxy", "tech": "nginx", "parent": null },
    { "id": "n_docker", "name": "Docker", "kind": "group", "tech": "docker", "parent": null },
    { "id": "n_api", "name": "API", "kind": "service", "tech": "spring", "parent": "n_docker" }
  ],
  "edges": [
    { "id": "e_1", "source": "n_nginx", "target": "n_api", "label": "proxy_pass", "kind": "sync" }
  ]
}
```

- `id` é gerado pelo servidor e nunca muda, então renomear um nó não quebra conexões.
- `kind` é um conjunto fechado: `external`, `proxy`, `group`, `service`, `frontend`, `database`, `cache`, `queue`, `storage`.
- `tech` escolhe o ícone. Tecnologia fora do catálogo é aceita e usa o ícone do `kind`.
- As posições ficam em `docs/architecture.layout.json`, para que mover uma caixa não polua o diff do modelo.

## Ferramentas MCP

| Ferramenta | Efeito |
| --- | --- |
| `get_model` | Devolve o modelo ou uma subárvore |
| `list_nodes` | Lista resumida de nós, com filtros |
| `add_node` / `update_node` / `move_node` / `remove_node` | Edição de nós; a remoção é em cascata |
| `add_edge` / `update_edge` / `remove_edge` | Edição de conexões |
| `set_lens` | Substitui o trecho de uma lente em um nó |
| `apply_batch` | Aplica várias operações como uma só, tudo ou nada |
| `validate` | Devolve os erros do modelo atual |

Erros são estruturados, com `code`, `path`, `message` e `hint`, para que o agente consiga se corrigir:

```json
{
  "code": "EDGE_ENDPOINT_NOT_FOUND",
  "path": "/edges/3/target",
  "message": "O destino n_cache não existe",
  "hint": "Crie o nó antes ou use um id retornado por list_nodes"
}
```

## Stack

- **Linguagem:** TypeScript em todo o monorepo
- **Canvas:** React + React Flow, layout automático com ELK
- **Ícones:** Devicon, embutidos no pacote
- **Validação:** JSON Schema e regras de integridade próprias
- **Integração:** Model Context Protocol (MCP)

## Estrutura do repositório

```
packages/
  core/     esquema, validação e operações puras (sem I/O)
  server/   servidor local, fila de escrita, WebSocket, adaptador MCP
  web/      interface React Flow
  cli/      comando arquitecture
```

## Roadmap

| Fase | Entrega |
| --- | --- |
| 1. Editor | Modelo, validação, canvas com drill-down, ícones e edição manual |
| 2. Agentes | Servidor MCP, `apply_batch`, atualização ao vivo, observador de arquivo |
| 3. Dados | Lente de dados: ER manual e importador de `schema.prisma` |
| 4. Segurança | Lente de segurança como sobreposição no canvas |
| 5. Saídas | Exportação para .drawio, Mermaid e Markdown; chat embutido |

## Fora de escopo

- Serviço hospedado, login e colaboração em tempo real entre pessoas.
- Chamada direta a LLM: quem raciocina é o agente externo.
- Inspeção de infraestrutura em execução. O modelo descreve o que foi declarado.

## Desenvolvimento

```bash
git clone https://github.com/JoaoAzevedo184/<repositorio>.git
cd <repositorio>
npm install
npm run dev
npm test
```

## Autor

João Victor Azevedo de Sena · [github.com/JoaoAzevedo184](https://github.com/JoaoAzevedo184)