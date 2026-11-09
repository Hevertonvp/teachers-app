# Defeitos e achados (homologação NEXO — PDI e Formulário 1/3)

Modo diagnóstico: nenhum código de produção foi alterado. Banco de teste: PostgreSQL local descartável.

| ID | Sev. | Módulo | Resumo | Evidência |
|---|---|---|---|---|
| DEF-01 | MÉDIO | Formulário 1/3 | "Próximo" só troca de semana depois que o salvamento termina e a tela segue editável na semana antiga, sem indicador. Com rede lenta, o texto digitado logo após tocar em "Próximo" entra na semana ANTERIOR e a semana seguinte fica vazia. | evidencias/05-defeito-troca-semana-durante-espera.png; UT-DEF-01 |
| DEF-02 | BAIXO | Login (transversal) | Rótulos "E-mail" e "Senha" em `LoginPage.jsx` sem `htmlFor`/`id`: leitor de tela não associa rótulo ao campo. | código `src/pages/LoginPage.jsx` linhas 49–72 |
| DEF-03 | MELHORIA | Gestão de vínculos | A tela de vínculo professor×turma×disciplina não permite informar data de início: todo vínculo nasce com a data de hoje. Vínculos históricos (professor que entrou durante a janela etc.) só podem ser criados por intervenção direta no banco. | 19 vínculos criados pela interface, todos com início 04/11/2026 |
| DEF-04 | TÉCNICO | Repositório | 3.331 arquivos de `node_modules/` estão versionados no Git desde o "first commit"; `.gitignore` só ignora `perguntas*.txt` e `.env`. Não corrigido por orientação. | `git ls-files node_modules` |
| DEF-05 | MELHORIA | Marca | A interface ainda exibe "Gestão Pedagógica"; o nome definido é "Nexo" (provisório). | todas as telas |

## Observações de regra não especificada (decisão da Secretaria)
- Ciclo com janela inteira no passado (retroativo) é aceito (S10, S12, L02).
- Reabertura é aceita mesmo quando cai dentro da janela de outro ciclo ativo (UT-REA-03) ou em outro ano (UT-REA-05).
- Não existe exclusão de ciclo, só inativação (UT-ED-05).

## Achados da fase offline
| ID | Sev. | Módulo | Resumo | Evidência |
|---|---|---|---|---|
| DEF-06 | MÉDIO | Formulário 1/3 / PWA | Sem rede, o aviso fixo "Sem conexão com a internet… Reconectando em Ns / Tentar agora" (`z-40`) fica por cima da barra de ações do formulário (`z-30`): "Próximo", "Salvar progresso" e "Concluir" ficam inclicáveis (Playwright: "intercepts pointer events"), no desktop e no celular. Alternativa existente: abas de semana no topo e salvamento automático. | evidencias/11-offline-banner-celular.png, 11-offline-banner-desktop.png; UT-OFF-UX-* |
| LIM-01 | LIMITAÇÃO | PWA | O Service Worker não cacheia HTML/JS/CSS por desenho: abrir o app do zero sem rede não funciona; só dá para continuar na página já aberta. Não é defeito; é decisão de produto a confirmar. | `public/sw.js`; UT-OFF-05 |
| DEF-07 | MÉDIO (ALTO perto do prazo) | Formulário 1/3 / offline | A fila offline só é enviada ao enfileirar com rede ou ao detectar reconexão (`syncQueue.js:32` e `:111`). Quem edita offline, fecha o navegador e volta com rede NÃO tem a fila enviada ao abrir o app (30 s observados); a alteração fica só no aparelho até o professor reabrir aquele mesmo formulário. Aviso global "1 alteração aguardando sincronização" aparece, mas nada é enviado. | evidencias/12-fila-pendente-online.png; UT-OFF-11/12/13 |
| DEF-08 | MÉDIO | Formulário 1/3 / offline | Conflito detectado pela FILA (edição offline vs. outro dispositivo): o item fica parado como `conflict`; a tela do formulário não oferece "Usar a versão salva / Manter o meu texto" (essas opções só existem no salvamento direto), mostra "Salvo" e "Recuperamos o que você tinha digitado…", e o servidor mantém outro texto. Há apenas o aviso genérico "Não foi possível sincronizar algumas alterações". Sem sobrescrita silenciosa, mas sem caminho de resolução. | evidencias/10-offline-conflito-reaberto.png; UT-OFF-10/10b |

