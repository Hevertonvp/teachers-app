// Formulário 1/3 para a EDUCAÇÃO INFANTIL (12/11/2026: o 1/3 vale para todos os Professores; disciplina é
// opcional por escola no cargo — nenhuma disciplina inventada). Navegador real, banco LOCAL.
// A) Secretaria cadastra pela tela um cargo de Educação Infantil (escola sem disciplina) para o P13 (sem cargo).
// B) P14 (cargo de teste "Aurora, sem disciplina") preenche as 4 semanas e conclui pela tela; painel mostra a folha
//    só com a escola; filtro por disciplina não a inclui; nada filtra por etapa.
// C) O cargo cadastrado hoje (P13) não entra no ciclo já aberto; entra num próximo ciclo (criado no banco, declarado).
import { abrir, login, foto, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';
const r = (id, cen, esp, obs, ok, ev = '') => registrar(`EI-${id}`, 'Educação Infantil no 1/3', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', ev);
const API = 'http://localhost:3340/api';
const A = 'ZZ-HOMOLOG Escola Aurora';
const tokenDe = async (email, senha) => (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const get = async (tk, p) => (await fetch(API + p, { headers: { authorization: 'Bearer ' + tk } })).json();

await prepararCargosHomolog();
const p13 = await prisma.pessoa.findUniqueOrThrow({ where: { email: 'p13@homolog.nexo' } });
const p14 = await prisma.pessoa.findUniqueOrThrow({ where: { email: 'p14@homolog.nexo' } });
let proximo = null;
try {
  // ===== A) cadastro pela tela =====
  const S = await abrir();
  await login(S.page, 'secretaria@escola.gov.br', '12345678');
  await S.page.goto(BASE + '/#/pessoas'); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(800);
  const linha = S.page.locator('tr', { hasText: 'p13@homolog.nexo' });
  for (let i = 0; i < 10 && !(await linha.count()); i++) { await S.page.getByRole('button', { name: 'Próxima' }).click(); await S.page.waitForTimeout(300); }
  const semCargo = (await linha.textContent()).includes('Sem cargo');
  await linha.getByRole('button', { name: 'Cargos' }).click();
  const m = S.page.locator('div.fixed.inset-0').last();
  await m.getByText('Este professor está sem cargo').waitFor({ timeout: 10000 });
  const escolaSel = m.getByLabel('Escola 1');
  await escolaSel.selectOption(await escolaSel.evaluate((s, t) => [...s.options].find(o => o.text === t)?.value, A));
  await m.getByRole('button', { name: 'Remover disciplina' }).click();
  const avisoSemDisciplina = await m.getByText('Sem disciplina específica (por exemplo, Educação Infantil).').isVisible();
  await m.getByRole('button', { name: 'Cadastrar cargo' }).click();
  await m.getByText('Cargo cadastrado.').waitFor({ timeout: 10000 });
  await foto(S.page, '60-cargo-educacao-infantil');
  const cargoP13 = await prisma.cargoProfessor.findFirst({ where: { professorId: p13.id }, include: { versoes: true } });
  r('1', 'Secretaria cadastra pela tela um cargo de Educação Infantil: escola sem disciplina, sem disciplina inventada', `"Sem cargo" antes; aviso "Sem disciplina específica"; composição [{Aurora, []}]`, `sem cargo antes: ${semCargo}; aviso: ${avisoSemDisciplina}; composição ${JSON.stringify(cargoP13?.versoes[0]?.composicao)}`, semCargo && avisoSemDisciplina && JSON.stringify(cargoP13?.versoes[0]?.composicao) === JSON.stringify([{ escolaId: 1, disciplinaIds: [] }]), '60-cargo-educacao-infantil.png');
  const disciplinas = await prisma.disciplina.count();
  r('2', 'Nenhuma disciplina "Educação Infantil" foi criada', 'nenhuma', String(await prisma.disciplina.count({ where: { nome: { contains: 'Infantil' } } })), (await prisma.disciplina.count({ where: { nome: { contains: 'Infantil' } } })) === 0 && disciplinas > 0);
  await S.browser.close();

  // ===== B) P14 preenche e conclui pela tela =====
  const P = await abrir({ viewport: { width: 390, height: 844 } });
  await login(P.page, 'p14@homolog.nexo', SENHA('p14'));
  await abrirCartao(P.page, /^Cargo 1$/);
  const cabecalho = (await P.page.locator('main').innerText()).replace(/\s+/g, ' ');
  const textos = ['Brincadeiras cantadas e roda de conversa.', 'Pintura com as mãos e cores primárias.', 'Contação de histórias com fantoches.', 'Circuito motor no pátio.'];
  for (let i = 0; i < 4; i++) { await P.page.getByRole('tab', { name: `Semana ${i + 1}` }).click(); await P.page.waitForTimeout(800); await P.page.locator('#conteudos-semana').fill(textos[i]); await P.page.waitForTimeout(600); }
  await P.page.getByRole('button', { name: /^Concluir/ }).click(); await P.page.waitForTimeout(2500);
  const [c14] = await cargosDe('p14');
  const e14 = await folhaDoCargo(c14);
  const rolagem = await P.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await foto(P.page, '60-p14-concluido-celular');
  r('3', 'Professor da Educação Infantil (celular) preenche as 4 semanas e conclui; cabeçalho mostra só a escola, sem turma', 'CONCLUIDA; 4 semanas; "Aurora" sem "—"', `status ${e14?.status}; ${e14?.respostas.length} semanas; cabeçalho com Aurora: ${cabecalho.includes(A)}; com turma: ${/\dM\d|Pré|Maternal/.test(cabecalho)}; sobra ${rolagem}px`, e14?.status === 'CONCLUIDA' && e14.respostas.length === 4 && cabecalho.includes(A) && !cabecalho.includes(`${A} —`) && rolagem <= 0, '60-p14-concluido-celular.png');
  await P.browser.close();

  const tkS = await tokenDe('secretaria@escola.gov.br', '12345678');
  const painel = await get(tkS, '/formulario-um-terco/ciclos/1/painel');
  const l14 = painel.linhas.find(l => l.professorId === p14.id);
  const ing = await prisma.disciplina.findUnique({ where: { nome: 'Inglês' } });
  const porDisc = await get(tkS, `/formulario-um-terco/ciclos/1/painel?disciplinaId=${ing.id}`);
  r('4', 'Painel: a folha da Educação Infantil conta no esperado (escola sem disciplina) e não entra no filtro de uma disciplina', `P14 concluída com ${A} e 0 disciplinas; fora do filtro de Inglês`, `P14: ${l14?.status}, ${l14?.composicao.map(p => `${p.escolaNome} [${p.disciplinas.length}]`).join(' + ')}; no filtro de Inglês: ${porDisc.linhas.some(l => l.professorId === p14.id)}`, l14?.status === 'concluida' && l14.composicao.length === 1 && l14.composicao[0].disciplinas.length === 0 && !porDisc.linhas.some(l => l.professorId === p14.id));

  // ===== C) cargo cadastrado hoje: fora do ciclo aberto; dentro do próximo =====
  const noCicloAberto = painel.linhas.some(l => l.professorId === p13.id);
  proximo = await prisma.cicloUmTerco.create({ data: { anoLetivo: 2026, trimestre: 3, titulo: 'ZZ-EI próximo ciclo', status: 'INATIVA', abreEm: new Date(Date.now() + 3600000), prazoEm: new Date(Date.now() + 5 * 86400000), todasEscolas: true, semanas: { create: [{ numero: 1, dataInicio: new Date(Date.now() + 86400000), dataFim: new Date(Date.now() + 2 * 86400000) }] } } });
  const painelProx = await get(tkS, `/formulario-um-terco/ciclos/${proximo.id}/painel?professorId=${p13.id}`);
  r('5', 'Cargo de Educação Infantil cadastrado hoje: não entra no ciclo já aberto; entra no próximo ciclo, só com a escola', 'fora do ciclo 1; 1 folha (Aurora, sem disciplina) no próximo', `no ciclo 1: ${noCicloAberto}; próximo: ${painelProx.linhas.length} folha(s) ${painelProx.linhas.map(l => l.composicao.map(p => `${p.escolaNome} [${p.disciplinas.length}]`).join(' + ')).join(' | ')}`, !noCicloAberto && painelProx.linhas.length === 1 && painelProx.linhas[0].composicao[0].disciplinas.length === 0);
} finally {
  if (proximo) await prisma.cicloUmTerco.delete({ where: { id: proximo.id } });
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: p13.id }, select: { id: true } })).map(c => c.id);
  await prisma.cargoVersao.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoProfessor.deleteMany({ where: { id: { in: cargos } } });
  await prepararCargosHomolog();
  await prisma.$disconnect();
}
