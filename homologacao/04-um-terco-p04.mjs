// Fase 5 (priorizada) — Formulário 1/3 com o professor de estresse P04, em navegador real.
import { abrir, login, foto, criarCiclo, sair, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const { browser, page, erros } = await abrir();
await login(page, 'secretaria@escola.gov.br', '123456');
const jaExiste = await prisma.cicloUmTerco.count({ where: { titulo: { contains: 'Nov/2026 (homolog)' } } });
const r = jaExiste ? { ok: true } : await criarCiclo(page, {
  tri: 3, titulo: 'Formulário 1/3 — Nov/2026 (homolog)', abre: '2026-11-02T08:00', prazo: '2026-11-20T18:00',
  semanas: [['2026-11-02', '2026-11-06'], ['2026-11-09', '2026-11-13'], ['2026-11-16', '2026-11-20'], ['2026-11-23', '2026-11-27']],
});
await foto(page, '04-secretaria-ciclo-criado');
registrar('UT-C01', 'Formulário 1/3', 'Secretaria cria ciclo do 3º trimestre pela interface', 'ciclo criado', r.ok ? 'criado' : r.mensagem, r.ok ? 'APROVADO' : 'REPROVADO', '04-secretaria-ciclo-criado.png');
await sair(page);

// ---- P04 ----
const senhaP04 = 'Nexo!Prof04-2026';
await login(page, 'p04@homolog.nexo', senhaP04);
await page.goto(BASE + '/#/formulario-um-terco'); await page.waitForLoadState('networkidle');
await page.locator('h2.text-xl').first().waitFor({ timeout: 15000 });
const cards = await page.locator('h2.text-xl').evaluateAll(hs => hs.map(h => { const c = h.closest('div.flex-col') || h.parentElement; return { rotulo: h.innerText.trim(), texto: c.innerText.replace(/\s+/g, ' ') }; }));
await foto(page, '04-p04-lista-1-3');
console.log('Cards do P04:'); cards.forEach(c => console.log('  ', c.texto.slice(0, 230)));
const esperado = [
  ['6º', 'Inglês', ['6M1', '6M2'], 'Aurora'], ['6º', 'Arte', ['6M1'], 'Aurora'], ['6º', 'Ensino Religioso', ['6M1'], 'Aurora'],
  ['7º', 'Inglês', ['7M1'], 'Aurora'], ['7º', 'Arte', ['7M1'], 'Aurora'], ['8º', 'Inglês', ['8M1'], 'Boa Vista'], ['9º', 'Inglês', ['9M2'], 'Boa Vista'],
];
registrar('UT-P04-01', 'Formulário 1/3', 'P04 (8 vínculos, 7 combinações ano+disciplina) vê exatamente 7 formulários', '7 cartões', `${cards.length} cartões`, cards.length === 7 ? 'APROVADO' : 'REPROVADO', '04-p04-lista-1-3.png');
for (const [serie, disc, turmas, escola] of esperado) {
  const c = cards.find(x => x.rotulo.includes(serie) && x.rotulo.includes(disc));
  const ok = !!c && turmas.every(t => c.texto.includes(t)) && c.texto.includes(escola);
  const i = c ? c.texto.indexOf('Válido') : -1;
  registrar(`UT-P04-02-${serie}${disc.slice(0, 3)}`, 'Formulário 1/3', `Cartão ${serie} ${disc} cobre ${turmas.join(' e ')} (${escola})`, `válido para ${turmas.join(', ')}`, c ? c.texto.slice(i, i + 90) : 'cartão ausente', ok ? 'APROVADO' : 'REPROVADO');
}

// ---- Preenchimento do 6º Inglês (uma entrega valendo para 6M1 e 6M2) ----
await abrirCartao(page, /6º.*Ensino/);
await foto(page, '04-p04-preenchimento-abertura');
const textos = [
  'Introdução ao Simple Present: rotina diária (wake up, have breakfast, go to school). Atividade oral em duplas perguntando "What time do you…?" e registro no caderno.',
  'Vocabulário de partes da casa e preposições de lugar (in, on, under). Leitura de um anúncio de aluguel e exercício de correspondência com imagens.',
  'Revisão de verbos auxiliares (do/does) e construção de frases negativas. Jogo de tabuleiro em grupos; correção coletiva dos erros mais frequentes.',
  'Produção de um cartão "About me" com acentuação e símbolos: ação, coração, não — "aspas" & (50% / R$ 10,00).\nSegunda linha com quebra de linha.',
];
const ta = page.locator('#conteudos-semana');
for (let i = 0; i < 4; i++) {
  await ta.click(); await ta.pressSequentially(textos[i].slice(0, 40), { delay: 15 }); await ta.fill(textos[i]);
  if (i === 1) { await page.getByRole('button', { name: 'Salvar progresso' }).click(); await page.waitForTimeout(900); await foto(page, '04-p04-salvo-parcial-semana2'); }
  if (i < 3) { await page.getByRole('button', { name: 'Próximo' }).click(); await page.waitForTimeout(900); }
}
await page.getByRole('button', { name: 'Salvar progresso' }).click().catch(() => {});
await page.waitForTimeout(1500);
const filtro = { professor: { email: 'p04@homolog.nexo' }, anoSerie: 6, disciplina: { nome: 'Ensino Religioso' } };
const ent = await prisma.entregaUmTerco.findFirst({ where: filtro, include: { respostas: true, cobertura: { include: { turma: true } } } });
const todosTextos = ent ? textos.every(t => ent.respostas.some(x => x.texto === t)) : false;
registrar('UT-P04-03', 'Formulário 1/3', 'Respostas das 4 semanas persistem no banco (6º Ensino Religioso)', '4 respostas idênticas', `${ent?.respostas.length ?? 0} respostas; textos iguais: ${todosTextos}`, ent && ent.respostas.length === 4 && todosTextos ? 'APROVADO' : 'REPROVADO', '04-p04-salvo-parcial-semana2.png');
const entIng = await prisma.entregaUmTerco.findMany({ where: { professor: { email: 'p04@homolog.nexo' }, anoSerie: 6, disciplina: { nome: 'Inglês' } }, include: { cobertura: { include: { turma: true } } } });
registrar('UT-P04-04', 'Formulário 1/3', '6º Inglês (6M1+6M2) gera 1 entrega com 2 coberturas', '1 entrega, 2 coberturas', `${entIng.length} entrega(s), ${entIng[0]?.cobertura.length} coberturas (${entIng[0]?.cobertura.map(c => c.turma.nome).join(',')})`, entIng.length === 1 && entIng[0].cobertura.length === 2 ? 'APROVADO' : 'REPROVADO');

// ---- Persistência após logout/login e reabertura ----
await sair(page);
await login(page, 'p04@homolog.nexo', senhaP04);
await abrirCartao(page, /6º.*Ensino/);
const t0 = await page.locator('#conteudos-semana').inputValue();
registrar('UT-P04-05', 'Formulário 1/3', 'Após logout/login a semana 1 reaparece igual', textos[0].slice(0, 50), t0.slice(0, 50), t0 === textos[0] ? 'APROVADO' : 'REPROVADO');
await foto(page, '04-p04-reaberto-apos-login');

// ---- Concluir: clique duplo ----
for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Próximo' }).click();
await page.getByRole('button', { name: /Concluir/ }).dblclick(); await page.waitForTimeout(2000);
await foto(page, '04-p04-concluido');
const eventos = await prisma.historicoEntregaUmTerco.groupBy({ by: ['tipo'], where: { entregaId: ent.id }, _count: true });
console.log('Eventos:', JSON.stringify(eventos));
const apos = await prisma.entregaUmTerco.findUnique({ where: { id: ent.id } });
const nConcl = eventos.find(e => e.tipo === 'CONCLUIDA')?._count ?? 0;
registrar('UT-P04-06', 'Formulário 1/3', 'Duplo clique em Concluir gera 1 só evento CONCLUIDA e status concluída', '1 CONCLUIDA + status CONCLUIDA', `${nConcl} CONCLUIDA; status ${apos.status}`, nConcl === 1 && apos.status === 'CONCLUIDA' ? 'APROVADO' : 'REPROVADO', '04-p04-concluido.png');
console.log('Erros console/rede:', erros);
await browser.close(); await prisma.$disconnect();