## Achados de vínculos e estados administrativos
| ID | Sev. | Módulo | Resumo | Evidência |
|---|---|---|---|---|
| DEF-09 | ALTO | Formulário 1/3 (painel × professor) | Professor cujo vínculo ENCERROU dentro da janela do ciclo (P08, encerrado em 10/11, janela 02–20/11) é contado como obrigação "esperada" no painel da Secretaria (21 batem com a conta manual), mas ele vê "Nenhum Formulário 1/3 para você agora" e a API exige vínculo ativo para editar. A obrigação fica eternamente "Não iniciada" e infla o esperado/derruba o % de entrega. Regra 67/68 do contexto ("vínculo encerrado preserva histórico" / "esperado = teve vínculo na janela") não diz se esse professor deve poder preencher. **Decisão da Secretaria necessária.** | evidencias/13-P08-lista.png, 13-painel-antes.png; UT-VIN-P08 |
| QUE-01 | CONCEITUAL | Formulário 1/3 | Desativar turma/professor durante o ciclo faz sumir a obrigação NÃO iniciada (P15: 21→20) e some o formulário da lista do professor, enquanto a obrigação já iniciada/concluída permanece (P11). É o documentado (seção 68), mas é decisão de negócio confirmar. | UT-EST-03/04/06 |

## Achados menores e de usabilidade
| ID | Sev. | Módulo | Resumo |
|---|---|---|---|
| DEF-10 | BAIXO | PDI (Alunos) | Filtro "Turma" com "Todas as escolas" lista nomes repetidos ("6M1 6M1 … 7M1 7M1") sem a escola; ambíguo porque os nomes se repetem entre escolas. |
| DEF-11 | BAIXO | PDI (Aplicação) | Data de início anterior a hoje é barrada só pelo balão nativo do navegador, sem mensagem própria na tela; o botão Salvar não responde. |
| DEF-12 | BAIXO | PDI (Alunos) | "Novo aluno PDI" parece ativo, mas com "Todas as escolas" só mostra o aviso verde no topo. |
| DEF-13 | MÉDIO | PDI offline | O mesmo aviso offline que cobre os botões do 1/3 (DEF-06) cobre o "Salvar" do PDI; a alternativa é salvar por teclado (Tab+Enter), que enfileira corretamente. A fila do PDI também não é enviada ao abrir o app (DEF-07). |

## Achados da rodada de transferência de aluno no PDI (09/11/2026)

Scripts: `25-pdi-transferencia-turma.mjs`, `25x-put-valido.mjs`, `26-pdi-transferencia-escola.mjs`, `27-pdi-ficha-anual-transferido.mjs`. Navegador real (Chromium) contra o banco local. Transferências feitas pela interface da Secretaria; preparação declarada: vínculo Inglês 6M1 Boa Vista → P04 criado pela API.

| ID | Sev. | Módulo | Resumo | Evidência |
|---|---|---|---|---|
| DEF-14 | ALTO | PDI (bloco de perguntas comuns) | Depois da troca de turma (Lucas 6M1 → 6M3), o novo professor (P10) abre a ficha de Arte e o campo "Perguntas comuns" mostra o texto da professora anterior (P04). Ao salvar, o P10 **sobrescreve o bloco da P04** (`blocos_respostas_padrao_pdi` id 1: professorId P04, `updatedBy` = P10). O texto original da P04 se perde sem histórico, e o bloco continua ligado às outras fichas da P04 para o mesmo aluno (Inglês e Ensino Religioso), que passam a mostrar o texto do P10. | 25a-p10-lucas-antes.png, 25a-p10-lucas-depois-salvar.png; PDI-TRF-T8 |
| DEF-15 | MÉDIO | PDI (Ficha Anual) | Aluno transferido de escola: a Ficha Anual lista as fichas da escola anterior (disciplina, escola, turma, professor, "Concluído"), mas o link de cada uma leva a "Esta aplicação não pertence à escola atual deste aluno" — tanto para a Secretaria quanto para a professora da nova escola. A tela oferece um acesso que não funciona. | 26-sec-ficha-anual-marina.png, 27-ficha-anual-secretaria.png, 27-ficha-anual-p04.png; PDI-TRF-E8/E9 |
| DEF-16 | BAIXO | PDI (Ficha Anual) | Datas da Aplicação exibidas um dia antes: tela "03/11/2026 a 14/12/2026"; banco 04/11/2026 a 15/12/2026 (provável conversão de data UTC para o fuso local). | 26-sec-ficha-anual-marina.png; PDI-TRF-E10 |

