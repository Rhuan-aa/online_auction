# Front da apresentação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remodelar o front como "palco fixo + abas", no estilo editorial claro, que ensina a arquitetura com dado real e tem os acréscimos de backend que isso exige.

**Architecture:** O backend ganha seis acréscimos:
- configuração A/B/C trocável em tempo de execução;
- tentativas no lance;
- reconstrução do cache por HTTP;
- eventos do leilão e viagem no tempo;
- tipo do evento no SSE;
- checagem de infraestrutura.

O front é reescrito sobre a lógica existente (`simulacao.ts`, `metricas.ts`, `historico.ts`, `api.ts`), com gráficos SVG próprios, um medidor de rede no `fetch` e uma aba por pergunta.

**Tech Stack:** Java 21, Spring Boot 4, Maven multi-módulo, JUnit 5; React 19, Vite 8, TypeScript 7, Vitest (só em dev), fontes `@fontsource-variable/*`.

**Spec:** `docs/superpowers/specs/2026-11-18-front-apresentacao-design.md`. Leia junto com este plano; as seções citadas (§) são dela.

## Global Constraints

- **Sem bibliotecas de runtime no front** além de `react` e `react-dom`. Fontes `@fontsource-variable/fraunces`, `@fontsource-variable/inter` e `@fontsource-variable/jetbrains-mono` são permitidas. `vitest` é só dependência de desenvolvimento.
- **Todo número na tela é real** (backend ou medição no navegador). Toda animação explicativa leva o selo com o texto exato **"ilustração"**.
- **Tokens de cor** (§5):
  - fundo `#f6f2ea`, superfície `#ffffff`, superfície-2 `#efe9dd`;
  - tinta `#16130f`, tinta suave `#5b5346`, borda `#d9cfbd`;
  - destaque `#e4472b`, sucesso `#1f7a4a`, aviso `#a86a00`, perigo `#c8321f`.
- **Tipografia:**
  - Fraunces em títulos e números grandes; Inter no texto, com `tabular-nums` em tabelas; JetBrains Mono no JSON e nos IDs;
  - base 18 px, preço do palco ~64 px, KPIs ~40 px;
  - bordas de 1,5 px; transições de 150–300 ms; respeitar `prefers-reduced-motion`.
- **Tema:** claro por padrão, com botão para o escuro guardado em `localStorage` (envolto em try/catch).
- **Rotas:** `#/{aba}?leilao={id}`, com abas `integridade`, `desempenho`, `rede`, `auditoria`, `arquitetura` e `e-se-fosse`. O padrão é `integridade`.
- **Usuários fixos:** `vendedor-1` e `licitante-1..3`. Só `vendedor-1` cria e cancela.
- **CORS:** só `http://localhost:5173`.
- **Regras do README:**
  - `leilao-leitura` não depende de `leilao-escrita`;
  - a leitura nunca grava no Event Store;
  - `leilao-escrita/domain` continua Java puro (ArchUnit verde).
- **Mudou corpo HTTP de `contratos`? Atualiza `frontend/src/types.ts` no mesmo commit.** As respostas novas deste plano vivem nos pacotes `api` dos serviços e espelham em `frontend/src/api.ts`.
- **Commits** em branch própria (`feat/front-apresentacao`), nunca no `main`.

## Review Focus

1. **Serviço fora do ar no meio da aula** (8081 ou 8082 caído): as abas mostram "serviço indisponível" no lugar do bloco afetado, sem tela branca; o palco mantém o último estado com o selo "desatualizado". Teste na Task 10 (`estadoDoPalco` com erro de rede) e na Task 9 (`api` devolve `ErroHttp` com status 0).
2. **Leilão inexistente ou id inválido na URL:** o palco mostra "leilão não encontrado" e abre a gaveta de leilões. Teste na Task 10.
3. **Comparação A×B×C interrompida** (abort, troca de aba, erro no meio): a configuração anterior é restaurada nos dois serviços. Testes na Task 13.
4. **Escrita e leitura com configurações diferentes** (um PUT falhou): a comparação para e restaura, e a aba Desempenho mostra o aviso. Teste na Task 13.
5. **Leilão em foco encerrado, cancelado ou ainda agendado:** "Dar lance" e "Rajada" ficam desabilitados com o motivo escrito. Teste na Task 10 (`podeDarLance`) e na Task 12.

---

## Parte 1 — Backend

Comando de verificação geral do backend (rodar em `backend/`): `./mvnw -q verify` → termina sem `BUILD FAILURE`.

### Task 1: Configuração A/B/C trocável em tempo de execução (módulo `estado`)

**Files:**
- Create: `backend/estado/src/main/java/br/edu/ifsp/leilao/estado/ConfiguracaoAtiva.java`
- Modify: `backend/estado/src/main/java/br/edu/ifsp/leilao/estado/CacheEstadoLeilao.java` (construtor e campo `ligado`)
- Modify: `backend/estado/src/main/java/br/edu/ifsp/leilao/estado/Checkpoint.java` (construtor e campo `ligado`)
- Modify: `backend/estado/src/main/java/br/edu/ifsp/leilao/estado/ObterEstado.java` (métricas)
- Modify: `backend/leilao-escrita/src/main/resources/application.yml` e `backend/leilao-leitura/src/main/resources/application.yml` (remover `management.metrics.tags.configuracao`)
- Modify: `backend/ferramentas/.../ReconstrutorCache.java`, se o construtor dos beans mudar
- Test: `backend/estado/src/test/java/br/edu/ifsp/leilao/estado/ConfiguracaoAtivaTest.java`, `ObterEstadoTest.java`, `CacheEstadoLeilaoTest.java`, `CheckpointTest.java`

**Interfaces:**
- Produces:
  - `@Component public class ConfiguracaoAtiva { public ConfiguracaoAtiva(@Value("${leilao.cache.configuracao:C}") Configuracao inicial); public Configuracao atual(); public Configuracao trocar(Configuracao nova); }`. Valor em `AtomicReference`; `trocar` devolve a nova.
  - `Configuracao.usaRedis()` e `usaCheckpoint()` passam a `public`.
  - `CacheEstadoLeilao(StringRedisTemplate, JsonMapper, ConfiguracaoAtiva)` e `Checkpoint(JdbcClient, JsonMapper, int aCadaEventos, ConfiguracaoAtiva)` consultam `configuracao.atual()` em cada operação, no lugar do `ligado` fixo.
  - Métricas `leilao.estado.obter` (tag `caminho`) e `leilao.estado.eventos.lidos` (tag `base`) ganham a tag `configuracao` = `atual().name()` **no momento da medição**. Use `Timer.builder(...).tags(...).register(registry)` por chamada; o registry devolve o medidor existente.
  - `ObterEstado(CacheEstadoLeilao, Checkpoint, LeitorEventos, MeterRegistry, ConfiguracaoAtiva)`.

- [ ] **Step 1: Write the failing tests**

```java
// ConfiguracaoAtivaTest
@Test void comecaNaInicialETroca() {
    var c = new ConfiguracaoAtiva(Configuracao.C);
    assertEquals(Configuracao.C, c.atual());
    assertEquals(Configuracao.A, c.trocar(Configuracao.A));
    assertEquals(Configuracao.A, c.atual());
}

// ObterEstadoTest (reusa EventStoreFalso/CacheFalso, agora recebendo a ConfiguracaoAtiva)
@Test void emATodaObtencaoReleTodosOsEventosEMarcaATag() {
    var config = new ConfiguracaoAtiva(Configuracao.C);
    // ... monta ObterEstado com cache que já tem ATUAL ...
    config.trocar(Configuracao.A);
    obter.obter(ID);
    var lidos = metricas.get("leilao.estado.eventos.lidos").tag("configuracao", "A").summaries();
    assertEquals(EVENTOS.size(), (int) lidos.stream().mapToDouble(s -> s.totalAmount()).sum());
    assertEquals(1, metricas.get("leilao.estado.obter").tag("caminho", "comando").tag("configuracao", "A").timer().count());
}

@Test void estadoObtidoEIgualNasTresConfiguracoes() {
    // para cada Configuracao: trocar, obter(ID), comparar com ATUAL
}
```

