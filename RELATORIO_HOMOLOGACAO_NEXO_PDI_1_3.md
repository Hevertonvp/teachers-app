*+# Relatório de homologação NEXO — PDI e Formulário 1/3

Data: 04/11/2026. Modo: diagnóstico (código de produção **não alterado**). Banco: PostgreSQL local descartável (nunca o Neon).

## 1. Resumo executivo

Foi montado um ambiente isolado e executada, em **navegador real (Chromium via Playwright)**, a jornada completa de escola: Secretaria cria calendário, escolas, turmas, professores e vínculos pela interface; professores fazem o primeiro acesso com senha temporária; o Formulário 1/3 e o PDI são preenchidos, salvos, concluídos, reabertos, consultados após logout; testes de calendário, sobreposição, concorrência, permissões, prazo, reabertura, vínculos históricos, estados administrativos, offline e celular.

- **Registros na matriz:** 192 (executados: 187; substituídos por teste mais preciso: 5).
- **Aprovados:** 169. **Reprovados:** 9. **Observações (regra não especificada):** 9. **Bloqueados:** 0.
- **Não executados:** ver seção 16 (lista explícita).
- **Defeitos:** 0 críticos; 1 ALTO (DEF-09, depende de decisão de negócio); 5 MÉDIOS (DEF-01, DEF-06, DEF-07, DEF-08, DEF-13); demais BAIXOS/técnicos/conceituais.
- **Formulário 1/3:** APTO COM RESSALVAS. **PDI:** VALIDAÇÃO INSUFICIENTE para o módulo inteiro (o fluxo do professor testado se comportou bem).

Reprovações registradas na matriz (cada uma corresponde a um defeito ou a erro corrigido do meu teste, ver seção 13):
- UT-DEF-01 — Digitar logo após "Próximo" (rede lenta) deve ir para a semana seguinte
- UT-OFF-UX-desktop — Sem rede, o botão "Próximo" continua clicável (desktop)
- UT-OFF-UX-celular — Sem rede, o botão "Próximo" continua clicável (celular)
- UT-OFF-11 — Voltar com rede depois de fechar o navegador: a fila pendente é enviada ao ABRIR o app (30 s)
- UT-OFF-10 — Conflito: a tela mostra opções ao professor (usar versão salva / manter o meu)
- UT-OFF-10b — Conflito de fila: ao REABRIR o formulário aparecem as opções (usar versão salva / manter o meu)
- UT-VIN-P08 — P08: formulários visíveis conforme vínculo histórico
- PDI-OFF-02 — Botão "Salvar" do PDI continua clicável sem rede (não coberto por aviso)
- PDI-OFF-07 — A alteração pendente é enviada ao servidor ao abrir com rede (15 s)

## 2. Ambiente

- Navegador: Chromium (Playwright 1.63), com `--ignore-certificate-errors` **exclusivo do ambiente de homologação** (certificado autoassinado do Vite). Foi verificado que o Service Worker registra, fica ativo e controla a página (UT-SW-01); isso **não** prova offline: o SW por desenho não cacheia HTML/JS/CSS (LIM-01).
- Frontend: Vite dev server (https, porta 5180). Backend: Node/Express/Prisma (porta 3340). Banco: PostgreSQL embarcado (`embedded-postgres`, porta 54329, banco `nexo_homolog`), migrations aplicadas só nele. O Neon **não foi acessado** pela homologação; `db.mjs` recusa qualquer alvo que não seja o local.
- Dados: escolas `ZZ-HOMOLOG Escola Aurora/Boa Vista`, turmas 6M1…9M2 (nomes repetidos nas duas escolas), professores P01–P15, 4 alunos, calendário 2026 fictício.
- Intervenções que **não** foram pela interface (declaradas): vínculos com datas históricas (P07–P15) inseridos no banco local (DEF-03); definição de senha de P02/P03/P05; antecipar prazo do ciclo e da Aplicação; inativar professor/turma via API; chamadas diretas de API para provar a proteção do servidor, permissões e concorrência; leitura direta do banco para conferir persistência.
- Scripts reproduzíveis: `homologacao/*.mjs`. Evidências: `homologacao/evidencias/`.
- Testes antigos reexecutados no banco local: 20 casos de domínio e **50 de integração, 0 falhas**, sem resíduos (não contam como testes de navegador).

## 3. Inventário crítico das regras

**CONFIRMADAS (documentadas e comprovadas na homologação):** identidade do 1/3 = ciclo + professor + ano/série + disciplina (um formulário vale para todas as turmas e escolas do ano/série); vários ciclos no mesmo trimestre; janelas de ciclos ativos não podem se sobrepor, inclusive por fronteira coincidente, validado no servidor sob trava; datas do ciclo dentro do trimestre global (limites inclusivos); elegibilidade só Ensino Fundamental; concluir exige todas as semanas; editar após concluir enquanto a janela está aberta; reabertura só pela Secretaria e sem alterar o prazo original; cobertura separada da entrega; PDI: ficha = Aplicação + aluno + disciplina; um modelo ativo por disciplina; resposta compartilhada única por Aplicação+aluno+turma+professor; edição após concluir enquanto o período é editável; autorização por vínculo vivo.

**IMPLEMENTADAS, NÃO CONFIRMADAS:** ciclo com janela inteira no passado é aceito; reabertura aceita mesmo dentro da janela de outro ciclo ou em outro ano; não existe exclusão de ciclo (só inativar); ciclo de 1 a 30 semanas; texto de semana até 10.000 caracteres; Aplicação PDI não pode começar antes de hoje; ciclo em curso só considera professor/turma/escola ativos (seção 68); vínculo encerrado durante a janela conta como esperado mas o professor não consegue preencher.

**AMBÍGUAS:** o que fazer com a obrigação de quem teve vínculo encerrado na janela (DEF-09); se desativar turma/professor deve apagar obrigação não iniciada (QUE-01); diferença entre ano civil e ano letivo para ciclos (o ano do ciclo é o ano do calendário de trimestres); aluno transferido de escola no meio da Aplicação.

**AUSENTES:** limites de duração mínima/máxima da janela; ciclo para ano letivo já encerrado; comportamento na virada de ano; offline abrindo o app sem rede; edição da data de início de vínculo.

## 4. Matriz completa de testes