**Regras não definidas (comportamento atual registrado, sem juízo de defeito):**
- **QUE-02** Novo professor da turma assume a ficha **em andamento** iniciada por outro e pode alterar as respostas (PDI-TRF-T7).
- **QUE-03** Novo professor pode alterar ficha **concluída** por outro; status continua CONCLUIDA e `concluidaEm` não muda; nenhum registro visível da alteração (PDI-TRF-T9).
- **QUE-04** Fichas da escola anterior ficam ilegíveis para todos (autora, Secretaria, nova escola) pela rota da ficha: HTTP 400 "Esta aplicação não pertence à escola atual deste aluno" (PDI-TRF-E3/E4). Dados preservados no banco (PDI-TRF-E7).
- **QUE-05** Indicadores calculados com a turma atual: fichas concluídas deixam de contar para a escola/turma de origem. Troca de turma: Aurora esperado 19 → 9, concluídas 3 → 1, em andamento 3 → 1 (a 6M3 só tem Arte e Matemática com professor). Entre escolas: Aurora 9/1/2 → 5/0/1; Boa Vista 0/0/0 → 2/0/1 (Ensino Religioso sem professor na Boa Vista não entra). As 3 fichas concluídas da Marina não contam em escola nenhuma.
- **QUE-06** A tela do novo professor mostra a turma/escola da fotografia da ficha ("6M1 · Aurora") sem indicar que o aluno mudou de turma (PDI-TRF-T6).
- **QUE-07** Disciplina sem professor na nova turma (ex.: Inglês do Lucas na 6M3): a ficha em andamento fica sem responsável e sai do esperado.

**Aprovados:** transferência pela interface; histórico de movimentação (turma antiga fechada, nova aberta, trajetória completa na Ficha Anual); professora anterior perde acesso (lista, tela e API: GET/PUT 403, nada gravado — a primeira rodada usou corpo vazio, erro do teste corrigido); novo professor passa a ver o aluno; ficha nova na Boa Vista nasce vazia e é gravada separada; fichas, respostas e blocos da escola anterior intactos e sem duplicação (exceto o DEF-14).

**Não testado:** Diretora/Gestor da escola anterior (não há contas no banco local), offline durante a transferência, Correções de ficha de aluno transferido, transferência de volta para a escola de origem.

### Rodada complementar (09/11/2026) — `28-pdi-transferencia-complementar.mjs`

Contas de teste criadas pela API da Secretaria no banco local (senha definida no banco, declarado): `gestor.bv@homolog.nexo` (Boa Vista), `diretora.bv@homolog.nexo` (Boa Vista), `gestor.aur@homolog.nexo` (Aurora).

