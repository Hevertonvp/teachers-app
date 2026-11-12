// Confere pela interface os formulários 1/3 de P01, P02, P03, P05 e P06 — 1/3 POR CARGO (reescrito em 12/11/2026).
// Expectativas escritas à mão a partir dos cargos de teste (cargos-homolog.mjs). Banco LOCAL.
import { createRequire } from 'node:module';
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';
const bcrypt = createRequire(new URL('../backend/package.json', import.meta.url))('bcryptjs');
await prepararCargosHomolog();
for (const c of ['p02', 'p03', 'p05', 'p06']) await prisma.pessoa.update({ where: { email: `${c}@homolog.nexo` }, data: { senhaHash: await bcrypt.hash(SENHA(c), 10), senhaTemporaria: false } });
const A = 'ZZ-HOMOLOG Escola Aurora'; const BV = 'ZZ-HOMOLOG Escola Boa Vista';
const esperado = {
  p01: [`${A} — Matemática`],
  p02: [`${A} — Ciências, História, Língua Portuguesa`],
  p03: [`${A} — Geografia`],
  p05: [`${A} — Educação Física`, `${BV} — Educação Física`], // 1 cargo, 2 escolas, 1 folha
  p06: [`${A} — Ciências`],
};
for (const [cod, linhas] of Object.entries(esperado)) {
  const x = await abrir();
  await login(x.page, `${cod}@homolog.nexo`, SENHA(cod));
  await x.page.goto(BASE + '/#/formulario-um-terco'); await x.page.waitForLoadState('networkidle');
  await x.page.locator('h2.text-xl').first().waitFor({ timeout: 15000 }).catch(() => {});
  const cards = await x.page.locator('h2.text-xl').evaluateAll(hs => hs.map(h => ({ r: h.innerText.trim(), t: h.closest('div.flex-col')?.innerText.replace(/\s+/g, ' ') ?? '' })).filter(c => c.t.includes('Nov/2026 (homolog)')));
  await foto(x.page, `24-${cod}-lista`);
  const ok = cards.length === 1 && cards[0].r === 'Cargo 1' && linhas.every(l => cards[0].t.includes(l)) && !/\dM\d|º ano|Válido para/.test(cards[0].t);
  registrar(`UT-CARD-${cod.toUpperCase()}`, 'Cargos', `${cod.toUpperCase()}: um formulário (Cargo 1) com escola → disciplinas, sem turmas`, `Cargo 1: ${linhas.join(' + ')}`, cards.map(c => `${c.r}: ${c.t.slice(c.t.indexOf('ZZ-'), c.t.indexOf('ZZ-') + 110)}`).join(' | ') || '(nenhum)', ok ? 'APROVADO' : 'REPROVADO', `24-${cod}-lista.png`);
  await x.browser.close();
}
await prisma.$disconnect();
