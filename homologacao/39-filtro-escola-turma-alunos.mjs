// DEF-10 — PDI > Alunos: filtro por ESCOLA e turma (nomes de turma se repetem entre escolas). Banco LOCAL.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`DEF10-${id}`, 'PDI Alunos (DEF-10)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const X = await abrir();
await login(X.page, 'secretaria@escola.gov.br', '12345678');
await X.page.goto(BASE + '/#/pdi/alunos'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
const filtros = X.page.locator('main select');
const selEscola = filtros.nth(0); // ordem na tela: Escola, Turma, Ativos e arquivados
const selTurma = filtros.nth(1);
const statusSel = filtros.nth(2);
await statusSel.selectOption('todos'); await X.page.waitForTimeout(500);
// Soma TODAS as páginas da tabela (a lista é paginada) e ignora a linha de "lista vazia".
const nomesTabela = async () => {
  const todas = [];
  const anterior = X.page.getByRole('button', { name: 'Anterior' });
  while (await anterior.count() && !(await anterior.isDisabled())) { await anterior.click(); await X.page.waitForTimeout(200); }
  for (;;) {
    todas.push(...(await X.page.locator('main table tbody tr').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')).filter(t => !/Nenhum/i.test(t)));
    const prox = X.page.getByRole('button', { name: 'Próxima' });
    if (!(await prox.count()) || await prox.isDisabled()) break;
    await prox.click(); await X.page.waitForTimeout(300);
  }
  return todas;
};

// 1. Com "Todas", as turmas aparecem agrupadas por escola e identificadas (sem "6M1 6M1" ambíguo)
const opcoes = await selTurma.locator('option').allInnerTexts();
const grupos = await selTurma.locator('optgroup').evaluateAll(gs => gs.map(g => g.label));
await foto(X.page, '39-filtros');
r('1', 'Turma com "Todas as escolas": opções agrupadas por escola e com o nome da escola', 'optgroups por escola; "6M1 — Aurora" e "6M1 — Boa Vista" distintos', `grupos: ${grupos.join(' | ')}; opções 6M1: ${opcoes.filter(o => o.startsWith('6M1')).join(' | ')}`, grupos.length >= 2 && opcoes.filter(o => o.startsWith('6M1')).length >= 2 && opcoes.filter(o => o.startsWith('6M1')).every(o => o.includes('—')), '39-filtros.png');

// 2. Filtrar pela escola Boa Vista: só alunos dela; turmas só dela
const bv = await prisma.escola.findFirst({ where: { nome: { contains: 'Boa Vista' } } });
await selEscola.selectOption(String(bv.id)); await X.page.waitForTimeout(800);
const linhasBV = await nomesTabela();
const esperadosBV = await prisma.alunoPdi.count({ where: { turma: { escolaId: bv.id } } });
const turmasBV = await selTurma.locator('option').allInnerTexts();
const turmasBVBanco = await prisma.turma.count({ where: { escolaId: bv.id, status: 'ATIVA' } });
r('2', 'Filtro Escola = Boa Vista: tabela só com alunos da Boa Vista (conferido no banco) e turmas só da Boa Vista', `${esperadosBV} alunos; ${turmasBVBanco} turmas + "Todas"`, `${linhasBV.length} linhas (todas Boa Vista: ${linhasBV.every(l => l.includes('Boa Vista'))}); opções de turma: ${turmasBV.length - 1}`, linhasBV.length === esperadosBV && linhasBV.every(l => l.includes('Boa Vista')) && turmasBV.length - 1 === turmasBVBanco);

// 3. Escola + turma: Boa Vista 6M1 ≠ Aurora 6M1
const t6bv = await prisma.turma.findFirst({ where: { escolaId: bv.id, nome: '6M1' } });
await selTurma.selectOption(String(t6bv.id)); await X.page.waitForTimeout(800);
const linhas6bv = await nomesTabela();
const esp6bv = await prisma.alunoPdi.count({ where: { turmaId: t6bv.id } });
const aur = await prisma.escola.findFirst({ where: { nome: { contains: 'Aurora' } } });
const t6au = await prisma.turma.findFirst({ where: { escolaId: aur.id, nome: '6M1' } });
await selEscola.selectOption(String(aur.id)); await X.page.waitForTimeout(500);
await selTurma.selectOption(String(t6au.id)); await X.page.waitForTimeout(800);
const linhas6au = await nomesTabela();
const esp6au = await prisma.alunoPdi.count({ where: { turmaId: t6au.id } });
await foto(X.page, '39-aurora-6m1');
r('3', 'Turma 6M1 da Boa Vista e 6M1 da Aurora são filtros diferentes, cada um com os alunos certos (banco)', `BV 6M1: ${esp6bv}; Aurora 6M1: ${esp6au}`, `BV 6M1: ${linhas6bv.length} (todas BV: ${linhas6bv.every(l => l.includes('Boa Vista'))}); Aurora 6M1: ${linhas6au.length} (todas Aurora: ${linhas6au.every(l => l.includes('Aurora'))})`, linhas6bv.length === esp6bv && linhas6au.length === esp6au && linhas6bv.every(l => l.includes('Boa Vista')) && linhas6au.every(l => l.includes('Aurora')), '39-aurora-6m1.png');

// 4. Trocar a escola limpa a turma escolhida (nunca fica turma de outra escola selecionada)
await selEscola.selectOption(String(bv.id)); await X.page.waitForTimeout(500);
const turmaDepois = await selTurma.inputValue();
r('4', 'Trocar a escola volta a turma para "Todas"', 'turma = todos', turmaDepois, turmaDepois === 'todos');
console.log('erros:', X.erros.filter(e => !/40[134]/.test(e)));
await X.browser.close(); await prisma.$disconnect();
