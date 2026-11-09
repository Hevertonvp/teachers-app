// PDI — transferência ENTRE ESCOLAS (Aurora → Boa Vista 6M1), com ficha EM ANDAMENTO (Pedro, Inglês, P04)
// e fichas CONCLUÍDAS (Marina: Inglês e Ensino Religioso concluídos pela P04 na Aurora).
// Aplicação da Boa Vista e transferências PELA INTERFACE da Secretaria. Preparação declarada via API:
// vínculo Inglês 6M1 Boa Vista → P04. Leitura direta do banco local só para conferir (declarado).
import fs from 'node:fs';
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const API = 'http://localhost:3340';
const SEC = ['secretaria@escola.gov.br', '123456'];
const P04 = ['p04@homolog.nexo', 'Nexo!Prof04-2026'];
const token = async ([email, senha]) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const txt = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const SAIDA = {};
const AP1 = 1, PEDRO = 3, MARINA = 2, INGLES = 9, ER = 10, BV = 2, BV_6M1 = 7;

const tSec = await token(SEC);
const tP04 = await token(P04);

// ---------- Preparação ----------
// 1) Aplicação da Boa Vista pela interface (Inglês e Ensino Religioso), 09/11 a 15/12.
const S = await abrir();
await login(S.page, ...SEC);
if (!(await prisma.aplicacaoPdi.findFirst({ where: { escolaId: BV } }))) {
  await S.page.goto(BASE + '/#/pdi/formulario'); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(1200);
  await S.page.getByRole('button', { name: 'Aplicações', exact: true }).click(); await S.page.waitForTimeout(800);
  await S.page.getByRole('button', { name: /Nova aplica/ }).first().click(); await S.page.waitForTimeout(600);
  const m = S.page.locator('div.fixed.inset-0');
  await m.getByRole('checkbox', { name: 'ZZ-HOMOLOG Escola Boa Vista', exact: true }).check();
  for (const d of ['Inglês', 'Ensino Religioso']) await m.locator('label.flex', { hasText: new RegExp('^\\s*' + d + '\\s*\\(PDI') }).locator('input').check();
  const datas = m.locator('input[type=date]');
  await datas.nth(0).fill('2026-11-09'); await datas.nth(1).fill('2026-12-15');
  await foto(S.page, '26-aplicacao-boa-vista');
  await m.getByRole('button', { name: /Salvar|Criar|Agendar/ }).last().click(); await S.page.waitForTimeout(2500);
  if (await S.page.locator('div.fixed.inset-0').count()) console.log('MODAL APLICAÇÃO:', (await txt(S.page)).slice(0, 400));
}
const ap2 = await prisma.aplicacaoPdi.findFirst({ where: { escolaId: BV }, include: { modelos: true } });
registrar('PDI-TRF-E0', 'PDI transferência', 'Secretaria cria Aplicação PDI da Boa Vista pela interface (Inglês, Ensino Religioso)', '1 aplicação na Boa Vista', ap2 ? `id ${ap2.id}; modelos ${ap2.modelos.map(x => x.disciplinaNome).join(', ')}` : 'não criada', ap2 ? 'APROVADO' : 'REPROVADO', '26-aplicacao-boa-vista.png');
if (!ap2) { await S.browser.close(); await prisma.$disconnect(); process.exit(1); }

// 2) Vínculo Inglês 6M1 Boa Vista → P04 (API, declarado). Ensino Religioso fica SEM professor na Boa Vista.
const v = await api(tSec, 'POST', '/api/professor-turma-disciplina', { turmaId: BV_6M1, professorId: 14, disciplinaId: INGLES });
console.log('vínculo BV 6M1 Inglês → P04:', v.status);

// 3) P04 deixa a ficha de Inglês do Pedro EM ANDAMENTO pela interface (Aurora 6M2).
const A = await abrir();
await login(A.page, ...P04);
await A.page.goto(`${BASE}/#/pdi/aluno/${AP1}/${PEDRO}`); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(2200);
const tasP = A.page.locator('main textarea');
if (await tasP.count() >= 2) {
  await tasP.nth(0).fill('Pedro (P04, Aurora): participa bem quando o tema é de interesse; precisa de apoio para organizar o tempo.');
  await tasP.nth(1).fill('Em Inglês (Aurora): ainda confunde presente simples e contínuo.');
  await A.page.getByRole('button', { name: 'Salvar', exact: true }).click(); await A.page.waitForTimeout(3000);
}
const fichaPedroAur = await prisma.fichaPdi.findFirst({ where: { aplicacaoId: AP1, alunoId: PEDRO, disciplinaId: INGLES }, include: { respostas: true } });
registrar('PDI-TRF-E1', 'PDI transferência', 'P04 deixa a ficha de Inglês do Pedro em andamento na Aurora (antes da transferência)', 'EM_ANDAMENTO com respostas', `${fichaPedroAur?.status} / ${fichaPedroAur?.respostas.length} resp`, fichaPedroAur?.status === 'EM_ANDAMENTO' ? 'APROVADO' : 'REPROVADO');

