// Escola nova pela janela "Escolas" → "Em qual cargo essa escola entra?" (decisão do usuário, 12/11/2026).
// Secretaria: opções conforme os cargos ativos (nunca Cargo 3, sem "Agora não"); o editor de cargo abre com a
// escola preenchida e nada é salvo sem confirmar. Diretora: não cria cargo; fica "Escola fora dos cargos".
// Navegador real, banco LOCAL. Limpa o que cria.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, ev = '') => registrar(`ESC-${id}`, 'Escola nova entra no cargo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', ev);
const P = 'zzesc';
const AUR = 'ZZ-HOMOLOG Escola Aurora';
const BV = 'ZZ-HOMOLOG Escola Boa Vista';
const ir = async (page, rota) => { await page.goto(BASE + '/#' + rota); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800); };
const modal = (page) => page.locator('div.fixed.inset-0').last();
const escolher = async (sel, texto) => { const v = await sel.evaluate((s, t) => [...s.options].find(o => o.text.trim() === t)?.value, texto); await sel.selectOption(v); };

const aurora = await prisma.escola.findFirstOrThrow({ where: { nome: AUR } });
const bv = await prisma.escola.findFirstOrThrow({ where: { nome: BV } });
const ing = await prisma.disciplina.findUniqueOrThrow({ where: { nome: 'Inglês' } });
const antes = new Date('2026-11-01T12:00:00Z');

async function limpar() {
  const pessoas = (await prisma.pessoa.findMany({ where: { email: { startsWith: P } }, select: { id: true } })).map(p => p.id);
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: pessoas } }, select: { id: true } })).map(c => c.id);
  await prisma.cargoVersao.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoProfessor.deleteMany({ where: { id: { in: cargos } } });
  await prisma.vinculoEscolar.deleteMany({ where: { pessoaId: { in: pessoas } } });
  await prisma.pessoaEvento.deleteMany({ where: { pessoaId: { in: pessoas } } });
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
}
// Professor com vínculo em Aurora e N cargos, todos só "Aurora — Inglês".
async function professor(sufixo, nCargos) {
  const p = await prisma.pessoa.create({ data: { nome: `Aaa ZZESC Professor ${sufixo}`, email: `${P}-${sufixo}@teste.invalid`, perfil: 'PROFESSOR' } });
  await prisma.vinculoEscolar.create({ data: { pessoaId: p.id, escolaId: aurora.id, dataInicio: antes } });
  for (let i = 0; i < nCargos; i++) {
    await prisma.cargoProfessor.create({ data: { professorId: p.id, dataInicio: new Date(antes.getTime() + i * 1000), createdAt: antes, versoes: { create: { criadaEm: antes, composicao: [{ escolaId: aurora.id, disciplinaIds: [ing.id], atuacaoIds: [] }] } } } });
  }
  return p;
}
const composicoes = async (pessoaId) => (await prisma.cargoProfessor.findMany({ where: { professorId: pessoaId, status: 'ATIVO' }, orderBy: { id: 'asc' }, include: { versoes: { orderBy: { criadaEm: 'desc' }, take: 1 } } })).map(c => c.versoes[0].composicao);
// Abre "Escolas" do professor, vincula Boa Vista e devolve os botões da pergunta.
async function vincularBoaVista(page, p) {
  await ir(page, '/pessoas');
  await page.locator('tr', { hasText: p.email }).getByRole('button', { name: 'Escolas', exact: true }).click();
  const m = modal(page);
  await escolher(m.locator('form select'), BV);
  await m.getByRole('button', { name: 'Vincular' }).click();
  await m.getByText('Em qual cargo essa escola entra?').waitFor({ timeout: 10000 });
  const botoes = (await m.locator('[role=alert] button').allInnerTexts()).map(t => t.trim());
  return { m, botoes, aviso: (await m.locator('[role=alert]').innerText()).replace(/\s+/g, ' ') };
}

