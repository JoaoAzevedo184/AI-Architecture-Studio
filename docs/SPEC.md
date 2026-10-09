# AI Architecture Studio — Especificação Técnica

2026-10-08 · João Victor Azevedo de Sena

## 1. Visão e escopo

O AI Architecture Studio é uma ferramenta local, iniciada com `npx` na raiz de um repositório, que mantém um modelo de arquitetura em `architecture.json` e o exibe em um canvas editável. Agentes como Claude Code e Codex leem e alteram o modelo por MCP; a pessoa edita pelo canvas. Os dois trabalham sobre o mesmo arquivo.

**Dentro do MVP (fases 1 e 2)**

- Modelo hierárquico com nós, conexões e filhos, validado por JSON Schema.
- Canvas com drill-down, ícones de tecnologia e edição manual.
- Servidor MCP com operações validadas e atualização ao vivo do canvas.

**Depois do MVP**

- Lente de dados (ER manual e importadores).
- Lente de segurança.
- Exportação para .drawio, Mermaid e Markdown.
- Chat embutido na interface.

**Fora de escopo**

- Serviço hospedado, login e colaboração em tempo real entre pessoas.
- Chamada direta a LLM pela ferramenta: quem raciocina é o agente externo.
- Inspeção de infraestrutura em execução. O modelo descreve o que foi declarado, não o que está rodando.

## 2. Arquitetura

Um único processo Node local é o dono do arquivo: interface e agente nunca gravam em `architecture.json` por conta própria. Isso resolve a concorrência sem trava de arquivo, porque todas as escritas passam por uma fila única.

| Componente | Papel | Fala com |
| --- | --- | --- |
| Núcleo (`core`) | Esquema, validação, operações puras sobre o modelo. Sem I/O. | Usado por todos |
| Servidor local | Carrega o arquivo, aplica operações em fila, grava de forma atômica, publica eventos | Disco, interface, MCP |
| Adaptador MCP | Expõe as operações do núcleo como ferramentas | Claude Code, Codex |
| Interface web | Canvas React Flow; envia operações, recebe eventos | Servidor local (HTTP + WebSocket) |
| Observador de arquivo | Detecta edição externa (agente editou o JSON direto, `git checkout`) | Servidor local |

**Fluxo de uma escrita**

1. O cliente (interface ou agente) envia uma operação com a `revision` que conhece.
2. O servidor confere a revisão, aplica a operação em memória e valida o modelo inteiro.
3. Se válido, grava em arquivo temporário e renomeia sobre `architecture.json`.
4. Incrementa `revision` e publica o evento `model.changed` por WebSocket. Esse evento é publicado somente em escrita aceita no modelo; gravar o layout não publica evento.
5. Se inválido, nada é gravado e o cliente recebe um erro estruturado.

**Transporte MCP.** O adaptador roda dentro do servidor local e é exposto por HTTP em `127.0.0.1`. Para agentes que só aceitam stdio, o comando `arquitecture mcp` é uma ponte fina que repassa as chamadas ao servidor em execução. Assim existe um único escritor mesmo com interface e agente abertos ao mesmo tempo.

**Estrutura do repositório.** Monorepo com `packages/core`, `packages/server`, `packages/web` e `packages/cli`. O `core` não depende de nada dos outros, o que permite testá-lo isoladamente.

## 3. Modelo `architecture.json`

O modelo é uma lista plana de nós e uma lista plana de conexões; a hierarquia vem do campo `parent`. A lista plana deixa mover um nó de nível barato e produz diffs de Git legíveis.

