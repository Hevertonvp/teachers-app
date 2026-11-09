// Gera RELATORIO_HOMOLOGACAO_NEXO_PDI_1_3.md a partir de resultados.json + DEFEITOS.md.
import fs from 'node:fs';
const raiz = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const res = JSON.parse(fs.readFileSync(new URL('./resultados.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'utf8'));
const defeitos = fs.readFileSync(new URL('./DEFEITOS.md', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'utf8');
const cont = {}; res.forEach(r => { const k = r.status.startsWith('OBSERVA') ? 'OBSERVAÇÃO' : r.status; cont[k] = (cont[k] || 0) + 1; });
const executados = res.length - (cont['SUBSTITUÍDO'] || 0);
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 230);
const linhas = res.map(r => `| ${r.id} | ${esc(r.modulo)} | ${esc(r.cenario)} | ${esc(r.esperado)} | ${esc(r.observado)} | ${r.status.startsWith('OBSERVA') ? 'OBSERVAÇÃO' : r.status} | ${r.evidencia ? 'evidencias/' + r.evidencia : ''} |`).join('\n');
const reprovados = res.filter(r => r.status === 'REPROVADO').map(r => `- ${r.id} — ${r.cenario}`).join('\n') || '- (nenhum)';

const md = `# Relatório de homologação NEXO — PDI e Formulário 1/3

Data: 04/11/2026. Modo: diagnóstico (código de produção **não alterado**). Banco: PostgreSQL local descartável (nunca o Neon).

## 1. Resumo executivo

Foi montado um ambiente isolado e executada, em **navegador real (Chromium via Playwright)**, a jornada completa de escola: Secretaria cria calendário, escolas, turmas, professores e vínculos pela interface; professores fazem o primeiro acesso com senha temporária; o Formulário 1/3 e o PDI são preenchidos, salvos, concluídos, reabertos, consultados após logout; testes de calendário, sobreposição, concorrência, permissões, prazo, reabertura, vínculos históricos, estados administrativos, offline e celular.

- **Registros na matriz:** ${res.length} (executados: ${executados}; substituídos por teste mais preciso: ${cont['SUBSTITUÍDO'] || 0}).
- **Aprovados:** ${cont['APROVADO'] || 0}. **Reprovados:** ${cont['REPROVADO'] || 0}. **Observações (regra não especificada):** ${cont['OBSERVAÇÃO'] || 0}. **Bloqueados:** ${cont['BLOQUEADO'] || 0}.
- **Não executados:** ver seção 16 (lista explícita).
- **Defeitos:** 0 críticos; 1 ALTO (DEF-09, depende de decisão de negócio); 5 MÉDIOS (DEF-01, DEF-06, DEF-07, DEF-08, DEF-13); demais BAIXOS/técnicos/conceituais.
- **Formulário 1/3:** APTO COM RESSALVAS. **PDI:** VALIDAÇÃO INSUFICIENTE para o módulo inteiro (o fluxo do professor testado se comportou bem).

Reprovações registradas na matriz (cada uma corresponde a um defeito ou a erro corrigido do meu teste, ver seção 13):
${reprovados}

## 2. Ambiente

- Navegador: Chromium (Playwright 1.63), com \`--ignore-certificate-errors\` **exclusivo do ambiente de homologação** (certificado autoassinado do Vite). Foi verificado que o Service Worker registra, fica ativo e controla a página (UT-SW-01); isso **não** prova offline: o SW por desenho não cacheia HTML/JS/CSS (LIM-01).
- Frontend: Vite dev server (https, porta 5180). Backend: Node/Express/Prisma (porta 3340). Banco: PostgreSQL embarcado (\`embedded-postgres\`, porta 54329, banco \`nexo_homolog\`), migrations aplicadas só nele. O Neon **não foi acessado** pela homologação; \`db.mjs\` recusa qualquer alvo que não seja o local.
- Dados: escolas \`ZZ-HOMOLOG Escola Aurora/Boa Vista\`, turmas 6M1…9M2 (nomes repetidos nas duas escolas), professores P01–P15, 4 alunos, calendário 2026 fictício.
- Intervenções que **não** foram pela interface (declaradas): vínculos com datas históricas (P07–P15) inseridos no banco local (DEF-03); definição de senha de P02/P03/P05; antecipar prazo do ciclo e da Aplicação; inativar professor/turma via API; chamadas diretas de API para provar a proteção do servidor, permissões e concorrência; leitura direta do banco para conferir persistência.
- Scripts reproduzíveis: \`homologacao/*.mjs\`. Evidências: \`homologacao/evidencias/\`.
- Testes antigos reexecutados no banco local: 20 casos de domínio e **50 de integração, 0 falhas**, sem resíduos (não contam como testes de navegador).

## 3. Inventário crítico das regras

**CONFIRMADAS (documentadas e comprovadas na homologação):** identidade do 1/3 = ciclo + professor + ano/série + disciplina (um formulário vale para todas as turmas e escolas do ano/série); vários ciclos no mesmo trimestre; janelas de ciclos ativos não podem se sobrepor, inclusive por fronteira coincidente, validado no servidor sob trava; datas do ciclo dentro do trimestre global (limites inclusivos); elegibilidade só Ensino Fundamental; concluir exige todas as semanas; editar após concluir enquanto a janela está aberta; reabertura só pela Secretaria e sem alterar o prazo original; cobertura separada da entrega; PDI: ficha = Aplicação + aluno + disciplina; um modelo ativo por disciplina; resposta compartilhada única por Aplicação+aluno+turma+professor; edição após concluir enquanto o período é editável; autorização por vínculo vivo.

**IMPLEMENTADAS, NÃO CONFIRMADAS:** ciclo com janela inteira no passado é aceito; reabertura aceita mesmo dentro da janela de outro ciclo ou em outro ano; não existe exclusão de ciclo (só inativar); ciclo de 1 a 30 semanas; texto de semana até 10.000 caracteres; Aplicação PDI não pode começar antes de hoje; ciclo em curso só considera professor/turma/escola ativos (seção 68); vínculo encerrado durante a janela conta como esperado mas o professor não consegue preencher.

**AMBÍGUAS:** o que fazer com a obrigação de quem teve vínculo encerrado na janela (DEF-09); se desativar turma/professor deve apagar obrigação não iniciada (QUE-01); diferença entre ano civil e ano letivo para ciclos (o ano do ciclo é o ano do calendário de trimestres); aluno transferido de escola no meio da Aplicação.

**AUSENTES:** limites de duração mínima/máxima da janela; ciclo para ano letivo já encerrado; comportamento na virada de ano; offline abrindo o app sem rede; edição da data de início de vínculo.

## 4. Matriz completa de testes

| ID | Módulo | Cenário | Esperado | Observado | Status | Evidência |
|---|---|---|---|---|---|---|
${linhas}

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

${defeitos}

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
`;
fs.writeFileSync(raiz + 'RELATORIO_HOMOLOGACAO_NEXO_PDI_1_3.md', md);
fs.writeFileSync(new URL('./MATRIZ_DE_EXECUCAO.csv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), ['id;modulo;cenario;esperado;observado;status;evidencia', ...res.map(r => [r.id, r.modulo, r.cenario, r.esperado, r.observado, r.status, r.evidencia].map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n'));
console.log(JSON.stringify({ total: res.length, executados, ...cont }));
