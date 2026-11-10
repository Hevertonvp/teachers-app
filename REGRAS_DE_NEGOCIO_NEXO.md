# Regras de Negócio — NEXO

> Referência funcional do NEXO (nome provisório do sistema pedagógico municipal).
> Versão de 09/11/2026. Consolida as regras anteriores (`CLAUDE_CONTEXT.md`, seções 1–100), as nove decisões discutidas após a homologação (`CLAUDE_CONTEXT.md`, seção 101-A), o relatório de homologação (`RELATORIO_HOMOLOGACAO_NEXO_PDI_1_3.md`) e os defeitos (`homologacao/DEFEITOS.md`).
> O código foi lido em 09/11/2026 para conferir o que está implementado. **Este documento não altera nenhuma regra nem código.**

## Como ler este documento

**Status de cada regra**

| Status | Significado |
|---|---|
| **Implementada** | Existe no código hoje (conferido em 09/11/2026). Não significa que foi aprovada pela Secretaria. |
| **Definida pelo usuário** | O responsável pelo projeto registrou como regra definitiva (antes ou durante a homologação). Não há registro formal de aprovação pela Secretaria. |
| **Proposta (pendente Secretaria)** | Proposta técnica do usuário com o Claude, nas decisões de 09/11/2026. **Não aprovada pela Secretaria. Não implementar antes da aprovação.** |
| **Pendente** | Sem definição. Precisa de decisão. |
| **Divergência** | O código faz algo diferente da regra registrada. |

> **Importante:** até 09/11/2026 **nenhuma regra tem aprovação formal registrada da Secretaria**. O comportamento atual do código **não** é automaticamente regra oficial; quando código e regra diferem, a divergência está marcada.

**Formato de cada regra:** identificador, regra, exemplo, origem, status, módulos, exceções, dependências e testes.
Os testes citam a matriz da homologação (`homologacao/resultados.json` e `MATRIZ_DE_EXECUCAO.csv`, IDs como `UT-T-S01` e `PDI-TRF-T8`) e as baterias do backend (`backend/scripts/umTerco/testar-dominio.ts`, 20 casos; `testar-integracao.ts`, 50 casos).

---

## 1. Visão geral do NEXO

- **O que é:** um sistema da rede municipal de ensino para acompanhamento pedagógico. Os módulos principais são o **PDI** (Plano de Desenvolvimento Individual do aluno) e o **Formulário 1/3** (registro semanal dos conteúdos ensinados por professor). Também há Correções, Ficha Anual, Indicadores, Anamnese, Mensagens, Feedback do Sistema e notificações.
- **Arquitetura:**
  - Frontend React (GitHub Pages) e backend Node/Express/Prisma (Render), sobre PostgreSQL (Neon).
  - O frontend é **só um cliente da API**. Outros clientes devem poder consumir a mesma API (`CLAUDE.md`).
- **Escopo real:** 12 escolas oficiais, incluindo CMEI e creche. A lista está no `CLAUDE_CONTEXT.md`, seção 13.
- **Princípios gerais vigentes:**
  - permissões por **vínculo vivo**, nunca pelo retrato histórico;
  - **não duplicar** identidades nem preenchimentos;
  - **não apagar histórico**, com uma exceção proposta (EXC-01);
  - nada pode ser sobrescrito em silêncio;
  - não inventar regra pedagógica.

---

## 2. Perfis e permissões

**PER-01 · Secretaria**
- **Regra:** administra a rede. Configura trimestres, escolas, turmas e pessoas; cuida dos Modelos e Aplicações PDI, das reaberturas, das Correções (corrigir ou devolver) e do Formulário 1/3 (criar, configurar, reabrir, acompanhar). **Não preenche ficha PDI**: só consulta e corrige pelo fluxo de Correções.
- **Exemplo:** a Secretaria cria a Aplicação PDI do 3º trimestre da E. M. Três Marias.
- **Origem:** usuário (contexto §5, §81). **Status:** Implementada. **Módulos:** todos.
- **Testes:** UT-PERM-*, PDI-AUT-*.

**PER-02 · Diretora**
- **Regra:** vinculada a exatamente uma escola e atua só nela. Administra os professores da própria escola, inclusive criando e encerrando vínculos e desativando professor. No PDI, só **consulta**. Não cria Modelos nem Aplicações.
- **Exemplo:** a Diretora da Escola A desativa um professor da Escola A, mas não de outra escola.
- **Origem:** usuário (§6). **Status:** Implementada no servidor.
- **Divergência:** a tela do perfil do aluno bloqueia Diretora e Gestor reais (**DEF-17**).
- **Depende de:** VIN-02. **Testes:** PDI-TRF-G2. Perfil da Diretora não homologado.

**PER-03 · Gestor / Supervisora**
- **Regra:** vinculado a uma ou mais escolas. Pode preencher e editar fichas PDI conforme a regra atual. Não administra Modelos nem Aplicações. Não reabre.
- **Origem:** usuário (§7). **Status:** Implementada no servidor.
- **Divergência:** DEF-17. O Gestor real não abre o perfil do aluno, e é pelo perfil que ele chega às fichas.
- **Testes:** PDI-TRF-G1. Perfil do Gestor não homologado.

**PER-04 · Professor**
- **Regra:** pode ter várias escolas, turmas e disciplinas, e várias disciplinas na mesma turma. Vê e edita só o que os vínculos ativos permitem.
- **Origem:** usuário (§8). **Status:** Implementada.
- **Testes:** UT-P04-*, PDI-P04-*, PDI-MULTI-*, PDI-AUT-*.

**PER-05 · Auxiliar**
- **Regra:** ligado a turmas (no máximo um ativo por turma, podendo ter várias turmas). Só consulta e não edita o PDI.
- **Origem:** usuário (§9, §17). **Status:** Implementada. **Testes:** não homologado.

**PER-06 · Suporte do Sistema**
- **Regra:** perfil separado, sem vínculo escolar. Acessa só a área global de Feedback. A conta é criada só por script.
- **Origem:** usuário (§10). **Status:** Implementada. A conta ainda não foi provisionada.

**PER-07 · Autorização sempre por vínculo vivo**
- **Regra:** quem pode ver ou editar é calculado pelo estado **atual** dos vínculos. O retrato gravado na ficha ou na entrega (nome do professor, turma, escola da época) serve só para exibição e histórico. Nunca concede acesso.
- **Exemplo:** depois da troca de professor, o nome antigo continua na ficha, mas quem edita é o novo.
- **Origem:** usuário (§15, §100). **Status:** Implementada. **Módulos:** PDI, 1/3.
- **Exceções:** Correções da Secretaria, que leem pela escola gravada na ficha (ver TRF-05).
- **Testes:** PDI-TRF-T3/T4, UT-PERM-*.

**PER-08 · Acesso e senha**
- **Regra:** autenticação por JWT. A pessoa criada recebe uma senha temporária única, válida por 48 h. O primeiro login obriga a troca. A senha definitiva tem no mínimo 8 caracteres. `authVersion` invalida sessões, por exemplo ao inativar alguém.
- **Origem:** usuário (§11). **Status:** Implementada.
- **Testes:** PA-P01-01 a 11, PA-P04-01 a 11.

**PER-09 · Formulário 1/3: quem acessa**
- **Regra:**
  - **Secretaria:** cria, configura, acompanha, reabre e consulta tudo.
  - **Professor:** vê só as próprias entregas elegíveis.
  - **Demais perfis:** **sem acesso**. Não inventar consulta de Diretora ou Gestor sem perguntar.
- **Origem:** usuário (§81). **Status:** Implementada. **Testes:** UT-PERM-*.

---

## 3. Escolas, turmas, professores e vínculos

**VIN-01 · Escola**
- **Regra:** só a Secretaria cria, edita, inativa e reativa escolas. Uma escola inativa sai das regras de elegibilidade do 1/3 durante o ciclo (ver UT-08).
- **Origem:** usuário. **Status:** Implementada.
- **Testes:** desativação de escola **não homologada**.

**VIN-02 · Vínculo escolar (pessoa × escola)**
- **Regra:** liga qualquer perfil a uma escola e nunca é apagado.
  - **Encerrar** o vínculo escolar encerra, na mesma operação, os vínculos de turma (professor e auxiliar) **daquela escola**.
  - **Reativar** o vínculo escolar **não** recria os vínculos de turma.
  - Encerrar o vínculo escolar não inativa a pessoa.
- **Exemplo:** professor que sai da Escola A perde as turmas da A, mas mantém as da Escola B.
- **Origem:** usuário. **Status:** Implementada. **Testes:** não homologado diretamente.

**VIN-03 · Professor × turma × disciplina**
- **Regra:** no máximo **um professor ativo por turma + disciplina**, garantido por índice único no banco. Atribuir outro professor **encerra o anterior automaticamente**, com data de hoje. Um professor pode ter vários vínculos.
- **Exemplo:** o prof. Caio assume Matemática no 6M1; o vínculo da prof. Ana termina na mesma data.
- **Origem:** usuário (§16). **Status:** Implementada.
- **Testes:** UT-P04-*, UT-VIN-*.

**VIN-04 · Pré-requisitos do vínculo de turma**
- **Regra:** só é criado para turma ativa, professor ativo e professor com vínculo escolar ativo na escola da turma.
- **Origem:** usuário. **Status:** Implementada. **Testes:** wizard de cadastro (homologação, fase 2).

**VIN-05 · Data de início do vínculo = data do cadastro**
- **Regra:** o vínculo começa na data em que é cadastrado no Nexo. Para o 1/3, o professor participa a partir dessa data, independentemente de quando começou na escola. Não há data de início retroativa, edição retroativa nem recálculo de ciclos anteriores.
- **Exemplo:** professor que começou em 01/11 e foi cadastrado em 12/11 não participa de um ciclo com prazo em 10/11.
- **Origem:** Decisão 6. **Status:** Implementada (comportamento atual); como regra, **Proposta (pendente Secretaria)**.
- **Módulos:** vínculos, 1/3. O PDI não usa datas de vínculo.
- **Testes:** PA (19 vínculos com início no cadastro), UT-VIN-P10.

**VIN-06 · Encerramento manual de vínculo docente**
- **Regra atual:**
  - Secretaria ou Diretora encerram pelo botão "Encerrar" na Gestão de Pessoas.
  - A data de fim é **hoje**. Não há motivo, registro de autor, confirmação nem verificação de pendências.
  - Há dois outros caminhos que encerram vínculo: a substituição de professor (VIN-03) e o encerramento do vínculo escolar (VIN-02).
