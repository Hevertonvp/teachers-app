// PDI offline: (a) o texto digitado sem rede é recuperável depois de fechar? (b) salvar por TECLADO (Tab+Enter) enfileira?
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const SENHA = 'Nexo!Prof04-2026';
const ap = await prisma.aplicacaoPdi.findFirst();
const al = await prisma.alunoPdi.findFirst({ where: { nome: 'Pedro Henrique Souza' } }); // 6M2: só Inglês do P04
const lerStores = (page) => page.evaluate(() => new Promise((res) => { const rq = indexedDB.open('teachers-app-offline'); rq.onerror = () => res({}); rq.onsuccess = () => { const db = rq.result, out = {}; let p = db.objectStoreNames.length; for (const s of db.objectStoreNames) { const g = db.transaction(s).objectStore(s).getAll(); g.onsuccess = () => { out[s] = g.result.map(x => ({ key: String(x.key).slice(0, 70), status: x.status })); if (--p === 0) res(out); }; } }; }));

const a = await abrir();
await login(a.page, 'p04@homolog.nexo', SENHA);
await a.page.goto(`${BASE}/#/pdi/aluno/${ap.id}/${al.id}`); await a.page.waitForLoadState('networkidle'); await a.page.waitForTimeout(1800);
await a.contexto.setOffline(true);
await a.page.locator('main textarea').nth(0).fill('RASCUNHO-OFFLINE: Pedro precisa de reforço em leitura de textos curtos; ótimo comportamento em sala.');
await a.page.waitForTimeout(4000);
const antes = await lerStores(a.page);
registrar('PDI-OFF-04', 'PDI offline', 'Texto digitado sem rede vira rascunho local (IndexedDB) automaticamente', 'item em drafts ou queue', JSON.stringify(antes), (antes.drafts?.length ?? 0) + (antes.queue?.length ?? 0) > 0 ? 'APROVADO' : 'REPROVADO');

// salvar por teclado
await a.page.locator('main textarea').nth(0).focus();
for (let i = 0; i < 12; i++) { await a.page.keyboard.press('Tab'); const nome = await a.page.evaluate(() => document.activeElement?.innerText?.trim()); if (nome === 'Salvar') { await a.page.keyboard.press('Enter'); break; } }
await a.page.waitForTimeout(3000);
const depoisTeclado = await lerStores(a.page);
registrar('PDI-OFF-05', 'PDI offline', 'Salvar por teclado (Tab+Enter) sem rede enfileira a alteração', 'item na fila', JSON.stringify(depoisTeclado.queue ?? []), (depoisTeclado.queue?.length ?? 0) > 0 ? 'APROVADO' : 'REPROVADO', '', 'Teclado é a alternativa quando o aviso cobre o botão.');

// fecha o navegador inteiro offline e volta com rede
const estado = await a.contexto.storageState({ indexedDB: true });
await a.browser.close();
const b = await abrir();
const ctx = await b.browser.newContext({ ignoreHTTPSErrors: true, storageState: estado, viewport: { width: 1280, height: 800 } });
const pg = await ctx.newPage();
await pg.goto(`${BASE}/#/pdi/aluno/${ap.id}/${al.id}`); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(2500);
const recuperado = await pg.locator('main textarea').nth(0).inputValue();
const aviso = (await pg.locator('body').innerText()).replace(/\s+/g, ' ').match(/Recuperamos[^.]*\./)?.[0];
await foto(pg, '23-pdi-reaberto-apos-offline');
registrar('PDI-OFF-06', 'PDI offline', 'Depois de fechar o navegador offline e reabrir com rede, o texto digitado é recuperado', 'texto recuperado', `"${recuperado.slice(0, 40)}" | aviso: ${aviso ?? '(nenhum)'}`, recuperado.startsWith('RASCUNHO-OFFLINE') ? 'APROVADO' : 'REPROVADO', '23-pdi-reaberto-apos-offline.png');
await pg.waitForTimeout(15000);
const noServidor = await prisma.respostaPadraoPdi.count({ where: { bloco: { alunoId: al.id } } }).catch(() => -1);
const gravado = await prisma.respostaPdi.count({ where: { ficha: { alunoId: al.id } } });
registrar('PDI-OFF-07', 'PDI offline', 'A alteração pendente é enviada ao servidor ao abrir com rede (15 s)', 'resposta gravada', `respostas padrão: ${noServidor}; respostas de ficha: ${gravado}`, noServidor > 0 || gravado > 0 ? 'APROVADO' : 'REPROVADO', '', 'Mesma lacuna do DEF-07 se REPROVADO (fila não é enviada ao abrir).');
await b.browser.close(); await prisma.$disconnect();
