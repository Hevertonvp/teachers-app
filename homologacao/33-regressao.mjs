// Regressão em navegador real depois das correções DEF-14/17/07/08: login, permissões, professor com
// vários vínculos (cartões do 1/3) e persistência do formulário PDI. API conferida em paralelo; banco LOCAL.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { readFileSync } from 'node:fs';
const PDI_LIGADO = /MODO_PDI = 'ativo'/.test(readFileSync(new URL('../src/config/modulos.js', import.meta.url), 'utf8'));
import { cargosDe, folhaDoCargo, prepararCargosHomolog } from './cargos-homolog.mjs';
await prepararCargosHomolog();
const [C1, C2] = await cargosDe('p04');
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
  r('MULTI-1', 'P04 (2 cargos diferentes) vê um cartão por cargo (1/3 por cargo)', '2 cartões: Cargo 1 e Cargo 2', `${cartoes.length}: ${cartoes.join(' | ')}`, cartoes.length === 2 && cartoes.includes('Cargo 1') && cartoes.includes('Cargo 2'), '33-cartoes-p04.png');
  r('MULTI-2', 'Cada cartão mostra escola → disciplinas do seu cargo (sem turmas)', 'Aurora — Arte, Ensino Religioso, Inglês; Boa Vista — Inglês', `Aurora: ${/Aurora — Arte, Ensino Religioso, Inglês/.test(ingles6)}; Boa Vista: ${/Boa Vista — Inglês/.test(ingles6)}; turmas: ${/\dM\d/.test(ingles6)}`, /Aurora — Arte, Ensino Religioso, Inglês/.test(ingles6) && /Boa Vista — Inglês/.test(ingles6) && !/\dM\d/.test(ingles6));

  // ---- Persistência do formulário PDI (bloco comum + disciplina), online — só com o PDI ligado ----
  if (!PDI_LIGADO) registrar('REG-PDI-1', 'Regressão', 'PDI online (persistência)', 'só com o PDI ligado', 'pulado: PDI em desenvolvimento', 'OBSERVAÇÃO (regra não especificada)');
  else {
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
  }
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
    ['PERM-4', 'P03 não lê a folha do Cargo 1 do P04 (não é dele)', tP03, 'GET', `/api/formulario-um-terco/ciclos/1/cargos/${C1}`, [403, 404]],
    ['PERM-5', 'P03 não grava na folha do Cargo 1 do P04 (corpo válido)', tP03, 'PUT', `/api/formulario-um-terco/ciclos/1/cargos/${C1}/respostas`, [403, 404], { baseUpdatedAt: null, respostas: [{ semanaId: 1, texto: 'invasão' }] }],
    ['PERM-6', 'P03 não lê a ficha PDI de Inglês do Pedro', tP03, 'GET', '/api/pdi-fichas/1/3/9', [403]],
    ['PERM-7', 'Professor não cria aluno PDI', tP04, 'POST', '/api/pdi-alunos', [403], { nome: 'x', turmaId: 1, responsavelNome: 'x', responsavelParentesco: 'Mãe', responsavelTelefone: '1' }],
  ];
  for (const [id, cen, t, m, p, esperado, body] of casos) {
    const s = await st(t, m, p, body);
    r(id, cen, `HTTP ${esperado.join('/')}`, `HTTP ${s}`, esperado.includes(s));
  }
}
await prisma.$disconnect();
