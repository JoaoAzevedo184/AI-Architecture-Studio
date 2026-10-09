# PRD — AI Architecture Studio

## 1. Informações do documento

| Campo | Valor |
| --- | --- |
| Produto | AI Architecture Studio |
| Tipo | Product Requirements Document |
| Finalidade | Referência de produto para orientar o desenvolvimento com Claude Code e OpenAI Codex |
| Versão | 0.5 |
| Data | 2026-10-08 |
| Status | Rascunho, não aprovado |
| Documento de origem | AI Architecture Studio — Especificação Técnica (citada como **ET §n**) |
| Público-alvo | Autor do projeto, pessoas desenvolvedoras e agentes de código que implementarão o produto |

**Convenção de classificação usada neste documento**

- **Confirmado:** está explícito na especificação técnica.
- **Proposto:** recomendação deste PRD, ainda sem aprovação.
- **Em aberto:** decisão necessária e não definida (lista `DA-nn` na seção 18).
- **Fora de escopo:** excluído ou reservado para fase posterior.

Quando um item não traz marcação, ele é **Confirmado**.

## 2. Resumo executivo

O AI Architecture Studio é uma ferramenta que roda no computador da pessoa desenvolvedora, dentro da pasta do projeto, e mostra a arquitetura do sistema como um diagrama editável.

**Problema.** Diagramas de arquitetura ficam desatualizados em relação ao código, e os diagramas gerados por agentes de IA costumam ser um resultado final que não se edita nem se aprofunda.

**Como funciona.** A arquitetura fica descrita em um arquivo, `docs/architecture.json`, guardado junto com o código. Um agente como Claude Code ou Codex lê o repositório e altera esse arquivo por meio de ferramentas controladas (MCP). A pessoa altera o mesmo arquivo pelo canvas. Toda alteração é validada antes de ser gravada, e o canvas se atualiza ao vivo.

**Quem se beneficia.** Pessoas desenvolvedoras que querem entender, documentar ou revisar a arquitetura de um repositório, com ou sem agente.

**Diferencial.** Diagrama editável à mão, navegável por níveis de profundidade (do sistema inteiro até o interior de um serviço) e alimentado por agentes sobre uma única fonte da verdade.

**Resultado esperado do MVP.** Abrir a ferramenta em um repositório, pedir a um agente que mapeie a arquitetura, ver o diagrama se montar sem recarregar, entrar nos componentes, corrigir à mão e ter tudo salvo em um arquivo versionável.

## 3. Problema e oportunidade

**Problemas sustentados pela especificação**

| Problema | Evidência na especificação |
| --- | --- |
| Manter duas representações da arquitetura (a do agente e a visual) leva a divergência | ET §1: agente e pessoa trabalham sobre o mesmo arquivo |
| Um diagrama de um só nível não comporta sistema, contêineres e componentes | ET §3 e §6: hierarquia por `parent` e drill-down |
| Alterações de agentes podem corromper o modelo | ET §4: validação completa antes de gravar e tratamento de edição direta do arquivo |
| Escritas simultâneas de pessoa e agente podem se sobrescrever | ET §2 e §5: escritor único e `expectedRevision` |
| Agentes precisam de erros que consigam interpretar para se corrigir | ET §4: erro com `code`, `path`, `message` e `hint` |

**Oportunidades inferidas (Proposto)**

- Diagramas versionados no Git, com diff legível, podem ser revisados junto com o código.
- Um editor útil sem agente reduz o risco do projeto, porque a fase 1 já entrega valor.
- A mesma base serve a visões especializadas (dados e segurança) sem um segundo modelo.

Não há pesquisa de mercado, entrevistas ou validação com usuários. As afirmações acima vêm da especificação e do raciocínio de produto.

## 4. Visão, objetivos e princípios do produto

**Visão.** A arquitetura de um projeto é um artefato vivo do repositório: o agente a mantém, a pessoa a corrige, e os dois enxergam a mesma coisa.

**Objetivos**

1. Manter um modelo de arquitetura hierárquico, válido e versionável em `docs/architecture.json`.
2. Permitir edição manual completa pelo canvas.
3. Permitir que agentes leiam e alterem o modelo por MCP, com validação.
4. Refletir no canvas, ao vivo, qualquer alteração aceita.
5. Preparar o modelo para lentes de dados e segurança sem reescrever o núcleo.

**Princípios**

| Princípio | Classificação | Origem |
| --- | --- | --- |
| Fonte da verdade única | Confirmado | ET §1, §2 |
| Execução local, sem serviço hospedado | Confirmado | ET §1 |
| Integridade do modelo: nada inválido é gravado pela ferramenta | Confirmado | ET §4 |
| Edição manual e por agente com as mesmas operações | Confirmado | ET §5 |
| Evolução incremental: cada fase é demonstrável | Confirmado | ET §8 |
| O modelo descreve o que foi declarado, não o que está rodando | Confirmado | ET §1 |
| Interoperabilidade: um protocolo para vários agentes | Proposto (inferido de ET §2, §5) | — |
| Diff legível no Git como critério de desenho | Proposto (inferido de ET §3, §8) | — |

**Restrições estratégicas**

- Sem login, sem backend hospedado, sem colaboração em tempo real entre pessoas.
- Sem chamada direta a LLM: quem raciocina é o agente externo.
- TypeScript em todo o monorepo.

**Sucesso do MVP.** Os critérios de aceite das fases 1 e 2 (seção 15) passam, com os testes obrigatórios da seção 16.

## 5. Usuários e personas

As personas abaixo são **hipóteses**. Nenhuma foi validada com usuários.

| Persona | Objetivos | Necessidades | Dificuldades | Contexto de uso | Resultado esperado |
| --- | --- | --- | --- | --- | --- |
| P1. Dev que quer visualizar a arquitetura | Entender como o sistema se organiza | Visão geral e aprofundamento por componente | Documentação ausente ou desatualizada | Ao entrar em um projeto ou retomar um antigo | Navega do nível do sistema ao interior de um serviço |
| P2. Dev que edita diagramas à mão | Documentar ou planejar uma arquitetura | Criar, conectar, organizar e salvar | Ferramentas genéricas de desenho não conhecem hierarquia nem tecnologia | Projeto novo ou revisão de desenho | Modelo salvo e versionado, com ícones corretos |
| P3. Dev que usa Claude Code ou Codex | Delegar o mapeamento ao agente | Agente que altera o modelo sem quebrá-lo; ver o resultado ao vivo | Saída do agente não editável; erros opacos | Terminal com agente e navegador lado a lado | Diagrama montado pelo agente e ajustado à mão |
| P4. Pessoa que avalia dados e segurança | Ver modelagem do banco e pontos sem autenticação | Lentes sobre o mesmo modelo | Informação espalhada pelo código | Revisão de projeto (fases 3 e 4) | Identifica tabelas, relações e rotas sem autenticação declarada |

P4 depende de funcionalidades posteriores ao MVP.

## 6. Escopo do produto

### 6.1. MVP — fases 1 e 2

- Modelo hierárquico com nós, conexões e filhos, validado por JSON Schema e regras de integridade.
- Servidor local com escritor único, gravação atômica e controle de revisão.
- Canvas com drill-down, trilha de navegação, ícones de tecnologia e edição manual.
- Painel lateral com árvore de nós e propriedades.
- Abas `Diagrama` e `JSON` (somente leitura).
- Servidor MCP com as doze ferramentas da seção 9.
- Atualização ao vivo por WebSocket.
- Observador de arquivo, aviso de modelo inválido e restauração do último modelo válido.

### 6.2. Evoluções posteriores

| Fase | Entrega |
| --- | --- |
| 3. Dados | Lente de dados: ER manual e importador de Prisma |
| 4. Segurança | Lente de segurança como sobreposição no canvas |
| 5. Saídas | Exportação para .drawio, Mermaid e Markdown; chat embutido |

### 6.3. Fora de escopo

- Serviço hospedado, login e colaboração em tempo real entre pessoas.
- Chamada direta a LLM pela ferramenta.
- Inspeção de infraestrutura em execução.
- Carregamento de plugins de lentes de terceiros (ET §7).
- Sincronização de posições entre abas da interface abertas ao mesmo tempo: cada aba lê o layout ao carregar.

### 6.4. Limites do produto