await limpar();
try {
  const p0 = await professor('zero', 0);
  const p1 = await professor('um', 1);
  const p2 = await professor('dois', 2);
  const S = await abrir();
  await login(S.page, 'secretaria@escola.gov.br', '12345678');

  // ===== 1 cargo: Incluir no Cargo 1 | Criar Cargo 2 → incluir, completar e salvar =====
  {
    const { botoes, aviso } = await vincularBoaVista(S.page, p1);
    await foto(S.page, '65-pergunta-um-cargo');
    await S.page.locator('[role=alert]').getByRole('button', { name: 'Incluir no Cargo 1' }).click();
    const c = modal(S.page);
    await c.getByLabel('Escola 2').waitFor({ timeout: 10000 });
    const escola2 = await c.getByLabel('Escola 2').evaluate(s => s.options[s.selectedIndex]?.text.trim());
    const antesDeSalvar = await composicoes(p1.id);
    const naoSalvou = antesDeSalvar.length === 1 && antesDeSalvar[0].length === 1 && antesDeSalvar[0][0].escolaId === aurora.id;
    const bloco2 = c.getByLabel('Escola 2').locator('xpath=ancestor::div[.//*[@aria-label="Disciplina 1"]][1]');
    await escolher(bloco2.getByLabel('Disciplina 1'), 'Inglês');
    await foto(S.page, '65-editor-cargo-1-com-boa-vista');
    await c.getByRole('button', { name: 'Salvar cargo' }).click();
    await c.getByText('Cargo alterado.', { exact: false }).waitFor({ timeout: 10000 });
    await c.getByRole('button', { name: 'Fechar', exact: true }).last().click();
    const depois = await composicoes(p1.id);
    const ok = depois.length === 1 && depois[0].length === 2 && depois[0].some(x => x.escolaId === bv.id && x.disciplinaIds[0] === ing.id);
    r('1', '1 cargo: pergunta "Escola … adicionada. Em qual cargo essa escola entra?" com Incluir no Cargo 1 e Criar Cargo 2 (sem "Agora não"); Incluir abre o editor com Boa Vista preenchida, sem salvar sozinho; Secretaria completa a disciplina e salva',
      'botões [Incluir no Cargo 1, Criar Cargo 2]; editor com Boa Vista; banco só muda ao salvar',
      `aviso: ${aviso}; botões: ${JSON.stringify(botoes)}; Escola 2: ${escola2}; não salvou antes: ${naoSalvou}; depois: ${JSON.stringify(depois)}`,
      JSON.stringify(botoes) === JSON.stringify(['Incluir no Cargo 1', 'Criar Cargo 2']) && aviso.includes(`${BV} adicionada.`) && escola2 === BV && naoSalvou && ok, '65-editor-cargo-1-com-boa-vista.png');
  }

  // ===== Sem cargo: só Criar Cargo 1 → editor do cargo novo com a escola =====
  {
    const { botoes } = await vincularBoaVista(S.page, p0);
    await S.page.locator('[role=alert]').getByRole('button', { name: 'Criar Cargo 1' }).click();
    const c = modal(S.page);
    await c.getByLabel('Escola 1').waitFor({ timeout: 10000 });
    const escola1 = await c.getByLabel('Escola 1').evaluate(s => s.options[s.selectedIndex]?.text.trim());
    await escolher(c.getByLabel('Disciplina 1'), 'Inglês');
    await c.getByRole('button', { name: 'Cadastrar cargo' }).click();
    await c.getByText('Cargo cadastrado.').waitFor({ timeout: 10000 });
    await c.getByRole('button', { name: 'Fechar', exact: true }).last().click();
    const depois = await composicoes(p0.id);
    r('2', 'Sem cargo ativo: só "Criar Cargo 1"; o editor abre com a escola nova e cadastra o cargo ao confirmar', 'botões [Criar Cargo 1]; Escola 1 = Boa Vista; 1 cargo com Boa Vista',
      `botões: ${JSON.stringify(botoes)}; Escola 1: ${escola1}; depois: ${JSON.stringify(depois)}`,
      JSON.stringify(botoes) === JSON.stringify(['Criar Cargo 1']) && escola1 === BV && depois.length === 1 && depois[0][0].escolaId === bv.id);
  }

  // ===== 2 cargos: Incluir no Cargo 1 | Incluir no Cargo 2 (nunca Cargo 3); cancelar → alerta na lista =====
  {
    const { botoes } = await vincularBoaVista(S.page, p2);
    await foto(S.page, '65-pergunta-dois-cargos');
    await S.page.locator('[role=alert]').getByRole('button', { name: 'Incluir no Cargo 2' }).click();
    const c = modal(S.page);
    await c.getByLabel('Escola 2').waitFor({ timeout: 10000 });
    const escola2 = await c.getByLabel('Escola 2').evaluate(s => s.options[s.selectedIndex]?.text.trim());
    await c.getByRole('button', { name: 'Cancelar' }).click();
    await c.getByRole('button', { name: 'Fechar', exact: true }).last().click();
    await S.page.waitForTimeout(1500);
    const linha = (await S.page.locator('tr', { hasText: p2.email }).innerText()).replace(/\s+/g, ' ');
    await foto(S.page, '65-lista-escola-fora-dos-cargos');
    const intactos = (await composicoes(p2.id)).every(x => x.length === 1 && x[0].escolaId === aurora.id);
    r('3', '2 cargos: só "Incluir no Cargo 1" e "Incluir no Cargo 2" (nunca Cargo 3); editor do Cargo 2 com a escola; Cancelar não salva e a lista mostra "Escola fora dos cargos" com o nome',
      'botões [Incluir no Cargo 1, Incluir no Cargo 2]; cargos intactos; alerta com Boa Vista',
      `botões: ${JSON.stringify(botoes)}; Escola 2: ${escola2}; intactos: ${intactos}; linha: ${linha.slice(0, 160)}`,
      JSON.stringify(botoes) === JSON.stringify(['Incluir no Cargo 1', 'Incluir no Cargo 2']) && escola2 === BV && intactos && linha.includes('Escola fora dos cargos') && linha.includes(BV), '65-lista-escola-fora-dos-cargos.png');
  }
  await S.browser.close();

  // ===== Diretora: vincula professor à escola dela pelo cadastro → nenhum cargo criado; pendência visível =====
  {
    const pd = await prisma.pessoa.create({ data: { nome: 'Aaa ZZESC Professor Diretora', email: `${P}-dir@teste.invalid`, perfil: 'PROFESSOR' } });
    await prisma.vinculoEscolar.create({ data: { pessoaId: pd.id, escolaId: bv.id, dataInicio: antes } });
    await prisma.cargoProfessor.create({ data: { professorId: pd.id, dataInicio: antes, createdAt: antes, versoes: { create: { criadaEm: antes, composicao: [{ escolaId: bv.id, disciplinaIds: [ing.id], atuacaoIds: [] }] } } } });
    const token = async (email, senha) => (await (await fetch('http://localhost:3340/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
    const api = async (tk, m2, p, b) => { const res = await fetch('http://localhost:3340/api' + p, { method: m2, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: b ? JSON.stringify(b) : undefined }); return { status: res.status, json: await res.json().catch(() => null) }; };
    const tDir = await token('diretora.aur@homolog.nexo', 'Nexo!Homolog-2026');
    const vinc = await api(tDir, 'POST', '/pessoas/professores', { email: pd.email, escolaIds: [aurora.id] });
    const cargosDepois = await composicoes(pd.id);
    const tSec = await token('secretaria@escola.gov.br', '12345678');
    const naSec = (await api(tSec, 'GET', '/pessoas/professores')).json.find(x => x.id === pd.id);
    const naDir = (await api(tDir, 'GET', '/pessoas/professores')).json.find(x => x.id === pd.id);
    const D = await abrir();
    await login(D.page, 'diretora.aur@homolog.nexo', 'Nexo!Homolog-2026');
    await ir(D.page, '/pessoas');
    const linhaDir = (await D.page.locator('tr', { hasText: pd.email }).innerText().catch(() => '')).replace(/\s+/g, ' ');
    await foto(D.page, '65-diretora-escola-fora-dos-cargos');
    await D.browser.close();
    r('4', 'Diretora vincula o professor à escola dela: nenhum cargo é criado nem alterado; Secretaria e Diretora veem "Escola fora dos cargos" (Aurora)',
      'vínculo ok; cargo intacto; escolasForaDosCargos = [Aurora] nas duas visões; alerta na tela da Diretora',
      `vínculo: ${vinc.status}; cargos: ${JSON.stringify(cargosDepois)}; sec: ${JSON.stringify(naSec?.escolasForaDosCargos)}; dir: ${JSON.stringify(naDir?.escolasForaDosCargos)}; tela: ${linhaDir.slice(0, 120)}`,
      vinc.status < 300 && cargosDepois.length === 1 && cargosDepois[0].length === 1 && cargosDepois[0][0].escolaId === bv.id
        && JSON.stringify(naSec?.escolasForaDosCargos?.map(e => e.id)) === JSON.stringify([aurora.id])
        && JSON.stringify(naDir?.escolasForaDosCargos?.map(e => e.id)) === JSON.stringify([aurora.id])
        && linhaDir.includes('Escola fora dos cargos'), '65-diretora-escola-fora-dos-cargos.png');
  }

  // ===== Sem regressão: professor da fixture (cargos completos) não tem alerta =====
  {
    const tSec = (await (await fetch('http://localhost:3340/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'secretaria@escola.gov.br', senha: '12345678' }) })).json()).token;
    const lista = await (await fetch('http://localhost:3340/api/pessoas/professores', { headers: { authorization: 'Bearer ' + tSec } })).json();
    const p05 = lista.find(x => x.email === 'p05@homolog.nexo');
    r('5', 'Professor com todas as escolas nos cargos (p05: 1 cargo, Aurora + Boa Vista) não ganha alerta', 'escolasForaDosCargos = []', JSON.stringify(p05?.escolasForaDosCargos), Array.isArray(p05?.escolasForaDosCargos) && p05.escolasForaDosCargos.length === 0);
  }
} finally {
  await limpar();
  await prisma.$disconnect();
}
