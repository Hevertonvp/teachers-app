// Fase 2a — Secretaria prepara calendário, escolas e turmas PELA INTERFACE.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';

const { browser, page, erros } = await abrir();
const modal = () => page.locator('div.fixed.inset-0');
await login(page, 'secretaria@escola.gov.br', '123456');

// ---- Calendário 2026 (dados fictícios de homologação) ----
await page.goto(BASE + '/#/configuracoes'); await page.waitForLoadState('networkidle');
const datas = ['2026-02-02', '2026-04-30', '2026-05-01', '2026-08-15', '2026-08-16', '2026-12-18'];
const inputs = page.locator('input[type=date]');
for (let i = 0; i < 6; i++) await inputs.nth(i).fill(datas[i]);
await page.getByRole('button', { name: /Salvar calendário de 2026/ }).click();
await page.waitForTimeout(1200);
await foto(page, '01-calendario-2026');

// ---- Escolas ----
await page.goto(BASE + '/#/escolas'); await page.waitForLoadState('networkidle');
for (const nome of ['ZZ-HOMOLOG Escola Aurora', 'ZZ-HOMOLOG Escola Boa Vista']) {
  await page.getByRole('button', { name: '+ Nova escola' }).first().click();
  await modal().locator('input').first().fill(nome);
  await modal().getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(800);
}
await foto(page, '01-escolas');

// ---- Turmas ----
const turmas = [
  ['ZZ-HOMOLOG Escola Aurora', 6, 1], ['ZZ-HOMOLOG Escola Aurora', 6, 2], ['ZZ-HOMOLOG Escola Aurora', 6, 3], ['ZZ-HOMOLOG Escola Aurora', 6, 4],
  ['ZZ-HOMOLOG Escola Aurora', 7, 1], ['ZZ-HOMOLOG Escola Aurora', 7, 2],
  ['ZZ-HOMOLOG Escola Boa Vista', 6, 1], ['ZZ-HOMOLOG Escola Boa Vista', 7, 1], ['ZZ-HOMOLOG Escola Boa Vista', 8, 1], ['ZZ-HOMOLOG Escola Boa Vista', 9, 2],
];
await page.goto(BASE + '/#/turmas'); await page.waitForLoadState('networkidle');
for (const [escola, serie, ident] of turmas) {
  await page.getByRole('button', { name: '+ Nova turma' }).first().click();
  const m = modal();
  await m.getByLabel('Escola').selectOption({ label: escola });
  await m.getByLabel('Ano letivo').fill('2026');
  await m.getByLabel('Ano/série').selectOption({ label: `${serie}º ano` });
  await m.getByLabel('Turno').selectOption({ label: 'Manhã' });
  await m.getByLabel('Identificador da turma').fill(String(ident));
  await m.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(700);
  if (await modal().count()) { console.log('MODAL AINDA ABERTO para', escola, serie, ident, (await modal().innerText()).slice(0, 200)); await page.keyboard.press('Escape'); }
}
await foto(page, '01-turmas');

console.log('Escolas no banco:', (await prisma.escola.findMany({ where: { nome: { startsWith: 'ZZ-HOMOLOG' } }, select: { id: true, nome: true } })));
console.log('Turmas no banco:', (await prisma.turma.findMany({ where: { escola: { nome: { startsWith: 'ZZ-HOMOLOG' } } }, select: { id: true, nome: true, escolaId: true, anoSerie: true, etapa: true, anoLetivo: true }, orderBy: { id: 'asc' } })).map(t => `${t.id}|${t.escolaId}|${t.nome}|${t.anoSerie}|${t.etapa}|${t.anoLetivo}`));
console.log('Trimestres:', await prisma.periodoTrimestre.findMany());
console.log('Erros:', erros);
await browser.close(); await prisma.$disconnect();