Em `CacheEstadoLeilaoTest` e `CheckpointTest`: um teste que troca de C para A e verifica que `ler` devolve `Optional.empty()` sem tocar no Redis ou no banco (os testes existentes mostram como verificar isso).

- [ ] **Step 2: Run tests to verify they fail**

Run: `./mvnw -q -pl estado test`
Expected: FAIL (`ConfiguracaoAtiva` não existe).

- [ ] **Step 3: Implement** `ConfiguracaoAtiva` e a troca de `ligado` por `configuracao.atual().usaRedis()` / `usaCheckpoint()`. Retag das métricas no `ObterEstado`: `Base` + `caminho` + `configuracao`. Remova `management.metrics.tags.configuracao` dos dois `application.yml` e corrija o comentário da propriedade `leilao.cache.configuracao` ("valor inicial; troca em tempo de execução por /admin/cache/configuracao").

- [ ] **Step 4: Run tests**

Run: `./mvnw -q verify`
Expected: sem falhas (inclui ArchUnit e a compilação do `ReconstrutorCache`).

- [ ] **Step 5: Commit** — `feat(estado): configuração A/B/C trocável em tempo de execução`

### Task 2: Rota `/admin/cache/configuracao` na escrita e na leitura

**Files:**
- Create: `backend/leilao-escrita/src/main/java/br/edu/ifsp/leilao/escrita/api/ConfiguracaoController.java`
- Create: `backend/leilao-leitura/src/main/java/br/edu/ifsp/leilao/leitura/api/ConfiguracaoController.java`
- Test: `backend/leilao-escrita/src/test/java/br/edu/ifsp/leilao/escrita/api/ConfiguracaoControllerTest.java` e o equivalente na leitura

**Interfaces:**
- Consumes: `ConfiguracaoAtiva` (Task 1).
- Produces:
  - `GET /admin/cache/configuracao` → `200 {"configuracao":"C"}`;
  - `PUT /admin/cache/configuracao` com corpo `{"configuracao":"A"}` → `200 {"configuracao":"A"}`;
  - valor inválido → `400`;
  - `@CrossOrigin(origins = "http://localhost:5173", methods = {GET, PUT})`;
  - `record ConfiguracaoDto(Configuracao configuracao)`.

- [ ] **Step 1: Write the failing test** (MockMvc standalone, sem subir Spring)

```java
@Test void trocaEDevolveANova() throws Exception {
    var config = new ConfiguracaoAtiva(Configuracao.C);
    var mvc = MockMvcBuilders.standaloneSetup(new ConfiguracaoController(config)).build();
    mvc.perform(put("/admin/cache/configuracao").contentType(APPLICATION_JSON).content("{\"configuracao\":\"B\"}"))
       .andExpect(status().isOk()).andExpect(jsonPath("$.configuracao").value("B"));
    assertEquals(Configuracao.B, config.atual());
}
@Test void valorInvalidoE400() { /* {"configuracao":"Z"} → 400, config continua C */ }
```

- [ ] **Step 2:** `./mvnw -q -pl leilao-escrita,leilao-leitura -am test` → FAIL
- [ ] **Step 3: Implement** os dois controllers, iguais, cada um no `api` do seu serviço. Não compartilhe controller entre os serviços: a leitura não pode depender da escrita.
- [ ] **Step 4:** `./mvnw -q verify` → PASS
- [ ] **Step 5: Commit** — `feat(api): rota para trocar a configuração do cache sem reiniciar`

### Task 3: Tentativas no lance

**Files:**
- Modify: `backend/leilao-escrita/src/main/java/br/edu/ifsp/leilao/escrita/application/ServicoLeilao.java`
- Create: `backend/leilao-escrita/src/main/java/br/edu/ifsp/leilao/escrita/application/LanceRecusadoException.java`
- Modify: `backend/leilao-escrita/src/main/java/br/edu/ifsp/leilao/escrita/application/ConflitoDeVersaoException.java` (campo `tentativas`)
- Modify: `backend/leilao-escrita/src/main/java/br/edu/ifsp/leilao/escrita/api/LeilaoController.java`, `TratadorErros.java`
- Test: `backend/leilao-escrita/src/test/java/br/edu/ifsp/leilao/escrita/application/ServicoLeilaoTest.java`

**Interfaces:**
- Produces:
  - `public record Resultado(int versao, int tentativas)` em `application`. Retornado por `ServicoLeilao.darLance` e `cancelar`; `iniciar` e `encerrar` ignoram.
  - `LanceRecusadoException(RegraVioladaException causa, int tentativas)` com `codigo()` e `tentativas()`. O `executar` embrulha a `RegraVioladaException` da `decisao` com o número da tentativa.
  - `ConflitoDeVersaoException` ganha `tentativas()` = 3 quando relançada no fim.
  - **HTTP:**
    - sucesso → `{"versao": n, "tentativas": t}`;
    - 422 → `{"erro","mensagem","tentativas"}`;
    - 409 → `{"erro":"CONFLITO_DE_VERSAO","mensagem","tentativas":3}`;
    - 404 continua `{"erro","mensagem"}`.
  - `record Erro(String erro, String mensagem, Integer tentativas)` com `@JsonInclude(NON_NULL)`.
  - O `OuvinteAgendador` e o domínio não mudam.

- [ ] **Step 1: Write the failing test** (EventStore falso em memória; `ObterEstado` montado com os falsos do módulo `estado` ou um `Function` equivalente)

```java
@Test void lanceQuePerdeADisputaUmaVezVoltaComDuasTentativas() {
    // EventStore falso: primeira chamada a anexar lança ConflitoDeVersaoException, segunda grava
    Resultado r = servico.darLance(ID, "licitante-2", 2000);
    assertEquals(2, r.tentativas());
}
@Test void lanceSemDisputaTemUmaTentativa() { assertEquals(1, servico.darLance(...).tentativas()); }
@Test void recusaDepoisDeRetentarCarregaAsTentativas() {
    // conflito na 1ª; na 2ª a decisão lança RegraVioladaException (valor abaixo do novo mínimo)
    var e = assertThrows(LanceRecusadoException.class, () -> servico.darLance(...));
    assertEquals(2, e.tentativas());
}
@Test void conflitoNasTresTentativasDevolveTres() { assertEquals(3, assertThrows(ConflitoDeVersaoException.class, ...).tentativas()); }
```

Teste do controller (MockMvc standalone com `TratadorErros` como `setControllerAdvice`): sucesso com `$.tentativas`, e 422 com `$.tentativas`.

- [ ] **Step 2:** `./mvnw -q -pl leilao-escrita -am test` → FAIL
- [ ] **Step 3: Implement** conforme as interfaces.
- [ ] **Step 4:** `./mvnw -q verify` → PASS
- [ ] **Step 5: Commit** — `feat(escrita): resposta do lance informa quantas tentativas foram necessárias`

### Task 4: Reconstrução do cache reutilizável e `POST /admin/cache/reconstruir`

