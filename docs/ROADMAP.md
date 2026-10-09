# Roadmap — AI Architecture Studio

O projeto é entregue em cinco fases. Cada fase termina em algo demonstrável sozinho. As fases 1 e 2 formam o MVP.

Este roadmap não tem datas: a ordem é fixa, o ritmo não. Documentos relacionados: [PRD](PRD.md) · [Arquitetura](ARCHITECTURE.md).

| Fase | Nome | Parte do MVP | Estado |
| --- | --- | --- | --- |
| 1 | Editor | Sim | A iniciar |
| 2 | Agentes | Sim | Não iniciada |
| 3 | Dados | Não | Não iniciada |
| 4 | Segurança | Não | Não iniciada |
| 5 | Saídas | Não | Não iniciada |

## Fase 1 — Editor

**Objetivo:** um editor de arquitetura utilizável sem nenhum agente.

**Critério de aceite:** rodar `npx arquitecture` em uma pasta vazia, montar Internet → Nginx → Docker com front, API e banco dentro, entrar no Docker, editar propriedades, fechar e reabrir sem perda.

Núcleo (`packages/core`)

- [ ] JSON Schema da `schemaVersion` 1 (nós, conexões, `meta`, `lenses`)
- [ ] Operações puras: criar, atualizar, mover e remover nó; criar, atualizar e remover conexão
- [ ] Regras de integridade com os nove códigos de erro
- [ ] Erro estruturado com `code`, `message`, `path` e `hint`
- [ ] Exclusão em cascata com lista do que foi removido
- [ ] Serialização com ordem de chaves estável
- [ ] Testes unitários por operação e por código de erro
- [ ] Teste de propriedade: sequências aleatórias de operações válidas sempre validam
- [ ] Teste de ida e volta: carregar, gravar e recarregar produz o mesmo conteúdo

Servidor local (`packages/server`)

- [ ] Carregar e validar `docs/architecture.json` na inicialização
- [ ] Fila única de escrita
- [ ] Gravação atômica (arquivo temporário e renomeação)
- [ ] Incremento de `revision` e resposta `REVISION_CONFLICT`
- [ ] Leitura e gravação de `docs/architecture.layout.json` (DA-03)
  - [ ] Gravação pela mesma fila, de forma atômica
  - [ ] Sem incremento de `revision` e sem `REVISION_CONFLICT`; vale a última escrita
  - [ ] Posição de `id` órfão ignorada ao carregar e descartada na próxima gravação
  - [ ] Arquivo ausente ou inválido tratado como "sem posições", sem bloquear escritas
- [ ] API HTTP para a interface, escutando em `127.0.0.1`
 - [ ] Recusar gravação de layout malformada com `SCHEMA_INVALID`


Interface (`packages/web`)

- [ ] Canvas React Flow mostrando os filhos diretos do nível atual
- [ ] Drill-down por duplo clique, trilha de navegação e nível na URL
- [ ] Conexões entre níveis desenhadas no ancestral visível
- [ ] Blocos com cor por `kind`, ícone, nome, linha de detalhe e contador de filhos
- [ ] Catálogo inicial de 41 tecnologias com SVGs embutidos
- [ ] Criar nó pela paleta e pelo menu de contexto; conectar arrastando
- [ ] Painel lateral com árvore de nós e propriedades
- [ ] Confirmação ao remover nó com cascata
- [ ] Gravar posição ao soltar o nó, não durante o arrasto
- [ ] Posicionamento em grade para nós sem posição
- [ ] Abas `Diagrama` e `JSON` (somente leitura)
- [ ] Desfazer na sessão da interface
- [ ] Tema escuro como padrão

CLI (`packages/cli`)

- [ ] Comando `arquitecture` que sobe o servidor e abre o navegador
- [ ] Confirmar disponibilidade do nome no npm antes de publicar

Verificação

- [ ] Teste de ponta a ponta cobrindo o critério de aceite