O produto representa a arquitetura **declarada** no modelo. Ele não garante que o modelo corresponde ao código, à infraestrutura implantada ou ao que está em execução. A correspondência depende de quem preenche o modelo, seja a pessoa ou o agente. A lente de segurança, quando existir, mostra o que foi declarado e não constitui auditoria. O arquivo de layout é lido só na inicialização: uma edição externa dele com a ferramenta em execução não é detectada e é sobrescrita na próxima gravação, então aplicar um layout vindo de fora exige reiniciar a ferramenta.

## 7. Jornadas e casos de uso

### J1. Iniciar a ferramenta em um repositório vazio

- **Ator:** dev (P2).
- **Pré-condições:** Node instalado; pasta sem `docs/architecture.json`.
- **Fluxo:** executa `npx arquitecture` na raiz; o servidor local inicia; o navegador abre o canvas vazio.
- **Resultado:** canvas pronto para edição.
- **Erros possíveis:** porta ocupada; falta de permissão de escrita.
- **Recuperação:** não definida na especificação (DA-04, DA-09). A criação automática do arquivo e da pasta `docs/` é **Proposta**.

### J2. Criar uma arquitetura manualmente

- **Ator:** dev (P2).
- **Pré-condições:** J1 concluída.
- **Fluxo:** cria os nós Internet, Nginx e Docker pela paleta; define `kind` e `tech`; arrasta para conectar; entra no Docker e cria front, API e banco.
- **Resultado:** modelo gravado a cada operação aceita; `revision` incrementa.
- **Erros possíveis:** conexão para o próprio nó (`EDGE_SELF_LOOP`); conexão para ancestral (`EDGE_TO_ANCESTOR`).
- **Recuperação:** a operação é recusada, nada é gravado e a interface mostra a mensagem do erro.

### J3. Navegar da raiz para um subdiagrama e retornar

- **Ator:** dev (P1).
- **Pré-condições:** existe um nó com filhos.
- **Fluxo:** duplo clique no nó; o canvas mostra os filhos diretos; a URL passa a refletir o nível; clica em um item da trilha para voltar.
- **Resultado:** navegação sem perda de contexto; o link local reabre no mesmo nível.
- **Erros possíveis:** URL aponta para um nó removido.
- **Recuperação:** não definida na especificação. **Proposto:** voltar ao ancestral existente mais próximo.

### J4. Editar propriedades e conexões

- **Ator:** dev (P2).
- **Fluxo:** seleciona um nó; altera nome, `kind`, `tech` ou descrição no painel; seleciona uma conexão e altera rótulo ou `kind`.
- **Resultado:** alteração gravada; canvas atualizado.
- **Erros possíveis:** `REVISION_CONFLICT` se o agente alterou o modelo no intervalo.
- **Recuperação:** a interface relê o modelo e a pessoa repete a alteração (ET §5).

### J5. Salvar, fechar e reabrir o projeto

- **Ator:** dev (P2).
- **Fluxo:** encerra o processo; executa `npx arquitecture` de novo.
- **Resultado:** mesmos nós, conexões, hierarquia e posições. Posições de nós que não existem mais são ignoradas.
- **Erros possíveis:** arquivo do modelo alterado e inválido no intervalo; arquivo de layout ausente ou inválido.
- **Recuperação:** comportamento na inicialização com arquivo do modelo inválido não está definido (DA-06). Em execução, vale J9. Layout ausente ou inválido não bloqueia: é tratado como "sem posições" e os nós recebem posicionamento automático (DA-03, resolvida).

### J6. Solicitar a um agente o mapeamento de um repositório

- **Ator:** dev (P3) e agente.
- **Pré-condições:** servidor em execução; agente configurado com o servidor MCP.
- **Fluxo:** a pessoa pede o mapeamento; o agente lê o código; chama `list_nodes` ou `get_model`; envia a arquitetura por `apply_batch`.
- **Resultado:** uma nova revisão com todos os nós e conexões.
- **Erros possíveis:** lote com referência inexistente; lente inválida.
- **Recuperação:** o lote inteiro é recusado; o agente recebe erros estruturados e reenvia corrigido.

### J7. Observar atualizações do agente sem recarregar a interface

- **Ator:** dev (P3).
- **Fluxo:** com o canvas aberto, o agente aplica operações; o servidor publica `model.changed`; o canvas redesenha; nós sem posição recebem layout automático, por ELK, entregue na fase 2.
- **Resultado:** o diagrama aparece sem ação da pessoa.
- **Erros possíveis:** conexão WebSocket perdida.
- **Recuperação:** não definida na especificação. **Proposto:** reconectar e reler o modelo.

### J8. Lidar com uma edição concorrente

- **Ator:** dev e agente.
- **Fluxo:** os dois enviam escrita com a mesma `expectedRevision`; a primeira é aceita; a segunda recebe `REVISION_CONFLICT` com a revisão corrente.
- **Resultado:** nenhuma alteração é sobrescrita em silêncio.
- **Recuperação:** o cliente recusado relê o modelo antes de tentar de novo.

### J9. Lidar com um arquivo JSON inválido

- **Ator:** dev ou agente que editou o arquivo diretamente.
- **Fluxo:** o observador detecta a mudança; a validação falha; o servidor mantém em memória o último modelo válido e publica `model.invalid`; o canvas mostra um aviso com os erros.
- **Resultado:** a interface continua funcionando com o último modelo válido; novas escritas são recusadas.
- **Recuperação:** corrigir o arquivo ou seguir J10.

### J10. Restaurar o último modelo válido

- **Ator:** dev.
- **Pré-condições:** estado de modelo inválido (J9).
- **Fluxo:** aciona "restaurar último válido" no aviso; o servidor regrava o arquivo com o modelo em memória e publica `model.restored`.
- **Resultado:** arquivo válido; escritas liberadas.
- **Erros possíveis:** falha de gravação.
- **Recuperação:** não definida. A restauração por agente via MCP também não está definida (DA-06).

## 8. Requisitos funcionais

**Prioridades (Proposto):** P0 é indispensável para a entrega funcional do MVP; P1 completa a experiência prevista; P2 é evolução posterior. As prioridades foram atribuídas por este PRD a partir dos critérios de aceite das fases e precisam de validação.

Os requisitos das fases 3 a 5 estão descritos na seção 14 e não recebem identificador `FR` nesta versão.

### 8.1. Inicialização e gerenciamento do projeto

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-001 | Iniciar por `npx` | `npx arquitecture` na raiz do repositório inicia o servidor local e abre o canvas | Uso sem instalação nem serviço hospedado | Dev | P0 | 1 | Dado um repositório, quando executo o comando, então o canvas abre no navegador | — | ET §1, §9 |
| FR-002 | Projeto sem modelo | Em pasta sem `docs/architecture.json`, a ferramenta apresenta um canvas vazio e utilizável | Critério da fase 1 parte de pasta vazia | Dev | P0 | 1 | Dado uma pasta vazia, quando inicio, então consigo criar o primeiro nó. Criar o arquivo e `docs/` automaticamente é **Proposto** (DA-09) | FR-001 | ET §8 (implícito) |
| FR-003 | Carregar modelo existente | Na inicialização, o servidor carrega e valida `docs/architecture.json` | Reabrir sem perda | Sistema | P0 | 1 | Dado um modelo válido salvo, quando reinicio, então nós, conexões e hierarquia são idênticos | FR-024, FR-029 | ET §2, §8 |

### 8.2. Modelo de arquitetura

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-004 | Nós | Um nó tem `id`, `name`, `kind`, `parent` e, opcionalmente, `tech` e `lenses` | Representar componentes | Dev, agente | P0 | 1 | Um nó com esses campos é aceito; um nó sem `name` ou `kind` gera `SCHEMA_INVALID` | — | ET §3 |
| FR-005 | Conexões | Uma conexão tem `id`, `source`, `target`, `label` opcional e `kind` (`sync`, `async`, `data`) | Representar relações | Dev, agente | P0 | 1 | Uma conexão entre dois nós existentes é aceita; `kind` fora do conjunto gera `SCHEMA_INVALID` | FR-004 | ET §3 |
| FR-006 | IDs estáveis | O `id` é gerado pelo servidor, opaco e imutável; não deriva do nome | Renomear não quebra conexões | Sistema | P0 | 1 | Dado um nó conectado, quando o renomeio, então o `id` e as conexões permanecem | FR-004 | ET §3 |
| FR-007 | `kind` fechado | `kind` do nó pertence a: `external`, `proxy`, `group`, `service`, `frontend`, `database`, `cache`, `queue`, `storage` | Cores, ícones padrão e lentes dependem do tipo | Dev, agente | P0 | 1 | Valor fora do conjunto gera `SCHEMA_INVALID` | FR-004 | ET §3 |
| FR-008 | Metadados de lentes | `lenses` guarda um objeto por lente; lente conhecida é validada, lente desconhecida é preservada sem validação | Extensão sem perda de dados | Agente, sistema | P1 | 1 | Trecho inválido de lente conhecida gera `LENS_INVALID`; trecho de lente desconhecida sobrevive a carregar e gravar | FR-004 | ET §3, §4 |