```json
{
  "schemaVersion": 1,
  "revision": 42,
  "meta": { "name": "HotelHub", "description": "Reservas de hotel" },
  "nodes": [
    { "id": "n_internet", "name": "Internet", "kind": "external", "parent": null },
    { "id": "n_nginx", "name": "Nginx", "kind": "proxy", "tech": "nginx", "parent": null },
    { "id": "n_docker", "name": "Docker", "kind": "group", "tech": "docker", "parent": null },
    { "id": "n_api", "name": "API", "kind": "service", "tech": "spring", "parent": "n_docker",
      "lenses": { "security": { "authn": "jwt", "authz": "rbac" } } },
    { "id": "n_db", "name": "PostgreSQL", "kind": "database", "tech": "postgresql", "parent": "n_docker",
      "lenses": { "data": { "tables": [] } } }
  ],
  "edges": [
    { "id": "e_1", "source": "n_internet", "target": "n_nginx", "label": "HTTPS", "kind": "sync" },
    { "id": "e_2", "source": "n_nginx", "target": "n_api", "label": "proxy_pass", "kind": "sync" }
  ]
}
```

| Campo | Regra |
| --- | --- |
| `schemaVersion` | Inteiro. Muda só em quebra de formato; cada mudança vem com uma migração |
| `revision` | Inteiro incrementado pelo servidor a cada escrita aceita no modelo. Gravar o layout não incrementa a `revision` |
| `nodes[].id` | Gerado pelo servidor, opaco e imutável. Nunca derivado do nome, então renomear não quebra conexões |
| `nodes[].kind` | Conjunto fechado: `external`, `proxy`, `group`, `service`, `frontend`, `database`, `cache`, `queue`, `storage` |
| `nodes[].tech` | Chave do catálogo de ícones. Chave desconhecida é aceita e cai no ícone do `kind` |
| `nodes[].parent` | `id` de outro nó ou `null` para a raiz |
| `nodes[].lenses` | Objeto por lente. Cada lente valida o próprio trecho; lente desconhecida é preservada sem validação |
| `edges[].kind` | `sync`, `async` ou `data` |
| `layout` | Posições por `id`. Fica em arquivo próprio (seção 9), fora do modelo, para que mover uma caixa não polua o diff semântico |

**Conexão entre níveis.** Uma conexão pode ligar nós de pais diferentes (`n_nginx` para `n_api`). No nível em que o destino está recolhido, o canvas desenha a conexão chegando no ancestral visível (`n_docker`).

## 4. Validação e integridade

Nenhuma escrita chega ao disco sem passar pela validação completa do modelo resultante. A validação tem duas camadas: forma (JSON Schema) e integridade (regras entre elementos).

| Código | Regra |
| --- | --- |
| `SCHEMA_INVALID` | O documento não obedece ao JSON Schema da `schemaVersion`. Também cobre o arquivo de layout: gravação de layout malformada é recusada com este código e `path` dentro do arquivo de layout |
| `DUPLICATE_ID` | Dois nós ou duas conexões com o mesmo `id` |
| `PARENT_NOT_FOUND` | `parent` aponta para nó inexistente |
| `PARENT_CYCLE` | Um nó é ancestral de si mesmo |
| `EDGE_ENDPOINT_NOT_FOUND` | `source` ou `target` inexistente |
| `EDGE_SELF_LOOP` | `source` igual a `target` |
| `EDGE_TO_ANCESTOR` | Conexão entre um nó e o próprio ancestral |
| `LENS_INVALID` | O trecho de uma lente conhecida não obedece ao esquema dela |
| `REVISION_CONFLICT` | A operação foi feita sobre uma revisão antiga |
| `NOT_FOUND` | A operação aponta, no campo de entrada (ex.: `/id`), para um nó ou conexão que não existe |

**Formato do erro.** Todo erro traz `code`, `message` em linguagem direta, `path` (ponteiro JSON até o elemento) e `hint` com a correção possível. Exemplo: `{ "code": "EDGE_ENDPOINT_NOT_FOUND", "path": "/edges/3/target", "message": "O destino n_cache não existe", "hint": "Crie o nó antes ou use um id retornado por list_nodes" }`. O agente consegue se corrigir a partir disso sem adivinhar.

**Exclusão em cascata.** Remover um nó remove os descendentes e todas as conexões que tocam neles. A resposta lista o que foi removido.

