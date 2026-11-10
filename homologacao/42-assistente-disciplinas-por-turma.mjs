// Assistente de vínculos do cadastro de professor: disciplina já adicionada PARA A TURMA some do seletor
// de disciplinas; a turma continua na lista; a disciplina continua disponível nas outras turmas.
// Navegador real (desktop e celular), banco LOCAL. Usa Redação e Geografia (sem professor na 6M1/6M2 da
// Aurora), para não substituir nenhum professor existente.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`ASSIST-${id}`, 'Assistente de vínculos (disciplinas por turma)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const aurora = await prisma.escola.findFirst({ where: { nome: { contains: 'Aurora' } } });
const t6m1 = await prisma.turma.findFirst({ where: { escolaId: aurora.id, nome: '6M1' } });
const t6m2 = await prisma.turma.findFirst({ where: { escolaId: aurora.id, nome: '6M2' } });
const redacao = await prisma.disciplina.findFirst({ where: { nome: 'Redação' } });
const geografia = await prisma.disciplina.findFirst({ where: { nome: 'Geografia' } });

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  await login(X.page, 'secretaria@escola.gov.br', '123456');
  await X.page.goto(BASE + '/#/pessoas'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
  await X.page.getByRole('button', { name: '+ Cadastrar professor' }).click(); await X.page.waitForTimeout(800);
  const c = X.page.locator('div.fixed.inset-0.z-50');
  const email = `assist-${nome}-${TAG}@homolog.nexo`;
  await c.locator('form input[type=email]').fill(email);
  await c.locator('form input').nth(1).fill(`Professor Assistente ${nome} ${TAG}`);
  await c.getByRole('checkbox', { name: 'ZZ-HOMOLOG Escola Aurora', exact: true }).check();
  await c.getByRole('button', { name: /Próximo/ }).click(); await X.page.waitForTimeout(2500);
  const w = X.page.locator('div.fixed.inset-0.z-50');
  const [selTurma, selDisc] = [w.locator('form select').nth(0), w.locator('form select').nth(1)];
  const disciplinas = async () => (await selDisc.locator('option').allInnerTexts()).filter(t => !/já adicionadas/.test(t));
  const totalDisc = (await disciplinas()).length;
  const turmasAntes = (await selTurma.locator('option').allInnerTexts()).length;

  await selTurma.selectOption(String(t6m1.id)); await X.page.waitForTimeout(300);
  await selDisc.selectOption(String(redacao.id)); await X.page.waitForTimeout(300);
  await w.getByRole('button', { name: '+ Adicionar' }).click(); await X.page.waitForTimeout(1500);
  const disc6m1 = await disciplinas();
  const selecionadaDepois = (await selDisc.locator('option:checked').innerText()).trim();
  const turmasDepois = (await selTurma.locator('option').allInnerTexts()).length;
  r(`1-${nome}`, `${nome}: depois de "6M1 — Redação", Redação some das disciplinas da 6M1 e outra já vem selecionada; a 6M1 continua na lista de turmas`, `Redação ausente; ${totalDisc - 1} disciplinas; turmas ${turmasAntes}`, `Redação presente: ${disc6m1.includes('Redação')}; ${disc6m1.length} disciplinas; selecionada: ${selecionadaDepois}; turmas ${turmasDepois}`, !disc6m1.includes('Redação') && disc6m1.length === totalDisc - 1 && selecionadaDepois !== 'Redação' && turmasDepois === turmasAntes);

  await selTurma.selectOption(String(t6m2.id)); await X.page.waitForTimeout(400);
  const disc6m2 = await disciplinas();
  r(`2-${nome}`, `${nome}: na 6M2, Redação continua disponível`, 'Redação presente', `Redação presente: ${disc6m2.includes('Redação')}; ${disc6m2.length} disciplinas`, disc6m2.includes('Redação') && disc6m2.length === totalDisc);

  await selTurma.selectOption(String(t6m1.id)); await X.page.waitForTimeout(400);
  await selDisc.selectOption(String(geografia.id)); await X.page.waitForTimeout(300);
  await w.getByRole('button', { name: '+ Adicionar' }).click(); await X.page.waitForTimeout(1500);
  const disc6m1b = await disciplinas();
  await foto(X.page, `42-assistente-${nome}`);
  r(`3-${nome}`, `${nome}: depois de "6M1 — Geografia", Redação e Geografia somem para a 6M1`, 'ambas ausentes', `Redação: ${disc6m1b.includes('Redação')}; Geografia: ${disc6m1b.includes('Geografia')}; ${disc6m1b.length} disciplinas`, !disc6m1b.includes('Redação') && !disc6m1b.includes('Geografia') && disc6m1b.length === totalDisc - 2, `42-assistente-${nome}.png`);

  const banco = await prisma.professorTurmaDisciplina.findMany({ where: { professor: { email }, status: 'ATIVO' }, include: { turma: true, disciplina: true } });
  r(`4-${nome}`, `${nome}: banco tem exatamente 6M1-Redação e 6M1-Geografia para o professor novo (sem duplicar)`, '2 vínculos', banco.map(v => `${v.turma.nome}-${v.disciplina.nome}`).join(', '), banco.length === 2 && banco.every(v => v.turmaId === t6m1.id) && new Set(banco.map(v => v.disciplinaId)).size === 2);
  await X.browser.close();
}
await prisma.$disconnect();
