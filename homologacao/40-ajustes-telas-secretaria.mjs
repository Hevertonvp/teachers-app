// Ajustes de tela pedidos pelo usuário (perfil Secretaria), navegador real, banco LOCAL:
//  1 PDI: sem "Gerenciar formulário"/"Ver alunos" no topo (ficam só nos cartões);
//  2 Modal "Turmas e disciplinas": sem "Histórico"; aviso de substituição com o NOME do professor;
//  3 Modais não fecham por clique fora nem Esc (só "×"/Fechar);
//  4 Assistente de vínculos do cadastro: turma já adicionada some (para aquela disciplina); modal com rolagem
//    interna, sem crescer para fora da tela (desktop e celular).
import { abrir, login, foto, preencherCadastroProfessor, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`UI-SEC-${id}`, 'Ajustes de tela (Secretaria)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const modal = (page) => page.locator('div.fixed.inset-0.z-50');

const X = await abrir();
await login(X.page, 'secretaria@escola.gov.br', '12345678');

// ---- 1. PDI ----
await X.page.goto(BASE + '/#/pdi'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
const gerenciar = await X.page.getByRole('button', { name: 'Gerenciar formulário' }).count();
const verAlunos = await X.page.getByRole('button', { name: 'Ver alunos' }).count();
await foto(X.page, '40-pdi-home');
r('1', 'Tela PDI: "Gerenciar formulário" e "Ver alunos" aparecem uma vez só (nos cartões), não no topo', '1 de cada', `Gerenciar formulário: ${gerenciar}; Ver alunos: ${verAlunos}`, gerenciar === 1 && verAlunos === 1, '40-pdi-home.png');

// ---- 2/3. Modal Turmas e disciplinas (P04) ----
await X.page.goto(BASE + '/#/pessoas'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
const linhaP04 = X.page.locator('tr', { hasText: 'p04@homolog.nexo' }).first();
await linhaP04.getByRole('button', { name: 'Turmas', exact: true }).click(); await X.page.waitForTimeout(2000);
const m = modal(X.page);
const temHistorico = /Histórico/.test(await m.innerText());
// 15/11/2026: turmas marcadas por disciplina do cargo. P04 marca "Arte — 6M3" (Arte da 6M3 é do P10) → pergunta
// antes de substituir, com o NOME do P10; Cancelar não muda nada.
const p01 = await prisma.pessoa.findUnique({ where: { email: 'p10@homolog.nexo' } });
const aurora = await prisma.escola.findFirst({ where: { nome: { contains: 'Aurora' } } });
const t6m1 = await prisma.turma.findFirst({ where: { escolaId: aurora.id, nome: '6M3' } });
const mat = await prisma.disciplina.findFirst({ where: { nome: 'Arte' } });
await m.getByRole('button', { name: 'Arte — 6M3' }).click(); await X.page.waitForTimeout(1500);
const aviso = ((await X.page.locator('div.fixed.inset-0').last().innerText()).match(/[^\n]*já dá Arte na 6M3[^\n]*/) || [''])[0];
await foto(X.page, '40-modal-substituicao');
r('2a', 'Modal "Turmas" (antes "Turmas e disciplinas") sem a seção "Histórico"', 'sem "Histórico"', `tem Histórico: ${temHistorico}`, !temHistorico, '40-modal-substituicao.png');
r('2b', 'Marcar turma que já tem outro professor na disciplina pergunta antes, com o NOME dele (não o id)', `contém "${p01.nome}" e não "#${p01.id}"`, aviso.slice(0, 140), aviso.includes(p01.nome) && !aviso.includes(`#${p01.id}`), '40-modal-substituicao.png');
await X.page.getByRole('button', { name: 'Cancelar' }).last().click(); await X.page.waitForTimeout(500);
// 3. clique fora e Esc não fecham; × fecha
const caixa = await m.locator('> div').first().boundingBox();
await X.page.mouse.click(5, 5); await X.page.waitForTimeout(500);
const abertoAposClique = await modal(X.page).count();
await X.page.keyboard.press('Escape'); await X.page.waitForTimeout(500);
const abertoAposEsc = await modal(X.page).count();
await modal(X.page).getByRole('button', { name: 'Fechar' }).first().click(); await X.page.waitForTimeout(500);
const fechouNoX = await modal(X.page).count();
r('3', 'Modal não fecha por clique fora nem Esc; fecha pelo "×"', 'aberto, aberto, fechado', `após clique fora: ${abertoAposClique ? 'aberto' : 'FECHOU'}; após Esc: ${abertoAposEsc ? 'aberto' : 'FECHOU'}; após ×: ${fechouNoX ? 'aberto' : 'fechado'}; caixa ${JSON.stringify(caixa && { y: Math.round(caixa.y), h: Math.round(caixa.height) })}`, abertoAposClique === 1 && abertoAposEsc === 1 && fechouNoX === 0);
// nada foi vinculado (não clicamos em Vincular): P01 continua com Matemática 6M1
const aindaP01 = await prisma.professorTurmaDisciplina.findFirst({ where: { turmaId: t6m1.id, disciplinaId: mat.id, status: 'ATIVO' } });
r('3b', 'Cancelar a substituição e fechar não altera vínculos (P10 continua em Arte 6M3)', 'P10', `professor ativo: ${aindaP01?.professorId === p01.id ? 'P10' : aindaP01?.professorId}`, aindaP01?.professorId === p01.id);

// ---- 4. Assistente do cadastro (Redação: nenhuma turma tem professor dessa disciplina) ----
await limparProfessoresDeTeste(['ui-', 'assist-']); // começa sem sobras (turmas de Redação livres)
for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const Y = nome === 'desktop' ? X : await abrir({ viewport: vp });
  if (nome === 'celular') await login(Y.page, 'secretaria@escola.gov.br', '12345678');
  await Y.page.goto(BASE + '/#/pessoas'); await Y.page.waitForLoadState('networkidle'); await Y.page.waitForTimeout(1500);
  await Y.page.getByRole('button', { name: '+ Cadastrar professor' }).click(); await Y.page.waitForTimeout(800);
  const c = modal(Y.page);
  // 15/11/2026: cadastro por cargo (escola + disciplina no Cargo 1), no lugar da caixinha de escola.
  await preencherCadastroProfessor(c, { email: `ui-${nome}-${TAG}@homolog.nexo`, nome: `Professor UI ${nome} ${TAG}`, escola: 'ZZ-HOMOLOG Escola Aurora', disciplina: 'Redação' }); await Y.page.waitForTimeout(2500);
  const w = modal(Y.page);
  // 15/11/2026: a disciplina vem do cargo (Redação); só se marcam as turmas (seis, sem professor de Redação).
  await w.locator('[data-disciplina="Redação"]').waitFor({ timeout: 10000 });
  const chips = w.locator('[data-disciplina="Redação"] button[aria-pressed]');
  const adicionadas = [];
  for (let i = 0; i < 6; i++) {
    const chip = chips.nth(i);
    adicionadas.push(await chip.innerText());
    await chip.click(); await Y.page.waitForTimeout(1200);
  }
  const cartao = await w.locator('> div').first().boundingBox();
  const alturaTela = vp.height;
  await foto(Y.page, `40-wizard-${nome}`);
  r(`4c-${nome}`, `Assistente (${nome}): com vários vínculos, o modal não passa da altura da tela`, `altura ≤ ${alturaTela}`, `topo ${Math.round(cartao.y)}, altura ${Math.round(cartao.height)}, base ${Math.round(cartao.y + cartao.height)}`, cartao.y >= 0 && cartao.y + cartao.height <= alturaTela + 1, `40-wizard-${nome}.png`);
  const criados = await prisma.professorTurmaDisciplina.count({ where: { professor: { email: `ui-${nome}-${TAG}@homolog.nexo` }, status: 'ATIVO' } });
  r(`4d-${nome}`, `Assistente (${nome}): vínculos criados no banco = os adicionados (sem duplicar)`, String(adicionadas.length), String(criados), criados === adicionadas.length);
  if (nome === 'celular') await Y.browser.close();
  await limparProfessoresDeTeste(['ui-']); // a rodada seguinte marca as mesmas turmas
}
console.log('erros:', X.erros.filter(e => !/40[134]/.test(e)));
await X.browser.close();
await limparProfessoresDeTeste(['ui-']); // 15/11/2026: apaga os professores criados aqui
await prisma.$disconnect();