// ---------- Fotografia ANTES da transferência ----------
const fotoBanco = async () => ({
  fichas: await prisma.fichaPdi.findMany({ where: { alunoId: { in: [PEDRO, MARINA] } }, include: { respostas: { orderBy: { aplicacaoPerguntaId: 'asc' } } }, orderBy: { id: 'asc' } }),
  blocos: await prisma.blocoRespostasPadraoPdi.findMany({ where: { alunoId: { in: [PEDRO, MARINA] } }, include: { respostas: true }, orderBy: { id: 'asc' } }),
  mov: await prisma.movimentacaoAlunoPdi.findMany({ where: { alunoId: { in: [PEDRO, MARINA] } }, orderBy: { id: 'asc' } }),
});
const antes = await fotoBanco();
const indAntes = (await api(tSec, 'GET', '/api/pdi-aplicacoes/indicadores')).json;
SAIDA.indicadoresAntes = indAntes;

// ---------- 4. Transferência Aurora → Boa Vista 6M1 pela interface ----------
for (const [alunoId, nome] of [[PEDRO, 'Pedro'], [MARINA, 'Marina']]) {
  await S.page.goto(`${BASE}/#/pdi/alunos/${alunoId}`); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(1500);
  await S.page.getByRole('button', { name: 'Editar aluno' }).click(); await S.page.waitForTimeout(600);
  const m = S.page.locator('div.fixed.inset-0');
  await m.locator('select').nth(0).selectOption(String(BV)); await S.page.waitForTimeout(300);
  await m.locator('select').nth(1).selectOption(String(BV_6M1));
  await foto(S.page, `26-editar-${nome}`);
  await m.getByRole('button', { name: 'Salvar' }).click(); await S.page.waitForTimeout(2200);
  const aluno = await prisma.alunoPdi.findUnique({ where: { id: alunoId } });
  registrar(`PDI-TRF-E2-${nome}`, 'PDI transferência', `Secretaria transfere ${nome} da Aurora para a Boa Vista (6M1) pela interface`, 'turma = Boa Vista 6M1', `turmaId ${aluno.turmaId}`, aluno.turmaId === BV_6M1 ? 'APROVADO' : 'REPROVADO', `26-editar-${nome}.png`);
}

// ---------- 5. Documentos da escola anterior ----------
// 5a) A própria autora (P04), que continua lecionando Inglês nas duas escolas.
const gP04Old = await api(tP04, 'GET', `/api/pdi-fichas/${AP1}/${PEDRO}/${INGLES}`);
await A.page.goto(`${BASE}/#/pdi/aluno/${AP1}/${PEDRO}`); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(2200);
const telaOld = await txt(A.page);
await foto(A.page, '26-p04-ficha-antiga-pedro');
registrar('PDI-TRF-E3', 'PDI transferência', 'P04 (autora) tenta abrir a ficha de Inglês do Pedro na Aplicação da Aurora depois da transferência', 'registrar', `GET ${gP04Old.status} ${JSON.stringify(gP04Old.json).slice(0, 90)}; tela: ${(telaOld.match(/(Nenhuma[^.]{0,80}|não pertence[^.]{0,60}|Erro[^.]{0,60})/) || ['(?)'])[0]}`, 'OBSERVAÇÃO (regra não especificada)', '26-p04-ficha-antiga-pedro.png');

// 5b) Secretaria (consulta da rede): ficha antiga por API, perfil do aluno e Ficha Anual pela interface.
const gSecOldPedro = await api(tSec, 'GET', `/api/pdi-fichas/${AP1}/${PEDRO}/${INGLES}`);
const gSecOldMarina = await api(tSec, 'GET', `/api/pdi-fichas/${AP1}/${MARINA}/${INGLES}`);
await S.page.goto(`${BASE}/#/pdi/alunos/${MARINA}`); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(2000);
const perfilMar = await txt(S.page);
await foto(S.page, '26-sec-perfil-marina');
await S.page.goto(`${BASE}/#/pdi/alunos/${MARINA}/ficha-anual`); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(2500);
const anualMar = await txt(S.page);
await foto(S.page, '26-sec-ficha-anual-marina');
const fichaAnualApi = await api(tSec, 'GET', `/api/pdi-ficha-anual/${MARINA}`);
SAIDA.fichaAnualApi = { status: fichaAnualApi.status, json: JSON.stringify(fichaAnualApi.json).slice(0, 1500) };
const anualMostraAurora = /Conteúdo ainda não consolidado|Marina é participativa|Aurora/.test(anualMar);
registrar('PDI-TRF-E4', 'PDI transferência', 'Secretaria consulta as fichas CONCLUÍDAS da Marina feitas na Aurora (API da ficha, perfil, Ficha Anual)', 'registrar acesso de leitura', `API ficha Pedro ${gSecOldPedro.status}; API ficha Marina ${gSecOldMarina.status} ${JSON.stringify(gSecOldMarina.json).slice(0, 80)}; Ficha Anual (tela) mostra conteúdo da Aurora: ${anualMostraAurora}; API ficha anual ${fichaAnualApi.status}`, 'OBSERVAÇÃO (regra não especificada)', '26-sec-ficha-anual-marina.png');

