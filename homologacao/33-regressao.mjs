// Regressão em navegador real depois das correções DEF-14/17/07/08: login, permissões, professor com
// vários vínculos (cartões do 1/3) e persistência do formulário PDI. API conferida em paralelo; banco LOCAL.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const API = 'http://localhost:3340';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`REG-${id}`, 'Regressão pós-correções', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const st = async (t, method, path, body) => (await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: body ? JSON.stringify(body) : undefined })).status;

// ---- Login ----
{
  const X = await abrir();
  await X.page.goto(BASE + '/#/pdi/meus-pdis'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(800);
  const semLogin = X.page.url().split('#')[1];
  await X.page.locator('input[type=email]').fill('p04@homolog.nexo');
  await X.page.locator('input[type=password]').first().fill('senha-errada');
  await X.page.getByRole('button', { name: /entrar/i }).click(); await X.page.waitForTimeout(1500);
  const errada = X.page.url().split('#')[1];
  const msg = /incorret/i.test(await X.page.locator('body').innerText());
  await login(X.page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
  const certa = X.page.url().split('#')[1];
  await foto(X.page, '33-login');
  r('LOGIN-1', 'URL protegida sem login vai para o login', '/login', semLogin, semLogin.includes('login'));
  r('LOGIN-2', 'Senha errada é recusada com mensagem', '/login + mensagem', `${errada}; mensagem: ${msg}`, errada.includes('login') && msg);
  r('LOGIN-3', 'Senha certa entra no sistema', 'fora do /login', certa, !certa.includes('login'), '33-login.png');

  // ---- Professor com vários vínculos: cartões do 1/3 ----
  await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
  const cartoes = await X.page.locator('h2.text-xl').allInnerTexts();
  const ingles6 = (await X.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await foto(X.page, '33-cartoes-p04');
  r('MULTI-1', 'P04 (vínculos em 2 escolas, várias turmas e disciplinas) vê um cartão por ano/série + disciplina', '7 cartões (6º Arte, 6º ER, 6º Inglês, 7º Arte, 7º Inglês, 8º Inglês, 9º Inglês)', `${cartoes.length}: ${cartoes.join(' | ')}`, cartoes.length === 7, '33-cartoes-p04.png');
  r('MULTI-2', '6º Inglês é UM formulário válido para as turmas das duas escolas', 'Aurora 6M1/6M2 e Boa Vista 6M1 no mesmo cartão', `Boa Vista citada: ${/Boa Vista/.test(ingles6)}; Aurora citada: ${/Aurora/.test(ingles6)}`, /Boa Vista/.test(ingles6) && /Aurora/.test(ingles6));

  // ---- Persistência do formulário PDI (bloco comum + disciplina), online ----
  await X.page.goto(`${BASE}/#/pdi/aluno/1/4`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
  const tas = X.page.locator('main textarea');
  await tas.nth(0).fill(`Larissa — comum ${TAG}`);
  await tas.nth(1).fill(`Larissa — disciplina ${TAG}`);
  await X.page.getByRole('button', { name: 'Salvar', exact: true }).click(); await X.page.waitForTimeout(3000);
  const msgSalvar = (await X.page.locator('main').innerText()).match(/Respostas salvas\.|guardadas neste aparelho/)?.[0] ?? '(nenhuma)';
  await X.page.goto(`${BASE}/#/pdi/aluno/1/4`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
  const v0 = await X.page.locator('main textarea').nth(0).inputValue(), v1 = await X.page.locator('main textarea').nth(1).inputValue();
  const banco = JSON.stringify(await prisma.respostaPadraoPdi.findMany({ where: { bloco: { alunoId: 4, professorId: 14 } } }));
  await foto(X.page, '33-pdi-persistencia');
  r('PDI-1', 'PDI online: Salvar confirma "Respostas salvas." e os textos persistem ao reabrir (tela e banco)', 'mensagem de sucesso; textos iguais; bloco no banco', `mensagem: ${msgSalvar}; comum ok: ${v0.includes(TAG)}; disciplina ok: ${v1.includes(TAG)}; banco: ${banco.includes(TAG)}`, msgSalvar === 'Respostas salvas.' && v0.includes(TAG) && v1.includes(TAG) && banco.includes(TAG), '33-pdi-persistencia.png');
  await X.browser.close();
}

// ---- Permissões (API como autoridade) ----
{
  const tP03 = await token('p03@homolog.nexo', 'Nexo!Prof03-2026');
  const tP04 = await token('p04@homolog.nexo', 'Nexo!Prof04-2026');
  const casos = [
    ['PERM-1', 'Sem token não acessa a API', null, 'GET', '/api/formulario-um-terco/minhas', [401]],
    ['PERM-2', 'Professor não lista ciclos da Secretaria', tP04, 'GET', '/api/formulario-um-terco/ciclos', [403]],
    ['PERM-3', 'Professor não abre o painel do 1/3', tP04, 'GET', '/api/formulario-um-terco/ciclos/1/painel', [403]],
    ['PERM-4', 'P03 não lê o 1/3 de 6º Inglês (não é dele)', tP03, 'GET', '/api/formulario-um-terco/ciclos/1/formularios/6/9', [403, 404]],
    ['PERM-5', 'P03 não grava o 1/3 de 6º Inglês (corpo válido)', tP03, 'PUT', '/api/formulario-um-terco/ciclos/1/formularios/6/9/respostas', [403, 404], { baseUpdatedAt: null, respostas: [{ semanaId: 1, texto: 'invasão' }] }],
    ['PERM-6', 'P03 não lê a ficha PDI de Inglês do Pedro', tP03, 'GET', '/api/pdi-fichas/1/3/9', [403]],
    ['PERM-7', 'Professor não cria aluno PDI', tP04, 'POST', '/api/pdi-alunos', [403], { nome: 'x', turmaId: 1, responsavelNome: 'x', responsavelParentesco: 'Mãe', responsavelTelefone: '1' }],
  ];
  for (const [id, cen, t, m, p, esperado, body] of casos) {
    const s = await st(t, m, p, body);
    r(id, cen, `HTTP ${esperado.join('/')}`, `HTTP ${s}`, esperado.includes(s));
  }
}
await prisma.$disconnect();
