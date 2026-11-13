// A escola do Professor vem do cargo + aviso antes da saída em cascata (decisões do usuário, 13/11/2026).
// Substitui o 65 (pergunta "Em qual cargo essa escola entra?", que saiu). Navegador real, banco LOCAL. Limpa o que cria.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, ev = '') => registrar(`CASC-${id}`, 'Escola vem do cargo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', ev);
const P = 'zzcasc';
const AUR = 'ZZ-HOMOLOG Escola Aurora';
const BV = 'ZZ-HOMOLOG Escola Boa Vista';
const ir = async (page, rota) => { await page.goto(BASE + '/#' + rota); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800); };
const modal = (page) => page.locator('div.fixed.inset-0').last();

const aurora = await prisma.escola.findFirstOrThrow({ where: { nome: AUR } });
const bv = await prisma.escola.findFirstOrThrow({ where: { nome: BV } });
const ing = await prisma.disciplina.findUniqueOrThrow({ where: { nome: 'Inglês' } });
const antes = new Date('2026-11-01T12:00:00Z');
let turmaCriada = null;

async function limpar() {
  const pessoas = (await prisma.pessoa.findMany({ where: { email: { startsWith: P } }, select: { id: true } })).map(p => p.id);
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: pessoas } }, select: { id: true } })).map(c => c.id);
  await prisma.professorTurmaDisciplina.deleteMany({ where: { professorId: { in: pessoas } } });
  await prisma.cargoVersao.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoProfessor.deleteMany({ where: { id: { in: cargos } } });
  await prisma.vinculoEscolar.deleteMany({ where: { pessoaId: { in: pessoas } } });
  await prisma.pessoaEvento.deleteMany({ where: { pessoaId: { in: pessoas } } });
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
  if (turmaCriada) await prisma.turma.delete({ where: { id: turmaCriada } }).catch(() => {});
  await prisma.turma.deleteMany({ where: { nome: 'ZZCASC 9º 9' } });
}
// Professor com 1 cargo nas escolas dadas (Inglês em cada), vínculos ativos nelas.
async function professor(sufixo, escolas) {
  const p = await prisma.pessoa.create({ data: { nome: `Aaa ZZCASC Professor ${sufixo}`, email: `${P}-${sufixo}@teste.invalid`, perfil: 'PROFESSOR' } });
  for (const e of escolas) await prisma.vinculoEscolar.create({ data: { pessoaId: p.id, escolaId: e.id, dataInicio: antes } });
  await prisma.cargoProfessor.create({ data: { professorId: p.id, dataInicio: antes, createdAt: antes, versoes: { create: { criadaEm: antes, composicao: escolas.map(e => ({ escolaId: e.id, disciplinaIds: [ing.id], atuacaoIds: [] })) } } } });
  return p;
}
const ativos = async (pessoaId) => (await prisma.vinculoEscolar.findMany({ where: { pessoaId, status: 'ATIVO' }, select: { escolaId: true } })).map(v => v.escolaId).sort();