### 8.3. Hierarquia e navegação

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-009 | Hierarquia por `parent` | A hierarquia é definida pelo campo `parent`; `null` indica a raiz | Níveis de profundidade | Dev, agente | P0 | 1 | Um nó com `parent` válido aparece somente no nível do pai | FR-004 | ET §3 |
| FR-010 | Drill-down | Duplo clique em um nó com filhos abre o nível dele, mostrando os filhos diretos e as conexões entre eles | Aprofundar sem poluir a visão geral | Dev | P0 | 1 | Dado Docker com três filhos, quando dou duplo clique, então vejo os três filhos | FR-009 | ET §6 |
| FR-011 | Trilha de navegação | Uma trilha no topo mostra o caminho (`Raiz / Docker / API`) e permite voltar a qualquer nível | Retornar | Dev | P0 | 1 | Clicar em um item da trilha abre aquele nível | FR-010 | ET §6 |
| FR-012 | Nível na URL | O nível atual fica na URL (`#/n_docker/n_api`) | Compartilhar e reabrir um link local | Dev | P1 | 1 | Abrir a URL copiada leva ao mesmo nível | FR-010 | ET §6 |
| FR-013 | Conexão entre níveis | Conexão entre nós de pais diferentes é desenhada chegando no ancestral visível do nível atual | Manter a relação visível com o destino recolhido | Sistema | P0 | 1 | Dado `n_nginx → n_api` e `n_api` dentro de `n_docker`, na raiz a conexão chega em `n_docker` | FR-005, FR-009 | ET §3 |
| FR-014 | Contador de filhos | Nós com filhos exibem um contador | Indicar que há mais para ver | Dev | P1 | 1 | Um nó com três filhos mostra o número 3 | FR-009 | ET §6 |

### 8.4. Canvas e edição manual

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-015 | Criar nó | Criar um nó pela paleta ou pelo menu de contexto, no nível atual | Edição manual | Dev | P0 | 1 | O nó criado aparece no nível atual com o `parent` correspondente | FR-004 | ET §6 |
| FR-016 | Conectar nós | Arrastar de um nó a outro cria uma conexão | Edição manual | Dev | P0 | 1 | A conexão é gravada; tentativas inválidas mostram o erro e nada é gravado | FR-005, FR-029 | ET §6 |
| FR-017 | Editar propriedades | Editar nome, `kind`, `tech` e descrição do nó, e rótulo e `kind` da conexão, no painel | Edição manual | Dev | P0 | 1 | A alteração é gravada e refletida no canvas | FR-019 | ET §5, §6 |
| FR-018 | Remover com confirmação | Remover um nó pede confirmação quando há cascata | Evitar perda acidental | Dev | P0 | 1 | Dado um nó com filhos, quando removo, então vejo a confirmação antes da exclusão | FR-031 | ET §6 |
| FR-019 | Painel lateral | Painel à esquerda com a árvore de nós e as propriedades do item selecionado | Visão estrutural e edição | Dev | P0 | 1 | Selecionar um item na árvore o seleciona no canvas e mostra as propriedades | — | ET §6 |
| FR-020 | Aparência dos blocos | Bloco com borda na cor do `kind`, ícone da tecnologia, nome e uma linha de detalhe; tema escuro como padrão | Leitura rápida | Dev | P1 | 1 | Nós de `kind` diferentes têm cores distintas; o tema inicial é escuro. A paleta exata não está definida | FR-021 | ET §6, §9 |

### 8.5. Catálogo de tecnologias e ícones

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-021 | Catálogo local de ícones | `tech` é mapeado para um SVG do Devicon embutido no pacote | Ícones sem depender de rede | Sistema | P0 | 1 | Com a rede desligada, um nó com `tech: "nginx"` mostra o ícone do Nginx | — | ET §6 |
| FR-022 | Tecnologia desconhecida | `tech` fora do catálogo é aceito e usa o ícone do `kind` | Não bloquear o agente por falta de ícone | Dev, agente | P0 | 1 | Um nó com `tech: "xyz"` é gravado e exibe o ícone do `kind` | FR-021 | ET §3, §9 |
| FR-023 | Catálogo inicial | O catálogo inicial tem as 41 chaves listadas na ET §9, em sete grupos | Cobrir as tecnologias comuns | Sistema | P1 | 1 | Cada uma das 41 chaves resolve para um ícone. A correspondência com os nomes do Devicon precisa ser verificada (DA-13) | FR-021 | ET §9 |

### 8.6. Persistência

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-024 | Arquivo do modelo | O modelo é persistido em `docs/architecture.json` | Fonte da verdade versionada | Sistema | P0 | 1 | Após uma operação aceita, o arquivo contém o novo estado | — | ET §1, §9 |
| FR-025 | Escrita atômica | A gravação usa arquivo temporário e renomeação | Nunca deixar o arquivo pela metade | Sistema | P0 | 1 | Interromper o processo durante a gravação não deixa o arquivo corrompido | FR-024 | ET §2 |
| FR-026 | Revisão | `revision` é incrementada pelo servidor a cada escrita aceita no modelo. Gravar o layout não incrementa a `revision` | Detectar conflitos | Sistema | P0 | 1 | Cada escrita aceita no modelo aumenta `revision` em 1; escrita recusada não altera | FR-024 | ET §2, §3 |
| FR-027 | Escritor único | Todas as escritas passam por uma fila única no servidor | Concorrência sem trava de arquivo | Sistema | P0 | 1 | Duas operações enviadas ao mesmo tempo são aplicadas uma após a outra | — | ET §2 |
| FR-028 | Serialização estável | Carregar e gravar um modelo sem alterações produz o mesmo conteúdo, com ordem de chaves estável | Diff do Git limpo | Sistema | P1 | 1 | O teste de ida e volta passa | FR-024 | ET §8 |

### 8.7. Validação e integridade

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-029 | Validação antes de gravar | Toda escrita no modelo valida o modelo resultante inteiro (JSON Schema e regras de integridade) antes de chegar ao disco. Na gravação do layout, valida-se apenas a forma do arquivo de layout; gravação malformada é recusada com `SCHEMA_INVALID`, `path` dentro do arquivo de layout, `message` e `hint`, e nada é gravado | Integridade do modelo | Sistema | P0 | 1 | Operação que viola qualquer regra da seção 10 não altera o arquivo nem a `revision` | — | ET §4 |
| FR-030 | Erro estruturado | Todo erro traz `code`, `message`, `path` e `hint` | Pessoa e agente conseguem se corrigir | Sistema | P0 | 1 | Cada código da seção 10 é devolvido com os quatro campos | FR-029 | ET §4 |
| FR-031 | Exclusão em cascata | Remover um nó remove os descendentes e as conexões que tocam neles; a resposta lista o que foi removido | Não deixar referências órfãs | Dev, agente | P0 | 1 | Dado Docker com três filhos e duas conexões, quando removo Docker, então a resposta lista os quatro nós e as conexões removidas | FR-029 | ET §4 |

### 8.8. Integração com agentes via MCP

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-032 | Adaptador MCP | As operações do núcleo são expostas como as ferramentas da seção 9 | Agentes alteram o modelo com validação | Agente | P0 | 2 | Cada ferramenta da seção 9 está disponível e produz o efeito documentado | FR-029 | ET §5 |
| FR-033 | Transporte HTTP local | O adaptador é exposto por HTTP em `127.0.0.1`, dentro do servidor local | Um único escritor | Agente | P0 | 2 | Um agente configurado por HTTP lista e chama as ferramentas | FR-032 | ET §2 |
| FR-034 | Ponte stdio | `arquitecture mcp` repassa chamadas stdio ao servidor em execução | Agentes que só aceitam stdio | Agente | P1 | 2 | Um agente configurado por stdio obtém os mesmos resultados que por HTTP. Descoberta do servidor em aberto (DA-04) | FR-033 | ET §2, §9 |
| FR-035 | Leitura parcial | `get_model` aceita `scope` e `depth`; `list_nodes` devolve um resumo com filtros | Não enviar o arquivo inteiro ao agente | Agente | P0 | 2 | `get_model` com `scope` devolve somente a subárvore pedida | FR-032 | ET §5 |
| FR-036 | Revisão otimista | Toda ferramenta de escrita aceita `expectedRevision` opcional e devolve a nova `revision` | Evitar sobrescrita | Agente, interface | P0 | 2 | Com `expectedRevision` diferente da atual, a resposta é `REVISION_CONFLICT` com a revisão corrente | FR-026 | ET §5 |