| ID | Sev. | Módulo | Resumo | Evidência |
|---|---|---|---|---|
| DEF-17 | ALTO | PDI (perfil do aluno) — **não é específico de transferência** | Gestor real abre "PDI > Alunos", vê o aluno na lista, mas o perfil (`/pdi/alunos/:id`) mostra "Aluno não encontrado" — por clique, URL direta e F5, para aluno transferido (Marina) e não transferido (Larissa). A API devolve o aluno (HTTP 200). Causa lida no código: `PdiAlunoPerfil.jsx` checa acesso com `vinculosEscolares` vindos de `src/data/mockData` (dados de exemplo), não dos vínculos reais. Afeta também a Diretora (mesmo caminho `canAccessEscola`). | 28-perfil-gestor-4.png, 28-perfil-gestor-2.png, 28-perfil-gestor-clicando.png |
| DEF-18 | MÉDIO | PDI (Correções) | Secretaria consegue "Devolver ao Professor" uma ficha concluída de aluna já transferida (HTTP 201, prazo de 3 dias), mas a professora não consegue abrir a ficha (HTTP 400 "não pertence à escola atual"): devolução impossível de atender. | PDI-TRF-G5; 28-PDI-TRF-G5.png |

**Comportamentos registrados (regra a definir):**
- **G1/G2** Gestor e Diretora da nova escola: Ficha Anual lista as fichas da Aurora; ao clicar, "Esta aplicação não pertence à escola atual deste aluno" (mesmo DEF-15); API da ficha antiga 400. Perfil do aluno bloqueado pelo DEF-17.
- **G3** Gestor da escola anterior: não vê mais a aluna (API aluno 403, ficha 400) — inclusive a ficha que a própria escola produziu.
- **G4** **Secretaria lê o conteúdo da ficha antiga pelo fluxo de Correções** (`/correcoes/pdi/:fichaId`, API 200; respostas e perguntas comuns visíveis). Caminho de leitura **já existente**, só para a Secretaria. (Mesma tela também mostra as datas um dia antes — DEF-16.)
- **QUE-08 (G6)** Aluno volta para a escola de origem (Pedro Boa Vista → Aurora 6M2): a ficha antiga da Aurora volta a abrir e fica **editável** de novo pela P04 (Aplicação ainda no período); a ficha da Boa Vista passa a dar 400. Indicadores Aurora 5/0/1 → 7/0/2; Boa Vista 2/0/1 → 1/0/0.

**Estado do banco local depois:** Pedro de volta à Aurora 6M2; 3 contas novas (gestor/diretora); 1 `CorrecaoFichaPdi` ABERTA na ficha de Inglês da Marina (criada pelo teste G5).

---

# Correções de 09/11/2026 (fase de estabilização)

Ambiente: banco PostgreSQL LOCAL (`nexo_homolog`, porta 54329). Antes dos testes foi conferido que o backend e os scripts enxergam só as 2 escolas fictícias. Neon não acessado. Cada defeito foi **reproduzido antes** da correção com o mesmo roteiro usado depois (IDs `*-ANTES-*` × `*-DEPOIS-*` em `resultados.json`; capturas `30-*`, `31-*`, `32-*`, `33-*`).

## DEF-14 — CORRIGIDO (ALTO) — professor sobrescrevia as perguntas comuns de outro professor
1. **Causa:** gravação (`PUT /api/pdi-fichas/:id/respostas-padrao`), leitura (`montarBlocoParaFicha`) e conclusão localizavam o bloco de perguntas comuns pela **fotografia da ficha** (turma e professor de quando ela nasceu), e não por quem responde agora.
2. **Comportamento anterior (reproduzido):**
   - troca de turma: o P10 via e gravava o texto da P04;
   - achado novo, **substituição de professor sem transferência**: o P12 via e gravava o texto do P06.
   
   Roteiro ANTES: 6 de 12 reprovados (S3a–c, S4a–c).
3. **Arquivos:** `backend/src/domain/pdiBlocoPadrao.ts`, `backend/src/api/routes/pdiFichas.ts`.
4. **Solução (mínima):**
   - o bloco de quem preenche passa a ser o da **turma atual do aluno + professor responsável atual** (`identidadeBlocoAtual`), na leitura, na gravação e na exigência de completude ao concluir;
   - quando nada mudou, a identidade é a mesma da fotografia, então não há diferença;
   - turma sem professor responsável na disciplina: bloco só leitura e gravação recusada (403);
   - as **Correções da Secretaria continuam lendo o bloco da fotografia** (leitura histórica).
   
   Nenhuma cópia de respostas, nenhuma migration, nenhuma mudança de permissão da ficha.
