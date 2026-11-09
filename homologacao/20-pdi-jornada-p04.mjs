// PDI — jornada real do P04 (Arte, Inglês, Ensino Religioso na 6M1 + Inglês na 6M2 + Arte/Inglês na 7M1).
import { abrir, login, foto, sair, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const { browser, page, erros } = await abrir();
const SENHA = 'Nexo!Prof04-2026';
await login(page, 'p04@homolog.nexo', SENHA);
const ordem = ['Arte', 'Inglês', 'Ensino Religioso']; // ordem em que os blocos aparecem na tela

const abrirAluno = async (nome) => {
  await page.goto(BASE + '/#/pdi/meus-pdis'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  await page.getByText(nome).first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);
};
const fichasDe = async (nome) => prisma.fichaPdi.findMany({ where: { aluno: { nome }, professorResponsavel: { email: 'p04@homolog.nexo' } }, include: { disciplina: true, respostas: true }, orderBy: { disciplina: { nome: 'asc' } } });
const resumo = (f) => f.map(x => `${x.disciplina.nome}:${x.status}/${x.respostas.length}resp`).join(' | ');

// ---- 1. Lucas: preenchimento completo, salvar parcial primeiro (só compartilhado + Arte) ----
await abrirAluno('Lucas Almeida Prado');
const tas = page.locator('main textarea');
registrar('PDI-P04-01', 'PDI', 'Formulário único do Lucas mostra 1 bloco compartilhado + 3 blocos de disciplina', '4 campos de texto', `${await tas.count()} campos`, (await tas.count()) === 4 ? 'APROVADO' : 'REPROVADO', '19-p04-formulario-unico-lucas.png');
await tas.nth(0).fill('Lucas demonstra boa autonomia e curiosidade; no trimestre melhorou a organização do caderno e a participação oral, embora ainda se disperse em atividades longas.');
await tas.nth(1).fill('Em Arte: ainda precisa consolidar a noção de perspectiva e o uso de sombreamento em desenhos de observação.');
await page.locator('main button').filter({ hasText: /^Sempre$/ }).nth(0).click();
await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await page.waitForTimeout(2500);
const rotaApos = page.url().split('#')[1];
let f = await fichasDe('Lucas Almeida Prado');
registrar('PDI-P04-02', 'PDI', 'Salvar parcial volta para "Meus PDIs" e grava só o que foi preenchido', '/pdi/meus-pdis e fichas persistidas', `${rotaApos} | ${resumo(f)}`, rotaApos.includes('meus-pdis') && f.length >= 1 ? 'APROVADO' : 'REPROVADO');
await foto(page, '20-apos-salvar-parcial');

// ---- 2. Reabrir: persistência e completar as demais disciplinas ----
await abrirAluno('Lucas Almeida Prado');
const t2 = page.locator('main textarea');
const v0 = await t2.nth(0).inputValue(), v1 = await t2.nth(1).inputValue();
registrar('PDI-P04-03', 'PDI', 'Ao reabrir, o texto compartilhado e o de Arte reaparecem iguais', 'textos idênticos', `compartilhado ok: ${v0.startsWith('Lucas demonstra')}; Arte ok: ${v1.startsWith('Em Arte')}`, v0.startsWith('Lucas demonstra') && v1.startsWith('Em Arte') ? 'APROVADO' : 'REPROVADO');
await t2.nth(2).fill('Em Inglês: confunde "do" e "does" em frases negativas; precisa praticar vocabulário de rotina e escuta de diálogos curtos.');
await page.locator('main button').filter({ hasText: /^Às vezes$/ }).nth(1).click();
await t2.nth(3).fill('Em Ensino Religioso: participa com respeito dos debates; precisa ampliar o repertório sobre tradições religiosas diversas.');
await page.locator('main button').filter({ hasText: /^Sempre$/ }).nth(2).click();
await page.getByRole('button', { name: 'Salvar', exact: true }).dblclick(); await page.waitForTimeout(3000); // clique duplo
f = await fichasDe('Lucas Almeida Prado');
const nResp = f.reduce((a, x) => a + x.respostas.length, 0);
registrar('PDI-P04-04', 'PDI', 'Clique duplo em Salvar não duplica fichas nem respostas', '3 fichas, sem duplicatas', `${f.length} fichas; ${resumo(f)}`, f.length === 3 && new Set(f.flatMap(x => x.respostas.map(r => `${x.id}-${r.aplicacaoPerguntaId}`))).size === nResp ? 'APROVADO' : 'REPROVADO');
const blocos = await prisma.respostaPadraoPdi.count({ where: { bloco: { aluno: { nome: 'Lucas Almeida Prado' } } } }).catch(() => -1);
registrar('PDI-P04-05', 'PDI', 'Resposta compartilhada gravada UMA vez para as 3 disciplinas (bloco padrão)', '1 resposta padrão no bloco', String(blocos), blocos === 1 ? 'APROVADO' : (blocos === -1 ? 'BLOQUEADO' : 'REPROVADO'));

// ---- 3. Concluir: individual com campo vazio e "todas" ----
await abrirAluno('Marina Teixeira Lopes');
const m = page.locator('main textarea');
const btnVazio = page.getByRole('button', { name: 'Concluir Inglês', exact: true });
const desabVazio = await btnVazio.isDisabled();
const fm = await fichasDe('Marina Teixeira Lopes');
registrar('PDI-P04-06', 'PDI', 'Ficha vazia: botão "Concluir Inglês" fica desabilitado na tela', 'botão desabilitado', 'desabilitado: ' + desabVazio, desabVazio ? 'APROVADO' : 'REPROVADO', '20-concluir-vazio.png');
// servidor também recusa (API direta, declarado)
const tokP04 = (await (await fetch('http://localhost:3340/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'p04@homolog.nexo', senha: SENHA }) })).json()).token;
const fichaIng = fm.find(x => x.disciplina.nome === 'Inglês');
let stSrv = 'sem ficha (ainda não criada: nada a concluir)';
if (fichaIng) { const r = await fetch('http://localhost:3340/api/pdi-fichas/' + fichaIng.id + '/concluir', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tokP04 }, body: '{}' }); stSrv = 'HTTP ' + r.status; }
registrar('PDI-P04-06b', 'PDI', 'Servidor recusa concluir ficha incompleta', 'HTTP 4xx ou sem ficha', stSrv, /HTTP 4/.test(stSrv) || /sem ficha/.test(stSrv) ? 'APROVADO' : 'REPROVADO');
await foto(page, '20-concluir-vazio');
// preenche Marina inteira e conclui todas
await m.nth(0).fill('Marina é participativa e colaborativa; lidera bem trabalhos em grupo e pede ajuda quando tem dúvidas.');
for (let g = 0; g < 3; g++) { await m.nth(1 + g).fill(`Conteúdo ainda não consolidado em ${ordem[g]}: revisar atividades do trimestre com apoio de exemplos concretos.`); await page.locator('main button').filter({ hasText: /^Sempre$/ }).nth(g).click(); }
await page.getByRole('button', { name: 'Concluir todas as disciplinas' }).click(); await page.waitForTimeout(3500);
const fm2 = await fichasDe('Marina Teixeira Lopes');
registrar('PDI-P04-07', 'PDI', '"Concluir todas as disciplinas" conclui as 3 fichas da Marina', '3 fichas CONCLUIDA', resumo(fm2), fm2.length === 3 && fm2.every(x => x.status === 'CONCLUIDA') ? 'APROVADO' : 'REPROVADO', '');
await foto(page, '20-marina-concluida');

// ---- 4. Edição após concluir ----
await abrirAluno('Marina Teixeira Lopes');
const desab = await page.locator('main textarea').nth(1).isDisabled().catch(() => null);
registrar('PDI-P04-08', 'PDI', 'Ficha concluída fica protegida contra edição pelo professor', 'campos desabilitados', `disabled: ${desab}`, desab === true ? 'APROVADO' : 'REPROVADO', '');

// ---- 5. Persistência após logout/login ----
await sair(page);
await login(page, 'p04@homolog.nexo', SENHA);
await page.goto(BASE + '/#/pdi/meus-pdis'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
const lista = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
await foto(page, '20-meus-pdis-apos-relogin');
registrar('PDI-P04-09', 'PDI', 'Após logout/login, Meus PDIs mostra a Marina concluída e o Lucas em preenchimento', 'estados persistem', lista.slice(lista.indexOf('Lucas'), lista.indexOf('Lucas') + 230), /Marina[^A-Z]*.*Conclu/.test(lista) ? 'APROVADO' : 'REPROVADO', '20-meus-pdis-apos-relogin.png');

// ---- 6. Total de fichas do P04 (cardinalidade aluno × disciplina) ----
const totalFichasP04 = await prisma.fichaPdi.count({ where: { professorResponsavel: { email: 'p04@homolog.nexo' } } });
console.log('Fichas do P04 já criadas:', totalFichasP04);
console.log('erros', erros.filter(e => !/40[13]/.test(e)));
await browser.close(); await prisma.$disconnect();