### 8.9. Operações em lote

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-037 | `apply_batch` atômico | Um lote aplica todas as operações ou nenhuma, gerando uma única revisão e um único evento | Sem estados intermediários no canvas | Agente | P0 | 2 | Um lote com uma operação inválida não altera o modelo; um lote válido incrementa `revision` em 1 | FR-032 | ET §5 |
| FR-038 | Alias no lote | Operações do lote referenciam nós criados no mesmo lote por um alias temporário | Criar nós e conexões em uma chamada | Agente | P0 | 2 | Um lote que cria dois nós e a conexão entre eles é aceito. O formato do alias não está definido (DA-15) | FR-037 | ET §5 |

### 8.10. Sincronização em tempo real

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-039 | Atualização ao vivo | A cada escrita aceita no modelo, o servidor publica `model.changed` por WebSocket e o canvas se atualiza sem recarregar. Gravar o layout não publica evento | Ver o agente trabalhar | Dev | P0 | 2 | Dado o canvas aberto, quando o agente cria um nó, então o nó aparece sem recarregar a página | FR-032 | ET §2, §5 |
| FR-040 | Interface envia a revisão | A interface envia sempre a `revision` que conhece em toda escrita no modelo. A gravação do layout não envia nem confere `revision` | Detectar que o agente alterou o modelo | Interface | P0 | 1 | Uma edição manual sobre revisão antiga recebe `REVISION_CONFLICT` | FR-026 | ET §5 |

### 8.11. Tratamento de alterações externas

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-041 | Observador de arquivo | O servidor detecta e valida toda mudança externa em `docs/architecture.json` | Não é possível impedir edição direta | Sistema | P0 | 2 | Editar o arquivo fora da ferramenta dispara a validação | FR-029 | ET §2, §4 |
| FR-042 | Adoção de mudança válida | Mudança externa válida é adotada e a revisão é incrementada | Aceitar `git checkout` e edições corretas | Sistema | P0 | 2 | Após um `git checkout` para um modelo válido, o canvas mostra o novo conteúdo | FR-041 | ET §4 |
| FR-043 | Rejeição de mudança inválida | Mudança externa inválida não é adotada: o servidor mantém o último modelo válido em memória, publica `model.invalid`, o canvas mostra um aviso com os erros e novas escritas são recusadas | A interface não pode cair | Sistema | P0 | 2 | Dado um JSON corrompido à mão, então o aviso aparece, a interface segue funcionando e escritas são recusadas | FR-041 | ET §4, §8 |
| FR-044 | Restaurar último válido | A ação "restaurar último válido" regrava o arquivo com o modelo em memória e publica `model.restored` | Sair do estado inválido | Dev | P0 | 2 | Após restaurar, o arquivo é válido e as escritas voltam a ser aceitas | FR-043 | ET §4, §5 |

### 8.12. Layout e posicionamento

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-045 | Posição manual persistida | A interface envia a posição ao soltar o nó (não durante o arrasto) e o servidor a grava em `docs/architecture.layout.json`, por `id`, pela mesma fila de escrita e de forma atômica. Gravar o layout não incrementa `revision`, não gera `REVISION_CONFLICT` e não tem controle de conflito: vale a última escrita | Reabrir com o mesmo desenho | Dev | P0 | 1 | Mover um nó, fechar e reabrir mantém a posição. Mover um nó não altera a `revision` do modelo. Posição de `id` inexistente no modelo é ignorada ao carregar e removida na próxima gravação do layout. Layout ausente ou inválido não bloqueia escritas nem invalida o modelo: os nós recebem posicionamento em grade enquanto FR-046 não existir. O layout é lido só na inicialização; o observador acompanha apenas o modelo; edição externa do layout com o servidor em execução não é detectada e é sobrescrita na próxima gravação. Para aplicar um layout vindo de fora (por exemplo, após `git checkout`), reinicia-se a ferramenta. Gravar o layout não publica evento. Gravação de layout malformada é recusada com `SCHEMA_INVALID`, `path` dentro do arquivo de layout, e nada é gravado | FR-006 | ET §6, §9; DA-03 |
| FR-046 | Layout automático | Nós sem posição recebem layout automático por ELK | Nós criados pelo agente não têm posição | Sistema | P0 | 2 | Nós criados por `apply_batch` aparecem sem sobreposição. Os critérios ainda não estão definidos (DA-08) | FR-045 | ET §6 |
| FR-047 | Reorganizar nível | Um botão reorganiza automaticamente o nível atual | Arrumar um nível bagunçado | Dev | P1 | 2 | Acionar o botão recalcula as posições do nível atual | FR-046 | ET §6 |

### 8.13. Visualização do JSON

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-048 | Abas Diagrama e JSON | O canvas tem as abas `Diagrama` e `JSON`; a aba `JSON` é somente leitura | Conferir o modelo sem sair da ferramenta | Dev | P1 | 1 | A aba `JSON` mostra o modelo atual e não permite edição | — | ET §6 |

### 8.14. Histórico de alterações e desfazer

| ID | Nome | Descrição | Justificativa | Ator | Prio | Fase | Critérios de aceitação | Dependências | Origem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-049 | Desfazer na sessão | A interface mantém uma pilha de operações inversas na sessão; desfazer não reverte alterações do agente | Corrigir erros de edição manual | Dev | P1 | 1 | Criar um nó e desfazer remove o nó. O comportamento com alterações do agente intercaladas está em aberto (DA-07) | FR-015 | ET §6 |

Histórico de alterações persistente não está previsto na especificação. O histórico disponível é o do Git.

## 9. Requisitos de integração MCP

Todas as ferramentas são da **fase 2**. Os esquemas completos de parâmetros não estão definidos na especificação; as entradas abaixo são as conhecidas.

| Ferramenta | Finalidade | Entradas conhecidas | Resultado esperado | Validação | Falhas |
| --- | --- | --- | --- | --- | --- |
| `get_model` | Ler o modelo ou uma subárvore | `scope?` (id de nó), `depth?` | Modelo ou subárvore | — | Comportamento para `scope` inexistente não definido |
| `list_nodes` | Listar nós de forma resumida | `parent?`, `kind?` | Lista com `id`, `name`, `kind`, `tech`, `parent` | — | Não definido |
| `add_node` | Criar um nó | `name`, `kind`, `tech?`, `parent?` | `id` gerado e nova `revision` | Esquema, `PARENT_NOT_FOUND` | Erro estruturado; nada gravado |
| `update_node` | Alterar um nó | `id` e campos a alterar | Nova `revision` | Esquema | `NOT_FOUND` para `id` inexistente; erro estruturado; nada gravado |
| `move_node` | Mudar o nó de nível | `id`, `parent` | Nova `revision` | `PARENT_NOT_FOUND`, `PARENT_CYCLE` | `NOT_FOUND` para `id` inexistente; erro estruturado; nada gravado |
| `remove_node` | Remover em cascata | `id` | Lista do que foi removido e nova `revision` | — | `NOT_FOUND` para `id` inexistente |
| `add_edge` | Criar uma conexão | `source`, `target`, `label?`, `kind?` | `id` da conexão e nova `revision` | `EDGE_ENDPOINT_NOT_FOUND`, `EDGE_SELF_LOOP`, `EDGE_TO_ANCESTOR` | Erro estruturado; nada gravado |
| `update_edge` | Alterar uma conexão | `id` e campos a alterar | Nova `revision` | Mesmas de `add_edge` | `NOT_FOUND` para `id` inexistente; erro estruturado; nada gravado |
| `remove_edge` | Remover uma conexão | `id` | Nova `revision` | — | `NOT_FOUND` para `id` inexistente |
| `set_lens` | Substituir o trecho de uma lente no nó | `nodeId`, `lens`, `data` | Nova `revision` | `LENS_INVALID` para lente conhecida | Lente desconhecida: não definido (DA-10) |
| `apply_batch` | Aplicar várias operações como uma | Lista de operações | Uma nova `revision`; um evento | Todas as regras, sobre o resultado final | Tudo ou nada; erros estruturados |
| `validate` | Verificar o modelo atual | Nenhuma | Lista de erros (vazia se válido) | Todas as regras | — |

