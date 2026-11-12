// Cenário limpo: editar OFFLINE, fechar o navegador, voltar COM rede. A fila pendente é enviada ao abrir o app?
// 1/3 POR CARGO (reescrito em 12/11/2026): Cargo 2 do P04, chave offline ciclo + cargo. Banco LOCAL.
import { abrir, login, foto, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, resetarFolhas } from './cargos-homolog.mjs';
const [, c2] = await cargosDe('p04');
await resetarFolhas('p04', 1);
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const fila = (page) => page.evaluate(() => new Promise((res) => { const rq = indexedDB.open('teachers-app-offline'); rq.onerror = () => res([]); rq.onsuccess = () => { const g = rq.result.transaction('queue').objectStore('queue').getAll(); g.onsuccess = () => res(g.result.map(x => ({ status: x.status, attempts: x.attempts }))); }; }));
const naoVazias = async () => ((await folhaDoCargo(c2))?.respostas ?? []).map(r => `S${r.semana.numero}:${r.texto.slice(0, 18)}`);

const A = await abrir();
await login(A.page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
await abrirCartao(A.page, /^Cargo 2$/);
await A.page.locator('#conteudos-semana').fill('Semana 1 ONLINE do Cargo 2: fonética e pronúncia.');
await A.page.getByRole('button', { name: 'Salvar progresso' }).click(); await A.page.waitForTimeout(1500);
await A.contexto.setOffline(true);
await A.page.getByRole('tab', { name: 'Semana 2' }).click(); await A.page.waitForTimeout(1200);
await A.page.locator('#conteudos-semana').fill('Semana 2 OFFLINE do Cargo 2: profissões e entrevista simulada.');
await A.page.waitForTimeout(4500); // autosave (2 s) vai para a fila local
const filaAntes = await fila(A.page);
const storageState = await A.contexto.storageState({ indexedDB: true });
await A.browser.close();                         // usuário fecha o navegador inteiro com dado só no aparelho

// novo navegador "do mesmo aparelho": mesmo storage (token + IndexedDB), agora COM rede
const B = await abrir();
const ctxB = await B.browser.newContext({ ignoreHTTPSErrors: true, storageState, viewport: { width: 1280, height: 800 } });
const pb = await ctxB.newPage();
await pb.goto(BASE + '/#/dashboard'); await pb.waitForLoadState('networkidle');
await pb.goto(BASE + '/#/formulario-um-terco'); await pb.waitForLoadState('networkidle');
const filaAbrir = await fila(pb);
await dormir(30000);
const filaDepois = await fila(pb);
const servidor = await naoVazias();
const textoBanner = (await pb.locator('div.fixed.inset-x-0.bottom-0.z-40').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
await foto(pb, '12-fila-pendente-online');
registrar('UT-OFF-11a', 'Offline', 'Antes de fechar: edição offline da semana 2 está guardada na fila local', '1 item pendente', JSON.stringify(filaAntes), filaAntes.length === 1 ? 'APROVADO' : 'REPROVADO');
registrar('UT-OFF-11', 'Offline', 'Voltar com rede depois de fechar o navegador: a fila pendente é enviada ao ABRIR o app (30 s)', 'servidor recebe a semana 2', `fila ao abrir: ${JSON.stringify(filaAbrir)}; após 30 s: ${JSON.stringify(filaDepois)}; servidor (semanas com texto): ${servidor.join(' | ')}; aviso: "${textoBanner.slice(0, 70)}"`, servidor.some(s => s.startsWith('S2')) ? 'APROVADO' : 'REPROVADO', '12-fila-pendente-online.png', 'envio só ocorre ao enfileirar com rede ou ao reconectar (syncQueue.js:32 e :111); sem envio na abertura.');
const clicavel = await pb.getByRole('link', { name: /Formulário 1\/3/ }).first().click({ timeout: 3000, trial: true }).then(() => true).catch(() => false);
console.log('Menu clicável com o aviso de pendência:', clicavel);

// Caminho de recuperação: o professor abre o mesmo formulário e salva de novo?
await abrirCartao(pb, /^Cargo 2$/);
const tela = await pb.locator('#conteudos-semana').inputValue();
await pb.getByRole('tab', { name: 'Semana 2' }).click(); await pb.waitForTimeout(1500);
const sem2 = await pb.locator('#conteudos-semana').inputValue();
registrar('UT-OFF-12', 'Offline', 'Ao reabrir o formulário, o texto digitado offline ainda aparece (rascunho local restaurado)', 'semana 2 visível com o texto offline', `semana 2 na tela: "${sem2.slice(0, 60)}"`, /OFFLINE/.test(sem2) ? 'APROVADO' : 'REPROVADO');
await pb.waitForTimeout(8000);
const aposAbrir = await naoVazias();
registrar('UT-OFF-13', 'Offline', 'Reabrir o formulário dispara o envio do que estava pendente', 'servidor com semana 2', aposAbrir.join(' | '), aposAbrir.some(s => s.startsWith('S2')) ? 'APROVADO' : 'REPROVADO');
await B.browser.close(); await prisma.$disconnect();
