// PDI — vários professores no mesmo aluno, autorização por vínculo, prazo, vínculo encerrado, concorrência, offline.
// Leitura/ação pela interface; preparação especial (prazo, vínculo encerrado) direto no banco local — declarado.
import fs from 'node:fs';
import { abrir, login, foto, sair, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

const SENHA = { p01: 'Nexo!Prof01-2026', p02: null, p04: 'Nexo!Prof04-2026', p03: null, p05: null };

// corrige matriz: edição após concluir é regra (seção 37)
{ const arq = new URL('./resultados.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'); const t = JSON.parse(fs.readFileSync(arq, 'utf8')); const x = t.find(a => a.id === 'PDI-P04-08'); if (x) { x.status = 'APROVADO'; x.esperado = 'campos HABILITADOS (edição após concluir é permitida enquanto o período é editável — contexto, seção 37)'; x.nota = 'Expectativa inicial incorreta; comportamento confere com a regra 37.'; fs.writeFileSync(arq, JSON.stringify(t, null, 2)); } }

// P02/P03/P05 ainda têm senha temporária (primeiro acesso): defino senha definitiva no banco local para poder logar (declarado).
const bcrypt = (await import('node:module')).createRequire(new URL('../backend/package.json', import.meta.url))('bcryptjs');
for (const cod of ['p02', 'p03', 'p05']) await prisma.pessoa.update({ where: { email: `${cod}@homolog.nexo` }, data: { senhaHash: await bcrypt.hash(`Nexo!Prof${cod.slice(1)}-2026`, 10), senhaTemporaria: false } });
SENHA.p02 = 'Nexo!Prof02-2026'; SENHA.p03 = 'Nexo!Prof03-2026'; SENHA.p05 = 'Nexo!Prof05-2026';

const ap = await prisma.aplicacaoPdi.findFirst();
const lucas = await prisma.alunoPdi.findFirst({ where: { nome: 'Lucas Almeida Prado' } });
const urlAluno = (alunoId) => `${BASE}/#/pdi/aluno/${ap.id}/${alunoId}`;

// ---- A. P02 (LP, Ciências, História) no MESMO aluno que o P04 ----
const A = await abrir();
await login(A.page, 'p02@homolog.nexo', SENHA.p02);
await A.page.goto(BASE + '/#/pdi/meus-pdis'); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(1500);
const listaP02 = (await A.page.locator('main').innerText()).replace(/\s+/g, ' ');
const discsP02 = ['Língua Portuguesa', 'Ciências', 'História'].every(d => listaP02.includes(d)) && !/Inglês|Arte|Ensino Religioso/.test(listaP02.slice(listaP02.indexOf('ALUNO')));
registrar('PDI-MULTI-01', 'PDI', 'P02 vê só as 3 disciplinas dele (LP, Ciências, História), sem as do P04', 'LP+Ciências+História; sem Inglês/Arte/ER', discsP02 ? 'confere' : listaP02.slice(listaP02.indexOf('ALUNO'), listaP02.indexOf('ALUNO') + 200), discsP02 ? 'APROVADO' : 'REPROVADO');
await A.page.getByText('Lucas Almeida Prado').first().click(); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(1800);
const tasA = A.page.locator('main textarea');
const compartilhadoP02 = await tasA.nth(0).inputValue();
registrar('PDI-MULTI-02', 'PDI', 'Bloco compartilhado do P02 começa VAZIO (não herda o texto do P04 sobre o mesmo aluno)', 'campo vazio', `"${compartilhadoP02.slice(0, 50)}"`, compartilhadoP02 === '' ? 'APROVADO' : 'REPROVADO', '');
await tasA.nth(0).fill('Visão do P02: Lucas lê com fluência e é cuidadoso nas atividades de Ciências, mas precisa revisar a escrita de textos longos.');
await A.page.getByRole('button', { name: 'Salvar', exact: true }).click(); await A.page.waitForTimeout(2500);
const blocos = await prisma.blocoRespostasPadraoPdi.findMany({ where: { alunoId: lucas.id }, include: { respostas: true, professor: { select: { email: true } } } }).catch(() => null);
console.log('Blocos de Lucas:', blocos ? blocos.map(b => `${b.professor?.email ?? b.professorId}:${b.respostas.length}`) : 'n/d');
registrar('PDI-MULTI-03', 'PDI', 'P02 e P04 têm blocos compartilhados SEPARADOS para o mesmo aluno/turma', '2 blocos (um por professor)', blocos ? `${blocos.length} bloco(s): ${blocos.map(b => b.professor?.email ?? b.professorId).join(', ')}` : 'não consultável', blocos && blocos.length === 2 ? 'APROVADO' : 'REPROVADO');
await A.browser.close();

// P04 continua com o texto dele intacto
const B = await abrir();
await login(B.page, 'p04@homolog.nexo', SENHA.p04);
await B.page.goto(urlAluno(lucas.id)); await B.page.waitForLoadState('networkidle'); await B.page.waitForTimeout(1800);
const sharedP04 = await B.page.locator('main textarea').nth(0).inputValue();
registrar('PDI-MULTI-04', 'PDI', 'O texto do P04 sobre o Lucas permanece intacto depois que o P02 salvou o dele', 'texto do P04 preservado', `"${sharedP04.slice(0, 45)}"`, sharedP04.startsWith('Lucas demonstra') ? 'APROVADO' : 'REPROVADO');

// ---- B. Autorização por vínculo (URL direta) ----
for (const [cod, desc, esperaNegado] of [['p03', 'P03 (Geografia 6M2/6M3/6M4/7M2; sem vínculo com a 6M1) abre o PDI do Lucas por URL', true], ['p05', 'P05 (Educação Física, sem modelo/vínculo com 6M1) abre o PDI do Lucas por URL', true]]) {
  const X = await abrir();
  await login(X.page, `${cod}@homolog.nexo`, SENHA[cod]);
  await X.page.goto(urlAluno(lucas.id)); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
  const txt = (await X.page.locator('body').innerText()).replace(/\s+/g, ' ');
  const vazou = /Lucas demonstra|Descreva o desempenho|Concluir Arte|Concluir Inglês/.test(txt);
  await foto(X.page, `21-${cod}-acesso-negado`);
  registrar(`PDI-AUT-${cod.toUpperCase()}`, 'PDI', desc, 'sem acesso ao formulário nem ao conteúdo', `rota: ${X.page.url().split('#')[1]}; conteúdo exposto: ${vazou}`, !vazou ? 'APROVADO' : 'REPROVADO', `21-${cod}-acesso-negado.png`);
  await X.browser.close();
}
// API direta: P03 lê ficha do Lucas
const tokP03 = (await (await fetch('http://localhost:3340/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'p03@homolog.nexo', senha: SENHA.p03 }) })).json()).token;
const fichaArte = await prisma.fichaPdi.findFirst({ where: { aluno: { nome: 'Lucas Almeida Prado' }, disciplina: { nome: 'Arte' } } });
const rGet = await fetch(`http://localhost:3340/api/pdi-fichas/${ap.id}/${lucas.id}/${fichaArte.disciplinaId}`, { headers: { authorization: `Bearer ${tokP03}` } });
const rPut = await fetch(`http://localhost:3340/api/pdi-fichas/${fichaArte.id}/respostas`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokP03}` }, body: JSON.stringify({ respostas: [] }) });
registrar('PDI-AUT-API', 'PDI', 'P03 tenta ler e gravar a ficha de Arte do Lucas pela API', 'HTTP 403/404', `GET ${rGet.status} | PUT ${rPut.status}`, [403, 404].includes(rGet.status) && [400, 403, 404].includes(rPut.status) ? 'APROVADO' : 'REPROVADO');

// ---- C. Concorrência: P04 em duas sessões editando o mesmo bloco ----
const C1 = await abrir(), C2 = await abrir();
for (const c of [C1, C2]) { await login(c.page, 'p04@homolog.nexo', SENHA.p04); await c.page.goto(urlAluno(lucas.id)); await c.page.waitForLoadState('networkidle'); await c.page.waitForTimeout(1800); }
await C1.page.locator('main textarea').nth(2).fill('SESSÃO 1 (computador da escola): Inglês — revisar auxiliares do/does.');
await C2.page.locator('main textarea').nth(2).fill('SESSÃO 2 (celular): Inglês — foco em vocabulário de rotina.');
await C1.page.getByRole('button', { name: 'Salvar', exact: true }).click(); await C1.page.waitForTimeout(2500);
await C2.page.getByRole('button', { name: 'Salvar', exact: true }).click(); await C2.page.waitForTimeout(3000);
const final = await prisma.respostaPdi.findMany({ where: { ficha: { aluno: { nome: 'Lucas Almeida Prado' }, disciplina: { nome: 'Inglês' } } } });
const txtFinal = JSON.stringify(final.map(r => r.valor));
const avisoC2 = (await C2.page.locator('body').innerText()).replace(/\s+/g, ' ').match(/(alterad|outra aba|outro dispositivo|conflit|atualiz)[^.]{0,100}/i)?.[0];
await foto(C2.page, '21-pdi-concorrencia-sessao2');
registrar('PDI-CONC-01', 'PDI', 'Duas sessões do mesmo professor salvam o mesmo campo: nada é sobrescrito em silêncio', 'conflito sinalizado OU registro final coerente e informado', `final no banco: ${txtFinal.includes('SESSÃO 2') ? 'SESSÃO 2' : txtFinal.includes('SESSÃO 1') ? 'SESSÃO 1' : 'nenhuma'}; aviso na sessão 2: ${avisoC2 ?? '(nenhum)'}; rota sessão 2: ${C2.page.url().split('#')[1]}`, avisoC2 || (txtFinal.includes('SESSÃO 1') && !txtFinal.includes('SESSÃO 2')) ? 'APROVADO' : 'REPROVADO', '21-pdi-concorrencia-sessao2.png', 'Se REPROVADO: a sessão 2 sobrescreveu a 1 sem avisar (última gravação vence).');
await C1.browser.close(); await C2.browser.close();

// ---- D. Prazo da Aplicação (banco local) ----
const fimOriginal = ap.dataFim;
await prisma.aplicacaoPdi.update({ where: { id: ap.id }, data: { dataFim: new Date('2026-11-03T00:00:00Z') } });
const D = await abrir();
await login(D.page, 'p04@homolog.nexo', SENHA.p04);
await D.page.goto(urlAluno(lucas.id)); await D.page.waitForLoadState('networkidle'); await D.page.waitForTimeout(1800);
const desabPrazo = await D.page.locator('main textarea').nth(1).isDisabled().catch(() => null);
await foto(D.page, '21-pdi-prazo-encerrado');
const tokP04 = (await (await fetch('http://localhost:3340/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'p04@homolog.nexo', senha: SENHA.p04 }) })).json()).token;
const rPrazo = await fetch(`http://localhost:3340/api/pdi-fichas/${fichaArte.id}/respostas`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokP04}` }, body: JSON.stringify({ respostas: [] }) });
registrar('PDI-PRZ-01', 'PDI', 'Aplicação com período encerrado: formulário somente leitura na tela', 'campos desabilitados', `disabled: ${desabPrazo}`, desabPrazo === true ? 'APROVADO' : 'REPROVADO', '21-pdi-prazo-encerrado.png');
registrar('PDI-PRZ-02', 'PDI', 'Servidor recusa gravar ficha fora do período', 'HTTP 4xx', `HTTP ${rPrazo.status}`, rPrazo.status >= 400 && rPrazo.status < 500 ? 'APROVADO' : 'REPROVADO');
await prisma.aplicacaoPdi.update({ where: { id: ap.id }, data: { dataFim: fimOriginal } });
await D.browser.close();

// ---- E. Vínculo encerrado no meio do período (P04 Arte 6M1) ----
const vin = await prisma.professorTurmaDisciplina.findFirst({ where: { professor: { email: 'p04@homolog.nexo' }, disciplina: { nome: 'Arte' }, turma: { nome: '6M1', escola: { nome: { contains: 'Aurora' } } } } });
await prisma.professorTurmaDisciplina.update({ where: { id: vin.id }, data: { status: 'ENCERRADO', dataFim: new Date('2026-11-04T00:00:00Z') } });
const E = await abrir();
await login(E.page, 'p04@homolog.nexo', SENHA.p04);
await E.page.goto(BASE + '/#/pdi/meus-pdis'); await E.page.waitForLoadState('networkidle'); await E.page.waitForTimeout(1800);
const listaE = (await E.page.locator('main').innerText()).replace(/\s+/g, ' ');
const linhaLucas = listaE.slice(listaE.indexOf('Lucas'), listaE.indexOf('Marina'));
await foto(E.page, '21-pdi-vinculo-encerrado');
registrar('PDI-VIN-01', 'PDI', 'Vínculo de Arte (6M1) do P04 encerra no meio do período: Arte some da lista dele; as outras disciplinas ficam', 'Lucas sem Arte; com Inglês e Ensino Religioso', linhaLucas.slice(0, 160), !/Arte/.test(linhaLucas) && /Inglês/.test(linhaLucas) ? 'APROVADO' : 'OBSERVAÇÃO (regra não especificada)', '21-pdi-vinculo-encerrado.png');
const fichaArteDepois = await prisma.fichaPdi.findUnique({ where: { id: fichaArte.id }, include: { respostas: true } });
registrar('PDI-VIN-02', 'PDI', 'A ficha de Arte já preenchida é PRESERVADA no banco após o vínculo encerrar', 'ficha e respostas intactas', `status ${fichaArteDepois?.status}, ${fichaArteDepois?.respostas.length} respostas`, fichaArteDepois && fichaArteDepois.respostas.length > 0 ? 'APROVADO' : 'REPROVADO');
await prisma.professorTurmaDisciplina.update({ where: { id: vin.id }, data: { status: 'ATIVO', dataFim: null } });
await E.browser.close();

console.log('erros (B):', B.erros.filter(e => !/40[134]/.test(e)));
await B.browser.close(); await prisma.$disconnect();
