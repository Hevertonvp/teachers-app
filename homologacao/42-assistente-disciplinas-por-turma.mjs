// Turmas marcadas no PRÓPRIO cadastro do professor (decisão do usuário, 15/11/2026): cada disciplina escolhida no
// cargo mostra as turmas da escola para marcar; "Cadastrar" grava cargo + turmas e vai direto para a senha (sem
// assistente depois). Turma com outro professor na disciplina avisa "Substitui …". Navegador real (desktop e
// celular), banco LOCAL. Usa Redação e Geografia (sem professor na 6M1 da Aurora). Limpa o que cria.
import { abrir, login, foto, preencherCadastroProfessor, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`ASSIST-${id}`, 'Turmas no cadastro do professor', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const aurora = await prisma.escola.findFirst({ where: { nome: { contains: 'Aurora' } } });
const t6m1 = await prisma.turma.findFirst({ where: { escolaId: aurora.id, nome: '6M1' } });
const mat = await prisma.disciplina.findFirst({ where: { nome: 'Matemática' } });
const ocupante = await prisma.professorTurmaDisciplina.findFirst({ where: { turmaId: t6m1.id, disciplinaId: mat.id, status: 'ATIVO' }, include: { professor: true } });
await limparProfessoresDeTeste(['assist-']);

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  await X.page.goto(BASE + '/#/pessoas'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
  await X.page.getByRole('button', { name: '+ Cadastrar professor' }).click(); await X.page.waitForTimeout(1200);
  const c = X.page.locator('div.fixed.inset-0.z-50');
  const email = `assist-${nome}-${TAG}@homolog.nexo`;
  await preencherCadastroProfessor(c, { email, nome: `Professor Assistente ${nome} ${TAG}`, escola: 'ZZ-HOMOLOG Escola Aurora', disciplinas: ['Redação', 'Geografia', 'Matemática'], turmas: ['Redação — 6M1', 'Geografia — 6M1', 'Matemática — 6M1'], enviar: false });
  const linhas = await c.locator('[data-disciplina]').evaluateAll(els => els.map(e => e.getAttribute('data-disciplina')));
  r(`1-${nome}`, `${nome}: cada disciplina escolhida no cargo mostra as turmas da escola logo abaixo`, 'Redação, Geografia, Matemática', linhas.join(', '), JSON.stringify(linhas) === JSON.stringify(['Redação', 'Geografia', 'Matemática']));

  const aviso = (await c.getByText(/^Substitui .* na 6M1\.$/).allInnerTexts()).join(' | ');
  await foto(X.page, `42-cadastro-turmas-${nome}`);
  r(`2-${nome}`, `${nome}: marcar turma em que outro professor dá a disciplina avisa a substituição com o nome dele`, `Substitui ${ocupante?.professor.nome} na 6M1.`, aviso || '(sem aviso)', !!ocupante && aviso === `Substitui ${ocupante.professor.nome} na 6M1.`, `42-cadastro-turmas-${nome}.png`);

  // Desmarca e tira Matemática (não substitui ninguém de verdade).
  await c.getByRole('button', { name: 'Matemática — 6M1', exact: true }).click();
  const avisoSumiu = (await c.getByText(/^Substitui /).count()) === 0;
  await c.getByRole('button', { name: 'Remover disciplina' }).nth(2).click();
  const largura = await X.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  r(`3-${nome}`, `${nome}: desmarcar tira o aviso; sem rolagem lateral`, 'aviso some; sem rolagem', `aviso some: ${avisoSumiu}; sem rolagem: ${largura}`, avisoSumiu && largura);

  await c.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await X.page.getByText('Senha temporária').waitFor({ timeout: 15000 });
  const janelaTurmas = await X.page.getByRole('heading', { name: /^Turmas — / }).count();
  const banco = await prisma.professorTurmaDisciplina.findMany({ where: { professor: { email }, status: 'ATIVO' }, include: { turma: true, disciplina: true } });
  const matIntacta = await prisma.professorTurmaDisciplina.findFirst({ where: { turmaId: t6m1.id, disciplinaId: mat.id, status: 'ATIVO' } });
  r(`4-${nome}`, `${nome}: "Cadastrar" grava as turmas marcadas e vai direto para a senha (sem janela de turmas depois); Matemática da 6M1 continua com o professor dela`, '6M1-Geografia, 6M1-Redação; sem janela; Matemática intacta', `${banco.map(v => `${v.turma.nome}-${v.disciplina.nome}`).sort().join(', ')}; janela de turmas: ${janelaTurmas}; Matemática com #${matIntacta?.professorId}`, banco.length === 2 && banco.every(v => v.turmaId === t6m1.id) && janelaTurmas === 0 && matIntacta?.professorId === ocupante?.professorId);
  await X.browser.close();
  await limparProfessoresDeTeste(['assist-']);
}
await prisma.$disconnect();
