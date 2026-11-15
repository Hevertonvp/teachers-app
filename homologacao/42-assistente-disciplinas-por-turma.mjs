// Assistente de turmas do cadastro de professor (decisão do usuário, 15/11/2026): a disciplina NÃO é escolhida
// de novo — vem do cargo. Uma linha por disciplina do cargo, com as turmas para marcar; marcar cria o vínculo,
// desmarcar encerra; disciplina fora do cargo não aparece. Navegador real (desktop e celular), banco LOCAL.
// Usa Redação e Geografia (sem professor na 6M1/6M2 da Aurora). Limpa o que cria.
import { abrir, login, foto, preencherCadastroProfessor, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`ASSIST-${id}`, 'Assistente de turmas (disciplina do cargo)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const aurora = await prisma.escola.findFirst({ where: { nome: { contains: 'Aurora' } } });
const t6m1 = await prisma.turma.findFirst({ where: { escolaId: aurora.id, nome: '6M1' } });

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  await X.page.goto(BASE + '/#/pessoas'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
  await X.page.getByRole('button', { name: '+ Cadastrar professor' }).click(); await X.page.waitForTimeout(800);
  const c = X.page.locator('div.fixed.inset-0.z-50');
  const email = `assist-${nome}-${TAG}@homolog.nexo`;
  await preencherCadastroProfessor(c, { email, nome: `Professor Assistente ${nome} ${TAG}`, escola: 'ZZ-HOMOLOG Escola Aurora', disciplinas: ['Redação', 'Geografia'] });
  const w = X.page.locator('div.fixed.inset-0.z-50');
  await w.locator('[data-disciplina]').first().waitFor({ timeout: 10000 });
  const linhas = await w.locator('[data-disciplina]').evaluateAll(els => els.map(e => e.getAttribute('data-disciplina')));
  const selects = await w.locator('select').count();
  r(`1-${nome}`, `${nome}: depois do cadastro, uma linha por disciplina do CARGO (Geografia, Redação) e nenhum campo para escolher disciplina`, 'Geografia, Redação; 0 selects', `${linhas.join(', ')}; ${selects} selects`, JSON.stringify(linhas) === JSON.stringify(['Geografia', 'Redação']) && selects === 0);

  await w.getByRole('button', { name: 'Redação — 6M1' }).click(); await X.page.waitForTimeout(1500);
  await w.getByRole('button', { name: 'Geografia — 6M1' }).click(); await X.page.waitForTimeout(1500);
  const marcadas = await w.locator('button[aria-pressed="true"]').count();
  await foto(X.page, `42-assistente-${nome}`);
  const banco = await prisma.professorTurmaDisciplina.findMany({ where: { professor: { email }, status: 'ATIVO' }, include: { turma: true, disciplina: true } });
  r(`2-${nome}`, `${nome}: marcar 6M1 em Redação e em Geografia cria os 2 vínculos (sem duplicar)`, '2 marcadas; 6M1-Redação e 6M1-Geografia', `${marcadas} marcadas; ${banco.map(v => `${v.turma.nome}-${v.disciplina.nome}`).join(', ')}`, marcadas === 2 && banco.length === 2 && banco.every(v => v.turmaId === t6m1.id), `42-assistente-${nome}.png`);

  await w.getByRole('button', { name: 'Geografia — 6M1' }).click(); await X.page.waitForTimeout(1500);
  const depois = await prisma.professorTurmaDisciplina.findMany({ where: { professor: { email }, status: 'ATIVO' }, include: { disciplina: true } });
  r(`3-${nome}`, `${nome}: desmarcar "Geografia — 6M1" encerra só esse vínculo`, 'fica só 6M1-Redação', depois.map(v => v.disciplina.nome).join(', '), depois.length === 1 && depois[0].disciplina.nome === 'Redação');

  const largura = await X.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  r(`4-${nome}`, `${nome}: disciplina fora do cargo não aparece (sem linha de Matemática) e sem rolagem lateral`, 'sem Matemática; sem rolagem', `Matemática: ${await w.locator('[data-disciplina="Matemática"]').count()}; sem rolagem: ${largura}`, (await w.locator('[data-disciplina="Matemática"]').count()) === 0 && largura);
  await X.browser.close();
  await limparProfessoresDeTeste(['assist-']); // senão a 6M1-Redação fica ocupada e a próxima rodada cai na pergunta de substituição
}
await limparProfessoresDeTeste(['assist-']);
await prisma.$disconnect();