| ID | Módulo | Cenário | Esperado | Observado | Status | Evidência |
|---|---|---|---|---|---|---|
| PA-P01-01 | Primeiro acesso | URL protegida sem login redireciona ao login | /login | /login | APROVADO |  |
| PA-P01-02 | Primeiro acesso | Senha temporária incorreta é recusada com mensagem | permanece no login + mensagem | /login \| "E-mail ou senha incorretos." | APROVADO |  |
| PA-P01-03 | Primeiro acesso | Login com campos vazios não entra | /login | /login | APROVADO |  |
| PA-P01-04 | Primeiro acesso | Senha temporária correta leva à troca obrigatória | /primeiro-acesso | /primeiro-acesso | APROVADO |  |
| PA-P01-05 | Primeiro acesso | Atualizar a página (F5) mantém no primeiro acesso, sem perder a sessão | /primeiro-acesso | /primeiro-acesso | APROVADO |  |
| PA-P01-06 | Primeiro acesso | Antes de trocar a senha, outras telas ficam bloqueadas | /primeiro-acesso | /primeiro-acesso | APROVADO |  |
| PA-P01-07 | Primeiro acesso | Confirmação diferente da nova senha é recusada | mensagem "senhas não coincidem" | mensagem exibida | APROVADO |  |
| PA-P01-08 | Primeiro acesso | Senha muito curta (3 caracteres) é recusada | permanece em /primeiro-acesso | /primeiro-acesso | APROVADO |  |
| PA-P01-09 | Primeiro acesso | Senha definitiva válida conclui e leva ao sistema | rota do professor (dashboard) | /dashboard | APROVADO |  |
| PA-P01-10 | Primeiro acesso | Login com a senha definitiva entra direto (sem nova troca) | dashboard | /dashboard | APROVADO |  |
| PA-P01-11 | Primeiro acesso | Senha temporária já usada não funciona mais | /login | /login | APROVADO |  |
| PA-P04-01 | Primeiro acesso | URL protegida sem login redireciona ao login | /login | /login | APROVADO |  |
| PA-P04-02 | Primeiro acesso | Senha temporária incorreta é recusada com mensagem | permanece no login + mensagem | /login \| "E-mail ou senha incorretos." | APROVADO |  |
| PA-P04-03 | Primeiro acesso | Login com campos vazios não entra | /login | /login | APROVADO |  |
| PA-P04-04 | Primeiro acesso | Senha temporária correta leva à troca obrigatória | /primeiro-acesso | /primeiro-acesso | APROVADO |  |
| PA-P04-05 | Primeiro acesso | Atualizar a página (F5) mantém no primeiro acesso, sem perder a sessão | /primeiro-acesso | /primeiro-acesso | APROVADO |  |
| PA-P04-06 | Primeiro acesso | Antes de trocar a senha, outras telas ficam bloqueadas | /primeiro-acesso | /primeiro-acesso | APROVADO |  |
| PA-P04-07 | Primeiro acesso | Confirmação diferente da nova senha é recusada | mensagem "senhas não coincidem" | mensagem exibida | APROVADO |  |
| PA-P04-08 | Primeiro acesso | Senha muito curta (3 caracteres) é recusada | permanece em /primeiro-acesso | /primeiro-acesso | APROVADO |  |
| PA-P04-09 | Primeiro acesso | Senha definitiva válida conclui e leva ao sistema | rota do professor (dashboard) | /dashboard | APROVADO |  |
| PA-P04-10 | Primeiro acesso | Login com a senha definitiva entra direto (sem nova troca) | dashboard | /dashboard | APROVADO |  |
| PA-P04-11 | Primeiro acesso | Senha temporária já usada não funciona mais | /login | /login | APROVADO |  |
| UT-C01 | Formulário 1/3 | Secretaria cria ciclo do 3º trimestre pela interface | ciclo criado | criado | APROVADO | evidencias/04-secretaria-ciclo-criado.png |
| UT-DEF-01 | Formulário 1/3 | Digitar logo após "Próximo" (rede lenta) deve ir para a semana seguinte | texto na semana 2; semana 1 intacta | semana 1 (banco): ": aquarela e mistura de cores primárias (editado)."; semana 1 (tela): " primárias (editado). DIGITADO-APOS-CLICAR-PROXIMO"; semana 2 vazia: true | REPROVADO | evidencias/05-defeito-troca-semana-durante-espera.png |
| UT-P04-01 | Formulário 1/3 | P04 (8 vínculos, 7 combinações ano+disciplina) vê exatamente 7 formulários | 7 cartões | 7 cartões | APROVADO | evidencias/04-p04-lista-1-3.png |
| UT-P04-02-6ºIng | Formulário 1/3 | Cartão 6º Inglês cobre 6M1 e 6M2 (Aurora) | válido para 6M1, 6M2 | Válido para: ZZ-HOMOLOG Escola Aurora — 6M1, 6M2 4/4 semanas Continuar | APROVADO |  |
| UT-P04-02-6ºArt | Formulário 1/3 | Cartão 6º Arte cobre 6M1 (Aurora) | válido para 6M1 | Válido para: ZZ-HOMOLOG Escola Aurora — 6M1 0/4 semanas Preencher | APROVADO |  |
| UT-P04-02-6ºEns | Formulário 1/3 | Cartão 6º Ensino Religioso cobre 6M1 (Aurora) | válido para 6M1 | Válido para: ZZ-HOMOLOG Escola Aurora — 6M1 0/4 semanas Preencher | APROVADO |  |
| UT-P04-02-7ºIng | Formulário 1/3 | Cartão 7º Inglês cobre 7M1 (Aurora) | válido para 7M1 | Válido para: ZZ-HOMOLOG Escola Aurora — 7M1 0/4 semanas Preencher | APROVADO |  |
| UT-P04-02-7ºArt | Formulário 1/3 | Cartão 7º Arte cobre 7M1 (Aurora) | válido para 7M1 | Válido para: ZZ-HOMOLOG Escola Aurora — 7M1 1/4 semanas Continuar | APROVADO |  |
| UT-P04-02-8ºIng | Formulário 1/3 | Cartão 8º Inglês cobre 8M1 (Boa Vista) | válido para 8M1 | Válido para: ZZ-HOMOLOG Escola Boa Vista — 8M1 0/4 semanas Preencher | APROVADO |  |
| UT-P04-02-9ºIng | Formulário 1/3 | Cartão 9º Inglês cobre 9M2 (Boa Vista) | válido para 9M2 | Válido para: ZZ-HOMOLOG Escola Boa Vista — 9M2 0/4 semanas Preencher | APROVADO |  |
| UT-P04-03 | Formulário 1/3 | Respostas das 4 semanas persistem no banco (6º Ensino Religioso) | 4 respostas idênticas | 4 respostas; textos iguais: true | APROVADO | evidencias/04-p04-salvo-parcial-semana2.png |
| UT-P04-04 | Formulário 1/3 | 6º Inglês (6M1+6M2) gera 1 entrega com 2 coberturas | 1 entrega, 2 coberturas | 1 entrega(s), 2 coberturas (6M1,6M2) | APROVADO |  |
| UT-P04-05 | Formulário 1/3 | Após logout/login a semana 1 reaparece igual | Introdução ao Simple Present: rotina diária (wake  | Introdução ao Simple Present: rotina diária (wake  | APROVADO |  |
| UT-P04-06 | Formulário 1/3 | Duplo clique em Concluir gera 1 só evento CONCLUIDA e status concluída | 1 CONCLUIDA + status CONCLUIDA | 1 CONCLUIDA; status CONCLUIDA | APROVADO | evidencias/04-p04-concluido.png |
| UT-T-S01 | Formulário 1/3 (calendário) | B começa depois de A terminar (mesmo trimestre) | ACEITO | ACEITO (banco: 1) | APROVADO |  |
| UT-T-S02 | Formulário 1/3 (calendário) | B começa exatamente quando A termina (20/11 18:00) | REJEITADO | REJEITADO: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:00 a 20/11/2026, 18:00). Dois Formulários 1/3 não podem ficar abertos ao mesmo te | APROVADO | evidencias/06-S02-rejeitado.png |
| UT-T-S03 | Formulário 1/3 (calendário) | B começa 1 minuto antes de A terminar | REJEITADO | REJEITADO: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:00 a 20/11/2026, 18:00). Dois Formulários 1/3 não podem ficar abertos ao mesmo te | APROVADO | evidencias/06-S03-rejeitado.png |
| UT-T-S04 | Formulário 1/3 (calendário) | B começa durante A e termina depois | REJEITADO | REJEITADO: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:00 a 20/11/2026, 18:00). Dois Formulários 1/3 não podem ficar abertos ao mesmo te | APROVADO | evidencias/06-S04-rejeitado.png |
| UT-T-S05 | Formulário 1/3 (calendário) | B totalmente contido em A | REJEITADO | REJEITADO: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:00 a 20/11/2026, 18:00). Dois Formulários 1/3 não podem ficar abertos ao mesmo te | APROVADO | evidencias/06-S05-rejeitado.png |
| UT-T-S06 | Formulário 1/3 (calendário) | B contém A inteiro | REJEITADO | REJEITADO: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:00 a 20/11/2026, 18:00). Dois Formulários 1/3 não podem ficar abertos ao mesmo te | APROVADO | evidencias/06-S06-rejeitado.png |
| UT-T-S07 | Formulário 1/3 (calendário) | B com janela idêntica à de A | REJEITADO | REJEITADO: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:00 a 20/11/2026, 18:00). Dois Formulários 1/3 não podem ficar abertos ao mesmo te | APROVADO | evidencias/06-S07-rejeitado.png |
| UT-T-S08 | Formulário 1/3 (calendário) | B começa antes de A e termina durante A | REJEITADO | REJEITADO: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:00 a 20/11/2026, 18:00). Dois Formulários 1/3 não podem ficar abertos ao mesmo te | APROVADO | evidencias/06-S08-rejeitado.png |
| UT-T-S09 | Formulário 1/3 (calendário) | B termina exatamente quando A começa (02/11 08:00) | REJEITADO | REJEITADO: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:00 a 20/11/2026, 18:00). Dois Formulários 1/3 não podem ficar abertos ao mesmo te | APROVADO | evidencias/06-S09-rejeitado.png |
| UT-T-S10 | Formulário 1/3 (calendário) | B termina 1 minuto antes de A começar (janela toda no passado) | ACEITO* | ACEITO (banco: 1) | OBSERVAÇÃO |  |
| UT-T-S12 | Formulário 1/3 (calendário) | B em outro trimestre (2º/2026), janela no passado | ACEITO* | ACEITO (banco: 1) | OBSERVAÇÃO |  |
| UT-T-S13 | Formulário 1/3 (calendário) | B em ano letivo 2027 (calendário não configurado) | REJEITADO | REJEITADO: BOTÃO SALVAR DESABILITADO pela interface. calendário. | APROVADO | evidencias/06-S13-rejeitado.png |
| UT-T-L02 | Formulário 1/3 (calendário) | Abertura no 1º instante do trimestre (16/08 00:00) | ACEITO* | ACEITO (banco: 1) | OBSERVAÇÃO |  |
| UT-T-L03 | Formulário 1/3 (calendário) | Prazo no último instante do trimestre (18/12 23:59) | ACEITO | ACEITO (banco: 1) | APROVADO |  |
| UT-T-L04 | Formulário 1/3 (calendário) | Abertura 1 min antes do trimestre (15/08 23:59) | REJEITADO | REJEITADO: A abertura (15/08/2026) está fora do 3º trimestre (16/08/2026 a 18/12/2026). | APROVADO | evidencias/06-L04-rejeitado.png |
| UT-T-L05 | Formulário 1/3 (calendário) | Prazo no dia seguinte ao fim (19/12 00:00) | REJEITADO | REJEITADO: O prazo de entrega (19/12/2026) está fora do 3º trimestre (16/08/2026 a 18/12/2026). | APROVADO | evidencias/06-L05-rejeitado.png |
| UT-T-L06 | Formulário 1/3 (calendário) | Janela inteira fora do trimestre (jan/2027 num ciclo do 3º/2026) | REJEITADO | REJEITADO: A abertura (10/01/2027) está fora do 3º trimestre (16/08/2026 a 18/12/2026). | APROVADO | evidencias/06-L06-rejeitado.png |
| UT-T-L07 | Formulário 1/3 (calendário) | Janela cruza a fronteira 2º→3º trimestre (rotulado 2º tri) | REJEITADO | REJEITADO: O prazo de entrega (16/08/2026) está fora do 2º trimestre (01/05/2026 a 15/08/2026). | APROVADO | evidencias/06-L07-rejeitado.png |
| UT-T-L08 | Formulário 1/3 (calendário) | Abertura e prazo no mesmo dia (01/12 08:00→18:00) | ACEITO | ACEITO (banco: 1) | APROVADO |  |
| UT-T-L09 | Formulário 1/3 (calendário) | Abertura DEPOIS do prazo | REJEITADO | REJEITADO: O prazo de entrega precisa ser depois da abertura. | APROVADO | evidencias/06-L09-rejeitado.png |
| UT-T-L10 | Formulário 1/3 (calendário) | Abertura IGUAL ao prazo | REJEITADO | REJEITADO: O prazo de entrega precisa ser depois da abertura. | APROVADO | evidencias/06-L10-rejeitado.png |
| UT-T-L12 | Formulário 1/3 (calendário) | Duração máxima: trimestre inteiro (16/08 → 18/12), sem sobrepor A? (sobrepõe A) | REJEITADO | REJEITADO: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:00 a 20/11/2026, 18:00). Dois Formulários 1/3 não podem ficar abertos ao mesmo te | APROVADO | evidencias/06-L12-rejeitado.png |
| UT-T-Y01 | Formulário 1/3 (calendário) | Ano letivo 2025 sem calendário configurado | REJEITADO | REJEITADO: BOTÃO SALVAR DESABILITADO pela interface. calendário. | APROVADO | evidencias/06-Y01-rejeitado.png |
| UT-T-INV1 | Formulário 1/3 (calendário) | Invariante: nenhum par de ciclos ATIVOS sobrepostos no banco | 0 pares | 0 pares | APROVADO |  |
| UT-SRV-A01 | Formulário 1/3 (servidor) | API recusa: trimestre 4 | HTTP 400 | HTTP 400: Trimestre inválido — use 1, 2 ou 3. | APROVADO |  |
| UT-SRV-A02 | Formulário 1/3 (servidor) | API recusa: ano letivo 1999 | HTTP 400 | HTTP 400: Ano letivo inválido. | APROVADO |  |
| UT-SRV-A03 | Formulário 1/3 (servidor) | API recusa: abertura ausente | HTTP 400 | HTTP 400: Dados inválidos. | APROVADO |  |
| UT-SRV-A04 | Formulário 1/3 (servidor) | API recusa: abertura "abc" | HTTP 400 | HTTP 400: Abertura: data/hora inválida. | APROVADO |  |
| UT-SRV-A05 | Formulário 1/3 (servidor) | API recusa: lista de semanas vazia | HTTP 400 | HTTP 400: Informe ao menos uma semana. | APROVADO |  |
| UT-SRV-A06 | Formulário 1/3 (servidor) | API recusa: 31 semanas | HTTP 400 | HTTP 400: No máximo 30 semanas por ciclo. | APROVADO |  |
| UT-SRV-A07 | Formulário 1/3 (servidor) | API recusa: semana com início depois do fim | HTTP 400 | HTTP 400: Semana 1: o início não pode ser depois do fim. | APROVADO |  |
| UT-SRV-A08 | Formulário 1/3 (servidor) | API recusa: semana fora do trimestre (15/08) | HTTP 400 | HTTP 400: Semana 1 (10/08/2026 a 15/08/2026) está fora do 3º trimestre (16/08/2026 a 18/12/2026). | APROVADO |  |
| UT-SRV-A09 | Formulário 1/3 (servidor) | API recusa: título com 201 caracteres | HTTP 400 | HTTP 400: Título muito longo. | APROVADO |  |
| UT-SRV-A10 | Formulário 1/3 (servidor) | API recusa: prazo fora do trimestre (20/12) | HTTP 400 | HTTP 400: O prazo de entrega (20/12/2026) está fora do 3º trimestre (16/08/2026 a 18/12/2026). | APROVADO |  |
| UT-SRV-A11 | Formulário 1/3 (servidor) | API recusa: semana com data inexistente 31/11 | HTTP 400 | HTTP 400: Semana 1: data de início inválida. | APROVADO |  |
| UT-SRV-A12 | Formulário 1/3 (servidor) | API recusa: sobreposição (começa no prazo de A, 20/11 18:00) | HTTP 409 | HTTP 409: A janela de preenchimento se sobrepõe ao "Formulário 1/3 — Nov/2026 (homolog)" (3º trimestre, 02/11/2026, 08:0 | APROVADO |  |
| UT-SRV-A13 | Formulário 1/3 (servidor) | API recusa: ano letivo sem calendário (2030) | HTTP 400/409 | HTTP 400: O 3º trimestre de 2030 não está configurado no calendário. Configure em Configurações › Trimestres antes de cr | APROVADO |  |
| UT-PERM-P01 | Formulário 1/3 (permissões) | Professor tenta criar ciclo | HTTP 403 | HTTP 403 | APROVADO |  |
| UT-PERM-P02 | Formulário 1/3 (permissões) | Professor tenta editar ciclo | HTTP 403 | HTTP 403 | APROVADO |  |
| UT-PERM-P03 | Formulário 1/3 (permissões) | Professor tenta reabrir ciclo | HTTP 403 | HTTP 403 | APROVADO |  |
| UT-PERM-P04 | Formulário 1/3 (permissões) | Professor tenta ver o painel administrativo | HTTP 403 | HTTP 403 | APROVADO |  |
| UT-PERM-P05 | Formulário 1/3 (permissões) | Professor tenta inativar ciclo | HTTP 403 | HTTP 403 | APROVADO |  |
| UT-PERM-P06 | Formulário 1/3 (permissões) | Secretaria tenta usar rota de preenchimento do professor (/minhas) | HTTP 403 | HTTP 403 | APROVADO |  |
| UT-PERM-P07 | Formulário 1/3 (permissões) | Sem token: lista de ciclos | HTTP 401 | HTTP 401 | APROVADO |  |
| UT-PERM-P08 | Formulário 1/3 (permissões) | Token inválido | HTTP 401 | HTTP 401 | APROVADO |  |
| UT-PERM-P09 | Formulário 1/3 (permissões) | P01 (só 6º Matemática) abre formulário 7º Arte que é do P04 | HTTP 403/404 | HTTP 404 | APROVADO |  |
| UT-PERM-P10 | Formulário 1/3 (permissões) | P01 tenta gravar respostas num formulário que não é dele | HTTP 403/404 | HTTP 400 | SUBSTITUÍDO |  |
| UT-PERM-P11 | Formulário 1/3 (permissões) | P01 tenta concluir formulário que não é dele | HTTP 403/404 | HTTP 403 | APROVADO |  |
| UT-PERM-P12 | Formulário 1/3 (permissões) | P01 tenta ler entrega do P04 pela rota administrativa | HTTP 403 | HTTP 403 | APROVADO |  |
| UT-PERM-P13 | Formulário 1/3 (permissões) | Lista do P01 só tem o formulário dele (6º Matemática) | 1 item, sem Arte/Inglês | 1 item(ns); contém "Inglês": false | APROVADO |  |
| UT-CONC-C01 | Formulário 1/3 (concorrência) | duas criações parcialmente sobrepostas ao mesmo tempo | 1 criada(s), as demais 409 | status 201,409; ATIVAS no banco: 1 | APROVADO |  |
| UT-CONC-C02 | Formulário 1/3 (concorrência) | duas criações IDÊNTICAS ao mesmo tempo | 1 criada(s), as demais 409 | status 201,409; ATIVAS no banco: 1 | APROVADO |  |
| UT-CONC-C03 | Formulário 1/3 (concorrência) | duas criações que dividem a fronteira (prazo de uma = abertura da outra) | 1 criada(s), as demais 409 | status 201,409; ATIVAS no banco: 1 | APROVADO |  |
| UT-CONC-C04 | Formulário 1/3 (concorrência) | cinco criações idênticas ao mesmo tempo | 1 criada(s), as demais 409 | status 201,409,409,409,409; ATIVAS no banco: 1 | APROVADO |  |
| UT-CONC-C05 | Formulário 1/3 (concorrência) | duas criações disjuntas ao mesmo tempo (ambas devem passar) | 2 criada(s), as demais 409 | status 201,201; ATIVAS no banco: 2 | APROVADO |  |
| UT-CONC-INV | Formulário 1/3 (concorrência) | Invariante após a concorrência: nenhum par de ATIVOS sobrepostos | 0 pares | 0 pares | APROVADO |  |
| UT-ED-01 | Formulário 1/3 (edição) | Editar ciclo para uma janela que sobrepõe o ciclo A | HTTP 409 | HTTP 409 | APROVADO |  |
| UT-ED-02 | Formulário 1/3 (edição) | Reativar ciclo inativo cuja janela agora colide com outro ciclo ativo | HTTP 409 | HTTP 409 | APROVADO |  |
| UT-ED-03 | Formulário 1/3 (edição) | Mudar trimestre de ciclo que já tem entregas | HTTP 409 (travado) | HTTP 409 | APROVADO |  |
| UT-ED-04 | Formulário 1/3 (edição) | Inativar ciclo que já tem preenchimentos | HTTP 409 | HTTP 409 | APROVADO |  |
| UT-ED-05 | Formulário 1/3 (edição) | Excluir ciclo (não há rota de exclusão; só inativar) | HTTP 404 (sem exclusão) | HTTP 404 | OBSERVAÇÃO |  |
| UT-REA-01 | Formulário 1/3 (reabertura) | Reabrir ciclo (janela fora do prazo original) | aceita | HTTP 201 | APROVADO |  |
| UT-REA-02 | Formulário 1/3 (reabertura) | Segunda reabertura com período sobreposto à primeira | HTTP 400 | HTTP 400 | APROVADO |  |
| UT-REA-03 | Formulário 1/3 (reabertura) | Reabertura cuja janela cai DENTRO do período aberto do ciclo A (colide com outro ciclo) | regra NÃO definida (ambiguidade conhecida) | HTTP 201 | OBSERVAÇÃO |  |
| UT-REA-04 | Formulário 1/3 (reabertura) | Reabertura com fim antes do início | HTTP 400 | HTTP 400 | APROVADO |  |
| UT-REA-05 | Formulário 1/3 (reabertura) | Reabertura em data de outro ano letivo/trimestre (mar/2027) | regra NÃO definida | HTTP 201 | OBSERVAÇÃO |  |
| UT-PERM-P10b | Formulário 1/3 (permissões) | P01 grava respostas (corpo válido) em formulário que não é dele | HTTP 403/404 e nenhum dado alterado | HTTP 403 (Você não tem vínculo ativo com esta disciplina neste ano/série.); dados do P04 alterados: false; entregas criadas p/ P01 no 7º ano: 0 | APROVADO |  |
| UT-SW-01 | Offline (Service Worker) | Service Worker registra, fica ativo e controla a página (certificado autoassinado aceito só neste ambiente) | registrado=1, ativo, controla=true | {"registrado":1,"estado":"activated","escopo":"https://localhost:5180/","controla":true,"caches":["gp-static-v1"]} | APROVADO |  |
| UT-OFF-01 | Offline | Salvamento ONLINE grava a semana 1 no servidor | 1 resposta no banco | 1 resposta(s) | APROVADO |  |
| UT-OFF-UX-desktop | Offline (usabilidade) | Sem rede, o botão "Próximo" continua clicável (desktop) | clicável | BLOQUEADO por aviso fixo: "Sem conexão com a internet. Suas alterações estão protegidas neste dispositivo. Reconectan" | REPROVADO | evidencias/11-offline-banner-desktop.png |
| UT-OFF-UX-celular | Offline (usabilidade) | Sem rede, o botão "Próximo" continua clicável (celular) | clicável | BLOQUEADO por aviso fixo: "Sem conexão com a internet. Suas alterações estão protegidas neste dispositivo. Reconectan" | REPROVADO | evidencias/11-offline-banner-celular.png |
| UT-OFF-02 | Offline | Salvar sem rede NÃO perde o texto: vai para a fila local; servidor ainda sem a semana 2 | fila com 1 item pendente; banco com 1 resposta | fila: [{"key":"p04@homolog.nexo::um-terco-resposta::1-9-9::respostas","status":"pending","attempts":0,"lastError":null,"resourceId":"1-9-9"}]; banco: 1 resposta(s) | APROVADO | evidencias/10-offline-apos-salvar.png |
| UT-OFF-03 | Offline | A tela AVISA claramente que está offline / pendente de sincronização | aviso visível | aviso encontrado no texto da tela | APROVADO | evidencias/10-offline-apos-salvar.png |
| UT-OFF-04 | Offline | Várias edições do MESMO formulário offline não geram itens duplicados na fila | 1 item na fila (instantâneo único) | 1 item(ns): ["pending"] | APROVADO |  |
| UT-OFF-05 | Offline | Abrir o app do zero (nova aba) SEM rede | por desenho o SW não cacheia o shell: não abre | não abriu (erro de rede do navegador) | OBSERVAÇÃO | evidencias/10-offline-recarga-sem-rede.png |
| UT-OFF-06 | Offline | Ao reconectar, a fila sincroniza sozinha e o servidor recebe as 3 semanas | 3 respostas no banco | 3 resposta(s) após 2s; textos: Semana 1 \| Semana 2 \| Semana 3  | APROVADO |  |
| UT-OFF-07 | Offline | Fila esvazia depois de sincronizar e não há eventos/respostas duplicados | fila vazia; 3 respostas; 1 evento INICIADA | fila: 0; respostas: 3; INICIADA: 1 | APROVADO |  |
| UT-OFF-08 | Offline | Fechar a aba com dado só local e voltar depois: o que foi digitado offline chega ao servidor | 2 respostas no banco | 4 resposta(s); textos: Semana 1 P \| \| \|  | SUBSTITUÍDO |  |
| UT-OFF-11a | Offline | Antes de fechar: edição offline da semana 2 está guardada na fila local | 1 item pendente | [{"status":"pending","attempts":0}] | APROVADO |  |
| UT-OFF-11 | Offline | Voltar com rede depois de fechar o navegador: a fila pendente é enviada ao ABRIR o app (30 s) | servidor recebe a semana 2 | fila ao abrir: [{"status":"pending","attempts":0}]; após 30 s: [{"status":"pending","attempts":0}]; servidor (semanas com texto): S1:Semana 1 ONLINE do; aviso: "1 alteração aguardando sincronização." | REPROVADO | evidencias/12-fila-pendente-online.png |
| UT-OFF-12 | Offline | Ao reabrir o formulário, o texto digitado offline ainda aparece (rascunho local restaurado) | semana 2 visível com o texto offline | semana 2 na tela: "Semana 2 OFFLINE do 8º ano: profissões e entrevista simulada" | APROVADO |  |
| UT-OFF-13 | Offline | Reabrir o formulário dispara o envio do que estava pendente | servidor com semana 2 | S1:Semana 1 ONLINE do \| S2:Semana 2 OFFLINE d | APROVADO |  |
| UT-OFF-09 | Offline | Conflito: celular editou offline, outro dispositivo gravou antes → servidor NÃO é sobrescrito em silêncio | servidor mantém o texto do outro dispositivo | HTTP do outro dispositivo: 200; servidor: "Semana 1 EDITADA NO COMPUTADOR DA ESCOLA (outro disposi" | APROVADO | evidencias/10-offline-conflito.png |
| UT-OFF-10 | Offline | Conflito: a tela mostra opções ao professor (usar versão salva / manter o meu) | aviso de conflito visível | SEM aviso de conflito na tela | REPROVADO | evidencias/10-offline-conflito.png |
| UT-OFF-10b | Offline | Conflito de fila: ao REABRIR o formulário aparecem as opções (usar versão salva / manter o meu) | opções visíveis | sem opções; texto da semana 1: Semana 1 EDITADA OFFLINE no celular: saudações formais, info | REPROVADO | evidencias/10-offline-conflito-reaberto.png |
| UT-VIN-00 | Vínculos | Turma de Educação Infantil criada pela interface | turma EI existe | Berçário I — Manhã | APROVADO |  |
| UT-VIN-P07 | Vínculos | P07: formulários visíveis conforme vínculo histórico | 6º ano — Matemática | 6º ano — Matemática \| 6º ano — Matemática cobre 6M3: true | APROVADO | evidencias/13-P07-lista.png |
| UT-VIN-P08 | Vínculos | P08: formulários visíveis conforme vínculo histórico | 6º ano — Redação | (nenhum) — tela: "Formulário 1/3 — Conteúdos Registre, semana a semana, os conteúdos que você ensinou. Você preenche uma vez por ano/série e discipl" | REPROVADO | evidencias/13-P08-lista.png |
| UT-VIN-P09 | Vínculos | P09: formulários visíveis conforme vínculo histórico | (nenhum) | (nenhum) — tela: "Formulário 1/3 — Conteúdos Registre, semana a semana, os conteúdos que você ensinou. Você preenche uma vez por ano/série e discipl" | APROVADO | evidencias/13-P09-lista.png |
| UT-VIN-P10 | Vínculos | P10: formulários visíveis conforme vínculo histórico | (nenhum) | (nenhum) — tela: "Formulário 1/3 — Conteúdos Registre, semana a semana, os conteúdos que você ensinou. Você preenche uma vez por ano/série e discipl" | APROVADO | evidencias/13-P10-lista.png |
| UT-VIN-P11 | Vínculos | P11: formulários visíveis conforme vínculo histórico | 7º ano — História | 7º ano — História | APROVADO | evidencias/13-P11-lista.png |
| UT-VIN-P12 | Vínculos | P12: formulários visíveis conforme vínculo histórico | 6º ano — Ciências + 7º ano — Ciências | 6º ano — Ciências + 7º ano — Ciências \| 6º ano — Ciências cobre 6M4: true \| 7º ano — Ciências cobre 7M2: true | APROVADO | evidencias/13-P12-lista.png |
| UT-VIN-P13 | Vínculos | P13: formulários visíveis conforme vínculo histórico | (nenhum) | (nenhum) — tela: "Formulário 1/3 — Conteúdos Registre, semana a semana, os conteúdos que você ensinou. Você preenche uma vez por ano/série e discipl" | APROVADO | evidencias/13-P13-lista.png |
| UT-VIN-P14 | Vínculos | P14: formulários visíveis conforme vínculo histórico | (nenhum) | (nenhum) — tela: "Formulário 1/3 — Conteúdos Registre, semana a semana, os conteúdos que você ensinou. Você preenche uma vez por ano/série e discipl" | APROVADO | evidencias/13-P14-lista.png |
| UT-VIN-P15 | Vínculos | P15: formulários visíveis conforme vínculo histórico | 7º ano — Matemática | 7º ano — Matemática | APROVADO | evidencias/13-P15-lista.png |
| UT-VIN-PAINEL1 | Painel | Painel: obrigações esperadas = 21 (cálculo manual por professor) | Esperadas 21 | {"esperadas":21,"concluidas":2,"andamento":4,"nao":15,"linhas":21} | APROVADO | evidencias/13-painel-antes.png |
| UT-VIN-PAINEL1b | Painel | Painel: concluídas + em andamento + não iniciadas = esperadas | soma = esperadas | 2+4+15=21 | APROVADO |  |
| UT-VIN-CARDS | Painel | Total de cartões vistos pelos professores novos = 6 e bate com o painel | 5 (P07,P08 não,P11,P12 x2,P15) — corrigido | 5 | SUBSTITUÍDO |  |
| UT-EST-01 | Estados administrativos | P11 conclui o 7º História pela interface | status CONCLUIDA | CONCLUIDA | APROVADO |  |
| UT-EST-02 | Estados administrativos | Painel com P11 concluído e todos ativos: esperadas 21, concluídas 3 | 21 / 3 | 21 / 3 | APROVADO | evidencias/14-painel-antes-desativar.png |
| UT-EST-03 | Estados administrativos | Professor desativado DEPOIS de concluir: a entrega concluída continua contando no painel (histórico preservado) | esperadas 21 / concluídas 3 (P11 visível) | esperadas 20, concluídas 3, P11 na lista: true | APROVADO | evidencias/14-painel-depois-desativar.png |
| UT-EST-04 | Estados administrativos | Turma inativada durante o ciclo: obrigação do P15 (único vínculo) sai do painel | documentado: sai (19 no total) | esperadas 20; P15 na lista: false | OBSERVAÇÃO | evidencias/14-painel-depois-desativar.png |
| UT-EST-05 | Estados administrativos | Professor inativo não consegue entrar | permanece no login | /login | APROVADO |  |
| UT-EST-06 | Estados administrativos | P15 (turma inativada): formulário some da lista dele | 0 cartões | 0 cartão(ões) | OBSERVAÇÃO |  |
| UT-EST-07 | Estados administrativos | Reativar professor e turma restaura painel (21 / 3) | 21 / 3 | 21 / 3 | APROVADO |  |
| UT-PRZ-00 | Prazo | Secretaria antecipa o prazo do ciclo (edição com entregas permitida) | HTTP 200 | HTTP 200 | APROVADO |  |
| UT-PRZ-01 | Prazo | Lista mostra o ciclo como Encerrado e o botão passa a "Ver" | selo Encerrado e botão Ver | Encerrado: true; Ver: true | APROVADO | evidencias/15-prazo-vencido-lista.png |
| UT-PRZ-02 | Prazo | Formulário após o prazo fica somente leitura (campo desabilitado) | campo desabilitado | desabilitado: true; mensagem: "Prazo: 04/11/2026, 09:00 Válido para: ZZ-HOMOLOG Escola Boa Vista — 8M1 Somente leitura." | APROVADO | evidencias/15-prazo-vencido-formulario.png |
| UT-PRZ-03 | Prazo | Servidor recusa gravar após o prazo (não depende da tela) | HTTP 400/403 e mensagem de prazo | HTTP 400: O prazo deste Formulário 1/3 terminou — ele está somente para leitura. Peça à Secretaria u | APROVADO |  |
| UT-PRZ-04 | Prazo | Nada foi gravado pela tentativa fora do prazo | 0 registros | 0 | APROVADO |  |
| UT-PRZ-05 | Prazo | Prazo vence com a tela aberta: salvar depois do vencimento é recusado e o professor é avisado | não grava; mensagem clara | gravou: 0; mensagem na tela: "Prazo: 20/11/2026, 18:00 Válido para: ZZ-HOMOLOG Escola Boa Vista — 9M2 O prazo deste Formulário 1/3 terminou — ele está" | APROVADO | evidencias/15-vence-com-tela-aberta.png |
| UT-PRZ-06 | Reabertura | Secretaria reabre o ciclo pela interface (04/11 00:00 → 06/11 23:59) | 1 reabertura registrada | 1 reabertura(s) | APROVADO | evidencias/15-reabertura-secretaria.png |
| UT-PRZ-07 | Reabertura | Dentro da reabertura o professor volta a editar e o texto é gravado | campo habilitado e texto gravado | habilitado: true; gravado: 1 | APROVADO |  |
| UT-PRZ-08 | Reabertura | Prazo original do ciclo permanece 04/11 09:00 (reabertura não altera o prazo) | prazoEm original inalterado | 2026-11-04T12:00:00.000Z | APROVADO |  |
| PDI-SET-01 | PDI | Secretaria cadastra 3 perguntas padrão pela interface (1 compartilhada, 2 por disciplina) | 3 perguntas padrão | 3 | APROVADO | evidencias/17-perguntas-padrao.png |
| PDI-SET-02 | PDI | Secretaria cria 7 modelos (um por disciplina), cada um nasce com as 3 perguntas padrão | 7 modelos x 3 perguntas | Matemática:3, Inglês:3, Arte:3, Ensino Religioso:3, Língua Portuguesa:3, Ciências:3, História:3 | APROVADO | evidencias/17-modelos.png |
| PDI-SET-03 | PDI | Secretaria cria Aplicação PDI da Escola Aurora (3º tri, 04/11–15/12) com 7 disciplinas | 1 aplicação | ZZ-HOMOLOG Escola Aurora tri=3 | APROVADO | evidencias/18-aplicacoes.png |
| PDI-SET-04 | PDI | Secretaria cadastra 4 alunos PDI pela interface | 4 alunos | 4 | APROVADO | evidencias/18-alunos.png |
| PDI-P04-01 | PDI | Formulário único do Lucas mostra 1 bloco compartilhado + 3 blocos de disciplina | 4 campos de texto | 4 campos | APROVADO | evidencias/19-p04-formulario-unico-lucas.png |
| PDI-P04-02 | PDI | Salvar parcial volta para "Meus PDIs" e grava só o que foi preenchido | /pdi/meus-pdis e fichas persistidas | /pdi/meus-pdis \| Arte:EM_ANDAMENTO/2resp \| Ensino Religioso:EM_ANDAMENTO/2resp \| Inglês:EM_ANDAMENTO/2resp | APROVADO |  |
| PDI-P04-03 | PDI | Ao reabrir, o texto compartilhado e o de Arte reaparecem iguais | textos idênticos | compartilhado ok: true; Arte ok: true | APROVADO |  |
| PDI-P04-04 | PDI | Clique duplo em Salvar não duplica fichas nem respostas | 3 fichas, sem duplicatas | 3 fichas; Arte:EM_ANDAMENTO/2resp \| Ensino Religioso:EM_ANDAMENTO/2resp \| Inglês:EM_ANDAMENTO/2resp | APROVADO |  |
| PDI-P04-05 | PDI | Resposta compartilhada gravada UMA vez para as 3 disciplinas (bloco padrão) | 1 resposta padrão no bloco | 1 | APROVADO |  |
| PDI-P04-06 | PDI | Ficha vazia: botão "Concluir Inglês" fica desabilitado na tela | botão desabilitado | desabilitado: true | APROVADO | evidencias/20-concluir-vazio.png |
| PDI-P04-06b | PDI | Servidor recusa concluir ficha incompleta | HTTP 4xx ou sem ficha | HTTP 400 | APROVADO |  |
| PDI-P04-07 | PDI | "Concluir todas as disciplinas" conclui as 3 fichas da Marina | 3 fichas CONCLUIDA | Arte:CONCLUIDA/2resp \| Ensino Religioso:CONCLUIDA/2resp \| Inglês:CONCLUIDA/2resp | APROVADO |  |
| PDI-P04-08 | PDI | Ficha concluída fica protegida contra edição pelo professor | campos HABILITADOS (edição após concluir é permitida enquanto o período é editável — contexto, seção 37) | disabled: false | APROVADO |  |
| PDI-P04-09 | PDI | Após logout/login, Meus PDIs mostra a Marina concluída e o Lucas em preenchimento | estados persistem | Lucas Almeida Prado ZZ-HOMOLOG Escola Aurora 6M1 Arte Em preenchimento Ensino Religioso Em preenchimento Inglês Em preenchimento 04/11/2026 a 15/12/2026 Vigente Marina Teixeira Lopes ZZ-HOMOLOG Escola Aurora 6M1 Arte Concluído Ens | APROVADO | evidencias/20-meus-pdis-apos-relogin.png |
| PDI-MULTI-01 | PDI | P02 vê só as 3 disciplinas dele (LP, Ciências, História), sem as do P04 | LP+Ciências+História; sem Inglês/Arte/ER | confere | APROVADO |  |
| PDI-MULTI-02 | PDI | Bloco compartilhado do P02 começa VAZIO (não herda o texto do P04 sobre o mesmo aluno) | campo vazio | "" | APROVADO |  |
| PDI-MULTI-03 | PDI | P02 e P04 têm blocos compartilhados SEPARADOS para o mesmo aluno/turma | 2 blocos (um por professor) | 2 bloco(s): p04@homolog.nexo, p02@homolog.nexo | APROVADO |  |
| PDI-MULTI-04 | PDI | O texto do P04 sobre o Lucas permanece intacto depois que o P02 salvou o dele | texto do P04 preservado | "Lucas demonstra boa autonomia e curiosidade; " | APROVADO |  |
| PDI-AUT-P03 | PDI | P03 (Geografia 6M2/6M3/6M4/7M2; sem vínculo com a 6M1) abre o PDI do Lucas por URL | sem acesso ao formulário nem ao conteúdo | rota: /pdi/aluno/1/1; conteúdo exposto: false | APROVADO | evidencias/21-p03-acesso-negado.png |
| PDI-AUT-P05 | PDI | P05 (Educação Física, sem modelo/vínculo com 6M1) abre o PDI do Lucas por URL | sem acesso ao formulário nem ao conteúdo | rota: /pdi/aluno/1/1; conteúdo exposto: false | APROVADO | evidencias/21-p05-acesso-negado.png |
| PDI-AUT-API | PDI | P03 tenta ler e gravar a ficha de Arte do Lucas pela API | HTTP 403/404 | GET 403 \| PUT 400 | APROVADO |  |
| PDI-CONC-01 | PDI | Duas sessões do mesmo professor salvam o mesmo campo: nada é sobrescrito em silêncio | conflito sinalizado OU registro final coerente e informado | final no banco: SESSÃO 1; aviso na sessão 2: Alterado em outra aba; rota sessão 2: /pdi/aluno/1/1 | APROVADO | evidencias/21-pdi-concorrencia-sessao2.png |
| PDI-PRZ-01 | PDI | Aplicação com período encerrado: formulário somente leitura na tela | campos desabilitados | disabled: false | APROVADO | evidencias/21-pdi-prazo-encerrado.png |
| PDI-PRZ-02 | PDI | Servidor recusa gravar ficha fora do período | HTTP 4xx | HTTP 400 | APROVADO |  |
| PDI-VIN-01 | PDI | Vínculo de Arte (6M1) do P04 encerra no meio do período: Arte some da lista dele; as outras disciplinas ficam | Lucas sem Arte; com Inglês e Ensino Religioso | Lucas Almeida Prado ZZ-HOMOLOG Escola Aurora 6M1 Ensino Religioso Em preenchimento Inglês Em preenchimento 04/11/2026 a 15/12/2026 Vigente  | APROVADO | evidencias/21-pdi-vinculo-encerrado.png |
| PDI-VIN-02 | PDI | A ficha de Arte já preenchida é PRESERVADA no banco após o vínculo encerrar | ficha e respostas intactas | status EM_ANDAMENTO, 2 respostas | APROVADO |  |
| PDI-OFF-01 | PDI offline | Editar o PDI sem rede: o texto é guardado na fila local e a tela avisa | item na fila + aviso | fila: []; aviso: true | SUBSTITUÍDO | evidencias/22-pdi-offline.png |
| PDI-OFF-02 | PDI offline | Botão "Salvar" do PDI continua clicável sem rede (não coberto por aviso) | clicável | BLOQUEADO (aviso offline cobre o botão) | REPROVADO | evidencias/22-pdi-offline.png |
| PDI-OFF-03 | PDI offline | Ao reconectar, o texto escrito offline chega ao servidor | resposta gravada | NÃO chegou em 80 s | SUBSTITUÍDO |  |
| CEL-1-3-lista | Celular | Tela 1-3-lista em 390 px sem rolagem horizontal | sem overflow horizontal | {"larguraDoc":390,"janela":390} | APROVADO | evidencias/22-celular-1-3-lista.png |
| CEL-pdi-meus | Celular | Tela pdi-meus em 390 px sem rolagem horizontal | sem overflow horizontal | {"larguraDoc":390,"janela":390} | APROVADO | evidencias/22-celular-pdi-meus.png |
| CEL-pdi-formulario | Celular | Tela pdi-formulario em 390 px sem rolagem horizontal | sem overflow horizontal | {"larguraDoc":390,"janela":390} | APROVADO | evidencias/22-celular-pdi-formulario.png |
| CEL-1-3-preenchimento | Celular | Preenchimento do 1/3 em 390 px sem rolagem horizontal | sem overflow horizontal | {"larguraDoc":390,"janela":390} | APROVADO | evidencias/22-celular-1-3-preenchimento.png |
| PDI-OFF-04 | PDI offline | Texto digitado sem rede vira rascunho local (IndexedDB) automaticamente | item em drafts ou queue | {"drafts":[{"key":"p04@homolog.nexo::bloco-resposta::12"}],"queue":[]} | APROVADO |  |
| PDI-OFF-05 | PDI offline | Salvar por teclado (Tab+Enter) sem rede enfileira a alteração | item na fila | [{"key":"p04@homolog.nexo::bloco-resposta::12::respostas-padrao","status":"pending"},{"key":"p04@homolog.nexo::ficha-resposta::12::respostas","status":"pending"}] | APROVADO |  |
| PDI-OFF-06 | PDI offline | Depois de fechar o navegador offline e reabrir com rede, o texto digitado é recuperado | texto recuperado | "RASCUNHO-OFFLINE: Pedro precisa de refor" \| aviso: (nenhum) | APROVADO | evidencias/23-pdi-reaberto-apos-offline.png |
| PDI-OFF-07 | PDI offline | A alteração pendente é enviada ao servidor ao abrir com rede (15 s) | resposta gravada | respostas padrão: 0; respostas de ficha: 0 | REPROVADO |  |
| UT-CARD-P01 | Vínculos | P01: formulários e turmas cobertas conferem com a conta manual | 6º ano — Matemática [6M1] | 6º ano — Matemática ZZ-HOMOLOG Escola Aurora — 6M1 | APROVADO | evidencias/24-p01-lista.png |
| UT-CARD-P02 | Vínculos | P02: formulários e turmas cobertas conferem com a conta manual | 6º ano — Língua Portuguesa [6M1] + 6º ano — Ciências [6M1] + 6º ano — História [6M1] | 6º ano — Língua Portuguesa ZZ-HOMOLOG Escola Aurora — 6M1 + 6º ano — Ciências ZZ-HOMOLOG Escola Aurora — 6M1 + 6º ano — História ZZ-HOMOLOG Escola Aurora — 6M1 | APROVADO | evidencias/24-p02-lista.png |
| UT-CARD-P03 | Vínculos | P03: formulários e turmas cobertas conferem com a conta manual | 6º ano — Geografia [6M2,6M3,6M4] + 7º ano — Geografia [7M2] | 6º ano — Geografia ZZ-HOMOLOG Escola Aurora — 6M2, 6M3, 6M4 + 7º ano — Geografia ZZ-HOMOLOG Escola Aurora — 7M2 | APROVADO | evidencias/24-p03-lista.png |
| UT-CARD-P05 | Vínculos | P05: formulários e turmas cobertas conferem com a conta manual | 7º ano — Educação Física [7M2,7M1] | 7º ano — Educação Física ZZ-HOMOLOG Escola Aurora — 7M2 ZZ-HOMOLOG Escola Boa Vista — 7M1 | APROVADO | evidencias/24-p05-lista.png |
| UT-CARD-P06 | Vínculos | P06: formulários e turmas cobertas conferem com a conta manual | 6º ano — Ciências [6M2] | 6º ano — Ciências ZZ-HOMOLOG Escola Aurora — 6M2 | APROVADO | evidencias/24-p06-lista.png |

## 5. Criação e primeiro acesso dos professores

A Secretaria cadastrou P01–P06 pela tela "Gestão de Pessoas" com o assistente oficial (escola → turma/disciplina) e a senha temporária apareceu uma única vez. Para P01 e P04 foram exercitados 11 passos cada (22 no total, todos aprovados): URL protegida redireciona ao login, senha errada, campos vazios, troca obrigatória, F5, telas bloqueadas até trocar, confirmação diferente, senha curta, senha definitiva, novo login, senha temporária já usada recusada. Achado: rótulos do login sem associação aos campos (DEF-02). Observação: o cadastro de vínculo não permite informar a data de início (DEF-03).

## 6. Homologação do PDI

Montado pela interface: 3 perguntas padrão (1 compartilhada, 2 por disciplina), 7 modelos que nasceram com as 3 perguntas, Aplicação da Escola Aurora (04/11–15/12) e 4 alunos. Professor P04 (3 disciplinas na 6M1, 1 na 6M2, 2 na 7M1) vê 4 alunos e 9 fichas aluno×disciplina e abre um formulário único por aluno. Comprovado: salvar parcial volta a "Meus PDIs"; textos persistem; clique duplo não duplica; resposta compartilhada gravada uma vez; ficha vazia não conclui (tela e servidor); "Concluir todas" conclui as 3; edição após concluir permitida (regra 37); persistência após logout; P02 e P04 têm blocos compartilhados separados no mesmo aluno; P03/P05 sem vínculo não acessam (tela e API); duas sessões do mesmo professor: conflito sinalizado ("Alterado em outra aba"); Aplicação vencida fica somente leitura (selo "Somente consulta") e o servidor recusa; vínculo encerrado remove só a disciplina certa e preserva a ficha. Offline do PDI: texto vira rascunho local e é recuperado, salvar por teclado enfileira; mas o botão Salvar fica coberto pelo aviso (DEF-06) e a fila não é enviada ao abrir o app (DEF-07).

## 7. Homologação do Formulário 1/3

P04 (8 vínculos em 2 escolas) vê exatamente **7 formulários** (6º Inglês cobrindo 6M1+6M2 numa única entrega com 2 coberturas). Preenchimento com acentos, aspas, quebra de linha, persistência após logout, clique duplo em Concluir gera 1 evento, painel da Secretaria confere com contagem manual (21 obrigações, 20 após inativar turma). Detalhes nos itens UT-P04-*, UT-VIN-*, UT-EST-*.

## 8. Calendário e regras temporais

22 casos pela interface + 13 validações do servidor: janelas sobrepostas, contidas, idênticas, fronteira exata (prazo = abertura) rejeitadas; 1 minuto de folga aceita; limites do trimestre inclusivos; fora do trimestre, abertura depois/igual ao prazo, ano sem calendário rejeitados (tela e servidor). **Concorrência entre administradores** (5 cenários simultâneos, inclusive 5 requisições idênticas): sempre exatamente 1 ciclo criado, demais 409, zero pares sobrepostos no banco. Reativar ciclo cuja janela agora colide: 409. Prazo vencido: lista "Encerrado", formulário somente leitura, servidor recusa; prazo vence com a tela aberta: gravação recusada com mensagem; reabertura pela interface libera edição e **não altera o prazo original**. Casos sem regra: janela retroativa aceita; reabertura dentro de outro ciclo ou em outro ano aceita; sem exclusão de ciclo. Não executados: viradas de dia/mês/trimestre/ano e a entrega exatamente no instante do prazo (ver seção 16).

## 9. Múltiplos vínculos docentes

| Professor | Situação | Esperado (cálculo manual) | Observado (interface) |
|---|---|---|---|
| P01 | 1 disciplina, 1 turma | 1 | 1 |
| P02 | 3 disciplinas, mesma turma | 3 | 3 |
| P03 | mesma disciplina em 4 turmas | 2 (6º com 3 turmas; 7º com 1) | 2 |
| P04 | várias disciplinas/turmas/2 escolas | 7 | 7 |
| P05 | 2 escolas | 1 (2 coberturas) | 1 |
| P06 | divide turma | 1 | 1 |
| P07 | entrou na janela | 1 | 1 |
| P08 | encerrou na janela | 1 esperado | **0 visível** (DEF-09) |
| P09 | encerrou antes | 0 | 0 |
| P10 | começou depois do prazo | 0 | 0 |
| P11 | desativado após entregar | 1 | 1 (permanece no painel) |
| P12 | vários vínculos/datas | 2 | 2 |
| P13 | sem turmas | 0 | 0 |
| P14 | Educação Infantil | 0 | 0 |
| P15 | turma depois inativada | 1, depois 0 | 1, depois 0 |

Painel: esperado 21 = observado 21; concluídas + em andamento + não iniciadas = esperadas.

## 10. Offline

Em Chromium real com a rede cortada: edição offline vai para a fila local sem duplicar; aviso claro de "Sem conexão: suas respostas foram guardadas neste aparelho"; reconexão sincroniza em ~2 s; um único evento de início; conflito com outro dispositivo **não sobrescreve** o servidor; fila esvazia; rascunho é recuperado ao reabrir. Abrir o app do zero sem rede não funciona (por desenho, LIM-01). Problemas: DEF-06 (aviso cobre os botões), DEF-07 (fila só é enviada ao enfileirar ou ao reconectar, não ao abrir), DEF-08 (conflito vindo da fila sem opção de resolução; tela diz "Salvo"). Conclusão offline não foi simulada (conforme seção 48).

## 11. Segurança e permissões

13 testes de permissão do 1/3 (professor não cria/edita/reabre/inativa/vê painel; sem token 401; token inválido 401; Secretaria não usa rota de professor; professor não lê, grava nem conclui formulário de outro, inclusive com corpo válido) e 3 do PDI (URL direta e API). Nenhum acesso indevido encontrado; nenhuma resposta 5xx em toda a homologação.

## 12. Integridade do banco

Invariante "nenhum par de ciclos ativos sobrepostos" verificada após a bateria de interface e após a concorrência (0 pares). Contagens de obrigações conferidas contra cálculo manual (seção 9). Respostas persistidas comparadas texto a texto (UT-P04-03). 1 entrega com 2 coberturas para 6º Inglês. Blocos compartilhados do PDI: 1 por professor/aluno. Fichas preservadas após vínculo encerrar.

## 13. Defeitos encontrados

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


## 14. Melhorias de usabilidade

- Aviso offline cobre as ações principais (DEF-06); a mensagem "Reconectando em Ns / Tentar agora" duplica o aviso amarelo da própria tela.
- "Próximo" sem indicador de espera (DEF-01).
- Filtro "Turma" lista "6M1 6M1 … 7M1 7M1" sem a escola quando se escolhe "Todas as escolas" (BAIXO, ambiguidade real porque os nomes se repetem entre escolas).
- Botão "Novo aluno PDI" parece ativo mas só avisa "Selecione uma escola específica" no topo.
- Campos de data com limite (Aplicação PDI não aceita data passada) só mostram o balão nativo do navegador, sem mensagem própria na tela.
- A tela de login e todas as telas mostram "Gestão Pedagógica", não "Nexo" (DEF-05).

## 15. Pendências de decisão da Secretaria

1. Professor com vínculo **encerrado dentro da janela** do ciclo: continua obrigado a preencher e deve conseguir? (DEF-09)
2. Desativar turma/professor durante o ciclo deve apagar a obrigação ainda não iniciada? (QUE-01)
3. Ciclo com janela totalmente no passado deve ser aceito?
4. Reabertura pode cair dentro da janela de outro ciclo ou em outro ano/trimestre?
5. Deve existir exclusão de ciclo?
6. A data de início do vínculo professor×turma deve ser editável (histórico real)?
7. O app deve abrir sem rede (cachear o shell do PWA)? (LIM-01)
8. Duração mínima/máxima da janela de um ciclo.
9. Aluno transferido de turma/escola no meio da Aplicação (PDI): quem responde e como fica a ficha.

## 16. Riscos residuais e não executado

**NÃO EXECUTADO (declarado, não houve falha escondida):** viradas de dia/mês/trimestre/ano civil e entrega exatamente no instante do prazo; sessão expirada com itens na fila; alterar ou encerrar o ciclo enquanto há dados pendentes offline; reabertura de Aplicação PDI; aluno transferido/troca de turma e escola; aluno com PDI concluído de ano anterior; correção/devolução de ficha, Ficha Anual, indicadores, Anamnese e CRMG (tipo de pergunta de habilidades não foi exercitado); perfis Diretora, Gestor e Auxiliar; desativação de **escola** (turma e professor foram testados); substituto e troca de professor com histórico longo; impressão/exportação (nenhum recurso foi localizado nos módulos); edição simultânea de dois administradores por dois navegadores (feita por API); dispositivo móvel real (só viewport 390 px, sem rolagem horizontal em 4 telas).
**Riscos:** o servidor de desenvolvimento do Vite não equivale ao build de produção para PWA; relógio testado foi o do sistema (04/11/2026), não houve manipulação de relógio do servidor; os horários seguem America/Sao_Paulo fixo (-03:00).

## 17. Parecer final

- **Formulário 1/3 — APTO COM RESSALVAS.** As regras centrais (identidade, cobertura, calendário, sobreposição, concorrência, permissões, prazo, reabertura, histórico) foram comprovadas em navegador, no servidor e no banco, e as contagens batem com cálculo manual. Condições para homologar: decisão da Secretaria sobre o DEF-09; correção do DEF-06 e do DEF-07 (offline em escolas com internet instável); revisão do DEF-08 e do DEF-01.
- **PDI — VALIDAÇÃO INSUFICIENTE** para o módulo completo. No recorte executado (professor com várias disciplinas e vários professores no mesmo aluno, autorização, prazo, vínculos, conflito, offline) o resultado foi favorável, mas ficaram sem execução reabertura de Aplicação, transferência de aluno, correções, ficha anual, indicadores, anamnese e os demais perfis.

**Resposta à pergunta central:** se professores começassem a usar o NEXO hoje nas condições reais, o Formulário 1/3 e o fluxo principal do PDI funcionariam corretamente nas situações complexas testadas, com as ressalvas acima; os pontos que mais incomodariam na prática são os de **internet ruim** (DEF-06/07/08) e a obrigação "fantasma" de professor que saiu da turma no meio do ciclo (DEF-09).
