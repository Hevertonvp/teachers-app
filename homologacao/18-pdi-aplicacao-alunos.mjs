// PDI — Aplicação (Escola Aurora, 3º trimestre) e alunos fictícios, tudo pela interface da Secretaria.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const { browser, page, erros } = await abrir();
const modal = () => page.locator('div.fixed.inset-0');
await login(page, 'secretaria@escola.gov.br', '123456');

// ---- Aplicação ----
await page.goto(BASE + '/#/pdi/formulario'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
if ((await prisma.aplicacaoPdi.count()) === 0) {
  await page.getByRole('button', { name: 'Aplicações', exact: true }).click(); await page.waitForTimeout(800);
  await foto(page, '18-aba-aplicacoes');
  await page.getByRole('button', { name: /Nova aplica/ }).first().click(); await page.waitForTimeout(600);
  const m = modal();
  await m.getByRole('checkbox', { name: 'ZZ-HOMOLOG Escola Aurora', exact: true }).check();
  for (const d of ['Matemática', 'Inglês', 'Arte', 'Ensino Religioso', 'Língua Portuguesa', 'Ciências', 'História']) await m.locator('label.flex', { hasText: new RegExp('^\\s*' + d + '\\s*\\(PDI') }).locator('input').check();
  const datas = m.locator('input[type=date]');
  await datas.nth(0).fill('2026-11-04'); await datas.nth(1).fill('2026-12-15');
  await foto(page, '18-aplicacao-modal');
  await m.getByRole('button', { name: /Salvar|Criar|Agendar/ }).last().click(); await page.waitForTimeout(2000);
  if (await modal().count()) { console.log('MODAL:', (await modal().innerText()).replace(/\s+/g, ' ').slice(0, 400)); await page.keyboard.press('Escape'); }
}
const ap = await prisma.aplicacaoPdi.findMany({ include: { escola: true } });
await foto(page, '18-aplicacoes');
console.log('Aplicações:', ap.map(a => `${a.escola.nome} ${a.dataInicio.toISOString().slice(0, 10)}→${a.dataFim.toISOString().slice(0, 10)} tri=${a.trimestre}`));
registrar('PDI-SET-03', 'PDI', 'Secretaria cria Aplicação PDI da Escola Aurora (3º tri, 04/11–15/12) com 7 disciplinas', '1 aplicação', ap.map(a => `${a.escola.nome} tri=${a.trimestre}`).join(';') || 'nenhuma', ap.length === 1 ? 'APROVADO' : 'REPROVADO', '18-aplicacoes.png');

// ---- Alunos ----
await page.goto(BASE + '/#/pdi/alunos'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
await page.getByRole('button', { name: /Todas as escolas/ }).first().click(); await page.waitForTimeout(500); await page.getByText('ZZ-HOMOLOG Escola Aurora', { exact: true }).first().click(); await page.waitForTimeout(1200);
const alunos = [['Lucas Almeida Prado', '6M1'], ['Marina Teixeira Lopes', '6M1'], ['Pedro Henrique Souza', '6M2'], ['Larissa Gomes Ferraz', '7M1']];
for (const [nome, turma] of alunos) {
  if (await prisma.alunoPdi.count({ where: { nome } })) continue;
  await page.getByRole('button', { name: 'Novo aluno PDI' }).click(); await page.waitForTimeout(500);
  const m = modal();
  await m.getByLabel('Nome completo').fill(nome);
  { const sel = m.locator('select').nth(1); const v = await sel.locator('option', { hasText: turma }).first().getAttribute('value'); await sel.selectOption(v); }
  await m.getByLabel('Nome do responsável').fill('Responsável de ' + nome.split(' ')[0]);
  await m.getByLabel('Parentesco').selectOption({ label: 'Mãe' });
  await m.getByLabel('Telefone principal').fill('(31) 99999-0000').catch(() => {});
  console.log('inválidos:', JSON.stringify(await m.locator(':invalid').evaluateAll(l => l.map(e => (e.closest('label')?.innerText ?? e.tagName).split('|')[0].slice(0, 30) + '=' + e.validationMessage))));
  await m.getByRole('button', { name: 'Salvar' }).click(); await page.waitForTimeout(1500);
  if (await modal().count()) { console.log('MODAL ALUNO:', (await modal().innerText()).replace(/\s+/g, ' ').slice(0, 300)); await foto(page, '18-aluno-erro'); await page.keyboard.press('Escape'); }
}
const al = await prisma.alunoPdi.findMany({ select: { id: true, nome: true, turmaId: true } });
await foto(page, '18-alunos');
registrar('PDI-SET-04', 'PDI', 'Secretaria cadastra 4 alunos PDI pela interface', '4 alunos', String(al.length), al.length === 4 ? 'APROVADO' : 'REPROVADO', '18-alunos.png');
console.log('erros', erros);
await browser.close(); await prisma.$disconnect();