await limpar();
try {
  const pA = await professor('alterar', [aurora, bv]);
  const pE = await professor('encerrar', [aurora]);
  const t = await prisma.turma.create({ data: { escolaId: bv.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 9, turno: 'TARDE', identificador: 9, nome: 'ZZCASC 9º 9', identidadeChave: `zzcasc-${Date.now()}` } });
  turmaCriada = t.id;
  await prisma.professorTurmaDisciplina.create({ data: { turmaId: t.id, professorId: pA.id, disciplinaId: ing.id, dataInicio: antes } });

  const S = await abrir();
  await login(S.page, 'secretaria@escola.gov.br', '12345678');
  await ir(S.page, '/pessoas');

  // 1. Lista: "Cargos e escolas" e "Turmas e disciplinas"; sem "Escolas" para professor.
  {
    const linha = S.page.locator('tr', { hasText: pA.email });
    const botoes = (await linha.getByRole('button').allInnerTexts()).map(b => b.trim()).filter(Boolean);
    r('1', 'Lista de professores (Secretaria): botão único "Cargos e escolas"; "Escolas" sumiu para professor', 'botões incluem Cargos e escolas e não incluem Escolas',
      JSON.stringify(botoes), botoes.includes('Cargos e escolas') && !botoes.includes('Escolas') && botoes.includes('Turmas e disciplinas'));
  }

  // 2. Tirar Boa Vista do cargo: aviso com escola e turma; Voltar não grava; confirmar tira da escola e da turma.
  {
    await S.page.locator('tr', { hasText: pA.email }).getByRole('button', { name: 'Cargos e escolas' }).click();
    const c = modal(S.page);
    await c.getByRole('button', { name: 'Alterar' }).click();
    const blocoBv = c.getByLabel('Escola 2');
    await blocoBv.waitFor({ timeout: 10000 });
    const qualSai = (await c.getByLabel('Escola 1').evaluate(s => s.options[s.selectedIndex]?.text.trim())) === BV ? 1 : 2;
    await c.getByRole('button', { name: 'Remover esta escola do cargo' }).nth(qualSai - 1).click();
    await c.getByRole('button', { name: 'Salvar cargo' }).click();
    const aviso = c.locator('[role=alert]').filter({ hasText: 'também sai de' });
    await aviso.waitFor({ timeout: 10000 });
    const texto = (await aviso.innerText()).replace(/\s+/g, ' ');
    await foto(S.page, '66-aviso-tirar-escola-do-cargo');
    const naoGravou = JSON.stringify(await ativos(pA.id)) === JSON.stringify([aurora.id, bv.id].sort());
    await c.getByRole('button', { name: 'Voltar' }).click();
    const voltouSemGravar = (await aviso.count()) === 0 && JSON.stringify(await ativos(pA.id)) === JSON.stringify([aurora.id, bv.id].sort());
    await c.getByRole('button', { name: 'Salvar cargo' }).click();
    await c.getByRole('button', { name: 'Salvar e tirar da escola' }).click();
    await c.getByText('Cargo alterado.', { exact: false }).waitFor({ timeout: 10000 });
    const depois = await ativos(pA.id);
    const ptd = await prisma.professorTurmaDisciplina.findFirst({ where: { professorId: pA.id, turmaId: t.id } });
    r('2', 'Tirar escola do cargo: aviso ANTES (escola + turma); Voltar não grava; "Salvar e tirar da escola" encerra vínculo e turma lá',
      'aviso com Boa Vista e ZZCASC 9º 9; banco intacto até confirmar; depois só Aurora e turma encerrada',
      `aviso: ${texto}; não gravou: ${naoGravou}; voltar: ${voltouSemGravar}; depois: ${JSON.stringify(depois)}; turma: ${ptd?.status}`,
      texto.includes(BV) && texto.includes('ZZCASC 9º 9') && naoGravou && voltouSemGravar && JSON.stringify(depois) === JSON.stringify([aurora.id]) && ptd?.status === 'ENCERRADO',
      '66-aviso-tirar-escola-do-cargo.png');
    await c.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  }

  // 3. Encerrar o único cargo: aviso lista a escola; botão "Encerrar e tirar da escola".
  {
    await ir(S.page, '/pessoas');
    await S.page.locator('tr', { hasText: pE.email }).getByRole('button', { name: 'Cargos e escolas' }).click();
    const c = modal(S.page);
    await c.getByRole('button', { name: 'Encerrar cargo' }).first().click();
    const botao = c.getByRole('button', { name: 'Encerrar e tirar da escola' });
    await botao.waitFor({ timeout: 10000 });
    const texto = (await c.locator('[role=alert]').filter({ hasText: 'também sai de' }).innerText()).replace(/\s+/g, ' ');
    await foto(S.page, '66-aviso-encerrar-cargo');
    const antesConfirmar = await ativos(pE.id);
    await botao.click();
    await c.getByText('Cargo encerrado.', { exact: false }).waitFor({ timeout: 10000 });
    const depois = await ativos(pE.id);
    r('3', 'Encerrar cargo: aviso ANTES com a escola que sai; confirmado, o professor sai da escola',
      'aviso com Aurora; vínculo ativo até confirmar; depois nenhum',
      `aviso: ${texto}; antes: ${JSON.stringify(antesConfirmar)}; depois: ${JSON.stringify(depois)}`,
      texto.includes(AUR) && JSON.stringify(antesConfirmar) === JSON.stringify([aurora.id]) && depois.length === 0, '66-aviso-encerrar-cargo.png');
  }

  // 4. Celular 390 px: aviso sem rolagem lateral.
  {
    const M = await abrir({ viewport: { width: 390, height: 800 } });
    await login(M.page, 'secretaria@escola.gov.br', '12345678');
    const pM = await professor('celular', [aurora, bv]);
    await ir(M.page, '/pessoas');
    await M.page.locator('tr', { hasText: pM.email }).getByRole('button', { name: 'Cargos e escolas' }).click();
    const c = modal(M.page);
    await c.getByRole('button', { name: 'Alterar' }).click();
    await c.getByRole('button', { name: 'Remover esta escola do cargo' }).first().click();
    await c.getByRole('button', { name: 'Salvar cargo' }).click();
    await c.locator('[role=alert]').filter({ hasText: 'também sai de' }).waitFor({ timeout: 10000 });
    const rolagem = await M.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await foto(M.page, '66-aviso-celular');
    r('4', 'Celular 390 px: aviso de saída cabe na tela', 'sem rolagem lateral', `rolagem lateral: ${rolagem}px; erros: ${M.erros.length}`, rolagem <= 0 && M.erros.length === 0, '66-aviso-celular.png');
    await M.browser.close();
    void pM;
  }

  // 5. Diretora: sem "+ Cadastrar professor" e sem "Escolas" para professor.
  {
    const D = await abrir();
    await login(D.page, 'diretora.aur@homolog.nexo', 'Nexo!Homolog-2026');
    await ir(D.page, '/pessoas');
    const cadastrar = await D.page.getByRole('button', { name: '+ Cadastrar professor' }).count();
    const escolas = await D.page.locator('tbody').getByRole('button', { name: 'Escolas', exact: true }).count();
    const texto = (await D.page.locator('main').innerText()).includes('peça à Secretaria');
    await foto(D.page, '66-diretora-professores');
    r('5', 'Diretora: não cadastra professor nem vincula escola de professor; texto orienta pedir à Secretaria', 'sem os botões; texto presente',
      `cadastrar: ${cadastrar}; escolas: ${escolas}; texto: ${texto}; erros: ${D.erros.length}`, cadastrar === 0 && escolas === 0 && texto && D.erros.length === 0, '66-diretora-professores.png');
    await D.browser.close();
  }

  r('6', 'Sem erros no console/5xx (Secretaria)', 'nenhum', JSON.stringify(S.erros).slice(0, 200), S.erros.length === 0);
  await S.browser.close();
} finally {
  await limpar();
  await prisma.$disconnect();
}