**Files:**
- Create: `backend/estado/src/main/java/br/edu/ifsp/leilao/estado/ReconstrucaoCache.java`
- Modify: `backend/ferramentas/src/main/java/br/edu/ifsp/leilao/ferramentas/reconstrutor/ReconstrutorCache.java` (passa a delegar e só imprime)
- Create: `backend/leilao-escrita/src/main/java/br/edu/ifsp/leilao/escrita/api/ReconstrucaoController.java`
- Test: `backend/estado/src/test/java/br/edu/ifsp/leilao/estado/ReconstrucaoCacheTest.java`

**Interfaces:**
- Produces:
  - `@Component public class ReconstrucaoCache { public ReconstrucaoCache(LeitorEventos, ObterEstado, CacheEstadoLeilao, Checkpoint); public Relatorio reconstruir(); }`
  - `public record Relatorio(int leiloes, long chavesApagadas, int checkpointsApagados, int refeitos, List<UUID> diferentes, Tempos tempos)` com `record Tempos(long fotografiaMs, long apagarMs, long refazerMs, long compararMs)`.
  - As etapas são as mesmas e na mesma ordem do `run` atual do `ReconstrutorCache`.
  - `POST /admin/cache/reconstruir` → `200` com o `Relatorio`, `@CrossOrigin(origins = "http://localhost:5173", methods = POST)`.

- [ ] **Step 1: Write the failing test** (reusa os falsos do `ObterEstadoTest`; `CacheFalso` e um `Checkpoint` falso com `apagarTudo`/`apagarTodos` contando)

```java
@Test void refazTodosEInformaIdenticos() {
    Relatorio r = reconstrucao.reconstruir();
    assertEquals(1, r.leiloes());
    assertEquals(1, r.refeitos());
    assertTrue(r.diferentes().isEmpty());
    assertEquals(ATUAL, cache.guardado.get(ID));
}
@Test void copiaAtrasadaApareceEmDiferentes() {
    // cache começa com o estado da versão 3 (de 6) e o Redis "confia" nele na fotografia
    assertEquals(List.of(ID), reconstrucao.reconstruir().diferentes());
}
```

- [ ] **Step 2:** `./mvnw -q -pl estado test` → FAIL
- [ ] **Step 3: Implement**. A CLI passa a chamar `reconstruir()` e imprime as mesmas 4 linhas de antes, a partir do `Relatorio`.
- [ ] **Step 4:** `./mvnw -q verify` → PASS
- [ ] **Step 5: Commit** — `feat(cache): reconstrução do cache por HTTP, compartilhada com a ferramenta CLI`

### Task 5: Eventos do leilão e viagem no tempo (leitura)

**Files:**
- Modify: `backend/estado/src/main/java/br/edu/ifsp/leilao/estado/LeitorEventos.java`
- Create: `backend/leilao-leitura/src/main/java/br/edu/ifsp/leilao/leitura/consultas/ViagemNoTempo.java`
- Modify: `backend/leilao-leitura/src/main/java/br/edu/ifsp/leilao/leitura/api/ConsultaController.java`
- Test: `backend/leilao-leitura/src/test/java/br/edu/ifsp/leilao/leitura/consultas/ViagemNoTempoTest.java`

**Interfaces:**
- Produces:
  - `LeitorEventos.todos(UUID) : List<EventoGravado>`, com `public record EventoGravado(int versao, String tipo, JsonNode dados, Instant criadoEm)`. `tipo` vem como está gravado, com o sufixo (ex. `LanceRegistrado.v1`); quem tira o `.v1` para exibir é o front.
  - `LeitorEventos.ateVersao(UUID, int n) : List<EventoLeilao>` (versão ≤ n, em ordem).
  - `ViagemNoTempo.estadoNaVersao(UUID, int n) : Optional<EstadoLeilao>`, via `EstadoLeilao.INICIAL.aplicarTodos(eventos.ateVersao(id, n))`. **Não** usa `ObterEstado`, `CacheEstadoLeilao` nem `Checkpoint`, e não registra métricas.
  - `GET /leiloes/{id}/eventos` → `200 [ {versao,tipo,dados,criadoEm} ]`, ou `404` se vazio.
  - `GET /leiloes/{id}?ateVersao=N` → `200 LeilaoDetalhe` na versão N; `400` se `N < 1` ou `N >` versão atual; `404` se o leilão não existir.

- [ ] **Step 1: Write the failing test** (`LeitorEventos` falso, no estilo do `EventStoreFalso`)

```java
@Test void estadoNaVersao3TemOsTresPrimeirosEventos() {
    var e = viagem.estadoNaVersao(ID, 3).orElseThrow();
    assertEquals(3, e.versao());
    assertEquals(EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 3)), e);
}
@Test void versaoAlemDaAtualEhVazia() { assertTrue(viagem.estadoNaVersao(ID, 99).isEmpty()); }
```

No controller: `ateVersao=0` → 400 e `ateVersao=99` → 400 (MockMvc standalone com falsos).

- [ ] **Step 2:** `./mvnw -q -pl leilao-leitura -am test` → FAIL
- [ ] **Step 3: Implement**. `estadoNaVersao` devolve vazio se `aplicarTodos` resultar em versão < n.
- [ ] **Step 4:** `./mvnw -q verify` → PASS
- [ ] **Step 5: Commit** — `feat(leitura): eventos do leilão e estado em qualquer versão`

### Task 6: Tipo do evento no SSE

**Files:**
- Modify: `backend/leilao-leitura/src/main/java/br/edu/ifsp/leilao/leitura/api/LeilaoDetalhe.java`
- Modify: `backend/leilao-leitura/src/main/java/br/edu/ifsp/leilao/leitura/api/TransmissorSse.java`
- Test: `backend/leilao-leitura/src/test/java/br/edu/ifsp/leilao/leitura/api/TransmissorSseTest.java`

**Interfaces:**
- Produces:
  - `LeilaoDetalhe` ganha `EventoInfo evento` (nulo fora do SSE), com `public record EventoInfo(String tipo, int versao)` e `@JsonInclude(NON_NULL)` no campo, para que `GET /leiloes/{id}` não mude.
  - `TransmissorSse.aoReceberEvento` lê `tipo` e `versao` do envelope (`EnvelopeEvento`) e envia `LeilaoDetalhe.de(id, estado).comEvento(new EventoInfo(tipo, versaoDoEvento))`.
  - A mensagem inicial do `assinar` vai sem `evento`.

- [ ] **Step 1: Write the failing test**: `LeilaoDetalhe.de(...).comEvento(new EventoInfo("LanceRegistrado.v1", 7))` serializado pelo `JsonMapper` contém `"evento":{"tipo":"LanceRegistrado.v1","versao":7}`; sem `comEvento`, o JSON não contém `"evento"`.
- [ ] **Step 2:** `./mvnw -q -pl leilao-leitura -am test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `./mvnw -q verify` → PASS
- [ ] **Step 5: Commit** — `feat(sse): mensagem ao vivo informa o tipo do evento`

### Task 7: Checagem de infraestrutura e CORS do agendador

**Files:**
- Create: `backend/leilao-leitura/src/main/java/br/edu/ifsp/leilao/leitura/api/InfraController.java`
- Create: `backend/leilao-leitura/src/main/java/br/edu/ifsp/leilao/leitura/consultas/ChecagemInfra.java`
- Modify: `backend/agendador-leilao/src/main/resources/application.yml` (CORS do actuator: `allowed-origins: http://localhost:5173`, `allowed-methods: GET`)
- Test: `backend/leilao-leitura/src/test/java/br/edu/ifsp/leilao/leitura/consultas/ChecagemInfraTest.java`

