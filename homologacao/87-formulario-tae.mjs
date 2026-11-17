// Formulário PDI do Professor TAE (17/11/2026) — Etapa 2, banco LOCAL. Cenário do roteiro 85 (escola de teste,
// turmas 6º/7º/Infantil, p04 professor da disciplina) + P10 como TAE da 6º e da 7º; depois o P04 também é
// ligado como TAE da 6º (segundo TAE: aviso, PDI fica com o P10). Confere: snapshot "Professor TAE" só com as de
// Computação; obrigações e acesso do TAE; segundo TAE sem obrigação; sem perguntas padrão; ano do aluno;
// indicadores e acompanhamento sem duplicar; Ficha de disciplina inalterada; Ficha Anual e Correções; tela do
// TAE no celular. Limpa o que cria.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparComputacao, montarCenario, criarAplicacao } from './85-perguntas-computacao.mjs';

const API = 'http://localhost:3340';
const SEC = ['secretaria@escola.gov.br', '12345678'];
const P04 = ['p04@homolog.nexo', 'Nexo!Prof04-2026'];
const P10 = ['p10@homolog.nexo', 'Nexo!Prof10-2026'];
const token = async ([email, senha]) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const r = (id, cen, esp, obs, ok, ev) => registrar(`TAE-${id}`, 'Formulário do Professor TAE', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', ev);

await limparComputacao();
const c = await montarCenario();
const tae = await prisma.atuacaoPedagogica.findFirst({ where: { nome: 'TAE' } });
const p10 = await prisma.pessoa.findUnique({ where: { email: P10[0] } });
const hoje = new Date(new Date().toISOString().slice(0, 10));
await prisma.vinculoEscolar.create({ data: { escolaId: c.escola.id, pessoaId: p10.id, dataInicio: hoje } });
const tSec = await token(SEC); const tP04 = await token(P04); const tP10 = await token(P10);

// Vínculos de TAE pela API (Secretaria): P10 na 6º e na 7º; depois P04 na 6º (segundo TAE)
const v1 = await api(tSec, 'POST', '/api/professor-turma-atuacao', { turmaId: c.t6.id, professorId: p10.id, atuacaoId: tae.id });
await api(tSec, 'POST', '/api/professor-turma-atuacao', { turmaId: c.t7.id, professorId: p10.id, atuacaoId: tae.id });
const v2 = await api(tSec, 'POST', '/api/professor-turma-atuacao', { turmaId: c.t6.id, professorId: c.p04.id, atuacaoId: tae.id });
r('1', 'Ligar um segundo TAE na mesma turma: liga, com aviso curto de que o PDI fica com o primeiro', 'sem aviso no 1º; aviso no 2º', `1º: ${v1.json?.aviso ?? 'sem aviso'}; 2º: ${v2.json?.aviso}`,
  v1.status === 201 && !v1.json.aviso && v2.status === 201 && /já tem TAE/.test(v2.json.aviso || ''));

// Perguntas de Computação: 6º (EF06CO02, seleção) e "marcar" do 7º
const cat6 = (await api(tSec, 'GET', '/api/habilidades-curriculares/computacao?ano=6')).json;
const ef06co02 = cat6.find(h => h.codigo === 'EF06CO02');
await api(tSec, 'POST', '/api/pdi-perguntas-computacao', { habilidadeId: ef06co02.id, texto: `[ZZ-COMP] ${ef06co02.descricaoOficial}`, tipoResposta: 'SELECAO', opcoes: ['Consegue com autonomia', 'Consegue com mediação', 'Não consegue autonomia', 'Não trabalhado'] });
await api(tSec, 'POST', '/api/pdi-perguntas-computacao', { anos: [7], texto: '[ZZ-COMP] Quais habilidades de Computação o aluno consolidou?', tipoResposta: 'HABILIDADE_COMPUTACAO' });

// Aplicação sem TAE (desmarcado) e com TAE (padrão)
const semTae = await criarAplicacao(tSec, c.escola.id, '2095-05-02', '2095-05-10', { incluirTae: false });
const ap = await criarAplicacao(tSec, c.escola.id, new Date().toISOString().slice(0, 10), '2026-12-15');
const modTae = ap.json.modelos.find(m => m.atuacaoId);
r('2', 'Aplicação nova traz o formulário "Professor TAE" (atuação, sem disciplina); com a opção desmarcada, não traz', '"Professor TAE", disciplinaId nulo; desmarcada: nenhum', `${modTae?.disciplinaNome}, disc ${modTae?.disciplinaId}, atuação ${modTae?.atuacaoId}; desmarcada: ${semTae.json.modelos.filter(m => m.atuacaoId).length}`,
  modTae?.disciplinaNome === 'Professor TAE' && modTae.disciplinaId === null && modTae.atuacaoId === tae.id && !semTae.json.modelos.some(m => m.atuacaoId));
const snap = (await api(tSec, 'GET', `/api/pdi-aplicacoes/${ap.json.id}/snapshot`)).json.find(m => m.atuacaoId);
r('3', 'Formulário do TAE só tem perguntas de Computação (nenhuma do Modelo nem padrão)', '2 perguntas, todas de Computação', `${snap.perguntas.length}: ${snap.perguntas.map(p => p.codigo || p.tipoResposta).join(', ')}`,
  snap.perguntas.length === 2 && snap.perguntas.every(p => p.perguntaIdOriginal === null));

// Obrigações
const meus10 = (await api(tP10, 'GET', '/api/pdi-fichas/meus-pdis')).json.filter(i => i.aplicacaoId === ap.json.id);
const meus04 = (await api(tP04, 'GET', '/api/pdi-fichas/meus-pdis')).json.filter(i => i.aplicacaoId === ap.json.id);
r('4', 'P10 (TAE ligado primeiro) recebe as obrigações "Professor TAE" dos alunos PDI da 6º e da 7º', '2 itens Professor TAE (Aluno6, Aluno7)', meus10.map(i => `${i.alunoNome.split(' ')[0]}:${i.disciplinaNome}`).join(', '),
  meus10.length === 2 && meus10.every(i => i.disciplinaNome === 'Professor TAE' && i.atuacaoId === tae.id && i.disciplinaId === null));
r('5', 'P04 (segundo TAE da 6º) não recebe obrigação de TAE — só as da disciplina dele', 'nenhum "Professor TAE"', meus04.map(i => `${i.alunoNome.split(' ')[0]}:${i.disciplinaNome}`).join(', '),
  meus04.length === 3 && !meus04.some(i => i.atuacaoId));

// Ficha do TAE: 6º ano
const fT6 = await api(tP10, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: ap.json.id, alunoId: c.a6.id, atuacaoId: tae.id });
r('6', 'Ficha do TAE (aluno do 6º): só a pergunta de Computação do 6º, sem perguntas padrão', 'EF06CO02; bloco padrão nulo; ficha de atuação', `${fT6.json?.perguntas?.map(p => p.codigo || p.tipoResposta).join(',')}; bloco ${fT6.json?.blocoPadrao}; atuação ${fT6.json?.ficha?.atuacaoId}, disc ${fT6.json?.ficha?.disciplinaId}`,
  fT6.status === 200 && JSON.stringify(fT6.json.perguntas.map(p => p.codigo)) === '["EF06CO02"]' && fT6.json.blocoPadrao === null && fT6.json.ficha.atuacaoId === tae.id && fT6.json.ficha.disciplinaId === null);
