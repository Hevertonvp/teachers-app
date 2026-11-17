// Perguntas de Computação na TELA (17/11/2026), navegador real, banco LOCAL. (1) Secretaria cadastra em
// Configurações uma pergunta sobre a habilidade EF06CO03 escolhendo ano e habilidade do catálogo; (2) professor
// abre a Ficha de um aluno do 7º ano e marca habilidades do 7º na pergunta "marcar"; autosave grava; (3) a
// Ficha do 6º mostra EF06CO03 e não a do 7º. Celular (390 px) na Ficha. Limpa o que cria.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparComputacao, montarCenario, criarAplicacao } from './85-perguntas-computacao.mjs';

const API = 'http://localhost:3340';
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const r = (id, cen, esp, obs, ok, ev) => registrar(`COMPTELA-${id}`, 'Computação na tela', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', ev);

await limparComputacao();
const c = await montarCenario();
const tSec = await token('secretaria@escola.gov.br', '12345678');

// 1. Configurações: cadastrar pela tela
const S = await abrir();
const s = S.page;
await login(s, 'secretaria@escola.gov.br', '12345678');
await s.goto(BASE + '/#/configuracoes'); await s.waitForLoadState('networkidle'); await s.waitForTimeout(1200);
const card = s.getByRole('heading', { name: 'Perguntas de Computação' }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
await s.getByRole('button', { name: '+ Adicionar pergunta', exact: true }).click(); await s.waitForTimeout(500);
const m = s.locator('div.fixed.inset-0').last();
await m.locator('select').nth(1).selectOption('6'); await s.waitForTimeout(300);
const selHab = m.locator('select').nth(2);
const opcaoHab = await selHab.locator('option', { hasText: 'EF06CO03' }).getAttribute('value');
await selHab.selectOption(opcaoHab); await s.waitForTimeout(200);
const textoAuto = await m.locator('textarea').first().inputValue();
await m.locator('textarea').first().fill(`[ZZ-COMP] ${textoAuto}`);
await foto(s, '86a-modal-computacao');
await m.getByRole('button', { name: 'Salvar' }).click(); await s.waitForTimeout(1500);
const lista = await card.innerText();
r('1', 'Secretaria cadastra pela tela: ano 6 → habilidade EF06CO03; texto vem do catálogo; aparece na lista', 'EF06CO03 · Seleção · 6º ano', lista.match(/EF06CO03[^\n]*\n?[^\n]*/)?.[0]?.replace(/\n/g, ' | ').slice(0, 140) || '(não achou)',
  textoAuto.startsWith('Descrever com precisão a solução de um problema') && /EF06CO03/.test(lista) && /Seleção · 6º ano/.test(lista), '86a-modal-computacao.png');
await S.browser.close();

// pergunta "marcar" do 7º ano pela API e Aplicação vigente
await api(tSec, 'POST', '/api/pdi-perguntas-computacao', { anos: [7], texto: '[ZZ-COMP] Quais habilidades de Computação o aluno consolidou?', tipoResposta: 'HABILIDADE_COMPUTACAO' });
const ap = await criarAplicacao(tSec, c.escola.id, new Date().toISOString().slice(0, 10), '2026-12-15');

// 2. Professor, celular, Ficha do 7º ano
const P = await abrir({ viewport: { width: 390, height: 844 } });
const p = P.page;
await login(p, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
await p.goto(`${BASE}/#/pdi/fichas/${ap.json.id}/${c.modelo.disciplinaId}/${c.a7.id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2500);
const caixa = p.locator('label', { hasText: 'EF07CO01' });
const qtd = await p.locator('label', { hasText: /EF07CO\d\d/ }).count();
await caixa.locator('input[type=checkbox]').check(); await p.waitForTimeout(800);
await foto(p, '86b-ficha-7ano-celular');
const largura = await p.evaluate(() => document.documentElement.scrollWidth);
await p.getByRole('button', { name: /Voltar/ }).first().click(); await p.waitForTimeout(2500);
const ficha7 = await prisma.fichaPdi.findFirst({ where: { aplicacaoId: ap.json.id, alunoId: c.a7.id }, include: { respostas: { include: { aplicacaoPergunta: true } } } });
const resp = ficha7?.respostas.find(x => x.aplicacaoPergunta.tipoResposta === 'HABILIDADE_COMPUTACAO');
r('2', 'Professor (celular) vê as 11 habilidades do 7º ano, marca EF07CO01 e ao sair (Voltar) grava', '11 opções; gravou EF07CO01; sem rolagem lateral', `${qtd} opções; gravou ${resp?.valor?.habilidades?.map(h => h.codigo).join(',')}; largura ${largura}`,
  qtd === 11 && resp?.valor?.habilidades?.[0]?.codigo === 'EF07CO01' && largura <= 390, '86b-ficha-7ano-celular.png');

// 3. Ficha do 6º: só EF06CO03
await p.goto(`${BASE}/#/pdi/fichas/${ap.json.id}/${c.modelo.disciplinaId}/${c.a6.id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2500);
const tela6 = await p.locator('main').innerText();
await foto(p, '86c-ficha-6ano-celular');
r('3', 'Ficha do 6º ano mostra a pergunta EF06CO03 e não mostra a do 7º', 'EF06CO03 sim; "Quais habilidades…" não', `EF06CO03: ${/EF06CO03/.test(tela6)}; 7º: ${/Quais habilidades de Computação/.test(tela6)}`,
  /EF06CO03/.test(tela6) && !/Quais habilidades de Computação/.test(tela6), '86c-ficha-6ano-celular.png');
console.log('Erros de console:', P.erros.filter(e => !/favicon/.test(e)).slice(0, 5));
await P.browser.close();

await limparComputacao();
await prisma.$disconnect();