**Interfaces:**
- Produces:
  - `GET /infra/saude` → `200 {"postgres":{"status":"UP","ms":3},"redis":{...},"kafka":{...}}`. Status `UP`/`DOWN` e o campo `erro` quando DOWN. **Sempre 200**, mesmo com componente DOWN.
  - `ChecagemInfra(JdbcClient, StringRedisTemplate, KafkaAdmin)` com o método `Map<String, Componente> checar()` e `record Componente(String status, long ms, String erro)`.
  - **Checagens, cada uma com timeout de 1 s:** Postgres `SELECT 1`; Redis `PING`; Kafka com `AdminClient.create(kafkaAdmin.getConfigurationProperties())` e `describeCluster().clusterId().get(1, SECONDS)`.
  - O `management.health.redis.enabled: false` **fica** (§8 item 4).
  - CORS do controller: `@CrossOrigin(origins = "http://localhost:5173")`.

- [ ] **Step 1: Write the failing test**: `ChecagemInfra` com um `Supplier` falso por componente (deixe as três verificações injetáveis como `Map<String, Callable<?>>` num construtor de pacote, só para teste). Um falso que lança exceção resulta em `DOWN` com `erro` preenchido, e os outros continuam `UP`.
- [ ] **Step 2:** `./mvnw -q -pl leilao-leitura -am test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `./mvnw -q verify` → PASS. Depois, com a infra no ar, suba a leitura, rode `curl -s localhost:8082/infra/saude` e confira os três `UP`. Pare o Redis com `docker stop leilao-redis-1` e confira que `redis` fica `DOWN` e `curl -s localhost:8082/actuator/health` continua `UP`. Religue com `docker start leilao-redis-1`.
- [ ] **Step 5: Commit** — `feat(leitura): checagem de Postgres, Redis e Kafka para o painel de saúde`

---

## Parte 2 — Front

Comandos de verificação do front (rodar em `frontend/`): `npm test` (Vitest), `npm run lint`, `npm run build`, todos sem erro.

### Task 8: Fundação — Vitest, fontes, tokens, tema e rotas

**Files:**
- Modify: `frontend/package.json` (dev: `vitest`; deps: `@fontsource-variable/fraunces`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`; script `"test": "vitest run"`)
- Create: `frontend/src/estilo/tokens.css`, `frontend/src/estilo/base.css` (substituem `index.css`); import das fontes em `main.tsx`
- Create: `frontend/src/tema.ts`
- Modify: `frontend/src/rota.ts`
- Test: `frontend/src/rota.test.ts`, `frontend/src/tema.test.ts`

**Interfaces:**
- Produces:
  - `type Aba = 'integridade' | 'desempenho' | 'rede' | 'auditoria' | 'arquitetura' | 'e-se-fosse'`; `const ABAS: { id: Aba; rotulo: string; pergunta: string }[]`.
  - Rótulos: Integridade, Desempenho, Rede, Auditoria, Arquitetura, E se fosse…?
  - Perguntas (§7):
    - "Dois lances ao mesmo tempo: quem ganha?"
    - "O cache ajuda mesmo?"
    - "Quanto custa ficar ao vivo?"
    - "Dá para voltar no tempo?"
    - "Por onde passa um lance?"
    - "Por que não do jeito comum?"
  - `interface Rota { aba: Aba; leilaoId: string | null }`; `lerRota(hash: string): Rota`; `hrefDe(r: Rota): string`; `useRota(): Rota`.
  - `type Tema = 'claro' | 'escuro'`; `lerTema(): Tema` (padrão `claro`) e `aplicarTema(t: Tema): void`. Este define `document.documentElement.dataset.tema` e salva; o storage fica em try/catch.
  - **CSS:**
    - classes base `.cartao`, `.botao`, `.botao--destaque`, `.selo-ilustracao`, `.gaveta`, `.kpi`, `.pergunta`;
    - variáveis com os tokens globais, com tema escuro em `[data-tema="escuro"]`;
    - `@media (prefers-reduced-motion: reduce)` zerando as transições.

- [ ] **Step 1: Write the failing tests**

```ts
test('aba e leilão da URL', () => expect(lerRota('#/auditoria?leilao=abc')).toEqual({ aba: 'auditoria', leilaoId: 'abc' }))
test('padrão é integridade sem leilão', () => expect(lerRota('')).toEqual({ aba: 'integridade', leilaoId: null }))
test('aba desconhecida cai no padrão', () => expect(lerRota('#/xyz').aba).toBe('integridade'))
test('ida e volta', () => expect(lerRota(hrefDe({ aba: 'rede', leilaoId: 'x' }))).toEqual({ aba: 'rede', leilaoId: 'x' }))
test('tema padrão é claro mesmo com storage quebrado', () => { /* stub localStorage.getItem lançando */ expect(lerTema()).toBe('claro') })
```

- [ ] **Step 2:** `npm install && npm test` → FAIL
- [ ] **Step 3: Implement.** Mantenha `#/leilao/{id}` (rota antiga) sendo lida como `{ aba: 'integridade', leilaoId: id }`, para links antigos não quebrarem.
- [ ] **Step 4:** `npm test && npm run build` → PASS
- [ ] **Step 5: Commit** — `feat(front): fundação visual (tokens, fontes locais, tema) e rotas por aba`

### Task 9: `api.ts` com medidor de rede e rotas novas

**Files:**
- Create: `frontend/src/rede.ts`
- Modify: `frontend/src/api.ts`
- Test: `frontend/src/rede.test.ts`, `frontend/src/api.test.ts`

**Interfaces:**
- Consumes: as rotas das Tasks 2–7.
- Produces (`rede.ts`):
  - `interface Registro { id: number; quando: number; metodo: string; rota: string; status: number; ms: number; bytes: number; tipo: 'http' | 'sse' }`.
  - `rota` é normalizada, com UUIDs trocados por `{id}` (ex. `GET /leiloes/{id}/lances`).
  - `registrar(r: Omit<Registro,'id'>)`; `assinar(fn: (r: Registro) => void): () => void`; `registros(): Registro[]` (os últimos 500); `limpar()`.
  - `resumoPorRota(rs: Registro[]): { rota: string; requisicoes: number; bytes: number; msMedio: number }[]`, ordenado por bytes, decrescente.
  - `normalizarRota(url: string): string`.
- Produces (`api.ts`):
  - **Todo `fetch` passa por `medir(url, init)`.** Ele registra o tempo e os bytes do corpo: lê `await r.clone().arrayBuffer()` para contar `byteLength`, ou `TextEncoder` se o corpo já foi lido como texto.
  - **Cada mensagem SSE registra `tipo: 'sse'`** com os bytes de `ev.data`.
  - Novos membros de `Api`:
    - `lerConfiguracaoCache(s: Servico): Promise<'A'|'B'|'C'>`
    - `trocarConfiguracaoCache(s: Servico, c: 'A'|'B'|'C'): Promise<'A'|'B'|'C'>`
    - `eventos(id: string): Promise<EventoGravado[]>` (com `interface EventoGravado { versao: number; tipo: string; dados: unknown; criadoEm: string }`)
    - `estadoNaVersao(id: string, versao: number): Promise<EstadoLeilao>`
    - `reconstruirCache(): Promise<RelatorioReconstrucao>` (espelha o `Relatorio` da Task 4)
    - `saudeInfra(): Promise<Record<'postgres'|'redis'|'kafka', { status: 'UP'|'DOWN'; ms: number; erro?: string }>>`
    - `saudeServico(s: Servico | 'agendador'): Promise<{ status: string; ms: number }>`, que lê `/actuator/health`; `ms` é o tempo de ida e volta.
  - `ResultadoLance` passa a carregar `tentativas: number` em `aceito`, `recusado` e `conflito`.
  - `observarLeilao(id, aoMudar: (e: EstadoLeilao & { evento?: { tipo: string; versao: number } }) => void, aoFalhar?)`.
  - `lerMetrica(servico, nome, tags?: string[])`, com várias `tag=` na URL (necessário para filtrar `configuracao`).