**Edição direta do arquivo.** Não dá para impedir que um agente abra o JSON e edite com as ferramentas de arquivo dele. A regra então é: o observador de arquivo valida toda mudança externa. Se for válida, o servidor adota o novo conteúdo e incrementa a revisão. Se for inválida, o servidor mantém em memória o último modelo válido, mostra um aviso no canvas com os erros e recusa novas escritas até o arquivo ser corrigido ou restaurado pelo botão "restaurar último válido". A instrução para o agente (no `CLAUDE.md` ou `AGENTS.md` do projeto) deve dizer para usar sempre as ferramentas MCP.

## 5. Operações e ferramentas MCP

Interface e agente usam o mesmo conjunto de operações do núcleo; as ferramentas MCP são só um invólucro. Cada ferramenta de escrita aceita `expectedRevision` opcional e devolve a nova `revision`.

| Ferramenta | Entrada | Efeito |
| --- | --- | --- |
| `get_model` | `scope?` (id de um nó), `depth?` | Devolve o modelo ou uma subárvore. Evita mandar o arquivo inteiro ao agente |
| `list_nodes` | `parent?`, `kind?` | Lista resumida: `id`, `name`, `kind`, `tech`, `parent` |
| `add_node` | `name`, `kind`, `tech?`, `parent?` | Cria o nó e devolve o `id` gerado |
| `update_node` | `id`, campos a alterar | Renomeia, troca `kind`, `tech` ou descrição |
| `move_node` | `id`, `parent` | Muda de nível; valida ciclo |
| `remove_node` | `id` | Remove em cascata e lista o que saiu |
| `add_edge` | `source`, `target`, `label?`, `kind?` | Cria a conexão |
| `update_edge` / `remove_edge` | `id` | Altera ou remove |
| `set_lens` | `nodeId`, `lens`, `data` | Substitui o trecho de uma lente no nó |
| `apply_batch` | lista de operações | Aplica tudo ou nada; referências a nós criados no mesmo lote usam um alias temporário |
| `validate` | nenhuma | Devolve os erros do modelo atual |

**Concorrência.** Sem `expectedRevision`, a operação é aplicada sobre o estado atual; como cada operação é pequena e endereçada por `id`, isso é seguro na maioria dos casos. Com `expectedRevision` diferente da atual, a resposta é `REVISION_CONFLICT` com a revisão corrente, e o cliente relê antes de tentar de novo. A interface sempre envia a revisão; o agente envia em `apply_batch`.

**`apply_batch` é o caminho principal do agente.** Montar uma arquitetura inteira operação por operação gera dezenas de chamadas e estados intermediários no canvas. Um lote produz uma única revisão e um único evento.

**Eventos para a interface.** `model.changed` (revisão e operações aplicadas; publicado somente em escrita aceita no modelo, nunca na gravação do layout), `model.invalid` (erros de uma edição externa) e `model.restored`.

## 6. Interface

O layout segue o database.build: painel lateral à esquerda, canvas à direita, abas no topo do canvas. No MVP o painel esquerdo mostra a árvore de nós e as propriedades do item selecionado; o chat entra depois, no mesmo lugar.

- **Canvas.** React Flow. Cada nível da hierarquia é uma tela: mostra os filhos diretos do nó atual e as conexões entre eles.
- **Drill-down.** Duplo clique em um nó com filhos entra nele. Uma trilha no topo (`Raiz / Docker / API`) permite voltar. O nível atual fica na URL (`#/n_docker/n_api`) para poder compartilhar o link local.
- **Blocos.** Estilo Archify: caixa com borda na cor do `kind`, ícone da tecnologia, nome e uma linha de detalhe. Nós com filhos mostram um contador.
- **Ícones.** Catálogo local mapeando `tech` para um SVG do Devicon. Os SVGs vão embutidos no pacote, sem requisição externa.
- **Edição manual.** Criar nó pela paleta ou menu de contexto, arrastar para conectar, editar propriedades no painel, apagar com confirmação quando houver cascata.
- **Layout.** Posição manual é salva em `docs/architecture.layout.json` (ver seção 9). Na fase 1, nós sem posição recebem posicionamento simples em grade. A partir da fase 2, nós sem posição (criados pelo agente) recebem layout automático por ELK, e um botão reorganiza o nível inteiro.
- **Abas.** `Diagrama` e `JSON` (somente leitura) no MVP; cada lente registrada adiciona a própria aba ou alternador.
- **Desfazer.** Pilha de operações inversas na sessão da interface. Não desfaz alterações do agente.

