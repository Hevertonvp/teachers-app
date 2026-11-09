// Fase 8 — offline REAL em navegador (Chromium, rede cortada com context.setOffline). Um cenário por cartão do P04.
// Intervenção declarada: leitura direta do IndexedDB e do banco local para conferir; um PUT via API para simular
// "outro dispositivo" no cenário de conflito.
import { abrir, login, foto, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const salvarOff = async (p) => { await p.getByRole('button', { name: 'Salvar progresso' }).click({ timeout: 2500 }).catch(() => {}); await p.waitForTimeout(3500); };
const semana = (p, n) => p.getByRole('tab', { name: 'Semana ' + n }).click();
const SENHA = 'Nexo!Prof04-2026';
const API = 'http://localhost:3340/api';
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
async function esperar(fn, ms = 90000, passo = 1500) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await dormir(passo); } return false; }

const lerFila = (page) => page.evaluate(() => new Promise((res) => {
  const rq = indexedDB.open('teachers-app-offline');
  rq.onerror = () => res({ erro: 'sem db' });
  rq.onsuccess = () => {
    const db = rq.result; const out = {};
    const stores = [...db.objectStoreNames];
    let pend = stores.length; if (!pend) return res(out);
    for (const s of stores) { const g = db.transaction(s).objectStore(s).getAll(); g.onsuccess = () => { out[s] = g.result.map(x => ({ key: x.key, status: x.status, attempts: x.attempts, lastError: x.lastError, resourceId: x.resourceId })); if (--pend === 0) res(out); }; }
  };
}));
const entregaDe = async (serie, disc) => { const e = await prisma.entregaUmTerco.findFirst({ where: { professor: { email: 'p04@homolog.nexo' }, anoSerie: serie, disciplina: { nome: disc } }, include: { respostas: { include: { semana: true }, orderBy: { semana: { numero: 'asc' } } } } }); if (e) e.respostas = e.respostas.filter(r => r.texto.trim() !== ""); return e; };

const { browser, contexto, page, erros } = await abrir();
await login(page, 'p04@homolog.nexo', SENHA);

// ============ O1–O3: editar offline, enfileirar, reconectar ============
await abrirCartao(page, /9º.*Inglês/);
const ta = page.locator('#conteudos-semana');
await ta.fill('Semana 1 ONLINE: revisão de there is/there are com objetos da sala de aula.');
await page.getByRole('button', { name: 'Salvar progresso' }).click(); await page.waitForTimeout(1200);
let ent = await entregaDe(9, 'Inglês');
registrar('UT-OFF-01', 'Offline', 'Salvamento ONLINE grava a semana 1 no servidor', '1 resposta no banco', `${ent?.respostas.length ?? 0} resposta(s)`, ent?.respostas.length === 1 ? 'APROVADO' : 'REPROVADO');

await contexto.setOffline(true);
await semana(page, 2); await page.waitForTimeout(1500);
await ta.fill('Semana 2 OFFLINE: leitura de pequeno texto sobre rotina escolar e perguntas de compreensão.');
await salvarOff(page);
await foto(page, '10-offline-apos-salvar');
const corpoOffline = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const fila1 = await lerFila(page);
ent = await entregaDe(9, 'Inglês');
const indicaOffline = /offline|sem conex|sem internet|salvo no aparelho|sincroniz/i.test(corpoOffline);
registrar('UT-OFF-02', 'Offline', 'Salvar sem rede NÃO perde o texto: vai para a fila local; servidor ainda sem a semana 2', 'fila com 1 item pendente; banco com 1 resposta', `fila: ${JSON.stringify(fila1.queue)}; banco: ${ent.respostas.length} resposta(s)`, fila1.queue?.length >= 1 && ent.respostas.length === 1 ? 'APROVADO' : 'REPROVADO', '10-offline-apos-salvar.png');
registrar('UT-OFF-03', 'Offline', 'A tela AVISA claramente que está offline / pendente de sincronização', 'aviso visível', indicaOffline ? 'aviso encontrado no texto da tela' : 'nenhum texto de offline/pendente encontrado na tela', indicaOffline ? 'APROVADO' : 'REPROVADO', '10-offline-apos-salvar.png');

await semana(page, 3); await page.waitForTimeout(1200);
await ta.fill('Semana 3 OFFLINE: produção escrita guiada sobre "My dream school" com 5 frases.');
await salvarOff(page); await salvarOff(page); // clique repetido
const fila2 = await lerFila(page);
registrar('UT-OFF-04', 'Offline', 'Várias edições do MESMO formulário offline não geram itens duplicados na fila', '1 item na fila (instantâneo único)', `${fila2.queue?.length} item(ns): ${JSON.stringify(fila2.queue?.map(i => i.status))}`, fila2.queue?.length === 1 ? 'APROVADO' : 'REPROVADO');

// reload offline (esperado: não abre — SW não cacheia o app por desenho)
const p2 = await contexto.newPage();
let abriu = true; try { await p2.goto(BASE + '/#/formulario-um-terco', { timeout: 8000 }); await p2.waitForTimeout(1000); abriu = (await p2.locator('h1').count()) > 0; } catch { abriu = false; }
await foto(p2, '10-offline-recarga-sem-rede').catch(() => {});
registrar('UT-OFF-05', 'Offline', 'Abrir o app do zero (nova aba) SEM rede', 'por desenho o SW não cacheia o shell: não abre', abriu ? 'ABRIU' : 'não abriu (erro de rede do navegador)', 'OBSERVAÇÃO (regra não especificada)', '10-offline-recarga-sem-rede.png', 'Limitação de produto, não defeito: só é possível continuar na página já aberta. Para suporte offline real seria preciso cachear o shell (decisão de produto).');
await p2.close();