- [ ] **Step 1: Write the failing tests**

```ts
test('normaliza ids', () => expect(normalizarRota('http://localhost:8082/leiloes/6e643478-3fc4-43a1-93b4-88192839b48a/lances')).toBe('/leiloes/{id}/lances'))
test('resumo soma por rota', () => { /* 2 registros da mesma rota → requisicoes 2, bytes somados */ })
test('darLance lê tentativas no 200 e no 422', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ versao: 5, tentativas: 2 }), { status: 200 })))
  expect(await api.darLance('id', { licitanteId: 'licitante-1', valor: 100 })).toEqual({ tipo: 'aceito', versao: 5, tentativas: 2 })
})
test('fetch que falha vira erro com status 0 e é registrado', async () => { /* fetch rejeita → { tipo:'erro', status:0 }; registros() tem status 0 */ })
test('medidor conta os bytes do corpo', async () => { /* corpo "{\"a\":1}" → bytes 7 */ })
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.** Ajuste `simulacao.ts`/`metricas.ts` só no necessário para compilar com o novo `ResultadoLance` (contagem de tentativas fica para a Task 12).
- [ ] **Step 4:** `npm test && npm run build` → PASS
- [ ] **Step 5: Commit** — `feat(front): medidor de rede e rotas novas na api`

### Task 10: Shell, palco e gavetas

**Files:**
- Rewrite: `frontend/src/App.tsx`
- Create: `frontend/src/shell/Topo.tsx`, `frontend/src/palco/Palco.tsx`, `frontend/src/palco/usePalco.ts`, `frontend/src/palco/palco.ts`, `frontend/src/palco/GavetaLeiloes.tsx`, `frontend/src/palco/GavetaNovoLeilao.tsx`, `frontend/src/shell/Aba.tsx`
- Delete: `frontend/src/ListaLeiloes.tsx`, `CriarLeilao.tsx`, `DetalheLeilao.tsx`, `AcoesLeilao.tsx` (a lógica útil migra; `Confirmar.tsx` é reaproveitado)
- Test: `frontend/src/palco/palco.test.ts`

**Interfaces:**
- Consumes: `Rota`/`hrefDe` (Task 8), `api`/`observarLeilao` (Task 9), `usuarios.ts`, `formato.ts`.
- Produces (`palco.ts`, puro):
  - `podeDarLance(e: EstadoLeilao | null, agora: number): { pode: boolean; motivo?: string }`. Os motivos têm o texto exato:
    - "Leilão ainda não abriu"
    - "Leilão encerrado"
    - "Leilão cancelado"
    - "Sem leilão em foco"
  - `proximoLance(e: EstadoLeilao, incrementoMinimo: number): number` = `precoAtual + incrementoMinimo`. Sem `precoAtual`, usa o preço inicial (o detalhe não traz o incremento; leia-o do `LeilaoCriado` em `api.eventos`, uma vez por leilão).
  - `acumularEventos(lista: EventoVisto[], novo: EventoVisto, max = 5): EventoVisto[]`, sem duplicar versão, mais recente primeiro.
  - `interface EventoVisto { tipo: string; versao: number; quando: number }`.
  - `type SituacaoPalco = 'sem-leilao' | 'carregando' | 'ao-vivo' | 'desatualizado' | 'nao-encontrado'`; `situacaoDoPalco(entrada: { leilaoId: string | null; estado: EstadoLeilao | null; erro: ErroHttp | null; sseCaiu: boolean }): SituacaoPalco`.
- Produces (`usePalco.ts`):
  - `usePalco(leilaoId: string | null): { estado; eventos: EventoVisto[]; situacao: SituacaoPalco; incrementoMinimo: number | null; ultimoEvento: EventoVisto | null }`.
  - Abre o SSE e o fecha ao trocar de leilão.
- Produces (`Aba.tsx`):
  - `<Aba pergunta adr?: string porQue: ReactNode>{children}</Aba>`, o esqueleto comum de todas as abas: pergunta-título, conteúdo e a caixa "Por que funciona assim?".
- **Palco (§6):**
  - seletor de leilão, título, status, preço em Fraunces ~64 px (pulsa ao mudar), líder, versão e contagem regressiva (`tempoRestante`);
  - "Dar lance" com valor editável pré-preenchido por `proximoLance`;
  - "Cancelar", só para `vendedor-1`, com `Confirmar`;
  - os 5 últimos eventos;
  - links "Ver todos" (`GavetaLeiloes`: lista + filtro por status, que vem de `ListaLeiloes`) e "Novo leilão" (`GavetaNovoLeilao`, que vem de `CriarLeilao` e só aparece para o vendedor). Ao criar, o novo leilão vira o foco.
- **Topo:** marca "Leilão." com o ponto em destaque, as abas, "estou como" e o botão de tema.
- **Sem leilão em foco:** o palco abre a gaveta de leilões.

- [ ] **Step 1: Write the failing tests**

```ts
test('não deixa dar lance em leilão encerrado', () => expect(podeDarLance({ ...estado, status: 'ENCERRADO' }, Date.now())).toEqual({ pode: false, motivo: 'Leilão encerrado' }))
test('sem leilão em foco', () => expect(podeDarLance(null, 0).motivo).toBe('Sem leilão em foco'))
test('eventos sem repetir versão, no máximo 5', () => { /* 7 eventos com uma versão repetida → 5, mais recente primeiro */ })
test('erro de rede com estado anterior fica desatualizado', () => expect(situacaoDoPalco({ leilaoId: 'x', estado, erro: new ErroHttp(0, 'rede'), sseCaiu: false })).toBe('desatualizado'))
test('404 fica nao-encontrado', () => expect(situacaoDoPalco({ leilaoId: 'x', estado: null, erro: new ErroHttp(404, ''), sseCaiu: false })).toBe('nao-encontrado'))
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.** As abas ainda podem ser `<Aba>` vazias com a pergunta.
- [ ] **Step 4:** `npm test && npm run lint && npm run build` → PASS. Com o sistema no ar:
  - abra `http://localhost:5173` e crie um leilão como `vendedor-1`;
  - troque para `licitante-1`, dê um lance e confira o preço pulsando e o evento `LanceRegistrado` no palco;
  - abra a mesma URL numa segunda janela e confira o lance aparecendo nela.
- [ ] **Step 5: Commit** — `feat(front): shell com palco ao vivo, abas e gavetas`

### Task 11: Biblioteca de gráficos SVG

**Files:**
- Create: `frontend/src/graficos/escalas.ts`, `Barras.tsx`, `BarrasEmpilhadas.tsx`, `Linhas.tsx`, `Sparkline.tsx`, `Raias.tsx`
- Delete: `frontend/src/Grafico.tsx` (substituído por `Linhas`)
- Test: `frontend/src/graficos/escalas.test.ts`

