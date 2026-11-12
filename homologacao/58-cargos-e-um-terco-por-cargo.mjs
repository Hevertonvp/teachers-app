// Cargos do Professor (cadastro, alteração, encerramento) e Formulário 1/3 POR CARGO, no navegador real.
// Banco LOCAL. Cria dados com prefixo ZZCARGO-UI e apaga tudo no fim.
import { abrir, login, BASE, foto } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`CARGO-${id}`, 'Cargos e 1/3 por cargo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');

const P = 'ZZCARGO-UI';
const H = 3600000;
const modal = (page) => page.locator('div.fixed.inset-0').last();
const ir = async (page, rota) => { await page.goto(BASE + '/#' + rota); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600); };
const opcoes = (sel) => sel.evaluate(s => [...s.options].map(o => o.text.trim()));
const larguraOk = async (page) => (await page.evaluate(() => document.documentElement.scrollWidth)) <= (page.viewportSize().width + 1);

async function limpar() {
  const pessoas = (await prisma.pessoa.findMany({ where: { email: { startsWith: P.toLowerCase() } }, select: { id: true } })).map(p => p.id);
  const p04 = await prisma.pessoa.findUnique({ where: { email: 'p04@homolog.nexo' } });
  const ids = [...pessoas, ...(p04 ? [p04.id] : [])];
  const escolas = (await prisma.escola.findMany({ where: { nome: { startsWith: P } }, select: { id: true } })).map(e => e.id);
  const ciclos = (await prisma.cicloUmTerco.findMany({ where: { titulo: { startsWith: P } }, select: { id: true } })).map(c => c.id);
  await prisma.entregaUmTerco.deleteMany({ where: { cicloId: { in: ciclos } } });
  await prisma.cicloUmTerco.deleteMany({ where: { id: { in: ciclos } } });
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: ids } }, select: { id: true } })).map(c => c.id);
  await prisma.entregaUmTercoCargo.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoVersao.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoProfessor.deleteMany({ where: { id: { in: cargos } } });
  await prisma.vinculoEscolar.deleteMany({ where: { OR: [{ pessoaId: { in: pessoas } }, { escolaId: { in: escolas } }] } });
  await prisma.pessoaEvento.deleteMany({ where: { pessoaId: { in: pessoas } } });
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
}

await limpar();
process.on('uncaughtException', async (e) => { console.error(e); await limpar().catch(() => {}); process.exit(1); });
const prud = await prisma.escola.create({ data: { nome: `${P} Prudenciana` } });
const tres = await prisma.escola.create({ data: { nome: `${P} Tres Marias` } });
const [ing, geo] = await Promise.all(['Inglês', 'Geografia'].map(nome => prisma.disciplina.findFirst({ where: { nome } })));
if (!ing || !geo) throw new Error('Disciplinas Inglês/Geografia não existem no banco local.');

const escolher = async (sel, texto) => { const v = await sel.evaluate((s, t) => [...s.options].find(o => o.text.trim() === t)?.value, texto); await sel.selectOption(v); };