## 7. Lentes

Uma lente é um módulo interno com três partes: um JSON Schema para o trecho `lenses.<nome>` do nó, um componente de visualização e, opcionalmente, importadores. As lentes ficam em um registro dentro do próprio código. Carregar plugins de terceiros não entra na especificação: o registro interno dá a mesma separação sem o custo de uma API pública estável.

```ts
interface Lens {
  name: string;                       // "data", "security"
  appliesTo: NodeKind[];              // em quais kinds a lente aparece
  schema: JSONSchema;                 // valida node.lenses[name]
  View: Component<{ node, model }>;   // aba ou sobreposição no canvas
  importers?: Importer[];             // geram o trecho a partir de arquivos do repo
}
```

**Lente de dados** (`appliesTo: database`)

- Trecho: `tables[]` com `name`, `columns[]` (`name`, `type`, `pk`, `nullable`, `unique`) e `relations[]` (`from`, `to`, cardinalidade).
- Visão: diagrama ER ao entrar no nó do banco, com tabelas editáveis.
- Importadores, nesta ordem: `schema.prisma`, migrations SQL, entidades JPA. A introspecção de um Postgres em execução fica por último, porque exige credenciais.
- O importador roda no servidor local e devolve uma proposta; a pessoa ou o agente confirma com `set_lens`.

**Lente de segurança** (`appliesTo: service, proxy, frontend, group`)

- Trecho no nó: `authn` (como autentica), `authz` (como autoriza), `exposure` (`public`, `internal`).
- Trecho na conexão: `encrypted`, `credential` (o que trafega: JWT, API key, nenhum).
- Visão: sobreposição no canvas normal, com selos nos nós, fronteiras de confiança desenhadas em volta dos grupos e destaque para conexões que cruzam uma fronteira sem autenticação declarada.
- Preenchimento pelo agente, que lê a configuração do projeto. Sem importador automático na primeira versão.

## 8. Fases de entrega

Cada fase termina em algo que dá para demonstrar sozinho.

| Fase | Entrega | Critério de aceite |
| --- | --- | --- |
| 1. Editor | `core` (esquema, validação, operações), servidor local, canvas com drill-down, ícones e edição manual | Rodar `npx` em uma pasta vazia, montar Internet → Nginx → Docker com front, API e banco dentro, entrar no Docker, editar propriedades, fechar e reabrir sem perda |
| 2. Agentes | Adaptador MCP, `apply_batch`, WebSocket, observador de arquivo | Pedir ao Claude Code para mapear um repositório real e ver o canvas se montar sem recarregar; um JSON corrompido à mão mostra o aviso e não derruba a interface |
| 3. Dados | Lente de dados, ER manual, importador Prisma | Entrar no nó do banco de um projeto com `schema.prisma` e ver as tabelas e relações corretas |
| 4. Segurança | Lente de segurança como sobreposição | Alternar a lente e identificar de relance qual rota chega a um serviço sem autenticação declarada |
| 5. Saídas | Exportação .drawio, Mermaid e Markdown; chat embutido | O .drawio exportado abre no draw.io com a mesma hierarquia |

**Testes**

- **Núcleo:** teste unitário para cada operação e para cada código de erro da seção 4. É a parte mais barata de testar e a que mais protege o projeto.
- **Propriedade:** aplicar sequências aleatórias de operações válidas e verificar que o modelo resultante sempre valida.
- **Ida e volta:** carregar, gravar e recarregar um modelo produz o mesmo conteúdo, com ordem de chaves estável para o diff do Git.
- **Concorrência:** duas escritas com a mesma `expectedRevision` resultam em um aceite e um `REVISION_CONFLICT`.
- **Importadores:** arquivos de exemplo com saída esperada fixada.
- **Interface:** um teste de ponta a ponta por fase cobrindo o critério de aceite.