5. **Testes:**
   - `30-def14-bloco-comum.mjs` (navegador real + API + banco): mesma turma com 2 professores, gravação quase simultânea, ficha concluída pela professora anterior, troca de turma, substituição de professor, troca de escola;
   - `30b-def14-complementos.mjs`: Correções mostram o original; turma sem professor; QUE-03 inalterado;
   - baterias `testar-formulario-unico.ts` (35/35) e `testar-indicadores.ts` (29/29).
6. **Resultado:** DEPOIS 12/12 + 3/3; repetido no fim (regressão) 12/12.
7. **Riscos residuais:** o novo professor precisa responder as perguntas comuns de novo (bloco próprio) para concluir uma ficha herdada. É consequência da regra 25 ("professores diferentes não compartilham"). O bloco antigo continua no banco e aparece nas Correções.
8. **Depende da Secretaria (NÃO decidido):** se o novo professor pode alterar as respostas **de disciplina** de ficha concluída por outro (QUE-03). O comportamento foi mantido como estava (`DEF14-DEPOIS-C3`).

## DEF-17 — CORRIGIDO (ALTO) — Gestor/Diretora reais não abriam o perfil do aluno PDI
1. **Causa:** `src/pages/PdiAlunoPerfil.jsx` conferia o acesso com `vinculosEscolares` de `src/data/mockData` (dados de exemplo).
2. **Comportamento anterior (reproduzido):** "Aluno não encontrado" para todo Gestor e toda Diretora reais, com a API respondendo 200. ANTES: 5 de 11 reprovados.
3. **Arquivos:** `src/pages/PdiAlunoPerfil.jsx`, `src/context/EscolaContext.jsx` (expõe `vinculosReais`; só acrescenta).
4. **Solução:**
   - o perfil usa os vínculos REAIS do `EscolaContext` (`GET /api/vinculos-escolares/me`), com as mesmas regras de antes: Gestor precisa de vínculo ativo, mesmo com escola inativa; os demais, de escola ativa e vínculo ativo;
   - enquanto carrega, a tela mostra "Carregando…" em vez de "não encontrado".
   
   Nenhuma permissão foi ampliada. O backend continua sendo a autoridade: o 403 foi conferido em todos os casos negativos.
5. **Testes:** `31-def17-perfil-aluno.mjs`, com contas reais e login de verdade: Diretora e Gestor de cada escola, em aluno próprio e de outra escola, transferido e não transferido; Secretaria e Professor.
6. **Resultado:** DEPOIS 11/11; regressão final 11/11.
7. **Riscos residuais:**
   - **Outras dependências de `mockData` encontradas e NÃO alteradas** (fora do PDI):
     - `getUserEscolaIds` e `professoresDaEscola` com vínculos de exemplo em `Pendencias.jsx`, `ListaPlanejamentos*.jsx`, `VisualizarPlanejamento.jsx`, `CorrecoesSimulados.jsx`, `ListaProfessores.jsx` e `AcompanhamentoEscolar.jsx`. São telas que também usam dados de exemplo;
     - o modal de vínculos de `GestaoEscolas.jsx`, que é uma tela real da Secretaria. A exibição pode estar incorreta; é preciso auditar.
   - **Não testado:** Gestor com vínculo em escola **inativa** (consulta histórica).

## DEF-07 — CORRIGIDO (MÉDIO/ALTO) — fila offline não era enviada ao abrir o app
1. **Causa:** `src/offline/syncQueue.js` só enviava a fila ao enfileirar com rede ou ao detectar reconexão. Na mesma rotina apareceram mais três problemas:
   - item interrompido no meio do envio ficava preso em "enviando" para sempre;
   - recusa definitiva do servidor (prazo, vínculo) era reenviada a cada sincronização;
   - sessão expirada (401) virava "erro".
2. **Comportamento anterior (reproduzido):**
   - fechar offline e reabrir com internet não enviava nada, nem no 1/3 nem no PDI;
   - depois de um novo login, também não;
   - item preso em "enviando" nunca saía.
