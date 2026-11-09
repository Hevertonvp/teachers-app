// Fase 3 — primeiro acesso real de P01 (simples) e P04 (estresse). Resultado de cada passo em /resultados.
import fs from 'node:fs';
import { abrir, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const senhas = JSON.parse(fs.readFileSync(new URL('./.senhas.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'utf8'));
const SENHA_DEF = { P01: 'Nexo!Prof01-2026', P04: 'Nexo!Prof04-2026' };

async function entrar(page, email, senha) {
  await page.goto(BASE + '/#/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').first().fill(senha);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForTimeout(1500);
}
const rota = (page) => page.url().split('#')[1];

for (const cod of ['P01', 'P04']) {
  const { browser, page, erros } = await abrir();
  const { email, senha } = senhas[cod];
  const id = (n) => `PA-${cod}-${n}`;

  // acesso direto sem autenticação
  await page.goto(BASE + '/#/formulario-um-terco'); await page.waitForTimeout(1000);
  registrar(id('01'), 'Primeiro acesso', 'URL protegida sem login redireciona ao login', '/login', rota(page), rota(page) === '/login' ? 'APROVADO' : 'REPROVADO');

  // senha temporária incorreta
  await entrar(page, email, 'senhaErrada!1');
  const msgErro = await page.locator('.text-red-800, .text-red-700, [role=alert]').first().innerText().catch(() => '');
  await foto(page, `03-${cod}-login-senha-errada`);
  registrar(id('02'), 'Primeiro acesso', 'Senha temporária incorreta é recusada com mensagem', 'permanece no login + mensagem', `${rota(page)} | "${msgErro}"`, rota(page) === '/login' && msgErro ? 'APROVADO' : 'REPROVADO');

  // campos vazios
  await page.goto(BASE + '/#/login');
  await page.getByRole('button', { name: /entrar/i }).click(); await page.waitForTimeout(500);
  registrar(id('03'), 'Primeiro acesso', 'Login com campos vazios não entra', '/login', rota(page), rota(page) === '/login' ? 'APROVADO' : 'REPROVADO');

  // senha temporária correta → troca obrigatória
  await entrar(page, email, senha);
  await foto(page, `03-${cod}-redirecionado-primeiro-acesso`);
  registrar(id('04'), 'Primeiro acesso', 'Senha temporária correta leva à troca obrigatória', '/primeiro-acesso', rota(page), rota(page) === '/primeiro-acesso' ? 'APROVADO' : 'REPROVADO');

  // F5 durante o primeiro acesso
  await page.reload(); await page.waitForTimeout(1500);
  registrar(id('05'), 'Primeiro acesso', 'Atualizar a página (F5) mantém no primeiro acesso, sem perder a sessão', '/primeiro-acesso', rota(page), rota(page) === '/primeiro-acesso' ? 'APROVADO' : 'REPROVADO');

  // tentar navegar para outra rota antes de trocar a senha
  await page.goto(BASE + '/#/formulario-um-terco'); await page.waitForTimeout(1000);
  registrar(id('06'), 'Primeiro acesso', 'Antes de trocar a senha, outras telas ficam bloqueadas', '/primeiro-acesso', rota(page), rota(page) === '/primeiro-acesso' ? 'APROVADO' : 'REPROVADO');

  // senhas que não coincidem
  const campos = page.locator('input[type=password]');
  await campos.nth(0).fill(SENHA_DEF[cod]); await campos.nth(1).fill('diferente123');
  await page.locator('button[type=submit]').click(); await page.waitForTimeout(600);
  const msg2 = await page.getByText(/não coincidem/i).count();
  registrar(id('07'), 'Primeiro acesso', 'Confirmação diferente da nova senha é recusada', 'mensagem "senhas não coincidem"', msg2 ? 'mensagem exibida' : 'sem mensagem', msg2 ? 'APROVADO' : 'REPROVADO');

  // senha curta / fraca
  await campos.nth(0).fill('123'); await campos.nth(1).fill('123');
  await page.locator('button[type=submit]').click(); await page.waitForTimeout(800);
  registrar(id('08'), 'Primeiro acesso', 'Senha muito curta (3 caracteres) é recusada', 'permanece em /primeiro-acesso', rota(page), rota(page) === '/primeiro-acesso' ? 'APROVADO' : 'REPROVADO');

  // senha definitiva válida
  await campos.nth(0).fill(SENHA_DEF[cod]); await campos.nth(1).fill(SENHA_DEF[cod]);
  await page.locator('button[type=submit]').click(); await page.waitForTimeout(2000);
  await foto(page, `03-${cod}-apos-troca-de-senha`);
  registrar(id('09'), 'Primeiro acesso', 'Senha definitiva válida conclui e leva ao sistema', 'rota do professor (dashboard)', rota(page), rota(page) !== '/primeiro-acesso' && rota(page) !== '/login' ? 'APROVADO' : 'REPROVADO');
  const menu = (await page.locator('nav a, aside a').allInnerTexts()).map(s => s.trim()).filter(Boolean);
  console.log(cod, 'menu do professor:', menu.join(' | '));

  // logout e novo login com a definitiva
  await page.getByRole('button', { name: 'Sair' }).click(); await page.waitForTimeout(1000);
  await entrar(page, email, SENHA_DEF[cod]);
  registrar(id('10'), 'Primeiro acesso', 'Login com a senha definitiva entra direto (sem nova troca)', 'dashboard', rota(page), ['/dashboard', '/'].includes(rota(page)) ? 'APROVADO' : 'REPROVADO');
  await page.getByRole('button', { name: 'Sair' }).click(); await page.waitForTimeout(800);

  // reutilizar a senha temporária
  await entrar(page, email, senha);
  registrar(id('11'), 'Primeiro acesso', 'Senha temporária já usada não funciona mais', '/login', rota(page), rota(page) === '/login' ? 'APROVADO' : 'REPROVADO');

  const p = await prisma.pessoa.findUnique({ where: { email }, select: { status: true, senhaTemporaria: true } });
  console.log(cod, 'banco: status', p?.status, '| senhaTemporaria (flag):', p?.senhaTemporaria);
  console.log(cod, 'erros console/rede:', erros.filter(e => !/401|403/.test(e)));
  await browser.close();
}
await prisma.$disconnect();