## 9. Decisões tomadas

| Tema | Decisão |
| --- | --- |
| Pacote e comando | `arquitecture` (`npx arquitecture`, `arquitecture mcp`). Falta conferir se o nome está livre no npm |
| Linguagem | TypeScript em todo o monorepo |
| Local do modelo | `docs/architecture.json` |
| Layout | Arquivo separado, `docs/architecture.layout.json`, com as posições por `id`. Gravado pelo servidor na mesma fila, de forma atômica, sem incrementar `revision` e sem controle de conflito (vale a última escrita); esquema próprio mínimo; `id` órfão descartado; arquivo ausente ou inválido equivale a "sem posições" |
| Identidade visual | Paleta por `kind`, tema escuro como padrão |
| Catálogo de ícones | Lista inicial abaixo |

**Gravação do layout**

- Gravado pelo servidor, pela mesma fila de escrita do modelo, com gravação atômica (arquivo temporário e renomeação).
- Gravar o layout não incrementa a `revision` do modelo e nunca gera `REVISION_CONFLICT`.
- Gravar o layout não publica nenhum evento: `model.changed` é publicado somente em escrita aceita no modelo. Cada aba da interface lê o layout ao carregar; sincronizar posições entre abas abertas ao mesmo tempo está fora do MVP.
- Uma gravação de layout malformada é recusada com `SCHEMA_INVALID`, com `path` apontando para o elemento dentro do arquivo de layout e `message` e `hint` como nos demais erros. Nada é gravado.
- Não há controle de conflito para o layout: vale a última escrita.
- Esquema próprio e mínimo: `schemaVersion` e `positions`, um objeto `{ x, y }` por `id` de nó.
- Posição de um `id` que não existe mais no modelo é ignorada ao carregar e removida na próxima gravação do layout. Remover um nó não exige gravar o layout na mesma operação.
- A interface grava a posição ao soltar o nó, não durante o arrasto.
- Arquivo ausente ou inválido não bloqueia nada: é tratado como "sem posições" e não coloca o modelo em estado inválido.
- O arquivo de layout é lido somente na inicialização do servidor. O observador de arquivo acompanha apenas o modelo.
- Uma edição externa do layout com o servidor em execução não é detectada e é sobrescrita na próxima gravação, porque vale a última escrita. Para aplicar um layout vindo de fora (por exemplo, após `git checkout`), reinicie a ferramenta.
- Nós sem posição recebem layout automático. Enquanto o layout por ELK não existir (da fase 2), usa-se um posicionamento simples em grade.

```json
{
  "schemaVersion": 1,
  "positions": {
    "n_nginx": { "x": 120, "y": 80 },
    "n_docker": { "x": 420, "y": 80 }
  }
}
```

**Catálogo inicial de `tech`**

| Grupo | Chaves |
| --- | --- |
| Linguagens | `java`, `python`, `typescript`, `javascript`, `go`, `rust`, `csharp`, `php` |
| Backend | `spring`, `fastapi`, `django`, `nodejs`, `express`, `fastify`, `nestjs`, `dotnet`, `laravel` |
| Frontend | `react`, `nextjs`, `vue`, `angular`, `svelte`, `reactnative` |
| Dados | `postgresql`, `mysql`, `mongodb`, `redis`, `sqlite`, `elasticsearch` |
| Mensageria | `kafka`, `rabbitmq` |
| Infraestrutura | `docker`, `kubernetes`, `nginx`, `traefik`, `caddy`, `githubactions` |
| Nuvem | `aws`, `gcp`, `azure`, `cloudflare` |

São 41 chaves. Uma tecnologia fora da lista continua válida no modelo e usa o ícone do `kind`.