- **Origem:** implementação. **Status:** Implementada.
- **Proposta (Decisão 1):** ao encerrar, mostrar as pendências afetadas e oferecer o cancelamento em lote (CAN-01).
- **Contradição a resolver:** data de fim retroativa (ver auditoria, CT1).
- **Testes:** UT-VIN-P08 (DEF-09).

**VIN-07 · Turma**
- **Regra:** turmas têm etapa e ano/série **estruturados**. Nunca deduzir a série do nome ("6M1"). Nomes podem se repetir entre escolas. Só a Secretaria cria e inativa turmas.
- **Origem:** usuário (§74). **Status:** Implementada.
- **Testes:** UT-T-*, homologação fase 2 (turma "6M1" nas duas escolas).

**VIN-08 · Desativar ≠ encerrar vínculo**
- **Regra:** desativar turma, professor ou escola muda só o status. Os vínculos de turma continuam ativos, e reativar devolve tudo. Inativar o professor também derruba as sessões dele.
- **Origem:** implementação. **Status:** Implementada.
- **Proposta (Decisão 2):** ao desativar com um ciclo do 1/3 aberto, mostrar as pendências e oferecer "Cancelar todas" ou "Manter" (CAN-01).
- **Testes:** UT-EST-01 a 07.

**VIN-09 · Pessoa com e-mail já existente**
- **Regra:** professor cadastrado com um e-mail que já existe reaproveita a mesma pessoa e ganha um novo vínculo. Colisão com outro perfil é bloqueada.
- **Origem:** usuário (§11). **Status:** Implementada.

---

## 4. Calendário e ano letivo

**CAL-01 · Calendário de trimestres por ano**
- **Regra:** cada ano tem 1º, 2º e 3º trimestres (`PeriodoTrimestre`). Só a Secretaria altera. Não existe calendário paralelo.
- **Origem:** usuário (§28, §62). **Status:** Implementada.
- **Testes:** UT-T-S13 (ano sem calendário recusado).

**CAL-02 · Aplicação PDI exige calendário completo**
- **Regra:** o ano precisa ter os 3 trimestres válidos. O trimestre da Aplicação é derivado da data de início. Nunca criar Aplicação com trimestre nulo.
- **Origem:** usuário (§29, §31). **Status:** Implementada.

**CAL-03 · Datas de 2026 não são oficiais**
- **Regra:** 1º de 02/02 a 30/04; 2º de 01/05 a 15/08; 3º de 16/08 a 18/12. Essas datas podem ter vindo de um exemplo e não devem ser tratadas como oficiais. As de 2027 não devem ser inventadas.
- **Origem:** usuário (§30–31). **Status:** **Pendente** (confirmação da Secretaria).

**CAL-04 · Fuso operacional**
- **Regra:** todas as datas e horas de abertura e prazo usam America/Sao_Paulo.
- **Origem:** implementação. **Status:** Implementada.
- **Divergência:** DEF-16. A Ficha Anual e as Correções mostram as datas da Aplicação um dia antes.

**CAL-05 · Formulário 1/3 dentro do trimestre**
- **Regra:** abertura, prazo e todas as semanas do ciclo ficam **dentro do mesmo trimestre**, com limites inclusivos.
- **Exemplo:** um ciclo do 3º trimestre de 2026 precisa abrir e ter prazo entre 16/08 e 18/12.
- **Origem:** usuário (§62). **Status:** Implementada.
- **Consequência:** ver a auditoria, G.
- **Testes:** UT-T-S*, testar-dominio.

---

## 5. Formulário 1/3

**UT-01 · Escolas atendidas pelo ciclo** *(mudou em 10/11/2026)*
- **Regra:** ao criar o Formulário 1/3, a Secretaria escolhe **as escolas que ele atende**, ou marca **"Todas as escolas"** (padrão).
  - "Todas" vale também para escolas criadas depois.
  - Com escolas escolhidas, só entram turmas (do Fundamental, com vínculo elegível) dessas escolas: um professor de Matemática do 6º ano nas escolas A e B, num ciclo só da A, tem a entrega valendo só para as turmas da A.
  - Escola com preenchimento iniciado no ciclo não pode ser retirada dele.
  - Escola inativa não pode ser escolhida (a que já estava no ciclo pode continuar).
  - A Educação Infantil continua fora pela estrutura da turma. Não usa `EscolaModulo` nem script.
- **Origem:** usuário, 10/11/2026 ("devemos escolher as escolas que ele vai atender, assim como no PDI"). **Substitui** a regra "1/3 global" (§72, §73, §82), que foi confirmada como substituída. **Status:** Implementada.
- **Ciclos que já existiam:** ficaram como "Todas as escolas", ou seja, o mesmo comportamento de antes.
- **Diferença do PDI:** o PDI cria uma Aplicação por escola; o 1/3 é **um ciclo com uma lista de escolas**, porque a entrega é por professor + ano/série + disciplina (UT-02).
- **Testes:** testar-integracao (ciclos "todas"), UT-ESC-1 a 8, UT-VIN-P14.

**UT-02 · Identidade do preenchimento**
- **Regra:** **um** formulário por ciclo + professor + ano/série + disciplina, valendo para todas as turmas e escolas desse ano/série ("todo sexto é sexto"). Escola e turma não fazem parte da identidade.
- **Exemplo:** Ana dá Matemática no 6M1 e no 6M2 da Escola A e no 6M1 da Escola B: é 1 formulário de Matemática do 6º ano. Ciências do 6º, Matemática do 7º ou outro ciclo são formulários diferentes.
- **Origem:** usuário (§56–58; confirmado em 04/11/2026). **Status:** Implementada (índice único no banco).
- **Depende de:** VIN-03, VIN-07.
- **Testes:** testar-integracao (identidade), UT-P04-* (7 formulários para 8 vínculos).

**UT-03 · Cobertura**
- **Regra:** o formulário guarda a quais turmas e escolas vale. Um vínculo equivalente novo durante a janela entra na **mesma** entrega. Um vínculo encerrado recebe data de fim na cobertura, e a entrega não some.
- **Origem:** usuário (§65–67). **Status:** Implementada.
- **Testes:** testar-integracao (cobertura), UT-P04 (2 coberturas).

**UT-04 · Vários ciclos por trimestre, sem janelas sobrepostas na mesma escola**
- **Regra:** pode haver vários ciclos no mesmo trimestre, mas as **janelas originais** (abertura → prazo) de ciclos ativos **que atendem alguma escola em comum** nunca se sobrepõem, inclusive pela fronteira exata. "Todas as escolas" tem escola em comum com qualquer ciclo. Ciclos de escolas diferentes podem coincidir (decisão do usuário, 10/11/2026). A validação é feita no servidor, com trava contra concorrência.
- **Exemplo:** ciclo A de 05/03 a 15/03 e B de 20/03 a 30/03 são válidos. A de 05/03 a 20/03 e B de 15/03 a 25/03 são recusados.
- **Origem:** usuário (§69–71). **Status:** Implementada.
- **Exceção proposta:** uma reabertura pode coincidir com outro ciclo (PRZ-03).
- **Testes:** UT-T-S01 a S09, testar-integracao (concorrência), homologação (5 cenários, 0 pares sobrepostos).

**UT-05 · Período de referência × janela de disponibilidade**
- **Regra:** as **semanas** do ciclo são o período pedagógico de referência. A **abertura e o prazo** são a janela em que o professor pode preencher. As semanas podem ser anteriores à abertura, sempre dentro do mesmo trimestre (CAL-05). São de 1 a 30 semanas, rotuladas pelo sistema ("Semana N").
- **Exemplo:** ciclo aberto de 10/11 a 20/11 sobre as semanas de 03/11 a 14/11.
- **Origem:** usuário (§60–61; distinção confirmada em 09/11/2026 e de novo em 10/11/2026: "uma coisa não tem nada a ver com a outra"). **Status:** Implementada. Nenhum campo novo é necessário.
- **Regras das semanas (decisão do usuário, 10/11/2026; implementada no frontend e no backend):**
  - fim não antes do início;
  - em ordem e sem sobreposição: cada semana começa depois do fim da anterior;
  - **buracos entre semanas são permitidos** (feriado, recesso) e o **tamanho é livre** (não precisa ter 7 dias);
  - **nenhuma semana termina depois do prazo de entrega**;
  - as datas são preenchidas à mão (a divisão automática pela janela foi descartada pelo usuário).