3. **Arquivos:** `src/offline/syncQueue.js`, `src/context/AuthContext.jsx`, `src/services/api.js` (o erro passa a carregar o `status` HTTP; só acrescenta).
4. **Solução:**
   - `sincronizarAoEntrar(userId)` é chamado pelo AuthContext ao abrir ou logar **com sessão válida** (token presente, sem senha temporária pendente) e envia só a fila daquele usuário;
   - item que sobrou em "enviando" é reenviado, sob a trava de sincronização;
   - 401, senha temporária pendente e 5xx devolvem o item a "pendente". Nada é descartado;
   - recusa de negócio fica como "erro" e **não é reenviada automaticamente**. Volta a "pendente" quando o professor editar de novo;
   - a remoção da fila continua só depois de resposta 2xx, e o conflito continua dando 409, sem sobrescrita.
5. **Testes:** `32-def07-def08-offline.mjs`, cenários:
   - 1: 1/3;
   - 2: PDI;
   - 3: sessão expirada;
   - 4: dois usuários no mesmo navegador;
   - 5: envio interrompido, sem duplicar.
6. **Resultado:** ANTES, 7 reprovados nesses cenários; DEPOIS, todos aprovados (contagem total abaixo).
7. **Riscos residuais:**
   - não testado em celular físico nem no build de produção;
   - ao abrir com sessão expirada, a página vai para o login e a fila espera o novo login. É assim por desenho.
8. **Fora de escopo:** DEF-06/13 (aviso offline cobre os botões) continua aberto. Nos testes do PDI, o Salvar foi acionado pelo teclado.

## DEF-08 — CORRIGIDO (MÉDIO) — conflito vindo da fila sem opções e "Salvo" falso
1. **Causa:**
   - a tela do 1/3 marcava "Salvo" quando o salvamento ia só para a fila;
   - ao reabrir, a tela não consultava a fila, então o conflito ficava invisível;
   - o **rascunho recuperado era aplicado sobre a versão mais nova do servidor e reenviado com essa versão**, sobrescrevendo em silêncio o que outro aparelho tinha salvo (reproduzido em `OFF-ANTES-6c`);
   - Anamnese, Correções e formulários do PDI também mostravam "Salvo" ou "Respostas salvas." quando a gravação só tinha ido para a fila.
2. **Arquivos:**
   - `src/pages/UmTercoPreenchimentoPage.jsx`;
   - `src/components/SavingIndicator.jsx`: novo estado "Salvo só neste aparelho"; "Sincronizado" passa a significar confirmado pelo servidor;
   - `src/pages/FormularioPdiAlunoPage.jsx`, `src/pages/FormularioPdiProfessor.jsx`, `src/pages/AnamnesePage.jsx`, `src/pages/CorrecoesPdiDetalhePage.jsx`.
3. **Solução:**
   - o rascunho do 1/3 guarda a versão do servidor sobre a qual foi escrito;
   - ao reabrir, se o servidor mudou depois, ou se a fila marcou conflito, a tela mostra "Usar a versão salva" e "Manter o meu texto";
   - **nada é enviado** até o professor escolher, nem ao trocar de semana nem ao sair;
   - se o texto local já é igual ao do servidor, a tela resolve sozinha, sem falso conflito;
   - salvamento confirmado limpa a fila daquele formulário;
   - "Usar a versão salva" descarta o envio pendente.
   
   Nenhuma política de sobrescrita automática foi criada.
4. **Testes:** `32-def07-def08-offline.mjs`, cenários 1a/1b (indicador), 2a (mensagem do PDI) e 6a–6d (conflito, opções, troca de semana com conflito aberto, "Manter", "Usar a versão salva").
5. **Resultado:** a primeira rodada DEPOIS achou um furo real: trocar de semana com o conflito aberto ainda enviava e sobrescrevia. Corrigido. Rodada final: 14/14.
6. **Riscos residuais (identificados na leitura do código; NÃO corrigidos e NÃO reproduzidos):**
   - o **formulário do PDI** recupera rascunhos sem guardar a versão de referência. Ao salvar, pode sobrescrever uma alteração mais recente feita em outro aparelho nas mesmas perguntas. É a mesma classe do problema do 1/3. Registrado como **DEF-19 (MÉDIO, a confirmar)**;
   - o conflito do PDI continua só com a mensagem "recarregue a página", sem opções.