**Revisão otimista.** Toda ferramenta de escrita aceita `expectedRevision` opcional. Sem ela, a operação é aplicada sobre o estado atual. Com valor diferente da revisão corrente, a resposta é `REVISION_CONFLICT` com a revisão atual, e o cliente relê antes de tentar de novo. A interface envia sempre a revisão; o agente envia em `apply_batch`.

**Atomicidade do lote.** `apply_batch` aplica tudo ou nada, produz uma única revisão e um único evento. É o caminho principal do agente.

**Alias temporário.** Dentro de um lote, operações referenciam nós criados no mesmo lote por um alias temporário. O formato não está definido (DA-15).

**Eventos para a interface**

| Evento | Quando | Conteúdo conhecido |
| --- | --- | --- |
| `model.changed` | Escrita aceita no modelo. Gravar o layout não publica evento | Revisão e operações aplicadas |
| `model.invalid` | Edição externa inválida | Erros |
| `model.restored` | Restauração do último modelo válido | Não detalhado |

**Orientação ao agente.** O `CLAUDE.md` ou `AGENTS.md` do projeto deve instruir o agente a usar sempre as ferramentas MCP (ET §4).

## 10. Regras de negócio e integridade

| ID | Regra | Código de erro | Comportamento observável |
| --- | --- | --- | --- |
| RN-01 | IDs de nós e de conexões são únicos | `DUPLICATE_ID` | Modelo com `id` repetido é recusado |
| RN-02 | IDs são gerados pelo servidor e imutáveis | — | Renomear não altera o `id` nem as conexões |
| RN-03 | O `parent` precisa existir | `PARENT_NOT_FOUND` | Criar ou mover para pai inexistente é recusado |
| RN-04 | Um nó não pode ser ancestral de si mesmo | `PARENT_CYCLE` | Mover um nó para dentro de um descendente é recusado |
| RN-05 | Os extremos de uma conexão precisam existir | `EDGE_ENDPOINT_NOT_FOUND` | Conexão para nó inexistente é recusada |
| RN-06 | Conexão de um nó para si mesmo é proibida | `EDGE_SELF_LOOP` | Recusada |
| RN-07 | Conexão entre um nó e o próprio ancestral é proibida | `EDGE_TO_ANCESTOR` | Recusada |
| RN-08 | O documento obedece ao JSON Schema da `schemaVersion` | `SCHEMA_INVALID` | Campo ausente ou valor fora do conjunto é recusado. O código também cobre o arquivo de layout: gravação malformada é recusada com `path` dentro dele |
| RN-09 | O trecho de uma lente conhecida obedece ao esquema da lente | `LENS_INVALID` | `set_lens` com dado inválido é recusado |
| RN-10 | Lente desconhecida é preservada sem validação | — | O trecho sobrevive a carregar e gravar |
| RN-11 | Remoção de nó é em cascata | — | Descendentes e conexões relacionadas saem juntos; a resposta lista o que saiu |
| RN-12 | `revision` incrementa a cada escrita aceita no modelo | — | Escrita recusada não altera a revisão |
| RN-13 | A gravação é atômica | — | O arquivo nunca fica parcialmente escrito |
| RN-14 | Operação sobre revisão antiga é recusada | `REVISION_CONFLICT` | A resposta traz a revisão corrente |
| RN-15 | Arquivo externo inválido não é adotado | — | Último modelo válido mantido; aviso; escritas recusadas até corrigir ou restaurar |
| RN-16 | Operação sobre `id` de nó ou conexão inexistente é recusada | `NOT_FOUND` | `update_node`, `move_node`, `remove_node`, `update_edge` e `remove_edge` com `id` inexistente devolvem o erro, com `path` no campo de entrada (ex.: `/id`); nada é gravado |

Os dez códigos de erro estão cobertos: `SCHEMA_INVALID`, `DUPLICATE_ID`, `PARENT_NOT_FOUND`, `PARENT_CYCLE`, `EDGE_ENDPOINT_NOT_FOUND`, `EDGE_SELF_LOOP`, `EDGE_TO_ANCESTOR`, `LENS_INVALID`, `REVISION_CONFLICT` e `NOT_FOUND` (este último acrescentado nesta versão do PRD, RN-16).

## 11. Modelo de dados e arquivos

| Arquivo | Papel |
| --- | --- |
| `docs/architecture.json` | Modelo canônico: nós, conexões, hierarquia e metadados de lentes |
| `docs/architecture.layout.json` | Posições dos nós, por `id`. Esquema próprio: `{ "schemaVersion": 1, "positions": { "<id do nó>": { "x": 0, "y": 0 } } }`. Fora da `revision` do modelo; ausente ou inválido equivale a "sem posições" (DA-03) |
| `CLAUDE.md` / `AGENTS.md` | Arquivos do próprio projeto onde fica a instrução para o agente usar MCP |

A especificação não define nenhum outro arquivo de configuração.

| Conceito | Significado |
| --- | --- |
| `schemaVersion` | Versão do formato. Muda só em quebra de formato; cada mudança vem com uma migração |
| `revision` | Contador de escritas aceitas no modelo, mantido pelo servidor |
| `meta` | Dados do projeto: `name`, `description` |
| `nodes` | Lista plana de componentes |
| `edges` | Lista plana de conexões entre nós |
| `parent` | `id` do nó que contém este, ou `null` para a raiz |
| `kind` | Tipo do nó (conjunto fechado) ou da conexão (`sync`, `async`, `data`) |
| `tech` | Chave do catálogo de ícones |
| `lenses` | Metadados por lente, dentro do nó |
| `layout` | Posições, mantidas no arquivo de layout |

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

O JSON Schema completo pertence à especificação técnica, que é o documento complementar para detalhes estruturais.

**Dúvidas sobre os arquivos**

- Não está definido o que a ferramenta faz ao abrir um arquivo com `schemaVersion` maior que a suportada (DA-11).

## 12. Requisitos não funcionais

| ID | Descrição | Justificativa | Critério de aceitação | Prio | Classificação | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| NFR-001 | A ferramenta funciona sem serviço hospedado e sem login | Local-first | Todas as jornadas do MVP funcionam sem conta | P0 | Confirmado | ET §1 |
| NFR-002 | A ferramenta não chama LLM diretamente | O raciocínio é do agente externo | Nenhuma requisição a API de LLM parte da ferramenta | P0 | Confirmado | ET §1 |
| NFR-003 | Os ícones não dependem de rede | Uso offline | Canvas completo com a rede desligada | P1 | Confirmado | ET §6 |
| NFR-004 | A ferramenta nunca grava um modelo inválido | Integridade dos dados | O teste de propriedade passa | P0 | Confirmado | ET §4, §8 |
| NFR-005 | Todos os clientes convergem para a mesma revisão | Consistência entre interface e agente | Após qualquer escrita, interface e `get_model` mostram a mesma `revision` | P0 | Confirmado | ET §2 |
| NFR-006 | Um arquivo corrompido não derruba a interface | Recuperação de erros | Critério de aceite da fase 2 | P0 | Confirmado | ET §8 |
| NFR-007 | Erros são compreensíveis para pessoa e agente | Autocorreção do agente | Todo erro tem `code`, `message`, `path` e `hint` | P0 | Confirmado | ET §4 |
| NFR-008 | O `core` não faz I/O e não depende dos outros pacotes | Manutenibilidade e teste isolado | O `core` é testado sem servidor, disco ou navegador | P0 | Confirmado | ET §2 |
| NFR-009 | Cada operação e cada código de erro tem teste unitário | Testabilidade | Existe ao menos um teste por operação e por código | P0 | Confirmado | ET §8 |
| NFR-010 | Uma nova lente é adicionada sem alterar o núcleo | Extensibilidade | Registrar a lente de dados não exige mudança em `core` além do registro | P1 | Confirmado | ET §7 |
| NFR-011 | Claude Code e Codex se conectam por MCP, via HTTP ou stdio | Compatibilidade | Os dois agentes listam e chamam as ferramentas | P0 | Confirmado | ET §2, §5 |
| NFR-012 | O servidor escuta apenas em `127.0.0.1` | Não expor o modelo à rede | O endpoint não é alcançável de outra máquina | P0 | Confirmado | ET §2 |
| NFR-013 | Controles adicionais do endpoint local: validar `Origin` e `Host` e exigir um token local por sessão | Uma página web aberta no navegador pode tentar chamar serviços em `localhost` | A definir junto com a decisão | Pendente | Proposto (DA-05) | — |
| NFR-014 | O modelo gera diffs legíveis no Git | Revisão junto com o código | Mover um nó no canvas não altera `docs/architecture.json` | P1 | Confirmado | ET §3, §8, §9 |
| NFR-015 | O canvas é utilizável em modelos de tamanho realista | Usabilidade | Meta não especificada | Pendente | Em aberto (DA-12) | — |
| NFR-016 | Tempos de resposta de escrita e de atualização ao vivo | Desempenho | Metas não especificadas | Pendente | Em aberto (DA-12) | — |

