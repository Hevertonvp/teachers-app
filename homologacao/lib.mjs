// Utilidades comuns da homologação. Tudo roda no navegador real contra o banco LOCAL.
import { chromium } from 'playwright';
import fs from 'node:fs';

export const BASE = 'https://localhost:5180';
export const EVID = new URL('./evidencias/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
fs.mkdirSync(EVID, { recursive: true });

export async function abrir({ headless = true, viewport = { width: 1280, height: 800 } } = {}) {
  const browser = await chromium.launch({ headless, args: ['--ignore-certificate-errors'] });
  const contexto = await browser.newContext({ ignoreHTTPSErrors: true, viewport, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const page = await contexto.newPage();
  const erros = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR ' + e.message));
  page.on('response', r => { if (r.status() >= 500) erros.push(`HTTP ${r.status()} ${r.url()}`); });
  return { browser, contexto, page, erros };
}

export async function login(page, email, senha) {
  await page.goto(BASE + '/#/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').first().fill(senha);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForFunction(() => !location.hash.includes('/login'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
}

export const foto = (page, nome) => page.screenshot({ path: EVID + nome + '.png', fullPage: true });

// Secretaria cria ciclo PELA INTERFACE. Devolve { ok, mensagem } (mensagem = erro mostrado no modal).
export async function criarCiclo(page, { ano = 2026, tri, titulo, abre, prazo, semanas }) {
  await page.goto(BASE + '/#/formulario-um-terco'); await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '+ Novo ciclo' }).first().click();
  const m = page.locator('div.fixed.inset-0');
  await m.getByLabel('Ano letivo').fill(String(ano));
  await m.getByLabel('Trimestre').selectOption(String(tri));
  await m.getByLabel('Quantidade de semanas').fill(String(semanas.length));
  if (titulo) await m.getByLabel('Título').fill(titulo);
  await m.getByLabel('Abertura (data e hora)').fill(abre);
  await m.getByLabel('Prazo de entrega (data e hora)').fill(prazo);
  for (let i = 0; i < semanas.length; i++) {
    await m.getByLabel(`Semana ${i + 1}: início`).fill(semanas[i][0]);
    await m.getByLabel(`Semana ${i + 1}: fim`).fill(semanas[i][1]);
  }
  const salvar = m.getByRole('button', { name: 'Salvar' });
  if (await salvar.isDisabled()) {
    const aviso = (await m.innerText()).replace(/s+/g, ' ').match(/(não está configurad[^.]*.|calend[^.]*.)/i)?.[0] ?? 'Salvar desabilitado';
    return { ok: false, mensagem: 'BOTÃO SALVAR DESABILITADO pela interface. ' + aviso };
  }
  await salvar.click();
  await page.waitForTimeout(1200);
  if (await m.count()) {
    const mensagem = (await m.locator('.text-red-800').first().innerText().catch(() => '')) || '(modal ficou aberto sem mensagem)';
    return { ok: false, mensagem };
  }
  return { ok: true, mensagem: '' };
}

export async function sair(page) {
  await page.getByRole('button', { name: 'Sair' }).click().catch(() => {});
  await page.waitForTimeout(700);
}

// Abre o cartão de um formulário na lista do professor (ex.: /6º.*Inglês/).
export async function abrirCartao(page, regex) {
  await page.goto(BASE + '/#/formulario-um-terco'); await page.waitForLoadState('networkidle');
  await page.locator('h2.text-xl', { hasText: regex }).first().locator('xpath=ancestor::div[contains(@class,"flex-col")][1]').getByRole('button').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
}