## Contagem desta fase
- **Navegador real + banco:**
  - DEF-14: 12/12, mais 3 complementares;
  - DEF-17: 11/11;
  - DEF-07/08: 14/14;
  - regressão: 13/13 (login, permissões, 7 cartões do professor com vários vínculos, persistência do PDI);
  - repetição final: DEF-14 12/12 + 3/3 e DEF-17 11/11.
- **Baterias automatizadas (API real, banco local):**
  - regras do 1/3: 20/20;
  - integração do 1/3: 50/50, sem resíduo;
  - formulário único do PDI: 35/35;
  - indicadores do PDI: 29/29;
  - calendário: 92/92;
  - CRMG **não executado** (catálogo ausente no banco local).
- **Rodadas ANTES (comprovação de cada defeito):**
  - DEF-14: 6 de 12 reprovados;
  - DEF-17: 5 de 11;
  - DEF-07/08: 10 reprovados de 13 executados; 1 interrompido por falta dos botões de conflito.
- **Não reexecutados** (dependem do estado do banco, que já mudou):
  - script 03 (primeiro acesso): as senhas temporárias já foram trocadas;
  - scripts 10–12 e 22–23: substituídos pelo 32;
  - scripts 25–28: substituídos pelo 30, que cobre troca de turma, troca de escola e substituição de professor com alunos novos.

## DEF-19 — CONFIRMADO E CORRIGIDO (MÉDIO→ALTO) — PDI sobrescrevia em silêncio a versão mais recente de outro aparelho
1. **Causa:** os dois formulários do PDI (formulário único do professor, `FormularioPdiAlunoPage.jsx`, e ficha única do Gestor, `FormularioPdiProfessor.jsx`) recuperavam o rascunho do aparelho misturando-o sobre a versão **mais nova** do servidor. O "Salvar" e o "Voltar" enviavam com a versão de referência atual (`ficha.updatedAt` / `bloco.version`), então o servidor aceitava e o texto salvo depois em outro aparelho era apagado.
2. **Reprodução em navegador real** (dois contextos da mesma professora; `34-def19-pdi-sobrescrita.mjs`):
   - **R1:** rascunho não salvo;
   - **R2:** edição offline na fila.
   
   Nas duas variantes, ao reabrir, o aparelho A mostrava o próprio texto sem aviso. "Salvar" apagou o texto do aparelho B, nas respostas da disciplina e nas perguntas comuns, e mostrou "Respostas salvas." ANTES: 4 de 6 reprovados. A fila enviada ao abrir (DEF-07) **não** sobrescreveu: o servidor devolveu 409. Na tela do Gestor (`34b-def19-gestor.mjs`), "Voltar" gravou o texto de A por cima, sem aviso (ANTES: 2 de 2 reprovados).
3. **Arquivos:** `src/utils/pdiFicha.js` (`analisarRascunho`, `MENSAGEM_CONFLITO_RASCUNHO`), `src/pages/FormularioPdiAlunoPage.jsx`, `src/pages/FormularioPdiProfessor.jsx`.
4. **Solução (só a causa técnica; nenhuma regra nova):**
   - o rascunho passa a guardar `base`, a versão do servidor sobre a qual foi escrito;
   - ao reabrir, se o servidor mudou depois (ou o rascunho é antigo, sem `base`, e o servidor tem outra resposta), o rascunho **não é misturado**. Os campos mostram a versão salva, o texto deste aparelho fica visível num aviso, e o usuário escolhe "Usar a versão salva" ou "Restaurar o meu texto";
   - até a escolha, aquela parte fica travada, nada dela é enviado e o "Salvar" informa "Algumas partes não foram salvas", **sem sucesso falso**;
   - rascunho igual ao servidor é descartado;
   - salvamento confirmado limpa o envio antigo daquela ficha ou bloco na fila.
   
   Os dois trabalhos ficam preservados até a escolha: o do outro aparelho no servidor, o deste aparelho no rascunho.