const p04Tenta = await api(tP04, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: ap.json.id, alunoId: c.a6.id, atuacaoId: tae.id });
const p04Le = await api(tP04, 'GET', `/api/pdi-fichas/atuacao/${ap.json.id}/${c.a6.id}/${tae.id}`);
r('7', 'Segundo TAE (P04) não abre nem lê a Ficha do TAE', '403 / 403', `${p04Tenta.status} / ${p04Le.status}`, p04Tenta.status === 403 && p04Le.status === 403);

// Responde e conclui
const pergunta = fT6.json.perguntas[0];
const salvo = await api(tP10, 'PUT', `/api/pdi-fichas/${fT6.json.ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: pergunta.id, valor: { resposta: 'Consegue com mediação' } }], baseUpdatedAt: fT6.json.ficha.updatedAt ?? fT6.json.ficha.createdAt });
const concl = await api(tP10, 'POST', `/api/pdi-fichas/${fT6.json.ficha.id}/concluir`);
r('8', 'TAE responde e conclui a Ficha', '200 / CONCLUIDA', `${salvo.status} / ${concl.json?.ficha?.status}`, salvo.status === 200 && concl.json?.ficha?.status === 'CONCLUIDA');

// Ficha de disciplina do mesmo aluno: inalterada (Modelo + Computação do ano), sem nada de TAE
const fD6 = await api(tP04, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: ap.json.id, alunoId: c.a6.id, disciplinaId: c.modelo.disciplinaId });
r('9', 'Ficha da disciplina do mesmo aluno continua a mesma (Modelo + Computação do 6º), sem mistura com o TAE', 'disciplina; 2 do Modelo + EF06CO02', `${fD6.json.ficha.disciplinaNome}; ${fD6.json.perguntas.length} perguntas; Computação: ${fD6.json.perguntas.filter(p => p.computacao).map(p => p.codigo).join(',')}`,
  fD6.json.ficha.disciplinaId === c.modelo.disciplinaId && fD6.json.ficha.atuacaoId === null && fD6.json.perguntas.filter(p => p.computacao).length === 1);

// Indicadores e acompanhamento: 3 alunos × disciplina + 2 do TAE (sem duplicar com o segundo TAE)
const ind = (await api(tSec, 'GET', '/api/pdi-aplicacoes/indicadores')).json.find(e => e.escolaId === c.escola.id);
r('10', 'Indicadores da escola: 3 (disciplina) + 2 (TAE) esperadas; concluída a do TAE; segundo TAE não duplica', 'esperado 5, concluídas 1', `esperado ${ind?.totalEsperado}, concluídas ${ind?.concluidas}, em andamento ${ind?.emAndamento}`,
  ind?.totalEsperado === 5 && ind?.concluidas === 1);
const acomp = await api(tSec, 'GET', `/api/acompanhamento/escola/${c.escola.id}?ano=2026&atualizar=1`);
const linhaTae = acomp.json?.pdi?.porDisciplina?.find?.(d => d.atuacaoId) ?? JSON.stringify(acomp.json).match(/"disciplina":"Professor TAE"[^}]*/)?.[0];
r('11', 'Acompanhamento da escola mostra "Professor TAE" como linha própria', 'linha Professor TAE (esperado 2)', typeof linhaTae === 'string' ? linhaTae : JSON.stringify(linhaTae), (typeof linhaTae === 'string' ? linhaTae : JSON.stringify(linhaTae ?? '')).includes('Professor TAE') && /"esperado":2/.test(typeof linhaTae === 'string' ? linhaTae : JSON.stringify(linhaTae ?? '')));

// Ficha Anual (TAE vê a dele) e Correções (aparece como Professor TAE)
const anual = await api(tP10, 'GET', `/api/pdi-ficha-anual/${c.a6.id}/2026`);
const fichasAnual = (anual.json?.periodos ?? []).flatMap(p => p.fichas);
const corr = (await api(tSec, 'GET', `/api/correcoes-pdi?escolaId=${c.escola.id}`)).json;
r('12', 'Ficha Anual do TAE mostra a Ficha "Professor TAE"; Correções lista a Ficha concluída como Professor TAE', 'anual: Professor TAE; correções: Professor TAE', `${anual.status} ${fichasAnual.map(f => f.disciplinaNome).join(',')}; correções: ${corr.map(f => f.disciplinaNome).join(',')}`,
  fichasAnual.some(f => f.disciplinaNome === 'Professor TAE' && f.atuacaoId === tae.id) && corr.some(f => f.disciplinaNome === 'Professor TAE' && f.atuacaoId === tae.id));

// Tela: P10 no celular — Meus PDIs e formulário do aluno do 7º (marcar habilidades)
const P = await abrir({ viewport: { width: 390, height: 844 } });
const p = P.page;
await login(p, ...P10);
await p.goto(BASE + '/#/pdi/meus-pdis'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2000);
const lista = await p.locator('main').innerText();
await foto(p, '87a-tae-meus-pdis-celular');
await p.goto(`${BASE}/#/pdi/aluno/${ap.json.id}/${c.a7.id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2500);
const form = await p.locator('main').innerText();
const opcoes7 = await p.locator('label', { hasText: /EF07CO\d\d/ }).count();
const largura = await p.evaluate(() => document.documentElement.scrollWidth);
await foto(p, '87b-tae-formulario-7ano-celular');
r('13', 'Tela do TAE (celular): Meus PDIs mostra "Professor TAE"; formulário do aluno do 7º lista as habilidades do 7º para marcar', 'Professor TAE; 11 habilidades; sem rolagem lateral', `Meus PDIs: ${/Professor TAE/.test(lista)}; formulário: ${/Professor TAE/.test(form)}, ${opcoes7} habilidades; largura ${largura}`,
  /Professor TAE/.test(lista) && /Professor TAE/.test(form) && opcoes7 === 11 && largura <= 390, '87b-tae-formulario-7ano-celular.png');
console.log('Erros de console:', P.erros.filter(e => !/favicon/.test(e)).slice(0, 5));
await P.browser.close();

await limparComputacao();
await prisma.$disconnect();