**Interfaces:**
- Produces:
  - `escalaLinear(dominio: [number, number], faixa: [number, number]): (v: number) => number`; `marcas(min: number, max: number, alvo = 5): number[]` (valores "redondos": 1, 2, 5 × 10ⁿ).
  - `interface Serie { nome: string; cor: string; pontos: { x: number; y: number }[] }`.
  - **Componentes** (todos com `titulo`, `unidade`, legenda e `<title>` acessível; cores via tokens; tamanhos de texto ≥ 14 px):
    - `<Barras grupos={{ rotulo: string; valores: { serie: string; valor: number | null }[] }[]} cores={Record<string,string>} />`
    - `<BarrasEmpilhadas itens={{ rotulo: string; partes: { nome: string; valor: number }[] }[]} />`
    - `<Linhas series={Serie[]} rotuloX rotuloY />`
    - `<Sparkline valores={number[]} />`
    - `<Raias raias={{ nome: string; marcas: { t: number; resultado: 'aceito'|'recusado'|'conflito'|'erro' }[] }[]} duracaoMs={number} />`
  - Use o skill `dataviz` como referência de paleta e marcas. As séries A/B/C precisam de contraste sobre `#f6f2ea`.

- [ ] **Step 1: Write the failing tests**

```ts
test('escala mapeia extremos', () => { const s = escalaLinear([0, 10], [100, 0]); expect(s(0)).toBe(100); expect(s(10)).toBe(0) })
test('marcas redondas', () => expect(marcas(0, 87)).toEqual([0, 20, 40, 60, 80, 100]))
test('domínio degenerado não gera NaN', () => expect(Number.isNaN(escalaLinear([5, 5], [0, 100])(5))).toBe(false))
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test && npm run build` → PASS
- [ ] **Step 5: Commit** — `feat(front): gráficos SVG próprios (barras, empilhadas, linhas, sparkline, raias)`

### Task 12: Aba Integridade

**Files:**
- Create: `frontend/src/abas/integridade/AbaIntegridade.tsx`, `rajada.ts`, `EscadaVersoes.tsx`
- Modify: `frontend/src/simulacao.ts` (contar `tentativas`; registrar o instante de cada lance para as raias; checagem nova)
- Test: `frontend/src/abas/integridade/rajada.test.ts`, `frontend/src/simulacao.test.ts`

**Interfaces:**
- Consumes: `api.darLance` com `tentativas`, `api.eventos`, `podeDarLance`, `<Raias>`, `usePalco`.
- Produces:
  - `planejarRajada(e: EstadoLeilao, incrementoMinimo: number, n: number, mesmoValor: boolean): DarLanceRequest[]`. Licitantes em rodízio `licitante-1..3`. Valor = `proximoLance`; se `mesmoValor` for falso, soma `i × incrementoMinimo`. `n` vai de 2 a 6 (limite de conexões do navegador).
  - `interface ResultadoRajada { pedido: DarLanceRequest; resultado: ResultadoLance; ms: number }`; `resumirRajada(rs): { aceitos: number; recusados: number; conflitos: number; colisoes: number }`, onde `colisoes` = soma de `(tentativas - 1)`.
  - `versoesContiguas(eventos: EventoGravado[]): boolean` (versões 1..n sem buraco nem repetição).
  - `Execucao.integridade` ganha `colisoes: number`; `Execucao.lances: { t: number; licitanteId: string; resultado: ResultadoLance['tipo'] }[]`, com `t` em ms desde o início; `Checagens` ganha `versoesContiguas: boolean`.
- **Tela** (dentro de `<Aba pergunta="Dois lances ao mesmo tempo: quem ganha?" adr="ADR-002">`):
  - **Rajada:** controles N (2–6) e "mesmo valor". Para o desenho, `EscadaVersoes` mostra os lances subindo para v+1: o vencedor sobe, os perdedores batem e mostram "tentou de novo ×(tentativas−1)" e o resultado final.
  - **Simulação completa:** o formulário do `PainelAdm` atual, com raias por licitante e progresso ao vivo. O leilão criado vira o foco do palco via `hrefDe`.
  - **Checagens:** ✓/✗ grandes.
  - **Bloqueio:** desabilitado com o motivo de `podeDarLance` quando o palco não permite.

- [ ] **Step 1: Write the failing tests**

```ts
test('rajada com mesmo valor manda o mesmo valor para todos', () => { const p = planejarRajada(estado, 100, 4, true); expect(new Set(p.map(x => x.valor)).size).toBe(1); expect(p).toHaveLength(4) })
test('colisões somam tentativas extras', () => expect(resumirRajada([aceito(1), recusado(2), recusado(3)]).colisoes).toBe(3))
test('versões com buraco falham', () => expect(versoesContiguas([ev(1), ev(2), ev(4)])).toBe(false))
test('n fora de 2..6 é limitado', () => expect(planejarRajada(estado, 100, 50, true)).toHaveLength(6))
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test && npm run build` → PASS. Ao vivo: rajada de 4 com mesmo valor num leilão aberto mostra 1 aceito e ao menos uma colisão.
- [ ] **Step 5: Commit** — `feat(front): aba Integridade com rajada, escada de versões e simulação`

### Task 13: Orquestrador da comparação A × B × C

**Files:**
- Create: `frontend/src/abas/desempenho/comparacao.ts`
- Modify: `frontend/src/metricas.ts` (fotos filtradas por `configuracao`), `frontend/src/simulacao.ts` (`executar` recebe a configuração da vez e não lê mais `/actuator/metrics` para descobri-la), `frontend/src/historico.ts` (guarda comparações)
- Test: `frontend/src/abas/desempenho/comparacao.test.ts`

**Interfaces:**
- Consumes: `api.lerConfiguracaoCache`, `api.trocarConfiguracaoCache`, `executar`.
- Produces:
  - `type Configuracao = 'A' | 'B' | 'C'`.
  - `executar(api, p, configuracao: Configuracao, aoProgredir, sinal): Promise<Execucao>`. Também calcula `p99` em `escrita` e `leitura`.
  - `fotografarServicos(api, configuracao: Configuracao)`: tags `caminho:…` + `configuracao:X`.
  - `interface Comparacao { id: string; quando: string; parametros: Parametros; execucoes: Partial<Record<Configuracao, Execucao>>; completa: boolean }`.
  - `compararABC(api: Api, p: Parametros, aoProgredir: (c: { configuracao: Configuracao; progresso: Progresso; feitas: Configuracao[] }) => void, sinal: AbortSignal): Promise<Comparacao>`.
  - **Algoritmo** (o teste não determina a ordem dos passos, então segue explícito):
    ```
    anterior = lerConfiguracaoCache('escrita'); exigir == lerConfiguracaoCache('leitura') senão ErroSimulacao('Escrita e leitura com configurações diferentes')
    try:
      para cfg em [A, B, C]:
        se sinal.aborted: parar
        trocar nas duas portas; reler as duas; se alguma != cfg → ErroSimulacao('Não foi possível trocar para cfg')
        execucoes[cfg] = executar(api, p, cfg, ...)
    finally:
      trocar as duas portas para `anterior` (mesmo em erro/abort; erro aqui só vai para console.error)
    ```
  - `historico.ts`: `carregarComparacoes(): Comparacao[]`, `salvarComparacoes(cs)` (chave `leilao.adm.comparacoes`, no máximo 10). As execuções avulsas antigas continuam legíveis.

- [ ] **Step 1: Write the failing tests** (Api falsa em memória que anota as chamadas)

```ts
test('roda A, B e C nessa ordem e restaura a anterior', async () => {
  const falsa = apiFalsa({ inicial: 'C' })
  const c = await compararABC(falsa, P, () => {}, new AbortController().signal)
  expect(Object.keys(c.execucoes)).toEqual(['A', 'B', 'C'])
  expect(falsa.trocas).toEqual([['A','A'], ['B','B'], ['C','C'], ['C','C']]) // [escrita, leitura] por troca
})
test('abortar no meio restaura a configuração anterior', async () => { /* aborta após A → última troca é para a anterior; completa=false */ })
test('erro numa execução restaura e propaga', async () => { /* executar de B lança → última troca é para a anterior; rejeita */ })
test('serviços discordando não roda nada', async () => { /* escrita C, leitura B → rejeita; nenhuma troca */ })
test('troca que não pega aborta', async () => { /* leitura continua em C depois do PUT para A → rejeita com "Não foi possível trocar para A"; restaura */ })
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test && npm run build` → PASS
- [ ] **Step 5: Commit** — `feat(front): comparação A×B×C em sequência, sem reiniciar, restaurando a configuração`