**Sobre a segurança do servidor local.** O único controle definido é escutar em `127.0.0.1`. A validação das entradas MCP está coberta pela validação do modelo (FR-029). A especificação não trata de proteção contra chamadas vindas de páginas web no mesmo computador; por isso NFR-013 é uma recomendação e não uma decisão.

## 13. Interface e experiência do usuário

**MVP**

| Elemento | Comportamento | Origem |
| --- | --- | --- |
| Layout geral | Painel lateral à esquerda, canvas à direita, abas no topo do canvas | ET §6 |
| Painel lateral | Árvore de nós e propriedades do item selecionado | ET §6 |
| Canvas | Cada nível é uma tela com os filhos diretos do nó atual e as conexões entre eles | ET §6 |
| Seleção e edição de nós | Seleção no canvas ou na árvore; edição no painel | ET §6 |
| Conexões | Criadas ao arrastar; rótulo e `kind` editáveis | ET §6 |
| Navegação hierárquica | Duplo clique entra; trilha volta | ET §6 |
| URL | Reflete o nível atual (`#/n_docker/n_api`) | ET §6 |
| Ícones | Devicon embutido, escolhido por `tech`; ícone do `kind` quando não há correspondência | ET §6 |
| Layout | Manual persistido; nós sem posição em grade na fase 1 e com layout automático por ELK a partir da fase 2; botão de reorganizar o nível | ET §6 |
| Aba `Diagrama` | Visão padrão | ET §6 |
| Aba `JSON` | Modelo atual, somente leitura | ET §6 |
| Aviso de modelo inválido | Mostra os erros de uma edição externa inválida, com a ação "restaurar último válido" | ET §4 |
| Tema | Escuro como padrão; paleta por `kind` | ET §9 |

**Estados sem definição na especificação**

- Estado de carregamento inicial.
- Estado de erro de conexão com o servidor ou com o WebSocket.
- Apresentação do `REVISION_CONFLICT` para a pessoa.
- Valores exatos da paleta por `kind`.

Estes estados precisam ser definidos durante a fase 1. Este PRD não propõe um design system.

**Interfaces futuras (fora do MVP)**

- Visão ER da lente de dados (fase 3).
- Sobreposição da lente de segurança (fase 4).
- Chat no painel esquerdo (fase 5).

## 14. Importação, exportação e lentes futuras

Nada nesta seção faz parte do MVP.

**Mecanismo de lentes (ET §7).** Uma lente é um módulo interno com um JSON Schema para `lenses.<nome>`, um componente de visualização e, opcionalmente, importadores. As lentes ficam em um registro interno. Plugins de terceiros estão fora de escopo.

**Lente de dados — fase 3**

| Item | Definição |
| --- | --- |
| Aplica-se a | Nós de `kind` `database` |
| Modelo | `tables[]` com `name`, `columns[]` (`name`, `type`, `pk`, `nullable`, `unique`) e `relations[]` (`from`, `to`, cardinalidade) |
| Visão | Diagrama ER ao entrar no nó do banco, com tabelas editáveis |
| Edição manual | Criar e editar tabelas, colunas e relações |
| Importadores, em ordem | `schema.prisma`; migrations SQL; entidades JPA; introspecção de PostgreSQL por último, porque exige credenciais |
| Confirmação | O importador devolve uma proposta; a pessoa ou o agente confirma com `set_lens` |
| Critério de aceite | Entrar no nó do banco de um projeto com `schema.prisma` e ver tabelas e relações corretas |

**Lente de segurança — fase 4**

| Item | Definição |
| --- | --- |
| Aplica-se a | Nós de `kind` `service`, `proxy`, `frontend`, `group` |
| No nó | `authn`, `authz`, `exposure` (`public`, `internal`) |
| Na conexão | `encrypted`, `credential` (o que trafega: JWT, API key, nenhum) |
| Visão | Sobreposição no canvas: selos nos nós, fronteiras de confiança em volta dos grupos, destaque para conexões que cruzam uma fronteira sem autenticação declarada |
| Preenchimento | Pelo agente; sem importador automático na primeira versão |
| Critério de aceite | Alternar a lente e identificar de relance qual rota chega a um serviço sem autenticação declarada |

A especificação define metadados de segurança na conexão, mas o modelo da ET §3 só define `lenses` no nó. Ver IN-07.

**Exportações — fase 5**

- Formatos: `.drawio`, Mermaid e Markdown.
- Critério de aceite: o `.drawio` exportado abre no draw.io com a mesma hierarquia.
- O mapeamento da hierarquia em Mermaid e Markdown não está definido (DA-14).

**Chat embutido — fase 5.** Ocupa o painel esquerdo. O funcionamento não está definido e há uma tensão com a exclusão de chamadas a LLM (IN-02, DA-02).

## 15. Métricas e critérios de sucesso

**Critérios de conclusão do MVP (Confirmado, ET §8)**

| Fase | Critério |
| --- | --- |
| 1 | Rodar `npx` em uma pasta vazia, montar Internet → Nginx → Docker com front, API e banco dentro, entrar no Docker, editar propriedades, fechar e reabrir sem perda |
| 2 | Pedir ao Claude Code para mapear um repositório real e ver o canvas se montar sem recarregar; um JSON corrompido à mão mostra o aviso e não derruba a interface |

**Métricas operacionais (Proposto; metas pendentes)**

| Métrica | Definição | Meta |
| --- | --- | --- |
| Taxa de sucesso de `apply_batch` | Lotes aceitos dividido por lotes enviados em uma sessão de mapeamento | Pendente |
| Tentativas até um lote válido | Número de chamadas até o agente obter aceite | Pendente |
| Tempo até o primeiro diagrama | Do pedido ao agente até o canvas preenchido | Pendente |
| Cobertura de ícones | Nós com `tech` resolvido no catálogo dividido pelo total de nós com `tech` | Pendente |

**Indicadores de qualidade**

- Todos os testes obrigatórios do MVP (seção 16) passam.
- Nenhum caminho conhecido grava um modelo inválido (NFR-004).

**Evidências de funcionamento**

- Execução gravada ou roteirizada dos dois critérios de aceite.
- `docs/architecture.json` gerado por agente em um repositório real, versionado.
- Relatório de testes.

## 16. Estratégia de testes e qualidade

| ID | Grupo | Cobre | Requisitos | MVP | Classificação |
| --- | --- | --- | --- | --- | --- |
| T-01 | Unitários do núcleo | Cada operação | FR-004 a FR-009, FR-015 a FR-017, FR-031 | Sim | Confirmado (ET §8) |
| T-02 | Regras de integridade | Cada código de erro e RN-01 a RN-16 | FR-029, FR-030, NFR-007, NFR-009 | Sim | Confirmado (ET §8) |
| T-03 | Baseados em propriedades | Sequências aleatórias de operações válidas sempre validam | FR-029, NFR-004 | Sim | Confirmado (ET §8) |
| T-04 | Serialização e ida e volta | Carregar, gravar e recarregar produz o mesmo conteúdo | FR-003, FR-024, FR-028, NFR-014 | Sim | Confirmado (ET §8) |
| T-05 | Concorrência | Duas escritas com a mesma `expectedRevision`: um aceite e um `REVISION_CONFLICT` | FR-026, FR-027, FR-036, FR-040, NFR-005 | Sim | Confirmado (ET §8) |
| T-06 | Operações em lote | Atomicidade e alias | FR-037, FR-038 | Sim | Proposto |
| T-07 | Integração MCP | Cada ferramenta por HTTP e pela ponte stdio | FR-032 a FR-035, NFR-011 | Sim | Proposto |
| T-08 | Atualização ao vivo e alterações externas | Eventos, observador, aviso e restauração | FR-039, FR-041 a FR-044, NFR-006 | Sim | Proposto |
| T-09 | Importadores | Arquivos de exemplo com saída esperada fixada | Fase 3 | Não | Confirmado (ET §8) |
| T-10 | Ponta a ponta por fase | O critério de aceite de cada fase | FR-001, FR-002, FR-010 a FR-014, FR-018 a FR-023, FR-045 a FR-049 | Fases 1 e 2 | Confirmado (ET §8) |

