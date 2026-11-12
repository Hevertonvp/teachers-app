// Formulário 1/3 POR CARGO com o professor P04 (2 cargos diferentes), em navegador real. Banco LOCAL.
// Reescrito em 12/11/2026 (antes: cartões por ano/série + disciplina). Usa os cargos de teste de cargos-homolog.mjs.
import { abrir, login, foto, sair, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';

await prepararCargosHomolog();
const [c1, c2] = await cargosDe('p04');
const { browser, page, erros } = await abrir();

await login(page, 'p04@homolog.nexo', SENHA('p04'));
await page.goto(BASE + '/#/formulario-um-terco'); await page.waitForLoadState('networkidle');
await page.locator('h2.text-xl').first().waitFor({ timeout: 15000 });
const cards = await page.locator('h2.text-xl').evaluateAll(hs => hs.map(h => { const c = h.closest('div.flex-col') || h.parentElement; return { rotulo: h.innerText.trim(), texto: c.innerText.replace(/\s+/g, ' ') }; }));
await foto(page, '04-p04-lista-1-3');
const doCiclo1 = cards.filter(c => c.texto.includes('Nov/2026 (homolog)'));
registrar('UT-P04-01', 'Formulário 1/3', 'P04 (2 cargos diferentes) vê exatamente 2 formulários no ciclo, um por cargo', '2 cartões: Cargo 1 e Cargo 2', doCiclo1.map(c => c.rotulo).join(' + '), doCiclo1.length === 2 && doCiclo1.some(c => c.rotulo === 'Cargo 1') && doCiclo1.some(c => c.rotulo === 'Cargo 2') ? 'APROVADO' : 'REPROVADO', '04-p04-lista-1-3.png');
const card1 = doCiclo1.find(c => c.rotulo === 'Cargo 1')?.texto ?? '';
const card2 = doCiclo1.find(c => c.rotulo === 'Cargo 2')?.texto ?? '';
registrar('UT-P04-02', 'Formulário 1/3', 'Cartões mostram escola → disciplinas do cargo, sem turmas nem ano/série', 'Cargo 1: Aurora — Arte, Ensino Religioso, Inglês; Cargo 2: Boa Vista — Inglês', `${card1.slice(0, 120)} | ${card2.slice(0, 100)}`, /Aurora — Arte, Ensino Religioso, Inglês/.test(card1) && /Boa Vista — Inglês/.test(card2) && !/\dM\d|º ano|Válido para/.test(card1 + card2) ? 'APROVADO' : 'REPROVADO');

// ---- Preenchimento do Cargo 1 (um texto por semana para as três disciplinas) ----
await abrirCartao(page, /^Cargo 1$/);
await foto(page, '04-p04-preenchimento-abertura');
const textos = [
  'Inglês: Simple Present e rotina. Arte: cores primárias. Ensino Religioso: valores e convivência.',
  'Inglês: partes da casa e preposições. Arte: aquarela. Ensino Religioso: festas populares.',
  'Inglês: do/does e negativas. Arte: colagem. Ensino Religioso: respeito às diferenças.',
  'Produção de um cartão "About me" com acentuação: ação, coração, não — "aspas" & (50% / R$ 10,00).\nSegunda linha com quebra de linha.',
];
const ta = page.locator('#conteudos-semana');
for (let i = 0; i < 4; i++) {
  await ta.click(); await ta.pressSequentially(textos[i].slice(0, 40), { delay: 15 }); await ta.fill(textos[i]);
  if (i === 1) { await page.getByRole('button', { name: 'Salvar progresso' }).click(); await page.waitForTimeout(900); await foto(page, '04-p04-salvo-parcial-semana2'); }
  if (i < 3) { await page.getByRole('button', { name: 'Próximo' }).click(); await page.waitForTimeout(900); }
}
await page.getByRole('button', { name: 'Salvar progresso' }).click().catch(() => {});
await page.waitForTimeout(1500);
const ent = await folhaDoCargo(c1);
const todosTextos = ent ? textos.every(t => ent.respostas.some(x => x.texto === t)) : false;
registrar('UT-P04-03', 'Formulário 1/3', 'Respostas das 4 semanas persistem no banco (folha do Cargo 1)', '4 respostas idênticas', `${ent?.respostas.length ?? 0} respostas; textos iguais: ${todosTextos}`, ent && ent.respostas.length === 4 && todosTextos ? 'APROVADO' : 'REPROVADO', '04-p04-salvo-parcial-semana2.png');
const folhasP04 = await prisma.entregaUmTerco.findMany({ where: { cicloId: 1, professor: { email: 'p04@homolog.nexo' }, chaveCargos: { not: null } }, include: { cargos: true } });
registrar('UT-P04-04', 'Formulário 1/3', 'Uma folha só para o Cargo 1 (sem bloco por disciplina) e nenhuma para o Cargo 2 ainda', '1 entrega ligada só ao Cargo 1, com a foto Aurora', `${folhasP04.length} entrega(s); cargos: ${folhasP04.map(e => e.cargos.map(c => c.cargoId).join('+')).join(' / ')}; foto: ${JSON.stringify(folhasP04[0]?.composicao)?.slice(0, 90)}`, folhasP04.length === 1 && folhasP04[0].chaveCargos === String(c1) && JSON.stringify(folhasP04[0].composicao).includes('Aurora') && !folhasP04.some(e => e.cargos.some(c => c.cargoId === c2)) ? 'APROVADO' : 'REPROVADO');

// ---- Persistência após logout/login e reabertura ----
await sair(page);
await login(page, 'p04@homolog.nexo', SENHA('p04'));
await abrirCartao(page, /^Cargo 1$/);
const t0 = await page.locator('#conteudos-semana').inputValue();
registrar('UT-P04-05', 'Formulário 1/3', 'Após logout/login a semana 1 reaparece igual', textos[0].slice(0, 50), t0.slice(0, 50), t0 === textos[0] ? 'APROVADO' : 'REPROVADO');
await foto(page, '04-p04-reaberto-apos-login');

// ---- Concluir: clique duplo ----
for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Próximo' }).click();
await page.getByRole('button', { name: /Concluir/ }).dblclick(); await page.waitForTimeout(2000);
await foto(page, '04-p04-concluido');
const eventos = await prisma.historicoEntregaUmTerco.groupBy({ by: ['tipo'], where: { entregaId: ent.id }, _count: true });
const apos = await prisma.entregaUmTerco.findUnique({ where: { id: ent.id } });
const nConcl = eventos.find(e => e.tipo === 'CONCLUIDA')?._count ?? 0;
registrar('UT-P04-06', 'Formulário 1/3', 'Duplo clique em Concluir gera 1 só evento CONCLUIDA e status concluída', '1 CONCLUIDA + status CONCLUIDA', `${nConcl} CONCLUIDA; status ${apos.status}`, nConcl === 1 && apos.status === 'CONCLUIDA' ? 'APROVADO' : 'REPROVADO', '04-p04-concluido.png');
registrar('UT-P04-07', 'Formulário 1/3', 'Sem erros no console', '0', erros.join(' | ') || '0', erros.length === 0 ? 'APROVADO' : 'REPROVADO');
await browser.close(); await prisma.$disconnect();
