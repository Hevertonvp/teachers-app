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
  // Modal de 10/11/2026: ano e trimestre saem da abertura; título é sempre 'Formulário 1/3'
  // (ano, tri e titulo deste helper ficaram sem efeito). Semanas explícitas sobrescrevem a divisão automática.
  // Desde 10/11/2026 abertura e prazo são só DATA (abre 00:00, prazo até 23:59): a hora passada aqui é ignorada.
  await m.getByLabel('Abertura', { exact: true }).fill(abre.slice(0, 10));
  await m.getByLabel('Prazo de entrega', { exact: true }).fill(prazo.slice(0, 10));
  await m.getByLabel('Quantidade de semanas').fill(String(semanas.length));
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
  await page.locator('[data-rotulo]', { hasText: regex }).first().locator('xpath=ancestor::div[contains(@class,"flex-col")][1]').getByRole('button').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
}

// Primeiro passo do cadastro de Professor (por CARGO, desde 12–13/11/2026): e-mail, nome e Cargo 1 com
// uma escola e uma disciplina. Depois de "Próximo →" abre o assistente de turmas e disciplinas.
export async function preencherCadastroProfessor(modal, { email, nome, escola, disciplina, disciplinas }) {
  const escolher = async (sel, texto) => {
    const v = await sel.evaluate((s, t) => [...s.options].find(o => o.text.trim() === t)?.value, texto);
    if (!v) throw new Error(`Opção "${texto}" não encontrada`);
    await sel.selectOption(v);
  };
  await modal.locator('input[type=email]').fill(email);
  await modal.locator('input:not([type=email]):not([type=date])').first().fill(nome);
  await escolher(modal.getByLabel('Escola 1').first(), escola);
  const lista = disciplinas ?? [disciplina];
  for (let i = 0; i < lista.length; i++) {
    if (i > 0) await modal.getByRole('button', { name: '+ Adicionar disciplina' }).first().click();
    await escolher(modal.getByLabel(`Disciplina ${i + 1}`).first(), lista[i]);
  }
  await modal.getByRole('button', { name: 'Próximo →' }).click();
}