## Fase 2 — Agentes

**Objetivo:** Claude Code e Codex leem e alteram o modelo, e o canvas acompanha ao vivo.

**Critério de aceite:** pedir ao Claude Code para mapear um repositório real e ver o canvas se montar sem recarregar; um JSON corrompido à mão mostra o aviso e não derruba a interface.

**Depende de:** fase 1.

- [ ] Adaptador MCP dentro do servidor local, exposto por HTTP em `127.0.0.1`
- [ ] Ferramentas de leitura: `get_model`, `list_nodes`, `validate`
- [ ] Ferramentas de escrita: `add_node`, `update_node`, `move_node`, `remove_node`, `add_edge`, `update_edge`, `remove_edge`, `set_lens`
- [ ] `apply_batch` atômico, com alias temporário para nós criados no mesmo lote
- [ ] `expectedRevision` em todas as escritas
- [ ] Ponte stdio: `arquitecture mcp`
- [ ] WebSocket com os eventos `model.changed`, `model.invalid` e `model.restored`
- [ ] Observador de arquivo: adotar mudança externa válida, rejeitar inválida
- [ ] Aviso de modelo inválido no canvas e botão "restaurar último válido"
- [ ] Layout automático com ELK para nós sem posição e botão de reorganizar o nível
- [ ] Texto de instrução para `CLAUDE.md` e `AGENTS.md`
- [ ] Teste de concorrência: duas escritas com a mesma `expectedRevision` resultam em um aceite e um conflito
- [ ] Teste de ponta a ponta cobrindo o critério de aceite

## Fase 3 — Dados

**Objetivo:** abrir o nó do banco como diagrama ER.

**Critério de aceite:** entrar no nó do banco de um projeto com `schema.prisma` e ver as tabelas e relações corretas.

**Depende de:** fase 1 para a visão; fase 2 para o agente preencher com `set_lens`.

- [ ] Registro interno de lentes (esquema, visão, importadores)
- [ ] Esquema da lente `data`: `tables`, `columns`, `relations`
- [ ] Visão ER com tabelas editáveis
- [ ] Importador de `schema.prisma`
- [ ] Fluxo de proposta: o importador sugere, a pessoa ou o agente confirma
- [ ] Testes de importador com saída esperada fixada
- [ ] Depois, nesta ordem: migrations SQL, entidades JPA, introspecção de PostgreSQL

## Fase 4 — Segurança

**Objetivo:** ver autenticação, autorização e fronteiras de confiança sobre o diagrama normal.

**Critério de aceite:** alternar a lente e identificar de relance qual rota chega a um serviço sem autenticação declarada.

**Depende de:** registro de lentes da fase 3.

- [ ] Esquema da lente `security` no nó: `authn`, `authz`, `exposure`
- [ ] Esquema na conexão: `encrypted`, `credential`
- [ ] Sobreposição no canvas: selos nos nós e fronteiras em volta dos grupos
- [ ] Destaque para conexões que cruzam uma fronteira sem autenticação declarada
- [ ] Sem importador automático nesta versão: o agente preenche

## Fase 5 — Saídas

**Objetivo:** levar o modelo para fora da ferramenta e conversar com o agente dentro dela.

**Critério de aceite:** o .drawio exportado abre no draw.io com a mesma hierarquia.

**Depende de:** fase 1 para as exportações.

- [ ] Exportação para .drawio
- [ ] Exportação para Mermaid
- [ ] Exportação para Markdown
- [ ] Chat embutido no painel esquerdo

O chat embutido tem uma pendência de definição: a ferramenta não chama LLM diretamente, então é preciso decidir como o chat se liga ao agente externo. Ver decisão DA-02 no PRD.

## Fora do roadmap

- Serviço hospedado, login e colaboração em tempo real entre pessoas
- Chamada direta a LLM pela ferramenta
- Inspeção de infraestrutura em execução
- API pública de plugins para lentes de terceiros