### Task 14: Aba Desempenho

**Files:**
- Create: `frontend/src/abas/desempenho/AbaDesempenho.tsx`, `frontend/src/abas/desempenho/aoVivo.ts`
- Delete: `frontend/src/PainelAdm.tsx` (a simulação foi para a Task 12; a comparação, para cá)
- Test: `frontend/src/abas/desempenho/aoVivo.test.ts`

**Interfaces:**
- Consumes: `compararABC`, `carregarComparacoes`, `<Barras>`, `<BarrasEmpilhadas>`, `<Linhas>`, `<Sparkline>`, `api.lerConfiguracaoCache`, `api.lerMetrica`.
- Produces:
  - `taxas(anterior: { count: number; total: number; quando: number }, atual: idem): { porSegundo: number; msMedio: number | null }` (tempo total em segundos convertido para ms).
  - **Tela** (`<Aba pergunta="O cache ajuda mesmo?" adr="ADR-003">`):
    - configuração ativa grande em cada porta, com aviso se discordarem;
    - botão "Comparar A × B × C" com os parâmetros da simulação (reusa o formulário da Task 12 como componente);
    - três colunas preenchendo ao vivo, com a da vez destacada;
    - aviso "Durante a comparação, não dê lances em outros leilões";
    - botão "Interromper";
    - **gráficos da comparação selecionada:**
      - p50/p95/p99 da escrita e da leitura (Barras);
      - tempo médio no backend;
      - eventos lidos por obtenção;
      - acerto do cache;
      - origem do estado por configuração (BarrasEmpilhadas com `porBase`);
      - curva tempo × versão (Linhas, `grafico.escrita`/`leitura`);
    - histórico de comparações para escolher;
    - **ao vivo:** sparkline de obtenções/s e ms médio por porta, lendo `leilao.estado.obter` a cada 2 s só enquanto a aba está visível.

- [ ] **Step 1: Write the failing test**

```ts
test('taxa por segundo e ms médio', () => expect(taxas({ count: 10, total: 0.5, quando: 0 }, { count: 30, total: 1.5, quando: 2000 })).toEqual({ porSegundo: 10, msMedio: 50 }))
test('sem obtenções no intervalo', () => expect(taxas({ count: 5, total: 1, quando: 0 }, { count: 5, total: 1, quando: 2000 }).msMedio).toBeNull())
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test && npm run build` → PASS. Ao vivo: "Comparar A × B × C" com 5×5 lances termina com as três colunas preenchidas, e `curl -s localhost:8081/admin/cache/configuracao` volta à configuração de antes.
- [ ] **Step 5: Commit** — `feat(front): aba Desempenho com comparação A×B×C e métricas ao vivo`

### Task 15: Aba Rede

**Files:**
- Create: `frontend/src/abas/rede/AbaRede.tsx`, `frontend/src/abas/rede/experimento.ts`
- Test: `frontend/src/abas/rede/experimento.test.ts`

**Interfaces:**
- Consumes: `rede.ts` (`assinar`, `registros`, `resumoPorRota`), `api.observarLeilao`, `api.consultarLeilao`, `api.darLance`, `<Barras>`.
- Produces:
  - `interface Percepcao { versao: number; aceitoEm: number | null; viaSse: number | null; viaPolling: number | null }`.
  - `registrarAceite(m: Map<number, Percepcao>, versao: number, quando: number)`, `registrarVisto(m, versao: number, via: 'sse' | 'polling', quando: number)`. Só o primeiro "visto" de cada via conta.
  - `atrasos(m): { sse: number[]; polling: number[]; naoMedidos: number }`. Atraso = visto − aceito, só para versões com `aceitoEm` (lances desta janela); as outras contam em `naoMedidos`.
  - **Experimento** "SSE × polling" de 30 s: intervalo de polling ajustável (padrão 1000 ms) e botão "dar lance agora" que usa o palco. O polling marca a versão vista quando `GET /leiloes/{id}` devolve uma versão maior. Ao final mostra requisições, bytes, atraso médio e máximo para cada via, e "atraso não medido: N lances de outras janelas".
- **Tela** (`<Aba pergunta="Quanto custa ficar ao vivo?" adr="ADR-001">`):
  - requisições e bytes por rota;
  - waterfall das últimas 30 requisições (barra horizontal de `quando` até `quando + ms`, colorida por status);
  - aviso fixo: "Medimos o corpo das respostas; cabeçalhos HTTP não entram".

- [ ] **Step 1: Write the failing tests**

```ts
test('atraso só para lances desta janela', () => {
  const m = new Map(); registrarAceite(m, 7, 1000); registrarVisto(m, 7, 'sse', 1030); registrarVisto(m, 7, 'polling', 1600); registrarVisto(m, 8, 'sse', 2000)
  expect(atrasos(m)).toEqual({ sse: [30], polling: [600], naoMedidos: 1 })
})
test('segunda vez visto não altera', () => { /* registrarVisto 2× na mesma via → mantém o primeiro */ })
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test && npm run build` → PASS. Ao vivo: durante o experimento, três lances pelo palco mostram atraso SSE menor que o do polling de 1 s.
- [ ] **Step 5: Commit** — `feat(front): aba Rede com medidor e experimento SSE × polling`

### Task 16: Aba Auditoria

**Files:**
- Create: `frontend/src/abas/auditoria/AbaAuditoria.tsx`, `frontend/src/abas/auditoria/diferencas.ts`, `frontend/src/abas/auditoria/Reconstrucao.tsx`
- Test: `frontend/src/abas/auditoria/diferencas.test.ts`

**Interfaces:**
- Consumes: `api.eventos`, `api.estadoNaVersao`, `api.reconstruirCache`, `Confirmar`, `usePalco` (recarrega a lista quando chega um evento novo).
- Produces:
  - `mudancas(antes: EstadoLeilao | null, depois: EstadoLeilao): { campo: keyof EstadoLeilao; de: unknown; para: unknown }[]`. Ignora `versao`; com `antes` nulo, todos os campos de `depois` aparecem como mudança.
- **Tela** (`<Aba pergunta="Dá para voltar no tempo?" adr="ADR-002">`):
  - **Linha do tempo** vertical com um evento por linha (versão, tipo sem `.v1`, horário); clicar abre o JSON em JetBrains Mono.
  - **Slider** 1…versão atual: busca `estadoNaVersao` (com debounce de 150 ms) e mostra o estado e a lista de `mudancas` em relação à versão anterior. Também destaca o evento correspondente na linha do tempo.
  - **"Reconstruir cache"** com confirmação. `Reconstrucao` anima as 4 etapas em sequência (≈400 ms cada) com os números e tempos do `RelatorioReconstrucao`:
    1. "Fotografia: N leilões"
    2. "Apagados: X chaves do Redis e Y checkpoints"
    3. "Refeitos N estados a partir dos eventos"
    4. "Idênticos ✓", ou "Cópia atrás da fonte em K leilão(ões) — corrigida"

- [ ] **Step 1: Write the failing tests**