const X = await abrir();
try {
  const { page, erros } = X;
  await login(page, 'secretaria@escola.gov.br', '12345678');
  await ir(page, '/pessoas');
  await page.getByRole('button', { name: '+ Cadastrar professor' }).click();
  const m = modal(page);
  const cargo1Aberto = await m.getByRole('heading', { name: 'Cargo 1' }).isVisible();
  const semEscolasDeVinculo = (await m.getByText('Escolas de vínculo', { exact: true }).count()) === 0;
  r('1', 'Cadastro: Cargo 1 já aberto, "Número de cargos" e sem lista solta de escolas', 'Cargo 1 visível; sem "Escolas de vínculo"', `${cargo1Aberto}; ${semEscolasDeVinculo}`, cargo1Aberto && semEscolasDeVinculo);

  // Validação perto do campo: escola vazia.
  await m.locator('input[type=email]').fill(`${P.toLowerCase()}-1@teste.invalid`);
  await m.getByRole('button', { name: 'Próximo →' }).click();
  const erroEscola = await m.getByText('Escolha a escola.').first().isVisible().catch(() => false);
  r('2', 'Validação próxima do campo (escola não escolhida)', '"Escolha a escola." no bloco', erroEscola, erroEscola);

  await m.locator('input:not([type=email]):not([type=date])').first().fill(`${P} Professora Ana`);
  const escola1 = m.getByLabel('Escola 1').first();
  await escolher(escola1, prud.nome);
  await escolher(m.getByLabel('Disciplina 1').first(), ing.nome);
  await m.getByRole('button', { name: '+ Adicionar disciplina' }).first().click();
  const opDisc2 = await opcoes(m.getByLabel('Disciplina 2').first());
  await escolher(m.getByLabel('Disciplina 2').first(), geo.nome);
  r('3', 'Disciplina repetida não aparece de novo na mesma escola', 'Inglês fora da 2ª lista', opDisc2.includes(ing.nome) ? 'Inglês aparece' : 'ok', !opDisc2.includes(ing.nome));
  await m.getByRole('button', { name: '+ Adicionar escola' }).first().click();
  const opEscola2 = await opcoes(m.getByLabel('Escola 2').first());
  await escolher(m.getByLabel('Escola 2').first(), tres.nome);
  r('4', 'Escola repetida não aparece de novo no mesmo cargo', 'Prudenciana fora da 2ª lista', opEscola2.includes(prud.nome) ? 'aparece' : 'ok', !opEscola2.includes(prud.nome));
  // 2ª escola: Inglês (mesma disciplina em escolas diferentes).
  const discDaEscola2 = m.locator('div.rounded-lg.bg-slate-50').nth(1).getByLabel('Disciplina 1');
  await escolher(discDaEscola2, ing.nome);

  await m.getByRole('radio', { name: '2' }).click();
  const cargo2 = await m.getByRole('heading', { name: 'Cargo 2' }).isVisible();
  const bloco2 = m.locator('div.rounded-xl').filter({ has: page.getByRole('heading', { name: 'Cargo 2' }) });
  await escolher(bloco2.getByLabel('Escola 1'), prud.nome);
  await escolher(bloco2.getByLabel('Disciplina 1'), ing.nome);
  r('5', 'Escolher 2 abre o Cargo 2 com o mesmo padrão', 'Cargo 2 visível', cargo2, cargo2);
  await foto(page, '58-cadastro-dois-cargos');

  await m.getByRole('button', { name: 'Próximo →' }).click();
  await page.waitForTimeout(1500);
  const wizard = modal(page);
  await wizard.getByRole('button', { name: 'Concluir depois' }).click().catch(() => {});
  await page.waitForTimeout(500);
  await modal(page).getByRole('button', { name: 'Concluir' }).click().catch(() => {});
  await page.waitForTimeout(800);
  const ana = await prisma.pessoa.findFirst({ where: { email: `${P.toLowerCase()}-1@teste.invalid` }, include: { cargos: true, vinculosEscolares: { where: { status: 'ATIVO' } } } });
  r('6', 'Cadastro grava 2 cargos e os vínculos das duas escolas (sem duplicar)', '2 cargos; 2 vínculos', `${ana?.cargos.length} cargos; ${ana?.vinculosEscolares.length} vínculos`, ana?.cargos.length === 2 && ana?.vinculosEscolares.length === 2);

  await ir(page, '/pessoas');
  await page.reload(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
  await foto(page, '58-lista-professores');
  const linha = page.locator('tr', { hasText: /Professora Ana/i });
  for (let i = 0; i < 10 && !(await linha.count()); i++) { await page.getByRole('button', { name: 'Próxima' }).click(); await page.waitForTimeout(300); }
  const coluna = (await linha.textContent()) ?? '';
  r('7', 'Lista mostra a quantidade de cargos ativos', '"2 cargos"', coluna.includes('2 cargos') ? '2 cargos' : coluna.slice(0, 80), coluna.includes('2 cargos'));

  await linha.getByRole('button', { name: 'Cargos' }).click();
  const mc = modal(page);
  await mc.getByText('Cargo 2').first().waitFor();
  const cartao1 = mc.locator('div.rounded-xl').filter({ has: page.getByRole('heading', { name: 'Cargo 1' }) }).first();
  await cartao1.getByRole('button', { name: 'Encerrar cargo' }).click();
  const confirmacao = await mc.getByText(/Ele não é apagado/).isVisible();
  await mc.getByRole('button', { name: 'Encerrar cargo' }).last().click();
  await page.waitForTimeout(1200);
  const titulos = await mc.locator('h3').allTextContents();
  r('8', 'Encerrar pede confirmação; o cargo que sobra vira "Cargo 1"', 'confirmação; só "Cargo 1"', `${confirmacao}; ${JSON.stringify(titulos)}`, confirmacao && JSON.stringify(titulos) === JSON.stringify(['Cargo 1']));
  await mc.getByRole('button', { name: 'Ver cargos encerrados' }).click();
  await page.waitForTimeout(800);
  const encerradoVisivel = await mc.getByText('Encerrado').first().isVisible();
  const noBanco = await prisma.cargoProfessor.count({ where: { professorId: ana.id } });
  r('9', 'Encerrado some da visão normal, aparece em "Ver cargos encerrados" e continua no banco', 'visível no histórico; 2 no banco', `${encerradoVisivel}; ${noBanco}`, encerradoVisivel && noBanco === 2);
  await foto(page, '58-cargos-modal');
  await mc.getByRole('button', { name: 'Fechar' }).last().click();
  r('10', 'Sem erros no console (Secretaria)', '0', erros.join(' | ') || '0', erros.length === 0);
} finally {
  await X.browser.close();
}

// Celular: cadastro de cargo sem rolagem lateral.
const C = await abrir({ viewport: { width: 390, height: 844 } });
try {
  await login(C.page, 'secretaria@escola.gov.br', '12345678');
  await ir(C.page, '/pessoas');
  await C.page.getByRole('button', { name: '+ Cadastrar professor' }).click();
  await modal(C.page).getByRole('radio', { name: '2' }).click();
  await modal(C.page).getByRole('button', { name: '+ Adicionar escola' }).first().click();
  await foto(C.page, '58-cadastro-celular');
  r('11', 'Celular (390 px): cadastro com 2 cargos sem rolagem lateral', 'largura ≤ 390', String(await C.page.evaluate(() => document.documentElement.scrollWidth)), await larguraOk(C.page));
} finally {
  await C.browser.close();
}

// Professor: p04 com dois cargos IGUAIS cadastrados antes da abertura → uma folha compartilhada.
const p04 = await prisma.pessoa.findUnique({ where: { email: 'p04@homolog.nexo' } });
const antes = new Date(Date.now() - 3 * H);
const composicao = [{ escolaId: prud.id, disciplinaIds: [ing.id] }];
for (let i = 0; i < 2; i++) {
  await prisma.cargoProfessor.create({ data: { professorId: p04.id, dataInicio: new Date(`${antes.toISOString().slice(0, 10)}T00:00:00Z`), createdAt: antes, versoes: { create: { criadaEm: antes, composicao } } } });
}
const hoje = new Date(Date.now() - 3 * H).toISOString().slice(0, 10);
const daqui = (d) => new Date(Date.now() - 3 * H + d * 24 * H).toISOString().slice(0, 10);
const ciclo = await prisma.cicloUmTerco.create({
  data: {
    anoLetivo: 2099, trimestre: 3, titulo: `${P} Formulário 1/3`, abreEm: new Date(Date.now() - 2 * H), prazoEm: new Date(Date.now() + 10 * 24 * H), todasEscolas: false,
    escolas: { create: [{ escolaId: prud.id }] },
    semanas: { create: [{ numero: 1, dataInicio: new Date(`${hoje}T00:00:00Z`), dataFim: new Date(`${daqui(2)}T00:00:00Z`) }, { numero: 2, dataInicio: new Date(`${daqui(3)}T00:00:00Z`), dataFim: new Date(`${daqui(5)}T00:00:00Z`) }] },
  },
});

for (const [rotulo, viewport] of [['computador', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const Y = await abrir({ viewport });
  try {
    const { page, erros } = Y;
    await login(page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
    await ir(page, '/formulario-um-terco');
    const card = page.locator('div', { has: page.getByRole('heading', { name: 'Cargos 1 e 2' }) }).filter({ hasText: ciclo.titulo }).last();
    const temCard = await card.isVisible().catch(() => false);
    const textoCard = temCard ? await card.textContent() : '';
    r(`12-${rotulo}`, `Professor (${rotulo}): dois cargos iguais → um card "Cargos 1 e 2" com "Escola — disciplina", sem turmas`, 'card único com Prudenciana — Inglês', textoCard.slice(0, 160), temCard && textoCard.includes(`${prud.nome} — ${ing.nome}`) && !/Válido para|Turma/.test(textoCard));
    if (rotulo === 'computador') {
      await card.getByRole('button', { name: /Preencher|Continuar/ }).click();
      await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
      const aviso = await page.getByText('Este formulário representa os dois cargos cadastrados').isVisible();
      r('13', 'Folha compartilhada mostra o aviso dos dois cargos', 'aviso visível', aviso, aviso);
      await page.locator('textarea').first().fill('Semana 1: verbos no passado (Inglês).');
      await page.getByRole('button', { name: /Próximo/ }).click();
      await page.waitForTimeout(800);
      await page.locator('textarea').first().fill('Semana 2: revisão.');
      await page.getByRole('button', { name: /^Concluir/ }).click();
      await page.waitForTimeout(1500);
      const confirmar = page.getByRole('button', { name: /Concluir/ }).last();
      if (await confirmar.isVisible().catch(() => false)) { await confirmar.click().catch(() => {}); await page.waitForTimeout(1500); }
      const entrega = await prisma.entregaUmTerco.findFirst({ where: { cicloId: ciclo.id, professorId: p04.id }, include: { cargos: true, respostas: true } });
      r('14', 'Concluir grava UMA entrega cobrindo os 2 cargos, com a foto da composição', 'CONCLUIDA; 2 cargos; 2 respostas', `${entrega?.status}; ${entrega?.cargos.length} cargos; ${entrega?.respostas.length} respostas; ${JSON.stringify(entrega?.composicao)?.slice(0, 80)}`, entrega?.status === 'CONCLUIDA' && entrega?.cargos.length === 2 && entrega?.respostas.length === 2);
      await foto(page, '58-professor-concluido');
    } else {
      await foto(page, '58-professor-celular');
    }
    r(`15-${rotulo}`, `Professor (${rotulo}): sem rolagem lateral e sem erros no console`, 'ok', `${await larguraOk(page)}; ${erros.join(' | ') || '0 erros'}`, (await larguraOk(page)) && erros.length === 0);
  } finally {
    await Y.browser.close();
  }
}

// Painel da Secretaria: sem ano/série; linha por folha de cargo.
const Z = await abrir();
try {
  const { page, erros } = Z;
  await login(page, 'secretaria@escola.gov.br', '12345678');
  await ir(page, `/formulario-um-terco/ciclos/${ciclo.id}`);
  const semAno = (await page.getByLabel('Ano/série').count()) === 0;
  const linhaP04 = page.locator('div', { hasText: 'Cargos 1 e 2' }).filter({ hasText: `${prud.nome} — ${ing.nome}` }).last();
  const temLinha = await linhaP04.isVisible().catch(() => false);
  const esperadas = await page.getByText('Esperadas').locator('..').textContent();
  await foto(page, '58-painel');
  r('16', 'Painel: sem filtro de ano/série; folha compartilhada conta 1 vez', 'sem Ano/série; linha "Cargos 1 e 2"; Esperadas 1', `${semAno}; ${temLinha}; ${esperadas?.replace(/\s+/g, ' ')}`, semAno && temLinha && /Esperadas\s*1\b/.test(esperadas ?? ''));
  r('17', 'Sem erros no console (painel)', '0', erros.join(' | ') || '0', erros.length === 0);
} finally {
  await Z.browser.close();
  await limpar();
  await prisma.$disconnect();
}
