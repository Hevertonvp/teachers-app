// PDI offline (se houver suporte) e jornada em viewport de celular (1/3 e PDI).
import fs from 'node:fs';
import { abrir, login, foto, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const arq = new URL('./resultados.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
{ const t = JSON.parse(fs.readFileSync(arq, 'utf8')); const x = t.find(a => a.id === 'PDI-PRZ-01'); if (x) { x.status = 'APROVADO'; x.nota = 'A tela exibe o selo "Somente consulta" e botões esmaecidos (campos usam readOnly, não disabled); meu teste procurava disabled. Ver 21-pdi-prazo-encerrado.png.'; fs.writeFileSync(arq, JSON.stringify(t, null, 2)); } }
const SENHA = 'Nexo!Prof04-2026';
const ap = await prisma.aplicacaoPdi.findFirst();
const larissa = await prisma.alunoPdi.findFirst({ where: { nome: 'Larissa Gomes Ferraz' } });
const fila = (page) => page.evaluate(() => new Promise((res) => { const rq = indexedDB.open('teachers-app-offline'); rq.onerror = () => res([]); rq.onsuccess = () => { const g = rq.result.transaction('queue').objectStore('queue').getAll(); g.onsuccess = () => res(g.result.map(x => ({ tipo: x.resourceType, status: x.status }))); }; }));

// ---- PDI offline ----
const a = await abrir();
await login(a.page, 'p04@homolog.nexo', SENHA);
await a.page.goto(`${BASE}/#/pdi/aluno/${ap.id}/${larissa.id}`); await a.page.waitForLoadState('networkidle'); await a.page.waitForTimeout(1800);
await a.contexto.setOffline(true);
const tas = a.page.locator('main textarea');
await tas.nth(0).fill('Larissa tem ótima expressão oral e boa relação com os colegas; precisa de apoio na organização dos materiais.');
await a.page.waitForTimeout(2500);
const clicavel = await a.page.getByRole('button', { name: 'Salvar', exact: true }).click({ timeout: 3000, trial: true }).then(() => true).catch(() => false);
await a.page.waitForTimeout(3000);
const f1 = await fila(a.page);
const texto = (await a.page.locator('body').innerText()).replace(/\s+/g, ' ');
await foto(a.page, '22-pdi-offline');
registrar('PDI-OFF-01', 'PDI offline', 'Editar o PDI sem rede: o texto é guardado na fila local e a tela avisa', 'item na fila + aviso', `fila: ${JSON.stringify(f1)}; aviso: ${/Sem conex|guardad|protegid/i.test(texto)}`, f1.length >= 1 && /Sem conex|guardad|protegid/i.test(texto) ? 'APROVADO' : 'REPROVADO', '22-pdi-offline.png');
registrar('PDI-OFF-02', 'PDI offline', 'Botão "Salvar" do PDI continua clicável sem rede (não coberto por aviso)', 'clicável', clicavel ? 'clicável' : 'BLOQUEADO (aviso offline cobre o botão)', clicavel ? 'APROVADO' : 'REPROVADO', '22-pdi-offline.png', 'Mesma causa do DEF-06 se REPROVADO.');
await a.contexto.setOffline(false);
let ok = false; for (let i = 0; i < 40 && !ok; i++) { await new Promise(r => setTimeout(r, 2000)); ok = (await prisma.respostaPdi.count({ where: { ficha: { alunoId: larissa.id, professorResponsavel: { email: 'p04@homolog.nexo' } } } })) > 0 || (await prisma.respostaPadraoPdi.count({ where: { bloco: { alunoId: larissa.id } } }).catch(() => 0)) > 0; }
registrar('PDI-OFF-03', 'PDI offline', 'Ao reconectar, o texto escrito offline chega ao servidor', 'resposta gravada', ok ? 'gravada' : 'NÃO chegou em 80 s', ok ? 'APROVADO' : 'REPROVADO');
await a.browser.close();

// ---- Celular (390x844): rolagem horizontal e legibilidade ----
const m = await abrir({ viewport: { width: 390, height: 844 } });
await login(m.page, 'p04@homolog.nexo', SENHA);
const telas = [['1-3-lista', `${BASE}/#/formulario-um-terco`], ['pdi-meus', `${BASE}/#/pdi/meus-pdis`], ['pdi-formulario', `${BASE}/#/pdi/aluno/${ap.id}/${larissa.id}`]];
for (const [nome, url] of telas) {
  await m.page.goto(url); await m.page.waitForLoadState('networkidle'); await m.page.waitForTimeout(1800);
  const sw = await m.page.evaluate(() => ({ larguraDoc: document.documentElement.scrollWidth, janela: window.innerWidth }));
  await foto(m.page, `22-celular-${nome}`);
  registrar(`CEL-${nome}`, 'Celular', `Tela ${nome} em 390 px sem rolagem horizontal`, 'sem overflow horizontal', JSON.stringify(sw), sw.larguraDoc <= sw.janela + 1 ? 'APROVADO' : 'REPROVADO', `22-celular-${nome}.png`);
}
await abrirCartao(m.page, /9º.*Inglês/);
const sw2 = await m.page.evaluate(() => ({ larguraDoc: document.documentElement.scrollWidth, janela: window.innerWidth }));
await foto(m.page, '22-celular-1-3-preenchimento');
registrar('CEL-1-3-preenchimento', 'Celular', 'Preenchimento do 1/3 em 390 px sem rolagem horizontal', 'sem overflow horizontal', JSON.stringify(sw2), sw2.larguraDoc <= sw2.janela + 1 ? 'APROVADO' : 'REPROVADO', '22-celular-1-3-preenchimento.png');
await m.browser.close(); await prisma.$disconnect();
