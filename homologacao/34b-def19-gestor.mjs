// DEF-19 na tela de UMA Ficha (Gestor, /pdi/fichas/:aplicacao/:disciplina/:aluno). Dois contextos de
// navegador do Gestor da Aurora; o "outro aparelho" grava pela API com a versão atual. Banco LOCAL.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const API = 'http://localhost:3340';
const GESTOR = ['gestor.aur@homolog.nexo', 'Nexo!Homolog-2026'];
const URL = `${BASE}/#/pdi/fichas/1/9/3`; // Aplicação 1, Inglês, Pedro (Aurora 6M2)
// Uso: node 34b-def19-gestor.mjs antes|depois
const FASE = (process.argv[2] || 'depois').toUpperCase();
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`DEF19-GESTOR-${FASE}-${id}`, 'PDI conflito entre aparelhos (DEF-19, tela do Gestor)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const ficha = await prisma.fichaPdi.findFirst({ where: { aplicacaoId: 1, alunoId: 3, disciplinaId: 9 } });
const textoBanco = async () => JSON.stringify((await prisma.respostaPdi.findMany({ where: { fichaId: ficha.id } })).map(x => x.valor));

// Aparelho A: digita na primeira caixa de texto da disciplina e fecha sem sair pelo botão.
const A = await abrir();
await login(A.page, ...GESTOR);
await A.page.goto(URL); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(2500);
const caixas = A.page.locator('main textarea');
const nCaixas = await caixas.count();
await caixas.last().fill(`GESTOR aparelho A ${TAG}`);
await A.page.waitForTimeout(1500);
const storage = await A.contexto.storageState({ indexedDB: true });
await A.browser.close();

// Outro aparelho grava pela API (versão atual), mudando a mesma pergunta de texto.
const tk = (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: GESTOR[0], senha: GESTOR[1] }) })).json()).token;
const atual = await (await fetch(`${API}/api/pdi-fichas/1/3/9`, { headers: { authorization: 'Bearer ' + tk } })).json();
const perguntaTexto = atual.perguntas.find(q => /texto|paragrafo/i.test(q.tipoResposta)) ?? atual.perguntas[0];
const put = await fetch(`${API}/api/pdi-fichas/${ficha.id}/respostas`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify({ baseUpdatedAt: atual.ficha.updatedAt, respostas: [{ aplicacaoPerguntaId: perguntaTexto.id, valor: { resposta: `OUTRO aparelho ${TAG}` } }] }) });
const depoisOutro = await textoBanco();

// Aparelho A reabre e tenta sair por "Voltar" (que salva o que estiver pendente).
const X = await abrir();
const ctx = await X.browser.newContext({ ignoreHTTPSErrors: true, storageState: storage, viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(URL); await page.waitForLoadState('networkidle'); await page.waitForTimeout(3000);
const tela = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
await foto(page, `34b-${FASE}-gestor-reaberto`);
const opcoes = await page.getByRole('button', { name: 'Restaurar o meu texto' }).count() > 0;
await page.getByRole('button', { name: /Voltar/ }).first().click().catch(() => {}); await page.waitForTimeout(2500);
const final = await textoBanco();
r('1', 'Outro aparelho salvou depois do rascunho do aparelho A: ao reabrir, aviso + texto de A visível + opções', 'aviso e opções; texto de A na tela', `${nCaixas} caixas; PUT outro aparelho ${put.status}; aviso: ${/alterad[ao] depois em outro lugar/.test(tela)}; texto de A visível: ${tela.includes(`GESTOR aparelho A ${TAG}`)}; opções: ${opcoes}`, /alterad[ao] depois em outro lugar/.test(tela) && tela.includes(`GESTOR aparelho A ${TAG}`) && opcoes, `34b-${FASE}-gestor-reaberto.png`);
r('2', 'Sair por "Voltar" sem escolher não sobrescreve o texto do outro aparelho', 'banco com o texto do outro aparelho', `antes: ${depoisOutro.includes(`OUTRO aparelho ${TAG}`)}; depois de Voltar: ${final.includes(`OUTRO aparelho ${TAG}`)}; texto de A no banco: ${final.includes(`GESTOR aparelho A ${TAG}`)}`, final.includes(`OUTRO aparelho ${TAG}`) && !final.includes(`GESTOR aparelho A ${TAG}`));
await X.browser.close(); await prisma.$disconnect();
