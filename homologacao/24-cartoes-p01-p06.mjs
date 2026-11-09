// Confere pela interface os formulários 1/3 de P01, P02, P03, P05, P06. Expectativas calculadas à mão.
import { createRequire } from 'node:module';
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const bcrypt = createRequire(new URL('../backend/package.json', import.meta.url))('bcryptjs');
const senha = (c) => `Nexo!Prof${c.slice(1)}-2026`;
for (const c of ['p02', 'p03', 'p05', 'p06']) await prisma.pessoa.update({ where: { email: `${c}@homolog.nexo` }, data: { senhaHash: await bcrypt.hash(senha(c), 10), senhaTemporaria: false } });
const esperado = {
  p01: { 'Matemática|6': ['6M1'] },
  p02: { 'Língua Portuguesa|6': ['6M1'], 'Ciências|6': ['6M1'], 'História|6': ['6M1'] },
  p03: { 'Geografia|6': ['6M2', '6M3', '6M4'], 'Geografia|7': ['7M2'] },
  p05: { 'Educação Física|7': ['7M2', '7M1'] },
  p06: { 'Ciências|6': ['6M2'] },
};
for (const [cod, mapa] of Object.entries(esperado)) {
  const x = await abrir();
  await login(x.page, `${cod}@homolog.nexo`, senha(cod));
  await x.page.goto(BASE + '/#/formulario-um-terco'); await x.page.waitForLoadState('networkidle');
  await x.page.locator('h2.text-xl').first().waitFor({ timeout: 15000 }).catch(() => {});
  const cards = await x.page.locator('h2.text-xl').evaluateAll(hs => hs.map(h => ({ r: h.innerText.trim(), t: h.closest('div.flex-col')?.innerText.replace(/\s+/g, ' ') ?? '' })));
  await foto(x.page, `24-${cod}-lista`);
  const esp = Object.entries(mapa).map(([k, turmas]) => { const [d, s] = k.split('|'); return { rotulo: `${s}º ano — ${d}`, turmas }; });
  const ok = cards.length === esp.length && esp.every(e => { const c = cards.find(k => k.r === e.rotulo); return c && e.turmas.every(t => c.t.includes(t)); });
  registrar(`UT-CARD-${cod.toUpperCase()}`, 'Vínculos', `${cod.toUpperCase()}: formulários e turmas cobertas conferem com a conta manual`, esp.map(e => `${e.rotulo} [${e.turmas.join(',')}]`).join(' + '), cards.map(c => `${c.r} ${(c.t.match(/Válido para:(.*?)\d\/\d semanas/) ?? ['', ''])[1].trim()}`).join(' + '), ok ? 'APROVADO' : 'REPROVADO', `24-${cod}-lista.png`);
  await x.browser.close();
}
await prisma.$disconnect();