T-06, T-07 e T-08 não aparecem como grupos na especificação. São propostos aqui porque os requisitos da fase 2 não teriam teste dedicado sem eles.

## 17. Roadmap e entregáveis

Sem datas nem estimativas. Detalhes de tarefas em [ROADMAP.md](ROADMAP.md).

| Fase | Objetivo | Escopo e entregáveis | Dependências | Critério de aceite | Requisitos | Riscos principais |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Editor | Editor utilizável sem agente | `core`, servidor local, canvas com drill-down, ícones e edição manual | — | Ver seção 15 | FR-001 a FR-031, FR-040, FR-045, FR-048, FR-049 | R-01, R-05, R-08 |
| 2. Agentes | Agentes leem e alteram o modelo ao vivo | Adaptador MCP, `apply_batch`, WebSocket, observador de arquivo | Fase 1 | Ver seção 15 | FR-032 a FR-039, FR-041 a FR-044, FR-046, FR-047 | R-02, R-03, R-04, R-06 |
| 3. Dados | Banco como diagrama ER | Lente de dados, ER manual, importador Prisma | Fase 1; fase 2 para `set_lens` | Seção 14 | Seção 14 | R-07 |
| 4. Segurança | Ver autenticação e fronteiras | Lente de segurança como sobreposição | Registro de lentes da fase 3 | Seção 14 | Seção 14 | R-07 |
| 5. Saídas | Exportar e conversar | Exportação .drawio, Mermaid e Markdown; chat embutido | Fase 1 | Seção 14 | Seção 14 | R-09 |

## 18. Riscos, dependências e decisões em aberto

### Riscos

| ID | Risco | Consequência | Classificação |
| --- | --- | --- | --- |
| R-01 | O escopo é amplo para um projeto individual | Fases posteriores não chegam a ser entregues | Risco de entrega |
| R-02 | O agente edita o JSON diretamente apesar da instrução | Estados inválidos frequentes; a mitigação existe (FR-043), mas a experiência piora | Risco de produto |
| R-03 | O endpoint HTTP local é alcançável por páginas web no mesmo computador | Alterações indevidas no modelo | Risco a avaliar (DA-05) |
| R-04 | A ponte stdio não encontra o servidor | O agente não consegue se conectar | Risco a avaliar (DA-04) |
| R-05 | Conexões entre níveis são difíceis de desenhar de forma legível | Diagramas confusos no nível da raiz | Risco de produto |
| R-06 | O layout automático produz resultado ruim para diagramas gerados por agente | A primeira impressão do recurso principal é fraca | Risco de produto (DA-08) |
| R-07 | Hierarquia e lentes não se mapeiam bem aos formatos de exportação | Exportações perdem informação | Risco a avaliar (DA-14) |
| R-08 | O nome `arquitecture` está indisponível no npm ou é confundido com erro de digitação | Renomear comando e documentação | Risco a avaliar (DA-01) |
| R-09 | O chat embutido não tem desenho compatível com a exclusão de chamadas a LLM | A entrega da fase 5 fica bloqueada | Risco a avaliar (DA-02) |
| R-10 | Modelos grandes degradam o canvas ou o tamanho das respostas MCP | Uso inviável em repositórios grandes | Risco a avaliar (DA-12) |

### Dependências

| ID | Dependência | Usada por |
| --- | --- | --- |
| D-01 | Node.js e npm | Toda a ferramenta |
| D-02 | React e React Flow | Canvas |
| D-03 | ELK | Layout automático |
| D-04 | Devicon | Catálogo de ícones |
| D-05 | Biblioteca de validação de JSON Schema (não escolhida) | Validação |
| D-06 | SDK do Model Context Protocol (não escolhido) | Adaptador MCP e ponte stdio |
| D-07 | Suporte a MCP em Claude Code e Codex | Fase 2 |
| D-08 | Disponibilidade do nome do pacote no npm | Publicação |

### Decisões em aberto

| ID | Decisão | Impacto |
| --- | --- | --- |
| DA-01 | Confirmar a grafia `arquitecture` e a disponibilidade no npm | Nome do comando em toda a documentação |
| DA-02 | Como o chat embutido funciona sem chamada direta a LLM | Viabilidade da fase 5 |
| DA-04 | Como a ponte stdio descobre o servidor (porta) e o que faz se ele não estiver em execução | FR-034 |
| DA-05 | Controles de segurança do endpoint local além do bind em `127.0.0.1` | NFR-013 |
| DA-06 | Recuperação de modelo inválido por agente (ferramenta MCP de restauração) e comportamento na inicialização com arquivo inválido | FR-043, FR-044, J5 |
| DA-07 | Comportamento do desfazer quando há alterações do agente intercaladas | FR-049 |
| DA-08 | Critérios do layout automático (a fase 2 está confirmada) | Critérios de aceitação de FR-046 e FR-047; R-06 |
| DA-09 | Criação automática de `docs/` e do modelo vazio | FR-002 |
| DA-10 | Comportamento de `set_lens` para lente desconhecida | Seção 9 |
| DA-11 | Política de migração entre valores de `schemaVersion`, incluindo arquivo mais novo que a ferramenta | Compatibilidade futura |
| DA-12 | Metas de desempenho e limites de tamanho do modelo | NFR-015, NFR-016 |
| DA-13 | Correspondência entre as 41 chaves de `tech` e os nomes de ícone do Devicon | FR-023 |
| DA-14 | Mapeamento da hierarquia e das lentes nas exportações | Fase 5 |
| DA-15 | Formato do alias em `apply_batch` e esquemas completos dos parâmetros das ferramentas | FR-038, seção 9 |

### Decisões resolvidas

| ID | Data | Decisão | Resumo |
| --- | --- | --- | --- |
| DA-03 | 2026-10-08 | Fluxo de escrita do arquivo de layout | O servidor grava `docs/architecture.layout.json` pela mesma fila, de forma atômica. Não incrementa `revision`, não gera `REVISION_CONFLICT` e vale a última escrita. Esquema próprio `{ schemaVersion, positions }`. `id` órfão é ignorado ao carregar e removido na próxima gravação. A interface grava ao soltar o nó. Arquivo ausente ou inválido equivale a "sem posições"; nós sem posição recebem grade até existir o layout por ELK |

## 19. Matriz de rastreabilidade