- **Consequência:** um ciclo antigo com semana depois do prazo (ex.: o #1 local, Semana 4 de 23 a 27/11 com prazo em 20/11) só volta a ser salvo depois de corrigido (estender o prazo ou ajustar a semana). A reabertura não é afetada.
- **Testes:** testar-dominio, UT-MODAL-*.

**UT-06 · Abertura atual ou futura**
- **Regra:** a abertura de um **novo** ciclo deve ser hoje ou no futuro, nunca retroativa. O prazo vem depois da abertura, dentro do trimestre, sem sobreposição.
- **Origem:** Decisão 3. **Status:** **Implementada em 10/11/2026 por decisão do usuário** ("só no futuro", interpretado como hoje ou depois).
- **Como ficou:** a abertura é só uma data (00:00) e o prazo vai até 23:59. A data da abertura precisa ser hoje ou depois. Em ciclo existente, a regra só vale se a data da abertura mudar: um ciclo já aberto pode ser editado sem mexer nela.
- **Depende de:** CAL-05.
- **Testes:** UT-MODAL-2/2b/9/10. Os roteiros antigos UT-T-S10/S12, que criavam ciclos no passado, agora esperariam recusa (não reexecutados).

**UT-07 · Preenchimento e conclusão**
- **Regra:**
  - O rascunho é salvo localmente e enviado ao trocar de etapa.
  - "Próximo" nunca conclui.
  - **Concluir** exige todas as semanas preenchidas e conexão.
  - O clique duplo não gera dois eventos.
  - O texto de cada semana tem no máximo 10.000 caracteres.
  - O sistema não pede nome, e-mail, unidade, turno nem cargo.
- **Origem:** usuário (§59–60, §76–77). **Status:** Implementada.
- **Divergência:** DEF-01 (texto vai para a semana errada com rede lenta).
- **Testes:** UT-P04-*, UT-DEF-01.

**UT-08 · Edição depois de concluir**
- **Regra:** o professor pode editar enquanto a janela (original ou de reabertura) estiver aberta, mesmo depois de concluir.
- **Comportamento atual:** o status continua "Concluída" e a data de conclusão não muda. A edição aparece só no histórico de eventos.
- **Origem:** usuário (§63). **Status:** Implementada.
- **Ponto não testado:** pela leitura do código, apagar o texto de uma semana deixa a entrega concluída com semana vazia.
- **Testes:** UT-PRZ-07, testar-integracao (edição após concluir).

**UT-09 · Quem é "esperado"**
- **Regra:** conta como esperado quem teve vínculo elegível em algum momento **dentro da janela** do ciclo. Vínculo que começou depois do prazo não entra.
- **Origem:** usuário (§68, "regra definitiva"). **Status:** Implementada.
- **Divergências:**
  - DEF-09: quem teve o vínculo encerrado na janela continua esperado, mas não consegue preencher.
  - Com o ciclo em andamento, vínculo de turma, professor ou escola **inativos** é ignorado (a obrigação some). **Depois do prazo** esse filtro não se aplica, e pela leitura do código a obrigação **volta**. Isso não foi testado.
- **Propostas:** Decisões 1 e 2 (CAN-01) e esperado igual durante e depois do ciclo.
- **Testes:** UT-VIN-*, UT-EST-03/04.

**UT-10 · Painel da Secretaria**
- **Regra:** mostra esperado, concluído, em andamento, não iniciado e percentual. Cada entrega conta **uma** vez, e a cobertura por escola aparece separada. Há filtros por escola, ano/série, disciplina, professor e status.
- **Origem:** usuário (§80). **Status:** Implementada.
- **Testes:** UT-VIN-PAINEL1b (contagem manual de 21 = painel).

**UT-11 · Concorrência**
- **Regra:** a entrega é única no banco, e as gravações da mesma entrega são serializadas. Gravação desatualizada recebe **409**, e a tela oferece "Usar versão salva" ou "Manter meu texto". Nunca há sobrescrita silenciosa.
- **Origem:** usuário (§78). **Status:** Implementada.
- **Divergência:** DEF-08 (conflito vindo da fila offline fica sem opções).
- **Testes:** testar-integracao (409 de duas abas), UT-OFF-09/10.

**UT-12 · Histórico da entrega**
- **Regra:** registra início, salvamentos (agrupados por 10 minutos), conclusão e mudanças de cobertura, com autor e data.
- **Origem:** usuário (§79). **Status:** Implementada.
- **Exceção proposta:** EXC-01 apaga esse histórico junto com o ciclo.

**UT-13 · Inativar ciclo**
- **Regra:** **MUDOU em 10/11/2026 (decisão do usuário):** pode inativar a qualquer momento, mesmo com preenchimentos. Antes de confirmar, a tela avisa quantos preenchimentos já foram iniciados. Nada é apagado: o ciclo some da lista do professor, libera a janela e volta inteiro ao reativar. Reativar é recusado se a janela coincidir com a de outro ciclo. (Antes: só era permitido enquanto nenhum professor tinha começado.)
- **Origem:** implementação; alterada pelo usuário. **Status:** Implementada.
- **Testes:** UT-ED-02, UT-ED-04; `homologacao/52-inativar-um-terco-com-preenchimentos.mjs` (3/3).

---

## 6. PDI

**PDI-01 · Aluno com identidade única**
- **Regra:** o aluno nunca é duplicado por troca de turma, de escola, de ano ou por transferência.
- **Origem:** usuário (§18). **Status:** Implementada.
- **Testes:** PDI-TRF-T0/E2 (mesmo `alunoId`).

**PDI-02 · Modelos e retrato da Aplicação**
- **Regra:** há um Modelo por disciplina, no máximo um ativo. A Aplicação **congela** um retrato dos Modelos, e a ficha nunca lê o Modelo vivo. Modelo já usado não é apagado de forma destrutiva.
- **Origem:** usuário (§20). **Status:** Implementada.

**PDI-03 · Pergunta padrão × compartilhada**
- **Regra:** "padrão" significa que a pergunta nasce em todo Modelo novo, e pode ser compartilhada ou por disciplina. As perguntas compartilhadas (adaptação, participação, comunicação) têm uma resposta por professor e aluno. As perguntas do CRMG **nunca** são compartilhadas: o servidor bloqueia e há uma restrição no banco.
- **Origem:** usuário (§21–24). **Status:** Implementada.

**PDI-04 · Bloco de perguntas comuns pertence ao professor que escreveu**
- **Regra:** a identidade do bloco é Aplicação + aluno + turma + professor. **Professores diferentes não compartilham.** O mesmo professor reutiliza o bloco em todas as suas disciplinas daquela turma. O controle de conflito é por `version`.
- **Exemplo:** P02 e P04 têm blocos separados sobre o mesmo aluno (PDI-MULTI-03).
- **Origem:** usuário (§25). **Status:** Implementada.
- **Divergência:** **DEF-14**. Depois da troca de turma, o novo professor grava no bloco da professora anterior e sobrescreve o texto dela sem histórico.
- **Testes:** PDI-MULTI-02 a 04, PDI-TRF-T8.

**PDI-05 · Aplicação**
- **Regra:** pertence a **uma escola** e pode ter vários Modelos. Aplicações da mesma escola não se sobrepõem. A data de início não pode ser anterior a hoje.
- **Origem:** usuário (§27). **Status:** Implementada.
- **Divergência:** DEF-11 (a data passada é barrada só pelo balão do navegador).
- **Testes:** PDI-SET-03, PDI-TRF-E0.

**PDI-06 · Perguntas por trimestre**
- **Regra:** uma pergunta com trimestre definido só entra na Aplicação daquele trimestre. Sem trimestre, entra sempre. O professor não escolhe.
- **Origem:** usuário (§32). **Status:** Implementada.

**PDI-07 · Ficha**
- **Regra:**
  - Ficha = Aplicação + aluno + disciplina, única, criada sob demanda.
  - Status: PENDENTE, EM_ANDAMENTO e CONCLUIDA.
  - Permite salvar parcialmente e concluir.
  - **Edição depois de concluir é permitida enquanto o período estiver aberto.**
  - Depois do prazo, fica somente leitura. A reabertura da Aplicação libera de novo.
- **Origem:** usuário (§37). **Status:** Implementada.
- **Testes:** PDI-P04-01 a 08, PDI-PRZ-01/02.

**PDI-08 · Formulário único por aluno**
- **Regra:** o professor com várias disciplinas abre uma tela única por aluno, com o bloco comum uma vez e um bloco por disciplina. Cada ficha é salva separadamente, e a falha numa não desfaz as outras. "Concluir todas" executa cada conclusão.
- **Origem:** usuário (§33–36). **Status:** Implementada.
- **Divergência:** DEF-13 (o aviso de offline cobre o Salvar).
- **Testes:** PDI-P04-*.

**PDI-09 · Responsável calculado na hora**
- **Regra:** o responsável pela ficha é o professor com vínculo **ativo** na turma **atual** do aluno, naquela disciplina. O retrato da ficha (turma, escola e professor de quando ela foi criada) serve só para exibição.
- **Origem:** usuário (§37, §23 do pedido original). **Status:** Implementada.
- **Testes:** PDI-VIN-01/02, PDI-TRF-T3 a T5.

**PDI-10 · Quem preenche**
- **Regra:** o professor responsável preenche. O Gestor pode preencher e editar conforme a regra atual. Diretora, Auxiliar e Secretaria só consultam; a Secretaria corrige pelas Correções.
- **Origem:** usuário (§5–9). **Status:** Implementada no servidor.
- **Divergência:** DEF-17 na tela.

**PDI-11 · Correções**
- **Regra:** há dois fluxos, um da ficha e outro do bloco comum. A Secretaria corrige diretamente ou devolve ao professor. **MUDOU em 10/11/2026:** o fluxo completo de devolução está na seção 23 (COR-01 a COR-10), valendo para o PDI e para o Formulário 1/3.
- **Origem:** usuário (§38). **Status:** Implementada.
- **Divergência:** DEF-18 **tratada** em 10/11/2026: a devolução de Ficha de aluno transferido para outra escola é recusada com explicação, e a Secretaria usa a correção direta (COR-07).
- **Testes:** PDI-TRF-G4/G5; `homologacao/51-correcoes-professor.mjs` (24 casos).

**PDI-12 · Ficha Anual**
- **Regra:** visão por aluno e ano, montada a partir das fichas originais, sem duplicar respostas. Mostra o histórico de turmas e escolas do aluno. O fechamento automático é configurável (processo diário às 08:15).
- **Origem:** usuário (§39). **Status:** Implementada.
- **Divergências:** DEF-15 (link para fichas de outra escola leva a erro) e DEF-16 (datas um dia antes).
- **Testes:** PDI-TRF-E8/E9. O fluxo completo **não foi homologado**.

---

## 7. Transferências e movimentações

**TRF-01 · Trajetória registrada**
- **Regra:** toda troca de turma ou escola fecha a movimentação anterior e abre uma nova, com data e autor. A Ficha Anual mostra a trajetória completa.
- **Origem:** usuário (§19). **Status:** Implementada.
- **Testes:** PDI-TRF-T1, PDI-TRF-E7, captura 26-sec-ficha-anual-marina.

**TRF-02 · Orientação conceitual: o PDI acompanha o aluno**
- **Regra:** o PDI acompanha o aluno em qualquer mudança de turma ou escola, sem misturar fichas de Aplicações diferentes. Princípios:
  1. identidade única;
  2. nenhuma transferência apaga o que foi preenchido;
  3. o histórico pedagógico continua associado ao aluno;
  4. a nova escola dá continuidade, respeitando as permissões;
  5. cada Aplicação mantém os próprios formulários;
  6. não há cópia automática de respostas entre Aplicações;
  7. profissionais autorizados acessam o necessário;
  8. registros históricos não são modificados indevidamente por transferências posteriores.
- **Origem:** usuário (orientação de 09/11/2026, Decisão 9). **Status:** **Definida pelo usuário** como orientação. Os detalhes (TRF-03 a TRF-08) são **Propostas** ou estão **Pendentes**.
- **Conformidade do código hoje:** ver a tabela abaixo.

| Princípio | Situação atual (testada em 09/11/2026) |
|---|---|
| 1. Identidade única | **Cumpre** (PDI-TRF-T0/E2). |
| 2. Nada é apagado | **Cumpre em parte.** Nada é apagado (T11/E7), mas o DEF-14 **sobrescreve** o texto comum da professora anterior. |
| 3. Histórico associado ao aluno | **Cumpre em parte.** A trajetória e a lista de fichas aparecem na Ficha Anual, mas o **conteúdo** das fichas de outra escola não abre (DEF-15/QUE-04). |
| 4. Continuidade na nova escola | **Cumpre em parte.** A ficha nova nasce vazia e o professor novo trabalha (E5). O Gestor e a Diretora da nova escola não abrem o perfil (DEF-17) nem leem o histórico (G1/G2). |
| 5. Aplicações separadas | **Cumpre** (E5, E7). |
| 6. Sem cópia automática | **Cumpre** (E5). |
| 7. Autorizados acessam o necessário | **Não cumpre.** Só a Secretaria lê o conteúdo antigo, e apenas pela tela de Correções (G4). A autora, a nova escola e a escola anterior não leem. |
| 8. Histórico não alterado por transferência posterior | **Não cumpre.** O DEF-14 sobrescreve o texto comum. O novo professor altera ficha **concluída** por outro na mesma escola (T9/QUE-03). Quando o aluno volta à escola de origem, a ficha antiga fica editável de novo (G6/QUE-08). |

**TRF-03 · Ficha em andamento na troca de turma**
- **Regra:** o novo professor da turma assume e continua a ficha em andamento.
- **Origem:** comportamento atual (QUE-02). **Status:** Implementada.
- **Proposta mais simples:** manter.
- **Testes:** PDI-TRF-T7.

**TRF-04 · Ficha concluída por outro professor**
- **Hoje:** o novo professor pode alterar. A ficha continua "Concluída", com a data original, sem registro visível (QUE-03).
- **Proposta mais simples:** ficha concluída cujo professor gravado na ficha seja diferente do responsável atual fica **somente leitura**. Alterações só pelas Correções, que já existem.
- **Status:** **Pendente** (decidir).
- **Testes:** PDI-TRF-T9.

**TRF-05 · Leitura do histórico da escola anterior**
- **Hoje:** ninguém abre o conteúdo pela rota da ficha. A resposta é 400, "Esta aplicação não pertence à escola atual deste aluno", inclusive para a autora, a Secretaria e o Gestor e a Diretora das duas escolas. A **Secretaria lê pelas Correções**, que é um caminho já existente.
- **Proposta mais simples:**
  - fichas de outra escola ficam **somente leitura**;
  - a Secretaria lê sempre (aproveitando a leitura das Correções);
  - a Secretaria decide se a nova escola também lê;
  - o link da Ficha Anual passa a abrir em somente leitura (corrige o DEF-15).
- **Status:** **Pendente** (permissão).
- **Testes:** PDI-TRF-E3/E4/E8/E9/G1 a G4.

**TRF-06 · Sem cópia entre Aplicações**
- **Regra:** cada Aplicação tem as próprias fichas. Na nova escola, a ficha nasce vazia.
- **Origem:** orientação TRF-02 (princípios 5 e 6). **Status:** Implementada.
- **Testes:** PDI-TRF-E5.

**TRF-07 · Volta à escola de origem**
- **Hoje:** a ficha antiga volta a abrir e fica **editável** se a Aplicação ainda estiver no período. A ficha da escola intermediária deixa de abrir (QUE-08).
- **Status:** **Pendente**. A regra TRF-05 (somente leitura de outra escola) resolve a escola intermediária; a ficha de origem reaberta é coerente com PDI-09.
- **Testes:** PDI-TRF-G6.

**TRF-08 · Disciplina sem professor na nova turma**
- **Hoje:** a ficha fica sem responsável e sai do total esperado (QUE-07).
- **Proposta mais simples:** aceitar. É coerente com PDI-09 e com o princípio do vínculo ativo.
- **Status:** **Pendente** (confirmar).

---

## 8. Prazos, encerramentos e reaberturas

**PRZ-01 · Prazo do 1/3**
- **Regra:** depois do prazo, o formulário fica somente leitura, e o servidor recusa gravação, inclusive com a tela aberta.
- **Origem:** usuário (§63). **Status:** Implementada.
- **Testes:** UT-PRZ-01 a 05.

**PRZ-02 · Reabertura do 1/3 (atual)**
- **Atualização 10/11/2026 (usuário):** reabrir só é possível **depois do prazo** (1/3) ou **depois do fim da vigência** (PDI). Antes disso o botão não aparece e o servidor recusa; para estender, usa-se Editar / Editar vigência.
- **Regra:** só a Secretaria reabre. A reabertura vale para o **ciclo inteiro** e não altera o prazo original. Não pode coincidir com outra reabertura do mesmo ciclo. O motivo é opcional, e a reabertura não pode ser editada nem excluída.
- **Origem:** usuário (§64). **Status:** Implementada.
- **Testes:** UT-REA-01 a 05, UT-PRZ-06 a 08.

**PRZ-03 · Reabertura: limites propostos**
- **Regra:**
  - pode coincidir com a janela de outro ciclo, **excepcionalmente**, com aviso;
  - pode ser em outro trimestre, **só no mesmo ano letivo**;
  - início atual ou futuro e fim depois do início;
  - **justificativa obrigatória**;
  - prazo original preservado;
  - o professor vê "Reaberto" e o período de referência;
  - não haverá cancelamento de reabertura nem reabertura individual por enquanto.
- **Origem:** Decisão 4. **Status:** **Proposta (pendente Secretaria)**.
- **Limitação:** na reabertura, só preenche quem **ainda tem o mesmo vínculo**.
- **Depende de:** UT-04, UT-06.
- **Testes:** UT-REA-03/05 passariam a ser recusados.

**PRZ-04 · Alteração do prazo**
- **Regra:** em ciclo **aberto**, a Secretaria pode antecipar ou adiar o prazo, respeitando as validações. Um novo prazo **nunca** pode ser retroativo. O prazo de ciclo **encerrado** não muda; para dar mais tempo, usa-se a reabertura.
- **Origem:** Decisão 8. **Status:** **Proposta (pendente Secretaria)**. Hoje qualquer prazo é aceito (UT-PRZ-00).

**PRZ-05 · "Encerrar agora"**
- **Regra:** ação de um clique, só para ciclo aberto e só da Secretaria. Pede confirmação e avisa quantos preenchimentos estão em andamento. Na prática, grava o prazo como o instante atual do servidor, sem estado novo.
- **Origem:** Decisão 8. **Status:** **Proposta (pendente Secretaria)**.
- **Ponto não decidido:** o prazo planejado anterior é sobrescrito.

**PRZ-06 · Duração da janela**
- **Regra:** não há duração mínima nem máxima além das validações existentes.
- **Origem:** Decisão 8. **Status:** **Proposta (pendente Secretaria)**; é o comportamento atual.

**PRZ-07 · Prazos do PDI**
- **Regra:** a Aplicação tem período próprio, com reabertura da Aplicação (`ReaberturaPdi`) e devolução individual com 3 dias (PDI-11).
- **Status:** Implementada.
- **Testes:** PDI-PRZ-01/02. A reabertura de Aplicação **não foi homologada**.

---

## 9. Cancelamentos administrativos

**CAN-01 · Cancelamento em lote de pendências do 1/3**
- **Regra:** ao encerrar um vínculo docente (Decisão 1) ou desativar uma turma, professor ou escola com janela aberta (Decisão 2), o sistema lista as pendências afetadas. A Secretaria escolhe, numa só ação:
  - **"Cancelar todas as pendências afetadas"**, com uma única justificativa; ou
  - **"Manter pendências"**.
  
  Não há seleção individual.
- **Exemplo:** a professora Ana sai da Escola A em 10/11, com o ciclo aberto de 02/11 a 20/11. A obrigação de Matemática do 6º ano dela é cancelada e sai do percentual.
- **Origem:** Decisões 1 e 2. **Status:** **Proposta (pendente Secretaria)**.
- **Módulos:** 1/3, vínculos e cadastros.
- **Depende de:** VIN-06, VIN-08, UT-09.
- **Testes:** ver o plano, B1.

**CAN-02 · O que nunca entra no lote**
- **Regra:** formulários **concluídos** e obrigações **ainda válidas por outro vínculo** (mesmo ano/série e disciplina) ficam fora, automaticamente.
- **Origem:** Decisões 1 e 2. **Status:** Proposta.

**CAN-03 · Efeitos do cancelamento**
- **Regra:** nada é apagado e o rascunho é preservado (legível, não editável). Cancelado não conta como entrega e aparece separado nos indicadores. São registrados responsável, data, justificativa e quantidade.
- **Origem:** Decisões 1 e 2. **Status:** Proposta.
- **Estrutura mínima:**
  - acrescentar o status `CANCELADA` às entregas;
  - registrar um evento `CANCELADA` no histórico já existente, com o identificador do lote, a justificativa e a quantidade.
  
  Não precisa de tabela nova.

**CAN-04 · Entrega cancelada não aceita gravação**
- **Regra:** o servidor deve recusar qualquer gravação numa entrega cancelada, inclusive vinda da fila offline.
- **Origem:** auditoria de 09/11/2026 (decorre de CAN-03 e OFF-02). **Status:** **Proposta (pendente)**.

---

## 10. Exclusão de ciclos

**EXC-01 · Exclusão definitiva de ciclo do 1/3 (exceção à preservação)**
- **Regra:** a Secretaria pode excluir **definitivamente** um ciclo, mesmo com preenchimentos, depois de uma confirmação explícita avisando que tudo será apagado e que a operação é **irreversível**. É feita numa transação única, sem deixar órfãos e sem preservar o histórico dos preenchimentos.
- **Exemplo:** um ciclo criado com o trimestre errado, e que alguns professores já começaram, é excluído inteiro.
- **Origem:** Decisão 5. **Status:** **Proposta (pendente Secretaria)**.

**Limites da exceção**
1. Vale **só** para o ciclo do 1/3.
2. Apaga só as 7 tabelas do ciclo, numa ordem explícita: histórico das entregas → cobertura → respostas → entregas → reaberturas → semanas → ciclo. Não muda as regras de exclusão do banco e não precisa de migration.
3. **Nunca** apaga vínculos, turmas, escolas, pessoas, disciplinas, calendário, PDI nem outros ciclos.
4. É uma ação manual da Secretaria. Nunca é automática nem feita por script.
5. Fora deste caso, vale a regra geral de não apagar histórico (contexto §79, CAN-03, PDI-02).

- **Pontos não decididos:** registrar o próprio ato da exclusão (quem, quando, qual ciclo, quantos registros); o que acontece com a fila e os rascunhos offline (OFF-06).
- **Testes:** ver o plano, B4.

**EXC-02 · Inativar continua existindo**
- **Regra:** ciclo sem preenchimentos pode ser inativado, de forma reversível (UT-13).
- **Status:** Implementada. Ver a simplificação S6.

---

## 11. Funcionamento offline

**OFF-01 · Internet para abrir**
- **Regra:** o Nexo exige internet para abrir e carregar formulários. O app e os dados não ficam guardados no aparelho, só ícones e o manifest.
- **Origem:** Decisão 7 e o desenho original. **Status:** Implementada; como regra, **Proposta (pendente Secretaria)**.
- **Testes:** UT-OFF-05, UT-SW-01.

**OFF-02 · Queda durante o uso**
- **Regra:** o texto vai para o rascunho e a fila do navegador e é enviado quando a conexão volta. Sai da fila **só depois de o servidor confirmar**. Conflito gera 409 e nunca sobrescreve em silêncio. Abas não sincronizam ao mesmo tempo.
- **Origem:** usuário (§44–46). **Status:** Implementada.
- **Divergências:** DEF-07 (fila não enviada ao reabrir), DEF-06/13 (aviso cobre botões), DEF-08 (conflito sem opções).
- **Testes:** UT-OFF-01 a 13, PDI-OFF-*.

**OFF-03 · Separação por usuário**
- **Regra:** o rascunho e a fila são guardados por usuário (e-mail). Só os itens do usuário logado são lidos e enviados. **Nada é apagado no logout**, para não perder trabalho. Em computador compartilhado, os dados ficam fisicamente no navegador, mas um professor não vê os de outro pela tela.
- **Origem:** usuário. **Status:** Implementada.
- **Pendente:** decidir se o rascunho de outro usuário parado no aparelho é aceitável.

**OFF-04 · Ações definitivas exigem conexão**
- **Regra:** concluir não é simulado offline. Mensagens nunca são enviadas automaticamente depois da reconexão.
- **Origem:** usuário (§46, §48). **Status:** Implementada.

**OFF-05 · Fila de recurso que não existe mais ou não aceita gravação**
- **Hoje:** pela leitura de `syncQueue.js`, um erro de negócio deixa o item como `error`, e ele é **tentado de novo a cada sincronização**, indefinidamente. O rascunho continua no aparelho.
- **Proposta mais simples:**
  - **ciclo excluído:** descartar o item da fila e o rascunho, avisando o professor;
  - **entrega cancelada ou prazo encerrado:** parar de tentar, manter o rascunho (pode servir numa reabertura) e avisar.
- **Status:** **Proposta (pendente)**.
- **Garantia já existente:** um ciclo excluído **não pode ser recriado** pela fila. A gravação exige que o ciclo exista, e os identificadores do banco não se repetem.

---

## 12. Indicadores e histórico

**IND-01 · Painel do 1/3**
- Ver UT-10. A contagem é derivada (calculada na hora).
- **Proposta (Decisão 2):** o esperado deve ser o mesmo durante e depois do ciclo.

**IND-02 · Painel do PDI da Aplicação vigente**
- **Regra:** é calculado **com os alunos, turmas e vínculos de agora**, só para turmas com professor ativo na disciplina. Quando um aluno muda, as fichas concluídas deixam de contar para a origem.
- **Exemplo:**
  - troca de turma: a Aurora foi de 19 esperados, 3 concluídas e 3 em andamento para 9, 1 e 1;
  - entre escolas: a Aurora foi de 9/1/2 para 5/0/1, e a Boa Vista de 0/0/0 para 2/0/1;
  - as 3 fichas concluídas da Marina não contam em escola nenhuma.
- **Origem:** comportamento atual (QUE-05). **Status:** Implementada; como regra, **Pendente**.
- **Proposta mais simples:** manter o painel da Aplicação "ao vivo" e usar a Ficha Anual como histórico do aluno.
- **Testes:** PDI-TRF-T2, E6, G6.

**IND-03 · Indicadores do aluno**
- **Regra:** são calculados a partir das fichas de todas as escolas do aluno. Exemplo: Marina, depois da transferência, aparece com "3 de 3 concluídas".
- **Status:** Implementada. Não foi homologado em detalhe.

**IND-04 · Histórico por retrato, nunca como autorização**
- **Regra:** fichas e entregas guardam um retrato (aluno, turma, escola, professor, datas da Aplicação). Esse retrato **nunca** é recalculado e nunca dá acesso.
- **Origem:** usuário (§39, §100). **Status:** Implementada.

---

## 13. Regras de negócio aprovadas

**Não há, até 09/11/2026, nenhuma regra com aprovação formal registrada da Secretaria.**

As regras **definidas pelo usuário** como definitivas, que são a base do código atual, são:
- PER-01 a PER-09;
- VIN-02, VIN-03, VIN-07, VIN-09;
- CAL-01, CAL-02, CAL-05;
- UT-01 a UT-05 e UT-07 a UT-12;
- PDI-01 a PDI-09 e PDI-11, PDI-12;
- TRF-01, TRF-02 (orientação);
- PRZ-01, PRZ-02;
- OFF-02 a OFF-04;
- IND-04.

**Recomendação:** submeter a lista à Secretaria junto com as propostas da seção 14, para que a aprovação fique registrada.

---

## 14. Propostas técnicas pendentes da Secretaria

| Decisão | Regras | Resumo |
|---|---|---|
| 1. Encerramento de vínculo | VIN-06, CAN-01 a 03 | Mostrar pendências e cancelar em lote, com justificativa. |
| 2. Desativação | VIN-08, CAN-01, UT-09 | O mesmo lote, sem encerrar vínculos. Esperado igual durante e depois do ciclo. |
| 3. Abertura de ciclo | UT-06 | Só hoje ou no futuro. As semanas podem ser anteriores. |
| 4. Reabertura | PRZ-03 | Pode coincidir com outro ciclo, só no mesmo ano letivo, com início atual ou futuro e justificativa. |
| 5. Exclusão de ciclo | EXC-01 | Exclusão definitiva e irreversível, com limites. |
| 6. Início do vínculo | VIN-05 | Data do cadastro, sem retroatividade. |
| 7. Offline | OFF-01 | Internet para abrir; o preenchimento é protegido se a conexão cair. |
| 8. Prazo | PRZ-04 a PRZ-06 | Sem duração mínima; antecipar ou adiar só em ciclo aberto; "Encerrar agora". |
| 9. Transferência | TRF-02 a TRF-08 | Orientação definida; detalhes pendentes (seção 15). |
| Derivadas da auditoria | CAN-04, OFF-05 | Entrega cancelada não aceita gravação; tratamento da fila para recurso excluído, cancelado ou encerrado. |

---

## 15. Ambiguidades e decisões ainda necessárias

**Da Secretaria**
1. Quem pode **ler** fichas de escola anterior: só a Secretaria, ou também a nova escola, e quais perfis (TRF-05).
2. Ficha **concluída** por outro professor: somente leitura ou editável (TRF-04).
3. Para qual escola conta uma ficha concluída depois da transferência (IND-02).
4. Disciplina sem professor na nova turma: fica fora do esperado? (TRF-08)
5. Datas oficiais do calendário de 2026 e 2027 (CAL-03).
6. Ciclos que precisam de registro **depois do fim do trimestre** (auditoria, G).
7. Realidade de conectividade das escolas (OFF-01).
8. Rascunho de outro usuário em computador compartilhado (OFF-03).
9. Se a Diretora continua podendo encerrar vínculos e desativar professores, que são operações que geram pendências (VIN-06).

**Técnicas, a decidir com o usuário**
1. Data de fim do vínculo retroativa ou não (auditoria, CT1).
2. Registrar ou não o ato de exclusão de um ciclo (EXC-01).
3. Guardar ou não o prazo planejado antes do "Encerrar agora" (PRZ-05).
4. O que fazer com lote vazio, quando todas as pendências foram excluídas automaticamente (CAN-02).
5. Tolerância de "hoje" na abertura do ciclo; edição da abertura de ciclo que já abriu (UT-06).
6. Manter "Inativar" depois que existir "Excluir" (auditoria, S6).
7. Entrega concluída com semana em branco: confirmar e decidir (UT-08).

---

## 16. Relação entre regras e testes

| Regra | Testes existentes | Situação |
|---|---|---|
| PER-08 | PA-P01-01 a 11, PA-P04-01 a 11 | Aprovado (22/22). |
| PER-09, PER-07 | UT-PERM-* (13), PDI-AUT-* | Aprovado. |
| UT-02, UT-03 | testar-integracao (identidade, cobertura), UT-P04-* | Aprovado. |
| UT-04 | UT-T-S01 a S09, concorrência (5 cenários) | Aprovado. |
| UT-06 | UT-T-S10, S12 | Observação (hoje aceito). |
| UT-07 | UT-P04-*, UT-DEF-01 | Reprovado no DEF-01. |
| UT-08 | UT-PRZ-07, testar-integracao | Aprovado. Semana vazia não testada. |
| UT-09 | UT-VIN-*, UT-EST-* | Reprovado no DEF-09 (P08); observações. |
| UT-10 | UT-VIN-PAINEL1b | Aprovado. |
| UT-11 | testar-integracao (409), UT-OFF-09/10 | Aprovado; DEF-08 reprovado. |
| UT-13 | UT-ED-02, UT-ED-04 | Aprovado. |
| PRZ-01 | UT-PRZ-01 a 05 | Aprovado. |
| PRZ-02/03 | UT-REA-01 a 05, UT-PRZ-06 a 08 | Aprovado; 03 e 05 são observações. |
| PRZ-04 | UT-PRZ-00 | Hoje aceita prazo no passado. |
| PDI-04 | PDI-MULTI-02 a 04, PDI-TRF-T8 | **Reprovado no T8 (DEF-14)**. |
| PDI-07, PDI-08 | PDI-P04-01 a 08, PDI-PRZ-01/02, PDI-CONC-01 | Aprovado. |
| PDI-09 | PDI-VIN-01/02, PDI-TRF-T3 a T5 | Aprovado. |
| PDI-10, PER-02/03 | PDI-TRF-G1, G2, perfil do Gestor | **Reprovado (DEF-17)**. |
| PDI-11 | PDI-TRF-G4, G5 | G4 aprovado; G5 **reprovado (DEF-18)**. |
| PDI-12 | PDI-TRF-E8 a E10 | **Reprovado (DEF-15, DEF-16)**. |
| TRF-01, TRF-06 | PDI-TRF-T1, E5, E7, T11 | Aprovado. |
| TRF-03 a 05, 07, 08; IND-02 | PDI-TRF-T2, T6, T7, T9, E3, E4, E6, G3, G6 | Observações (regra pendente). |
| OFF-01 a 04 | UT-OFF-01 a 13, UT-SW-01, PDI-OFF-* | Aprovado; DEF-06, 07, 08 e 13 reprovados. |
| CAN-*, EXC-01, PRZ-05, OFF-05 | — | Sem teste (proposta). |

---

## 17. Auditoria de coerência das nove decisões

### A. Contradições

| # | Contradição | Exemplo real | Opção mais simples |
|---|---|---|---|
| CT1 | A Decisão 1 previa **data de fim retroativa** no encerramento do vínculo. A Decisão 6 proíbe efeito retroativo no início. | A Secretaria registra em 25/11 que a Ana saiu em 05/11. O ciclo de 02/11 a 20/11, já encerrado, muda: a Ana deixa de ser "esperada" depois do fato. | **Fim = data do registro**, igual ao início. Não pedir data na tela. |
| CT2 | A Decisão 5 (exclusão definitiva) contraria a preservação histórica das Decisões 1 e 2, da regra §79 e do PDI-02. | Um ciclo com 300 formulários concluídos é excluído por engano e não há como recuperar sem backup. | Manter a **exceção limitada** (EXC-01): só o ciclo do 1/3, só a Secretaria, confirmação com as quantidades. Recomendo registrar o ato, nem que seja uma linha. |
| CT3 | A Decisão 4 (reabertura coincidindo com outro ciclo) contraria a leitura literal da regra 70 (nunca duas janelas abertas). | O professor tem dois formulários de Matemática do 6º ano abertos na mesma semana e escreve no errado. | Interpretar a regra 70 como **janelas originais**. A reabertura é exceção, com aviso e o cartão marcado "Reaberto" com as semanas. |
| CT4 | A Decisão 3 (abertura atual ou futura) somada à regra 62 (tudo no mesmo trimestre) impede registrar as últimas semanas depois que o trimestre termina. | O 3º trimestre acaba em 18/12. O conteúdo da semana de 14 a 18/12 teria de ser registrado até 18/12. | Não alterar sem a Secretaria. Ver o item G. |
| CT5 | A Decisão 9 (princípio 8: histórico não se altera por transferência) contraria a regra 37 do PDI ("edição após concluir enquanto o período estiver aberto", por quem for responsável agora). | O novo professor reescreve a ficha concluída pela professora anterior (T9). | Ficha concluída por outro professor fica somente leitura; mudança só pelas Correções (TRF-04). |
| CT6 | A regra 25 diz que "professores diferentes não compartilham", mas o código grava no bloco do professor anterior (DEF-14). | Ver o T8. | É **defeito**, não decisão: corrigir. |
| CT7 | A Decisão 2 propõe que o "esperado" seja estável, mas o código atual ignora vínculos inativos só durante o ciclo. | A obrigação do P15 some durante o ciclo e, pela leitura do código, volta depois do prazo. | Aplicar a mesma regra o tempo todo (Decisão 2). Antes, **confirmar com um teste** (tarefa C8 do plano). |
| CT8 | A Decisão 1 fala em "Secretaria", mas hoje a Diretora também encerra vínculos e desativa professores. | A Diretora encerra um vínculo, e a pendência fantasma (DEF-09) aparece sem que a Secretaria seja avisada. | Mostrar a lista de pendências também para a Diretora. Só a Secretaria cancela o lote, e a Diretora vê "Manter" e um aviso. Pendente da Secretaria. |
| CT9 | A Decisão 9 (princípio 7: autorizados acessam o necessário) contraria o DEF-17: o Gestor e a Diretora reais não abrem nenhum perfil de aluno. | O Gestor da nova escola não consegue nem ver a Marina. | É **defeito**: corrigir antes de definir permissões finas. |

### B. Complexidade desnecessária (simplificações recomendadas)

| # | Simplificação | Ganho |
|---|---|---|
| S1 | **Encerramento de vínculo sem campos novos:** sem data (C1) e sem colunas de motivo e autor no vínculo. O motivo só é exigido quando há pendências para cancelar e fica no evento do lote. | Elimina 2 colunas, uma validação de datas e o risco de retroatividade. |
| S2 | **Um único fluxo de lote** para as Decisões 1 e 2 (encerrar vínculo, substituição, encerramento do vínculo escolar, desativar turma, professor ou escola). | Uma tela e uma rota reutilizadas em 5 pontos. |
| S3 | **Lote sem tabela:** só o status `CANCELADA` mais eventos no histórico já existente, com identificador do lote. | Uma alteração de enum, que só acrescenta. Nenhuma tabela nova. |
| S4 | **"Encerrar agora" sem estado:** grava o prazo. | Nada novo no banco. |
| S5 | **Decisões 6, 7 e a duração da 8 não exigem código.** | Zero esforço. Só documentação e orientação. |
| S6 | Avaliar **tirar "Inativar" da tela** quando existir "Excluir", ou deixar Inativar só para ciclos ainda não abertos. | Um conceito a menos para a Secretaria. Pendente. |
| S7 | **Leitura de histórico do PDI aproveitando as Correções**, que já mostram a ficha antiga para a Secretaria, e a Ficha Anual, que já lista as fichas. | Sem tela nova. Basta permitir somente leitura no link existente. |
| S8 | **Não criar** auditoria genérica, aprovação em duas etapas nem configuração de duração ou limites. | Mantém a linha mínima. |

### C. Reutilização de estruturas existentes

| Necessidade | Estrutura existente |
|---|---|
| Status "Encerrado", "Encerrar agora" | Status derivado do prazo (`statusDoCiclo`), sem campo novo. |
| Registro do cancelamento e do lote | `HistoricoEntregaUmTerco` (tipo, autor, data e campo livre JSON). |
| Lista de pendências afetadas | O cálculo de elegíveis e a montagem do painel do 1/3. |
| Justificativa de reabertura | `ReaberturaUmTerco.motivo` (já existe; basta exigir). |
| Período de referência × janela | `SemanaUmTerco` × `abreEm`/`prazoEm`. |
| Leitura de ficha antiga | Correções (Secretaria) e Ficha Anual (lista). |
| Trajetória do aluno | `MovimentacaoAlunoPdi`. |
| Trava de concorrência | Bloqueio do registro, travas de transação, `updatedAt` e `version`. |
| Proteção contra recriar ciclo excluído | Chave estrangeira mais identificadores que não se repetem. |

### D. Preservação × exclusão
A exclusão definitiva (EXC-01) é a **única** exceção à regra de não apagar histórico, com os 5 limites da seção 10. Qualquer outra situação usa inativar, cancelar ou encerrar, que preservam os dados. **Recomendação:** registrar ao menos o ato da exclusão (quem, quando, qual ciclo, quantos registros apagados), para não perder a rastreabilidade administrativa. Isso **não** preserva os preenchimentos e é compatível com a decisão.

### E. Offline × operações administrativas

| Operação | O que acontece hoje (código) | Risco | Regra mais simples |
|---|---|---|---|
| Excluir ciclo (proposta) | O item na fila recebe erro e fica `error`, tentado a cada sincronização. O rascunho fica no aparelho. | Repetição infinita e aviso confuso. **Não recria dados**: a gravação exige o ciclo, e os identificadores não se repetem. | Descartar o item e o rascunho do ciclo excluído, avisando (OFF-05). |
| Cancelar pendências (proposta) | A rota de gravação não olha o status da entrega. | Uma sincronização atrasada **edita ou "ressuscita"** uma entrega cancelada. | O servidor recusa gravar em entrega cancelada (CAN-04); a fila para e avisa. |
| "Encerrar agora" ou prazo vencido | Gravação recusada ("prazo terminou"); o item fica `error` e é repetido. | Repetição infinita; o texto fica só no aparelho. | Parar de repetir, manter o rascunho (útil numa reabertura) e avisar. |
| Vínculo encerrado | 403; item `error`. | Igual. | Igual ao anterior. |
| Fila ao reabrir com internet (DEF-07) | Não é enviada. | Perda prática perto do prazo. | Enviar ao abrir, só do usuário logado e com sessão válida. |

### F. Formulários concluídos (comportamento atual)
- **1/3:**
  - É editável depois de concluído durante a janela e durante **qualquer reabertura**, pelo professor com o mesmo vínculo.
  - O status e a data de conclusão não mudam. Só o histórico registra "salvo".
  - Pela leitura do código, é possível deixar uma semana em branco numa entrega concluída. Não foi testado.
- **PDI:**
  - É editável depois de concluído enquanto o período ou a reabertura estiver aberto, **pelo responsável atual**, que pode ser outro professor depois de uma troca de turma (T9).
  - O status e a data de conclusão não mudam, e não há registro visível.
  - As Correções registram o valor anterior e o novo, mas a edição comum não registra.
- **Regra mais simples recomendada:** manter a edição depois de concluir para o **mesmo** autor, conforme as regras 37 e 63. A ficha concluída por **outro** professor fica somente leitura (TRF-04).

### G. Calendário: trimestre que termina antes do registro
- **A regra 62 exige** abertura, prazo e semanas no mesmo trimestre. Consequências:
  - as últimas semanas do trimestre precisam ser registradas **até o último dia** do trimestre;
  - não há ciclo sobre um trimestre já encerrado (e, com a Decisão 3, nem retroativo);
  - a reabertura (Decisão 4) pode cair no trimestre seguinte do mesmo ano, mas **só preenche quem ainda tem o mesmo vínculo**.
- **Exemplo:** o 3º trimestre termina em 18/12. Um ciclo sobre as semanas de 30/11 a 18/12 precisa ter prazo até 18/12, então a última semana é registrada no próprio último dia letivo.
- **Opção mais simples, a submeter à Secretaria** e sem alterar agora: manter a regra 62 para as **semanas** e permitir que o **prazo** (não a abertura) avance até X dias depois do fim do trimestre, ainda no mesmo ano letivo.

---

## 18. Auditoria de riscos

| # | Risco | Gravidade | Situação | Testes necessários |
|---|---|---|---|---|
| R1 | **Perda de dados (texto comum do PDI)**: o novo professor sobrescreve o bloco do anterior (DEF-14). | **Alta** | Comprovado. | Repetir PDI-TRF-T8; bloco de cada professor intacto; regressão de PDI-MULTI-*. |
| R2 | **Perda prática de texto offline**: fila não enviada ao reabrir (DEF-07), botões cobertos (DEF-06/13), conflito sem saída (DEF-08), semana errada com rede lenta (DEF-01). | **Alta** perto do prazo | Comprovado. | UT-OFF-11 a 13, UT-OFF-UX-*, UT-OFF-10/10b, UT-DEF-01; dois usuários no mesmo navegador. |
| R3 | **Dados do PDI inacessíveis depois da transferência** (QUE-04, DEF-15) e **Gestor/Diretora sem acesso ao perfil** (DEF-17). | **Alta** | Comprovado. | PDI-TRF-E3/E4/E8/E9/G1 a G3; perfil com contas reais de Gestor e Diretora. |
| R4 | **Alteração indevida de documento concluído** (T9, G6, edição comum sem histórico). | **Média/Alta** | Comprovado (comportamento); a regra está pendente. | T9 e G6 com a regra decidida; histórico da alteração. |
| R5 | **Indicadores históricos mudando**: PDI ao vivo (QUE-05); 1/3 com obrigação que some e volta (CT7); DEF-09 inflando o esperado. | **Média** | Comprovado em parte (CT7 não testado). | Comparar o painel antes e depois do prazo com turma inativa; P08 com cancelamento; troca de escola. |
| R6 | **Operação irreversível** (exclusão de ciclo). | **Alta** se implementada | Proposta. | Contagem das 7 tabelas antes e depois; atomicidade; 403 para outros perfis; confirmação com quantidades. |
| R7 | **Sincronização atrasada** em ciclo excluído, entrega cancelada ou prazo encerrado (repetição infinita; edição de entrega cancelada). | **Média** | Proposta e código atual. | Fila pendente + exclusão; fila pendente + cancelamento; fila pendente + "Encerrar agora". |
| R8 | **Formulário atribuído ao professor errado ou duplicado** (1/3): coberto pelo índice único e pelas travas. | Baixa | Testado, sem falhas. | Manter a regressão `testar-integracao` (50) a cada mudança no 1/3. |
| R9 | **Conflito entre vínculos docentes**: substituição automática encerra o anterior sem aviso; três caminhos de encerramento sem verificar pendências. | **Média** | Comprovado (DEF-09). | Substituição, encerramento manual e cascata do vínculo escolar gerando a lista de pendências. |
| R10 | **Divergência entre interface, servidor e banco**: verificação de acesso com dados de exemplo (DEF-17); datas um dia antes (DEF-16); limite de data só no balão do navegador (DEF-11); filtro de turma ambíguo (DEF-10). | **Média** | Comprovado. | Auditar o uso de `src/data/mockData` em verificações de acesso; datas com fuso em todas as telas. |
| R11 | **Devolução impossível** (DEF-18). | Média | Comprovado. | PDI-TRF-G5 com a regra decidida. |
| R12 | **Ambiente:** `node_modules` versionado (DEF-04); servidor de desenvolvimento ≠ build de produção do app instalável; relógio não manipulado nos testes. | Média | Conhecido. | Testes no build de produção (`vite preview`); viradas de data. |

---

## 19. Plano de implementação (ordem recomendada — NÃO executar ainda)

### Grupo A — Correções de defeitos comprovados (não dependem de decisão)

| # | Tarefa | Prioridade | Dependências | Risco | Complexidade | Testes |
|---|---|---|---|---|---|---|
| A1 | **DEF-14:** o professor só grava no **próprio** bloco de perguntas comuns, identificado pela turma e pelo professor atuais, nunca pelo retrato da ficha. | 1 | — | Médio (muda a resolução do bloco) | Média | PDI-TRF-T8; PDI-MULTI-*; troca de professor; bloco antigo intacto. |
| A2 | **DEF-17:** a tela do perfil do aluno passa a usar os vínculos escolares **reais**. Auditar outros usos de `mockData` em verificações de acesso. | 1 | — | Baixo | Baixa/Média | Gestor e Diretora reais abrem o perfil; Secretaria continua igual. |
| A3 | **DEF-07:** enviar a fila ao abrir o app com internet (só o usuário logado, sessão válida, conflito respeitado). | 1 | — | Médio | Média | UT-OFF-11 a 13; dois usuários no mesmo navegador; sessão expirada com fila. |
| A4 | **DEF-06/13:** o aviso de offline não cobre os botões. | 2 | — | Baixo | Baixa | UT-OFF-UX-desktop e celular; PDI-OFF-02. |
| A5 | **DEF-08:** conflito vindo da fila oferece "Usar versão salva" e "Manter meu texto". | 2 | A3 | Médio | Média | UT-OFF-10/10b. |
| A6 | **DEF-01:** "Próximo" espera o salvamento ou bloqueia a edição, com indicador. | 2 | — | Baixo | Média | UT-DEF-01 com rede lenta. |
| A7 | **DEF-16:** datas da Aplicação com fuso correto (Ficha Anual e Correções). | 3 | — | Baixo | Baixa | PDI-TRF-E10; varrer outras telas com datas. |
| A8 | **DEF-15 (mínimo):** o link da Ficha Anual não leva a erro. Esconder até decidir TRF-05, ou abrir em somente leitura depois da decisão. | 3 | B6 para a versão completa | Baixo | Baixa | PDI-TRF-E8/E9. |
| A9 | **DEF-18:** impedir "Devolver ao Professor" quando a ficha é de escola diferente da atual do aluno, ou seguir a regra de TRF-05. | 3 | B6 | Baixo | Baixa | PDI-TRF-G5. |
| A10 | Baixos: DEF-02 (rótulos do login), DEF-10 (filtro de turma com escola), DEF-11 (mensagem própria de data), DEF-12 (botão "Novo aluno"). | 4 | — | Baixo | Baixa | Testes visuais e de acessibilidade. |

### Grupo B — Mudanças que dependem das decisões (só depois da aprovação da Secretaria)

| # | Tarefa | Prioridade | Dependências | Risco | Complexidade | Testes |
|---|---|---|---|---|---|---|
| B1 | **Decisões 1 e 2 (DEF-09, QUE-01):** lista de pendências e lote "Cancelar todas" ou "Manter" nos 5 caminhos (S2). Status `CANCELADA`. Esperado estável durante e depois do ciclo. Gravação em entrega cancelada recusada (CAN-04). | 1 | Aprovação; CT1 e CT8 decididos | Alto (mexe em indicadores e permissões) | Alta | Testes listados na seção 101-A do contexto; P08 e P15 da homologação; lote vazio; dois lotes simultâneos. |
| B2 | **Decisão 9:** ficha concluída por outro professor fica somente leitura (TRF-04); leitura de outra escola (TRF-05); aviso de aluno transferido (QUE-06). | 1 | Aprovação; A1, A2 | Médio | Média | PDI-TRF-T9, E3, E4, E8, E9, G1 a G6. |
| B3 | **Decisão 8:** prazo nunca retroativo; prazo de ciclo encerrado travado; "Encerrar agora". | 2 | Aprovação | Baixo | Baixa/Média | Seção 101-A (Decisão 8); UT-PRZ-00 ajustado. |
| B4 | **Decisão 5:** exclusão definitiva com contagem, confirmação e ordem explícita. Tratamento offline (OFF-05). | 2 | Aprovação; decidir o registro do ato; A3 | **Alto** (irreversível) | Média/Alta | Seção 101-A (Decisão 5); fila e rascunho do ciclo excluído. |
| B5 | **Decisão 3:** abertura atual ou futura com mensagem própria. | 3 | Aprovação; G discutido | Baixo | Baixa | UT-T-S10/S12 passam a ser recusados; regressão das baterias. |
| B6 | **Decisão 4:** limites da reabertura, justificativa obrigatória, cartão "Reaberto" com as semanas. | 3 | Aprovação; B5 | Baixo | Média | Seção 101-A (Decisão 4). |
| B7 | **OFF-05:** parar de repetir itens recusados em definitivo e avisar. | 3 | A3, B1, B3, B4 | Médio | Média | Fila com prazo encerrado, cancelado ou excluído. |
| B8 | Decisões 6 e 7: **sem código**. Orientação aos professores ("abrir com internet"). | — | — | — | — | — |
| B9 | DEF-05: aplicar o nome "Nexo" nas telas, no app instalável e no título (só quando o usuário pedir). | 4 | Pedido do usuário | Baixo | Baixa | Visual. |

### Grupo C — Testes ainda pendentes (homologação complementar, só no banco isolado)

| # | Teste | Prioridade | Dependências | Complexidade |
|---|---|---|---|---|
| C1 | Perfis Diretora, Gestor e Auxiliar no PDI (depois do A2). | 1 | A2 | Média |
| C2 | Correções (específica e do bloco), devolução, expiração. | 1 | — | Média |
| C3 | Reabertura de Aplicação PDI. | 2 | — | Baixa |
| C4 | Ficha Anual (fechamento automático) e indicadores do aluno. | 2 | — | Média |
| C5 | Anamnese e perguntas do CRMG. | 2 | — | Média |
| C6 | Desativação de **escola**. | 2 | — | Baixa |
| C7 | Viradas de dia, mês, trimestre e ano; entrega no instante do prazo (relógio controlado). | 2 | — | Média |
| C8 | **Confirmar CT7 da auditoria:** obrigação de turma inativa volta depois do prazo. | 1 | — | Baixa |
| C9 | 1/3 concluído com semana apagada. | 2 | — | Baixa |
| C10 | Sessão expirada com itens na fila. | 2 | A3 | Baixa |
| C11 | Build de produção (`vite preview`) e celular físico. | 3 | — | Média |
| C12 | Transferência com offline ativo; volta à escola de origem depois da regra B2. | 3 | B2 | Baixa |

### Grupo D — Organização técnica

| # | Tarefa | Prioridade | Dependências | Risco | Complexidade |
|---|---|---|---|---|---|
| D1 | **DEF-04:** tirar `node_modules/`, `dist/` e `.vite/` do Git (`.gitignore` e `git rm --cached`), num commit isolado. | 1 | Autorização | Baixo | Baixa |
| D2 | Revisar o que de `homologacao/` ficou no Git. O commit `f5a5e77` (do usuário, 09/11, não enviado) já incluiu scripts, `resultados.json`, 99 capturas **e os logs** (`backend.log`, `db.log`, `frontend.log`); `.senhas.json`, `pgdata/` e `node_modules/` ficaram fora. Sugestão: tirar os `*.log` do Git e ignorá-los. | 2 | Autorização | Baixo | Baixa |
| D3 | Commitar o que veio depois do `f5a5e77`: `REGRAS_DE_NEGOCIO_NEXO.md`, `CLAUDE_CONTEXT.md` atualizado, scripts 25 a 28, novas capturas e `DEFEITOS.md`. Depois, enviar (push) quando autorizado. | 1 | Autorização | Baixo | Baixa |
| D4 | Atualizar o relatório e a planilha de testes com as rodadas de transferência. **Atenção:** `gerar-relatorio.mjs` regera o relatório e pode sobrescrever edições manuais. | 3 | — | Baixo | Baixa |
| D5 | Remover o mock `FormularioUmTerco.jsx` depois de auditar as referências. | 4 | — | Baixo | Baixa |
| D6 | Confirmar o estado do push e do deploy (Render e GitHub Pages) antes de qualquer correção ir a produção. | 1 | — | — | Baixa |
| D7 | Submeter as seções 13 a 15 deste documento à Secretaria e registrar a aprovação aqui. | 1 | — | — | — |

**Ordem sugerida:**
1. D6 e D1.
2. A1, A2 e A3 (defeitos altos).
3. C8 e C1 (confirmações rápidas).
4. A4, A5 e A6.
5. D7 (Secretaria).
6. B1 e B2.
7. B3 e B4.
8. B5, B6 e B7.
9. Restante dos grupos A e C.
10. D2 a D5.

---

## 20. Atualização de 09/11/2026 — correções aplicadas (fase de estabilização)

Nenhuma regra de negócio foi criada nem alterada. Foram corrigidas **divergências entre o código e regras já registradas**. Detalhes, testes e evidências estão em `homologacao/DEFEITOS.md`, na seção "Correções de 09/11/2026".

| Regra | Divergência | Situação agora |
|---|---|---|
| PDI-04 (bloco pertence ao professor que escreveu) | DEF-14: o novo responsável sobrescrevia o bloco do anterior, na troca de turma e também na **substituição de professor** | **Corrigida.** O bloco de quem preenche é o da turma atual + professor responsável atual. As Correções da Secretaria continuam mostrando o bloco original. |
| PER-02, PER-03, PDI-10 (Diretora e Gestor consultam alunos da própria escola) | DEF-17: a tela checava acesso com dados de exemplo | **Corrigida.** A tela usa os vínculos reais. O backend continua sendo a autoridade. |
| OFF-02 (fila; nada se perde; nada é sobrescrito em silêncio) | DEF-07: a fila não era enviada ao abrir o app; item preso em "enviando"; recusa definitiva reenviada sem fim | **Corrigida.** A fila é enviada ao abrir ou logar com sessão válida, só a do próprio usuário. |
| OFF-02 / UT-11 (conflito nunca sobrescreve) | DEF-08: "Salvo" falso; conflito da fila invisível; rascunho reenviado por cima de versão mais nova | **Corrigida no 1/3** (opções de conflito; nada é enviado até a escolha). Indicadores honestos ("Sincronizado" × "Salvo só neste aparelho") no 1/3, no PDI, na Anamnese e nas Correções. |

**Continuam abertos:**
- **QUE-03 / TRF-04:** pendente da Secretaria. O novo professor ainda pode editar as respostas de disciplina de uma ficha concluída por outro. Não foi decidido.
- **DEF-19 (novo, MÉDIO, a confirmar):** o formulário do PDI recupera rascunho sem a versão de referência e pode sobrescrever uma alteração mais recente de outro aparelho. O conflito do PDI não tem opções.
- **DEF-06/13:** o aviso offline ainda cobre os botões.
- **Dependências de `mockData` fora do PDI** (lista em DEFEITOS.md, DEF-17): incluem o modal de vínculos da tela de Escolas.
- Os demais itens do plano da seção 19 (grupos A a D) não foram executados. Ficaram concluídos A1 (DEF-14), A2 (DEF-17), A3 (DEF-07), A5 (DEF-08) e D1 (`node_modules`).

## 21. Atualização de 09/11/2026 (2) — mais divergências corrigidas

Nenhuma regra nova. Detalhes em `homologacao/DEFEITOS.md`.

| Regra | Divergência | Situação agora |
|---|---|---|
| OFF-02 / PDI-07 (nada sobrescrito em silêncio) | DEF-19: o rascunho do PDI apagava a versão mais nova salva em outro aparelho | **Corrigida.** O rascunho guarda a versão de referência; em conflito, o usuário escolhe; nada é enviado nem dado como salvo antes da escolha. |
| OFF-02 (proteção durante o uso) | DEF-06/13: o aviso offline cobria os botões | **Corrigida.** |
| UT-07 (preenchimento por semana) | DEF-01: troca de semana com rede lenta; texto digitado durante o envio se perdia | **Corrigida.** |

Regressão final: 78/78 em navegador, 226/226 em API, integridade 8/8 e build de produção 6/6.

## 22. Acompanhamento Escolar (10/11/2026)

Tela só de leitura. Detalhes em `PROPOSTA_ACOMPANHAMENTO_ESCOLAR.md`.

| Regra | Descrição |
|---|---|
| ACP-01 | Quem acessa: **Secretaria** vê a rede inteira; **Diretora** vê só as próprias escolas (vínculo ativo). Gestor, Professor, Auxiliar e Suporte recebem 403. |
| ACP-02 | A tela não cria, não altera e não apaga nada. Correções do PDI em aberto aparecem só como informação. |
| ACP-03 | Unidades iguais às telas existentes. PDI = Ficha (aluno × disciplina), com o mesmo esperado de `/pdi-aplicacoes/indicadores`. 1/3 = entrega única (professor × ano/série × disciplina), contada uma vez na rede; por escola é cobertura e não soma. |
| ACP-04 | Nenhum nome de aluno ou professor; nenhum ranking de escolas. A ordem padrão do mapa mostra primeiro as escolas com atividade, em ordem alfabética. |
| ACP-05 | Depois do prazo, o que não foi concluído é "não concluído no prazo", nunca "atrasado". |
| ACP-06 | "Merecem acompanhamento" (escola × formulário × período): prazo em até 7 dias com menos de 50% concluído e pelo menos 5 itens esperados; ou aberto há mais de 7 dias sem nenhum início; ou encerrado há até 30 dias, sem reabertura vigente, com itens não concluídos. Esperado zero nunca gera item. |
| ACP-07 | Percentual só com 5 ou mais itens esperados; abaixo disso, "x de y". |
| ACP-08 | **Foto do PDI no prazo:** um job diário (08:30, e também na subida do servidor) guarda esperado, concluídas e em preenchimento de cada Aplicação ATIVA encerrada há 1 a 3 dias. Aplicação encerrada há mais tempo nunca ganha foto. Percentual de período do PDI já encerrado só aparece com foto; sem foto, só o número de Fichas concluídas. |
| ACP-09 | O 1/3 pode ser comparado entre ciclos (o esperado usa as datas dos vínculos); o PDI histórico, só pela foto. |

## 23. Fluxo de correções para professores (10/11/2026)

Vale para o PDI (Ficha e perguntas comuns) e para o Formulário 1/3 (entrega). A correção direta da Secretaria no PDI continua igual. O 1/3 não tinha correções; ganhou só a devolução (não há correção direta no 1/3).

| Regra | Descrição |
|---|---|
| COR-01 | A Secretaria escreve **"O que precisa ser corrigido?"** (obrigatório, até 2000 caracteres) e **confirma** antes de enviar. Só formulário já concluído pode ser devolvido. |
| COR-02 | **Prazo fixo de 3 dias corridos** (72 h) a partir da confirmação, no horário de São Paulo. Não é editável e não há configuração. |
| COR-03 | **Devoluções ilimitadas**, uma aberta de cada vez: enquanto a anterior aguarda o professor, outra é recusada (isso também segura o duplo clique). Cada devolução é um registro novo, com novas orientações e novo prazo; o histórico nunca é apagado. |
| COR-04 | Ao confirmar, o sistema envia uma **mensagem automática na caixa de mensagens existente** do professor (sem push): tipo do formulário, aluno ou ano/série, escola, turma, disciplina, orientações completas, prazo e o botão **"Abrir formulário"**. A mensagem nasce na mesma transação da devolução (sem duplicar, sem devolução sem aviso). |
| COR-05 | O professor vê **"Correção solicitada"** na lista e, dentro do formulário, as orientações, o prazo e a situação. **Salvar é rascunho; só "Enviar correção" envia.** No PDI, "Enviar correção" também envia a correção das perguntas comuns daquele aluno. |
| COR-06 | A devolução libera a edição **só daquele formulário** (aquela Ficha ou aquela entrega), mesmo com a Aplicação ou o ciclo já encerrados. Nada mais é liberado. |
| COR-07 | **Quem recebe** é quem consegue editar pela regra de acesso atual. PDI: o professor com vínculo ativo na turma atual do aluno, naquela disciplina, se o aluno ainda está na escola da Aplicação; perguntas comuns: o dono do bloco, se ainda é ele quem edita. 1/3: o próprio professor da entrega. Sem ninguém que consiga editar (aluno transferido de escola, professor inativo), a devolução é recusada com explicação. |
| COR-08 | **Prazo vencido:** aparece "Prazo de correção encerrado". O professor **não é bloqueado**, nada é apagado, não há cobrança automática. O envio depois do prazo vale e fica marcado como "fora do prazo". |
| COR-09 | Depois do envio, a Secretaria vê **"Correção recebida"** e pode **aceitar** (finaliza) ou **devolver de novo** (a anterior fica registrada como "Devolvida novamente"). Lista do PDI e painel do 1/3 têm o filtro "correção em andamento". |
| COR-10 | Situações, calculadas a partir do que está gravado: Correção solicitada, Prazo de correção encerrado, Correção recebida, Correção aceita, Devolvida novamente. |