// ---------- 6. Nova escola ----------
await A.page.goto(BASE + '/#/pdi/meus-pdis'); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(1800);
const listaNova = await txt(A.page);
await foto(A.page, '26-p04-meus-pdis-depois');
await A.page.goto(`${BASE}/#/pdi/aluno/${ap2.id}/${PEDRO}`); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(2200);
const tasN = A.page.locator('main textarea');
const nN = await tasN.count();
const valsN = []; for (let i = 0; i < nN; i++) valsN.push(await tasN.nth(i).inputValue());
await foto(A.page, '26-p04-ficha-nova-pedro');
registrar('PDI-TRF-E5', 'PDI transferência', 'Na Boa Vista, P04 abre o Pedro na nova Aplicação: a ficha nasce vazia (sem o texto da Aurora)?', 'registrar', `Pedro na lista: ${listaNova.includes('Pedro')}; Marina na lista: ${listaNova.includes('Marina')}; ${nN} campos; todos vazios: ${valsN.every(x => !x)}`, 'OBSERVAÇÃO (regra não especificada)', '26-p04-ficha-nova-pedro.png');
if (nN >= 2) {
  await tasN.nth(0).fill('Pedro (P04, Boa Vista): chegou transferido; em adaptação.');
  await tasN.nth(1).fill('Em Inglês (Boa Vista): avaliação inicial na nova turma.');
  await A.page.getByRole('button', { name: 'Salvar', exact: true }).click(); await A.page.waitForTimeout(3000);
}

// ---------- 7. Indicadores ----------
const indDepois = (await api(tSec, 'GET', '/api/pdi-aplicacoes/indicadores')).json;
SAIDA.indicadoresDepois = indDepois;
const fmt = (l, id) => { const e = l.find(x => x.escolaId === id); return `esp ${e.totalEsperado}/concl ${e.concluidas}/and ${e.emAndamento}`; };
registrar('PDI-TRF-E6', 'PDI transferência', 'Indicadores das duas escolas antes × depois da transferência entre escolas', 'registrar variação', `Aurora: ${fmt(indAntes, 1)} → ${fmt(indDepois, 1)} | Boa Vista: ${fmt(indAntes, 2)} → ${fmt(indDepois, 2)}`, 'OBSERVAÇÃO (regra não especificada)');

// ---------- 8. Integridade ----------
const depois = await fotoBanco();
const iguais = antes.fichas.every(a => { const d = depois.fichas.find(f => f.id === a.id); return d && d.status === a.status && JSON.stringify(d.respostas.map(r => r.valor)) === JSON.stringify(a.respostas.map(r => r.valor)) && d.escolaNomeSnapshot === a.escolaNomeSnapshot; });
const blocosIguais = antes.blocos.every(a => { const d = depois.blocos.find(b => b.id === a.id); return d && JSON.stringify(d.respostas.map(r => r.valor)) === JSON.stringify(a.respostas.map(r => r.valor)); });
const novas = depois.fichas.filter(f => !antes.fichas.some(a => a.id === f.id)).map(f => `ficha ${f.id} ap${f.aplicacaoId} ${f.disciplinaNomeSnapshot} ${f.status}`);
registrar('PDI-TRF-E7', 'PDI transferência', 'Fichas e blocos da Aurora (Pedro e Marina) intactos depois da transferência; nada apagado', 'conteúdo idêntico; só fichas novas na Boa Vista', `fichas antigas idênticas: ${iguais}; blocos antigos idênticos: ${blocosIguais}; novas: ${novas.join('; ') || 'nenhuma'}; movimentações: ${depois.mov.map(m => `${m.alunoId}:${m.turmaId}:${m.dataFim ? 'f' : 'a'}`).join(' ')}`, iguais && blocosIguais ? 'APROVADO' : 'REPROVADO');

console.log('erros navegador:', [...A.erros, ...S.erros].filter(e => !/40[0134]/.test(e)));
SAIDA.antes = antes; SAIDA.depois = depois;
fs.writeFileSync(new URL('./saida-26.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), JSON.stringify(SAIDA, null, 2));
await A.browser.close(); await S.browser.close(); await prisma.$disconnect();