```ts
test('mostra só o que mudou', () => expect(mudancas(e1, { ...e1, precoAtual: 2000, liderId: 'licitante-2', versao: 8 })).toEqual([
  { campo: 'precoAtual', de: e1.precoAtual, para: 2000 }, { campo: 'liderId', de: e1.liderId, para: 'licitante-2' }]))
test('primeira versão lista todos os campos', () => expect(mudancas(null, e1).length).toBeGreaterThan(3))
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test && npm run build` → PASS. Ao vivo: num leilão com lances, o slider na versão 2 mostra `status: Aberto` e preço inicial; "Reconstruir cache" termina em "Idênticos ✓".
- [ ] **Step 5: Commit** — `feat(front): aba Auditoria com linha do tempo, viagem no tempo e reconstrução do cache`

### Task 17: Aba Arquitetura

**Files:**
- Create: `frontend/src/abas/arquitetura/AbaArquitetura.tsx`, `Diagrama.tsx`, `caminho.ts`, `Saude.tsx`, `adrs.ts`
- Test: `frontend/src/abas/arquitetura/caminho.test.ts`

**Interfaces:**
- Consumes: `api.darLance`, `usePalco().ultimoEvento`, `api.saudeServico`, `api.saudeInfra`.
- Produces:
  - `interface Medicao { versao: number; cliqueEm: number; respostaEm: number | null; sseEm: number | null }`.
  - `casarSse(pendentes: Medicao[], versaoSse: number, quando: number): Medicao[]` marca `sseEm` na medição com a mesma versão.
  - `trechos(m: Medicao): { gravacaoMs: number | null; propagacaoMs: number | null }` (resposta − clique; SSE − resposta).
  - `NOS = ['front','escrita','eventstore','kafka','leitura','agendador','sse']`.
  - `adrs.ts`: `ADRS: { id: 'ADR-001'|'ADR-002'|'ADR-003'|'ADR-004'; titulo: string; decisao: string; aba: Aba }[]`. A decisão é uma frase de cada ADR em `docs/adr`; as abas são 001→rede, 002→auditoria, 003→desempenho e 004→arquitetura.
- **Diagrama** (`<Aba pergunta="Por onde passa um lance?" adr="ADR-001">`):
  - SVG com os nós e as setas; `front → escrita → eventstore` e `eventstore → kafka → leitura`/`agendador`, depois `leitura → sse → front`.
  - **Lance desta janela** (botão "Dar lance e acompanhar"): acende `front→escrita→eventstore` até a resposta e mostra `gravacaoMs` sobre esse trecho; ao chegar o SSE, acende o resto e mostra `propagacaoMs` sobre `eventstore→…→front`. **Sem tempos por nó intermediário.**
  - **Lance de outra janela** (SSE com versão sem medição): acende só `kafka→leitura→sse→front`, sem tempo.
- **Saúde:** cartões para escrita, leitura e agendador (`saudeServico`) e para Postgres, Redis e Kafka (`saudeInfra`), a cada 5 s só com a aba visível. Cada cartão mostra UP/DOWN e o tempo em ms. Se o serviço não responder, o cartão fica DOWN com "sem resposta".
- **Cartões das ADRs** levando à aba de cada uma.

- [ ] **Step 1: Write the failing tests**

```ts
test('SSE completa a medição da mesma versão', () => expect(casarSse([{ versao: 9, cliqueEm: 0, respostaEm: 12, sseEm: null }], 9, 40)[0].sseEm).toBe(40))
test('trechos', () => expect(trechos({ versao: 9, cliqueEm: 0, respostaEm: 12, sseEm: 40 })).toEqual({ gravacaoMs: 12, propagacaoMs: 28 }))
test('SSE de outra versão não mexe', () => expect(casarSse([m9], 10, 50)[0].sseEm).toBeNull())
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test && npm run build` → PASS. Ao vivo: "Dar lance e acompanhar" mostra os dois tempos. Com `docker stop leilao-redis-1`, o cartão Redis fica DOWN e os lances continuam passando. Religue com `docker start leilao-redis-1`.
- [ ] **Step 5: Commit** — `feat(front): aba Arquitetura com diagrama vivo, saúde e ADRs`

### Task 18: Aba "E se fosse…?"

**Files:**
- Create: `frontend/src/abas/eSeFosse/AbaESeFosse.tsx`, `cenarios.ts`, `Cenario.tsx` (controles play, pausa, passo e reiniciar)
- Test: `frontend/src/abas/eSeFosse/cenarios.test.ts`

**Interfaces:**
- Consumes: `api.eventos` (eventos reais do leilão em foco).
- Produces:
  - `crud(eventos: EventoGravado[]): { passo: number; linha: { preco: number | null; lider: string | null; status: string }; apagado: string }[]`. Uma "tabela" de uma linha sofrendo UPDATE a cada evento; `apagado` descreve o que se perdeu (ex. "lance de licitante-1 de R$ 12,00").
  - `cqrsAtrasado(eventos, atrasoPassos = 2): { passo: number; escrita: number | null; replica: number | null; precoVelho: boolean }[]`. A réplica mostra o preço de `atrasoPassos` antes.
  - Os cenários "REST síncrono × broker" e "RabbitMQ × Kafka" são roteiros fixos de passos (texto + estado dos nós) em `cenarios.ts`; não precisam de teste.
- **Tela** (`<Aba pergunta="Por que não do jeito comum?">`):
  - quatro cartões lado a lado (2×2): CRUD × Event Sourcing, CQRS × cache versionado, REST síncrono × broker, RabbitMQ × Kafka;
  - em cada um, o lado "nosso sistema" e o lado "alternativa", e o **selo "ilustração"** no topo do cartão;
  - **sem leilão em foco**, CRUD e CQRS mostram "escolha um leilão com lances no palco".

- [ ] **Step 1: Write the failing tests**

```ts
test('CRUD perde o lance anterior a cada UPDATE', () => { const p = crud(eventosReais); expect(p.at(-1)!.linha.preco).toBe(ultimoValor); expect(p.filter(x => x.apagado).length).toBe(lances - 1) })
test('réplica fica atrás', () => expect(cqrsAtrasado(eventosReais, 2).some(p => p.precoVelho)).toBe(true))
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test && npm run build` → PASS
- [ ] **Step 5: Commit** — `feat(front): aba "E se fosse…?" com as alternativas ilustradas`

### Task 19: Limpeza, documentação e verificação completa

**Files:**
- Delete: CSS e componentes órfãos (o `index.css` antigo, se sobrou).
- Modify: `frontend/README.md` (abas, rotas, `npm test`), `README.md` (rotas novas na tabela de serviços), `docs/PAINEL_ADM.md` (aponta para as abas Integridade e Desempenho e para a comparação sem reiniciar), `backend/README.md` (rotas `/admin/...` e `/infra/saude`), `.gitignore` (`.superpowers/`)

- [ ] **Step 1:** em `backend/`, `./mvnw -q verify`; em `frontend/`, `npm test && npm run lint && npm run build`. Tudo sem erro.
- [ ] **Step 2: Ensaio completo com o sistema no ar**, nesta ordem:
  - **palco:** criar leilão, lance e segunda janela;
  - **Integridade:** rajada e simulação;
  - **Desempenho:** "Comparar A × B × C" (confira que a configuração volta à anterior);
  - **Rede:** experimento SSE × polling;
  - **Auditoria:** slider e reconstruir;
  - **Arquitetura:** lance acompanhado e Redis parado e religado;
  - **"E se fosse…?":** os quatro cenários;
  - **tema escuro;**
  - `prefers-reduced-motion` ligado no sistema operacional, para conferir que as animações param.

  Anote qualquer falha e corrija antes do commit.
- [ ] **Step 3: Commit** — `docs: novo front da apresentação e rotas de administração`