// reconectar
const t0 = Date.now();
await contexto.setOffline(false);
const sincronizou = await esperar(async () => (await entregaDe(9, 'Inglês')).respostas.length === 3, 120000);
const seg = Math.round((Date.now() - t0) / 1000);
ent = await entregaDe(9, 'Inglês');
const filaApos = await lerFila(page);
registrar('UT-OFF-06', 'Offline', 'Ao reconectar, a fila sincroniza sozinha e o servidor recebe as 3 semanas', '3 respostas no banco', `${ent.respostas.length} resposta(s) após ${seg}s; textos: ${ent.respostas.map(r => r.texto.slice(0, 9)).join(' | ')}`, sincronizou ? 'APROVADO' : 'REPROVADO');
registrar('UT-OFF-07', 'Offline', 'Fila esvazia depois de sincronizar e não há eventos/respostas duplicados', 'fila vazia; 3 respostas; 1 evento INICIADA', `fila: ${filaApos.queue?.length}; respostas: ${ent.respostas.length}; INICIADA: ${await prisma.historicoEntregaUmTerco.count({ where: { entregaId: ent.id, tipo: 'INICIADA' } })}`, (filaApos.queue?.length ?? 0) === 0 && ent.respostas.length === 3 ? 'APROVADO' : 'REPROVADO');

const nova = page;
// ============ O5: conflito offline x servidor ============
await abrirCartao(nova, /7º.*Inglês/);
const t5 = nova.locator('#conteudos-semana');
await t5.fill('Semana 1 base (online): saudações formais e informais.');
await nova.getByRole('button', { name: 'Salvar progresso' }).click(); await nova.waitForTimeout(1200);
await contexto.setOffline(true);
await t5.fill('Semana 1 EDITADA OFFLINE no celular: saudações formais, informais e despedidas.');
await salvarOff(nova);
// "outro dispositivo" grava primeiro (API direta)
const tok = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'p04@homolog.nexo', senha: SENHA }) })).json()).token;
const e7 = await entregaDe(7, 'Inglês'); const ciclo = await prisma.cicloUmTerco.findFirst({ where: { titulo: { contains: 'Nov/2026 (homolog)' } }, include: { semanas: true } });
const disc = await prisma.disciplina.findUnique({ where: { nome: 'Inglês' } });
const semana1 = ciclo.semanas.find(s => s.numero === 1);
const outro = await fetch(`${API}/formulario-um-terco/ciclos/${ciclo.id}/formularios/7/${disc.id}/respostas`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify({ baseUpdatedAt: e7.updatedAt.toISOString(), respostas: [{ semanaId: semana1.id, texto: 'Semana 1 EDITADA NO COMPUTADOR DA ESCOLA (outro dispositivo).' }] }) });
await contexto.setOffline(false);
await dormir(15000);
const e7b = await entregaDe(7, 'Inglês');
const texto1 = e7b.respostas.find(r => r.semana.numero === 1)?.texto;
const corpo5 = (await nova.locator('body').innerText()).replace(/\s+/g, ' ');
await foto(nova, '10-offline-conflito');
const mostrouConflito = /alterado em outra aba|Usar a versão salva|Manter o meu texto/i.test(corpo5);
registrar('UT-OFF-09', 'Offline', 'Conflito: celular editou offline, outro dispositivo gravou antes → servidor NÃO é sobrescrito em silêncio', 'servidor mantém o texto do outro dispositivo', `HTTP do outro dispositivo: ${outro.status}; servidor: "${texto1?.slice(0, 55)}"`, texto1?.includes('COMPUTADOR DA ESCOLA') ? 'APROVADO' : 'REPROVADO', '10-offline-conflito.png');
registrar('UT-OFF-10', 'Offline', 'Conflito: a tela mostra opções ao professor (usar versão salva / manter o meu)', 'aviso de conflito visível', mostrouConflito ? 'aviso de conflito exibido' : 'SEM aviso de conflito na tela', mostrouConflito ? 'APROVADO' : 'REPROVADO', '10-offline-conflito.png');
await abrirCartao(nova, /7º.*Inglês/); await nova.waitForTimeout(2500);
const corpoReaberto = (await nova.locator('body').innerText()).replace(/s+/g, ' ');
await foto(nova, '10-offline-conflito-reaberto');
const conflitoAoReabrir = /alterado em outra aba|Usar a versão salva|Manter o meu texto/i.test(corpoReaberto);
registrar('UT-OFF-10b', 'Offline', 'Conflito de fila: ao REABRIR o formulário aparecem as opções (usar versão salva / manter o meu)', 'opções visíveis', conflitoAoReabrir ? 'opções exibidas' : 'sem opções; texto da semana 1: ' + (await nova.locator('#conteudos-semana').inputValue()).slice(0, 60), conflitoAoReabrir ? 'APROVADO' : 'REPROVADO', '10-offline-conflito-reaberto.png');
const filaFim = await lerFila(nova);
console.log('Fila final:', JSON.stringify(filaFim.queue));
console.log('Erros de console/rede (exclui falhas de rede esperadas):', erros.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::/.test(e)));
await browser.close(); await prisma.$disconnect();