5. **Resultado:** DEPOIS, formulário único 8/8 (incluindo "Restaurar o meu texto" e "Usar a versão salva", fila vazia ao final) e tela do Gestor 2/2.
6. **Riscos residuais:**
   - o conflito detectado **no momento do salvamento** (409 com a tela aberta) continua com a mensagem "recarregue a página". Ao recarregar, cai neste novo fluxo com as opções;
   - **agrupamento do bloco comum:** no formulário único, o agrupamento ainda usa o professor gravado na fotografia da ficha. Um aluno transferido com fichas criadas por dois professores diferentes, que passam ao mesmo professor novo, pode mostrar o bloco duas vezes. O servidor responde 409 e nada se perde, mas a tela fica confusa. Não reproduzido.

## DEF-06 / DEF-13 — CORRIGIDO (MÉDIO) — aviso de sem conexão cobria os botões
1. **Causa:** o aviso global (`SyncStatusBanner`, fixo no rodapé, `z-40`) ocupava a faixa inteira por cima da barra de ações do 1/3 (`z-30`). No PDI, cobria o "Salvar" do fim da página.
2. **Antes (roteiro 35, desktop e celular):** "Próximo" e "Salvar progresso" do 1/3 e "Salvar" do PDI estavam cobertos. Para conferir, o teste olha qual elemento fica no centro do botão. ANTES: 4 de 4 reprovados.
3. **Arquivos:** `src/components/SyncStatusBanner.jsx` e `src/pages/UmTercoPreenchimentoPage.jsx` (só a marcação `data-barra-acoes-fixa` na barra).
4. **Solução:**
   - só a caixa do aviso recebe cliques; o resto da faixa deixa passar;
   - se a tela tem barra de ações fixa, o aviso sobe para cima dela;
   - enquanto o aviso está visível, a página ganha espaço no fim, para o último botão poder rolar para cima dele.
5. **Resultado:** DEPOIS 4/4, em desktop e celular. O aviso continua visível.

## DEF-01 — CORRIGIDO (MÉDIO) — troca rápida de semana com rede lenta
1. **Causa:** "Próximo" e as abas **esperavam** o salvamento terminar antes de trocar de semana, e a semana antiga continuava editável. A leitura do código mostrou mais dois problemas ligados a isso:
   - ao terminar um salvamento, a tela marcava tudo como salvo e **apagava o rascunho**, mesmo que o professor tivesse digitado algo **durante** o envio;
   - com um envio em andamento, um novo salvamento devolvia "ok" sem enviar, e o Sair ou o Concluir podiam seguir sem o último texto.
2. **Antes (roteiro 35, atraso de 2,5 s nas gravações):**
   - 300 ms depois de "Próximo", a tela ainda estava na Semana 1 e o texto digitado foi para a Semana 1 (DEF01-a reprovado);
   - **o texto digitado durante um salvamento se perdeu**: só a primeira parte chegou ao banco (DEF01-b reprovado).
   
   A primeira rodada do DEF01-c tinha um erro do teste (clicou no "Sair" do cabeçalho) e foi descartada.
3. **Arquivo:** `src/pages/UmTercoPreenchimentoPage.jsx`.
4. **Solução:**
   - a troca de semana acontece **na hora**, e o salvamento segue em segundo plano com o texto já capturado;
   - se algo mudou durante o envio, o formulário continua "sujo", o rascunho não é apagado e o próximo envio leva o resto;
   - quem pede um salvamento com outro em andamento **espera** esse terminar e então envia o que faltar. Sair e Concluir nunca seguem sem o último texto.
5. **Resultado:** DEPOIS 3/3:
   - texto na Semana 2 com a Semana 1 intacta;
   - as duas partes digitadas durante o salvamento chegaram ao banco;
   - Sair esperou o envio da Semana 4.
