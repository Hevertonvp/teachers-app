// Fase 2b — Secretaria cadastra professores e vínculos PELA INTERFACE (wizard oficial) e captura
// a senha temporária mostrada. As senhas ficam só em .senhas.json (gitignored), nunca em logs.
import fs from 'node:fs';
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';

const ESC = { A: 'ZZ-HOMOLOG Escola Aurora', B: 'ZZ-HOMOLOG Escola Boa Vista' };
// [código, nome, e-mail, { escola: [[turma, disciplina], ...] }]
const PROFESSORES = [
  ['P01', 'Ana Paula Ribeiro', 'p01@homolog.nexo', { A: [['6M1', 'Matemática']] }],
  ['P02', 'Beatriz Nogueira', 'p02@homolog.nexo', { A: [['6M1', 'Língua Portuguesa'], ['6M1', 'Ciências'], ['6M1', 'História']] }],
  ['P03', 'Carlos Eduardo Lima', 'p03@homolog.nexo', { A: [['6M2', 'Geografia'], ['6M3', 'Geografia'], ['6M4', 'Geografia'], ['7M2', 'Geografia']] }],
  ['P04', 'Daniela Moreira', 'p04@homolog.nexo', {
    A: [['6M1', 'Inglês'], ['6M1', 'Arte'], ['6M1', 'Ensino Religioso'], ['6M2', 'Inglês'], ['7M1', 'Inglês'], ['7M1', 'Arte']],
    B: [['8M1', 'Inglês'], ['9M2', 'Inglês']],
  }],
  ['P05', 'Eduardo Fonseca', 'p05@homolog.nexo', { A: [['7M2', 'Educação Física']], B: [['7M1', 'Educação Física']] }],
  ['P06', 'Fernanda Albuquerque', 'p06@homolog.nexo', { A: [['6M2', 'Ciências']] }],
];

const arquivoSenhas = new URL('./.senhas.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const senhas = fs.existsSync(arquivoSenhas) ? JSON.parse(fs.readFileSync(arquivoSenhas, 'utf8')) : {};
const only = process.argv.slice(2);

const { browser, page, erros } = await abrir();
const modal = () => page.locator('div.fixed.inset-0');
await login(page, 'secretaria@escola.gov.br', '12345678');
await page.goto(BASE + '/#/pessoas'); await page.waitForLoadState('networkidle');

for (const [codigo, nome, email, plano] of PROFESSORES) {
  if (only.length && !only.includes(codigo)) continue;
  if (senhas[codigo]) { console.log(codigo, 'já cadastrado, pulando'); continue; }
  await page.getByRole('button', { name: '+ Cadastrar professor' }).click();
  await modal().getByLabel('E-mail', { exact: true }).fill(email);
  await modal().locator('input').nth(1).fill(nome);
  for (const k of Object.keys(plano)) await modal().getByLabel(ESC[k], { exact: true }).check();
  await modal().getByRole('button', { name: /Próximo/ }).click();
  await page.waitForTimeout(900);

  const chaves = Object.keys(plano);
  for (let i = 0; i < chaves.length; i++) {
    for (const [turma, disciplina] of plano[chaves[i]]) {
      await modal().getByLabel('Turma').selectOption({ label: turma });
      await modal().getByLabel('Disciplina').selectOption({ label: disciplina });
      await modal().getByRole('button', { name: /\+ Adicionar/ }).click();
      await page.getByText(`${turma} — ${disciplina}`).first().waitFor({ timeout: 8000 });
    }
    if (codigo === 'P04' && i === 0) await foto(page, '02-p04-wizard-escola-A');
    await modal().getByRole('button', { name: i === chaves.length - 1 ? 'Concluir cadastro' : /Próxima escola/ }).click();
    await page.waitForTimeout(500);
  }
  const senha = (await modal().locator('p.font-mono.text-lg').innerText()).trim();
  senhas[codigo] = { email, senha };
  fs.writeFileSync(arquivoSenhas, JSON.stringify(senhas, null, 2));
  await foto(page, `02-${codigo}-senha-temporaria-modal`);
  await modal().getByRole('button', { name: 'Concluir' }).click();
  await page.waitForTimeout(500);
  console.log(codigo, 'cadastrado com', Object.values(plano).flat().length, 'vínculo(s) pela interface');
}
await foto(page, '02-lista-professores');
const vinc = await prisma.professorTurmaDisciplina.findMany({ where: { professor: { email: { endsWith: '@homolog.nexo' } } }, include: { professor: { select: { email: true } }, turma: { select: { nome: true, escolaId: true } }, disciplina: { select: { nome: true } } }, orderBy: { id: 'asc' } });
console.log('Vínculos no banco:', vinc.length);
for (const v of vinc) console.log(` ${v.professor.email.split('@')[0]} | esc${v.turma.escolaId} ${v.turma.nome} | ${v.disciplina.nome} | ${v.status} | início ${v.dataInicio.toISOString().slice(0, 10)}`);
console.log('Erros:', erros);
await browser.close(); await prisma.$disconnect();