| Requisito | Origem | Fase | Critério de aceitação (resumo) | Teste |
| --- | --- | --- | --- | --- |
| FR-001 | ET §1, §9 | 1 | Comando abre o canvas | T-10 |
| FR-002 | ET §8 | 1 | Pasta vazia permite criar o primeiro nó | T-10 |
| FR-003 | ET §2, §8 | 1 | Reabrir sem perda | T-04 |
| FR-004 | ET §3 | 1 | Nó válido aceito; incompleto recusado | T-01 |
| FR-005 | ET §3 | 1 | Conexão válida aceita; `kind` inválido recusado | T-01 |
| FR-006 | ET §3 | 1 | Renomear preserva `id` e conexões | T-01 |
| FR-007 | ET §3 | 1 | `kind` fora do conjunto recusado | T-01 |
| FR-008 | ET §3, §4 | 1 | Lente conhecida validada; desconhecida preservada | T-01 |
| FR-009 | ET §3 | 1 | Nó aparece só no nível do pai | T-01 |
| FR-010 | ET §6 | 1 | Duplo clique mostra os filhos | T-10 |
| FR-011 | ET §6 | 1 | Trilha volta ao nível | T-10 |
| FR-012 | ET §6 | 1 | URL reabre o nível | T-10 |
| FR-013 | ET §3 | 1 | Conexão chega no ancestral visível | T-10 |
| FR-014 | ET §6 | 1 | Contador correto | T-10 |
| FR-015 | ET §6 | 1 | Nó criado no nível atual | T-01 |
| FR-016 | ET §6 | 1 | Conexão gravada; inválida recusada | T-01 |
| FR-017 | ET §5, §6 | 1 | Alteração gravada e refletida | T-01 |
| FR-018 | ET §6 | 1 | Confirmação antes da cascata | T-10 |
| FR-019 | ET §6 | 1 | Árvore e propriedades sincronizadas com o canvas | T-10 |
| FR-020 | ET §6, §9 | 1 | Cor por `kind`; tema escuro | T-10 |
| FR-021 | ET §6 | 1 | Ícone sem rede | T-10 |
| FR-022 | ET §3, §9 | 1 | `tech` desconhecido aceito | T-10 |
| FR-023 | ET §9 | 1 | 41 chaves resolvem | T-10 |
| FR-024 | ET §1, §9 | 1 | Arquivo reflete o estado | T-04 |
| FR-025 | ET §2 | 1 | Interrupção não corrompe | Não definido |
| FR-026 | ET §2, §3 | 1 | `revision` + 1 por escrita aceita no modelo | T-05 |
| FR-027 | ET §2 | 1 | Escritas serializadas | T-05 |
| FR-028 | ET §8 | 1 | Ida e volta idêntica | T-04 |
| FR-029 | ET §4 | 1 | Operação inválida não grava | T-02, T-03 |
| FR-030 | ET §4 | 1 | Erro com quatro campos | T-02 |
| FR-031 | ET §4 | 1 | Cascata com lista do removido | T-01 |
| FR-032 | ET §5 | 2 | Ferramentas disponíveis | T-07 |
| FR-033 | ET §2 | 2 | Agente conecta por HTTP | T-07 |
| FR-034 | ET §2, §9 | 2 | Agente conecta por stdio | T-07 |
| FR-035 | ET §5 | 2 | Subárvore por `scope` | T-07 |
| FR-036 | ET §5 | 2 | `REVISION_CONFLICT` em revisão antiga | T-05 |
| FR-037 | ET §5 | 2 | Lote tudo ou nada | T-06 |
| FR-038 | ET §5 | 2 | Alias resolve dentro do lote | T-06 |
| FR-039 | ET §2, §5 | 2 | Canvas atualiza sem recarregar | T-08 |
| FR-040 | ET §5 | 1 | Edição manual sobre revisão antiga recusada | T-05 |
| FR-041 | ET §2, §4 | 2 | Edição externa dispara validação | T-08 |
| FR-042 | ET §4 | 2 | Mudança válida adotada | T-08 |
| FR-043 | ET §4, §8 | 2 | Aviso; interface de pé; escritas recusadas | T-08 |
| FR-044 | ET §4, §5 | 2 | Restauração libera escritas | T-08 |
| FR-045 | ET §6, §9 | 1 | Posição mantida ao reabrir | T-10 |
| FR-046 | ET §6 | 2 | Nós sem sobreposição | T-10 |
| FR-047 | ET §6 | 2 | Nível reorganizado | T-10 |
| FR-048 | ET §6 | 1 | JSON visível e não editável | T-10 |
| FR-049 | ET §6 | 1 | Desfazer reverte edição manual | T-10 |

FR-025 não tem teste definido na especificação. **Proposto:** um teste que interrompe a gravação e verifica o arquivo.

## 20. Glossário

| Termo | Definição |
| --- | --- |
| Fonte da verdade | O arquivo `docs/architecture.json`, do qual interface e agente derivam o que mostram e alteram |
| Nó | Um componente da arquitetura: serviço, banco, proxy, grupo e assim por diante |
| Conexão (aresta) | Relação direcionada entre dois nós |
| Hierarquia | Relação de contenção entre nós, definida por `parent` |
| Drill-down | Entrar em um nó para ver o subdiagrama com os filhos dele |
| Lente | Visão especializada sobre o mesmo modelo, com metadados próprios no nó |
| MCP | Model Context Protocol, protocolo pelo qual agentes chamam ferramentas externas |
| Revisão | Contador `revision`, incrementado a cada escrita aceita no modelo |
| Escrita atômica | Gravação que termina por inteiro ou não acontece, feita com arquivo temporário e renomeação |
| Conflito de revisão | Recusa de uma operação feita sobre uma revisão antiga (`REVISION_CONFLICT`) |
| JSON Schema | Formato de descrição da estrutura esperada de um documento JSON, usado na validação de forma |
| Layout automático | Cálculo das posições dos nós pela ferramenta, com ELK |
| Escritor único | O servidor local, único processo que grava os arquivos do modelo |
| Arquitetura declarada | O que o modelo descreve, em oposição ao que está implantado ou em execução |

## 21. Inconsistências identificadas na especificação de origem

| ID | Trechos | Inconsistência | Decisão necessária |
| --- | --- | --- | --- |
| IN-01 | ET §1 a §8 contra ET §9 | As seções 1 a 8 citam `architecture.json` sem pasta; a seção 9 fixa `docs/architecture.json` | Atualizar as referências antigas. Este PRD adota a seção 9 |
| IN-02 | ET §1 "fora de escopo" contra ET §1 e §8 "chat embutido" | A ferramenta não chama LLM, mas prevê um chat embutido na fase 5 | Definir como o chat se liga ao agente externo (DA-02) |
| IN-03 | ET §2 e §6 contra ET §9 | O fluxo de escrita só trata `architecture.json`; a seção 6 diz que a posição é salva em `layout`; a seção 9 move o layout para arquivo próprio sem definir seu fluxo | Resolvida pela DA-03 (2026-10-08) |
| IN-04 | ET §4 contra ET §5 | O estado inválido só sai por correção do arquivo ou pelo botão da interface; existe o evento `model.restored`, mas nenhuma ferramenta MCP de restauração | Decidir se o agente pode restaurar (DA-06) |
| IN-05 | ET §2 contra ET §8 | O passo 4 do fluxo de escrita publica por WebSocket, mas o WebSocket é entrega da fase 2 | Esclarecer que na fase 1 a interface se atualiza pela resposta HTTP |
| IN-06 | Título contra ET §9 | O produto se chama "AI Architecture Studio" e o comando é `arquitecture`, grafia que não é inglês nem português | Confirmar o nome (DA-01) |
| IN-07 | ET §3 contra ET §7 | A lente de segurança define metadados na conexão, mas o modelo só prevê `lenses` no nó | Definir onde ficam os metadados de lente das conexões antes da fase 4 |

Nenhuma destas inconsistências foi resolvida por este PRD além de IN-01, em que a decisão mais recente da própria especificação prevalece, e de IN-03, resolvida pela DA-03.

## Resumo de validação

| Item | Resultado |
| --- | --- |
| Seções produzidas | 20 da estrutura solicitada, mais a seção 21 (inconsistências) e este resumo |
| Requisitos funcionais | 49 (FR-001 a FR-049), em 14 domínios |
| Requisitos não funcionais | 16 (NFR-001 a NFR-016) |
| Regras de negócio | 16 (RN-01 a RN-16), cobrindo os 10 códigos de erro |
| Ferramentas MCP documentadas | 12 |
| Jornadas | 10 |
| Grupos de teste | 10 (T-01 a T-10), 3 deles propostos |
| Riscos / dependências / decisões em aberto | 10 / 8 / 14 (mais 1 resolvida: DA-03) |
| Inconsistências na especificação | 7 (IN-01 a IN-07); IN-01 e IN-03 resolvidas |

**Decisões em aberto mais importantes**

1. DA-02: funcionamento do chat embutido sem chamada a LLM.
2. DA-05: segurança do endpoint HTTP local.
3. DA-04: descoberta do servidor pela ponte stdio.
4. DA-01: grafia e disponibilidade do nome `arquitecture`.

**Pontos que precisam de validação humana**

- As personas da seção 5 são hipóteses.
- As prioridades P0, P1 e P2 foram atribuídas por este PRD.
- FR-002 foi derivado do critério de aceite da fase 1, não de um requisito explícito.
- Os grupos de teste T-06, T-07 e T-08 e o controle NFR-013 são propostas.
- As métricas da seção 15 não têm metas.
- Os requisitos das fases 3 a 5 não receberam identificador `FR`; isso deve ser feito quando cada fase for detalhada.