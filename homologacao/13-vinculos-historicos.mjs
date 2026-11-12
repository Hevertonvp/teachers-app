// 1/3 POR CARGO — quem recebe o formulário e quantos são esperados (reescrito em 12/11/2026; antes: vínculos
// históricos por turma). Pela interface: cada professor P07–P15 e o painel da Secretaria. Banco LOCAL.
// Regras conferidas (decisões do usuário de 12/11/2026): cargos IGUAIS → 1 folha; quase iguais → 2; sem cargo →
// nenhuma (cadastro incompleto, sem fallback pelo PTD); Educação Infantil → folha com a escola, sem disciplina.
// Expectativas escritas à mão a partir de cargos-homolog.mjs.
import { createRequire } from 'node:module';
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { FOLHAS_ESPERADAS_CICLO1, prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';
const bcrypt = createRequire(new URL('../backend/package.json', import.meta.url))('bcryptjs');
await prepararCargosHomolog();
for (const c of ['p07', 'p08', 'p09', 'p10', 'p11', 'p12', 'p13', 'p14', 'p15']) await prisma.pessoa.update({ where: { email: `${c}@homolog.nexo` }, data: { senhaHash: await bcrypt.hash(SENHA(c), 10), senhaTemporaria: false, status: 'ATIVO' } });

const A = 'ZZ-HOMOLOG Escola Aurora'; const BV = 'ZZ-HOMOLOG Escola Boa Vista';
// [rótulo, trecho da composição]
const esperadoCards = {
  P07: [['Cargos 1 e 2', `${A} — Matemática`]],                                  // dois cargos iguais → 1 folha compartilhada
  P08: [],                                                                       // sem cargo
  P09: [],                                                                       // sem cargo
  P10: [['Cargo 1', `${A} — Arte`]],
  P11: [['Cargo 1', `${A} — História`]],
  P12: [['Cargo 1', `${A} — Ciências`], ['Cargo 2', `${A} — Ciências, Matemática`]], // quase iguais → 2 folhas
  P13: [],                                                                       // sem cargo
  P14: [['Cargo 1', A]],                                                         // Educação Infantil: escola sem disciplina
  P15: [['Cargo 1', `${BV} — Matemática`]],
};
let totalCards = 0;
for (const [cod, esp] of Object.entries(esperadoCards)) {
  const x = await abrir();
  await login(x.page, `${cod.toLowerCase()}@homolog.nexo`, SENHA(cod.toLowerCase()));
  await x.page.goto(BASE + '/#/formulario-um-terco'); await x.page.waitForLoadState('networkidle'); await x.page.waitForTimeout(1500);
  const cards = await x.page.locator('h2.text-xl').evaluateAll(hs => hs.map(h => { const c = h.closest('div.flex-col'); return { r: h.innerText.trim(), t: c ? c.innerText.replace(/\s+/g, ' ') : '' }; }).filter(c => c.t.includes('Nov/2026 (homolog)')));
  totalCards += cards.length;
  await foto(x.page, `13-${cod}-lista`);
  const ok = cards.length === esp.length && esp.every(([rot, trecho]) => cards.some(c => c.r === rot && c.t.includes(trecho))) && cards.every(c => !/\dM\d|º ano/.test(c.t));
  const vazio = cards.length === 0 ? (await x.page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 130) : '';
  registrar(`UT-VIN-${cod}`, 'Cargos', `${cod}: formulários visíveis conforme os cargos`, esp.map(([r, t]) => `${r} (${t})`).join(' + ') || '(nenhum)', (cards.map(c => `${c.r} (${c.t.slice(c.t.indexOf('ZZ-'), c.t.indexOf('ZZ-') + 60)})`).join(' + ') || '(nenhum)') + (vazio ? ` — tela: "${vazio}"` : ''), ok ? 'APROVADO' : 'REPROVADO', `13-${cod}-lista.png`);
  await x.browser.close();
}

// Folha compartilhada do P07: aviso dos dois cargos no formulário.
{
  const x = await abrir();
  await login(x.page, 'p07@homolog.nexo', SENHA('p07'));
  await x.page.goto(BASE + '/#/formulario-um-terco'); await x.page.waitForLoadState('networkidle');
  await x.page.locator('h2.text-xl', { hasText: 'Cargos 1 e 2' }).first().locator('xpath=ancestor::div[contains(@class,"flex-col")][1]').getByRole('button').click();
  await x.page.waitForLoadState('networkidle'); await x.page.waitForTimeout(800);
  const aviso = await x.page.getByText('Este formulário representa os dois cargos cadastrados').isVisible().catch(() => false);
  registrar('UT-VIN-P07b', 'Cargos', 'P07: a folha compartilhada mostra o aviso dos dois cargos', 'aviso visível', String(aviso), aviso ? 'APROVADO' : 'REPROVADO');
  await x.browser.close();
}

// Painel da Secretaria: esperado = folhas por cargo (à mão: 14).
{
  const s = await abrir();
  await login(s.page, 'secretaria@escola.gov.br', '12345678');
  await s.page.goto(BASE + '/#/formulario-um-terco/ciclos/1'); await s.page.waitForLoadState('networkidle'); await s.page.waitForTimeout(2000);
  const txt = (await s.page.locator('main').innerText()).replace(/\s+/g, ' ');
  const pega = (rot) => Number((txt.match(new RegExp(rot + '\\s*(\\d+)')) ?? [])[1]);
  const p = { esperadas: pega('Esperadas'), concluidas: pega('Concluídas'), andamento: pega('Em andamento'), nao: pega('Não iniciadas') };
  await foto(s.page, '13-painel');
  registrar('UT-VIN-PAINEL1', 'Painel', `Painel: esperadas = ${FOLHAS_ESPERADAS_CICLO1} folhas por cargo (conta manual)`, `Esperadas ${FOLHAS_ESPERADAS_CICLO1}`, JSON.stringify(p), p.esperadas === FOLHAS_ESPERADAS_CICLO1 ? 'APROVADO' : 'REPROVADO', '13-painel.png');
  registrar('UT-VIN-PAINEL1b', 'Painel', 'Painel: concluídas + em andamento + não iniciadas = esperadas', 'soma = esperadas', `${p.concluidas}+${p.andamento}+${p.nao}`, p.concluidas + p.andamento + p.nao === p.esperadas ? 'APROVADO' : 'REPROVADO');
  registrar('UT-VIN-PAINEL1c', 'Painel', 'Painel sem filtro nem texto de ano/série', 'sem "Ano/série"', /Ano\/série|º ano/.test(txt) ? 'aparece' : 'não aparece', /Ano\/série|º ano/.test(txt) ? 'REPROVADO' : 'APROVADO');
  await s.browser.close();
}
registrar('UT-VIN-CARDS', 'Painel', 'Cartões vistos por P07–P15 = 7 (P07 1, P10 1, P11 1, P12 2, P14 1, P15 1)', '7', String(totalCards), totalCards === 7 ? 'APROVADO' : 'REPROVADO');
await prisma.$disconnect();
