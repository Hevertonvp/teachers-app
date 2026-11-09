// DEF-07 (fila enviada ao ABRIR o app com internet) e DEF-08 (sem "Salvo" falso; conflito da fila
// com opções; rascunho nunca reenviado em silêncio por cima de versão mais nova).
// Uso: node 32-def07-def08-offline.mjs antes|depois. Chromium real; rede cortada com setOffline;
// "fechar o navegador" = fechar o browser e reabrir outro com o MESMO storage (token + IndexedDB).
// Simulações declaradas: token inválido (sessão expirada) e item "enviando" interrompido são
// gravados no storage do navegador; a edição concorrente de "outro aparelho" é feita pela API.
import { abrir, login, foto, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const FASE = (process.argv[2] || 'depois').toUpperCase();
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const API = 'http://localhost:3340';
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const SENHA04 = 'Nexo!Prof04-2026';
const r = (id, cen, esp, obs, ok, evid = '', nota = '') => registrar(`OFF-${FASE}-${id}`, 'Offline (DEF-07/DEF-08)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid, nota);

const filaDe = (page) => page.evaluate(() => new Promise((res) => { const rq = indexedDB.open('teachers-app-offline'); rq.onerror = () => res([]); rq.onsuccess = () => { try { const g = rq.result.transaction('queue').objectStore('queue').getAll(); g.onsuccess = () => res(g.result.map(x => ({ userId: x.userId, tipo: x.resourceType, status: x.status }))); } catch { res([]); } }; }));
const marcarFila = (page, status) => page.evaluate((st) => new Promise((res) => { const rq = indexedDB.open('teachers-app-offline'); rq.onsuccess = () => { const tx = rq.result.transaction('queue', 'readwrite'); const s = tx.objectStore('queue'); const g = s.getAll(); g.onsuccess = () => { g.result.forEach(x => s.put({ ...x, status: st })); }; tx.oncomplete = () => res(true); }; }), status);
const textos1o3 = async (anoSerie, disc) => { const e = await prisma.entregaUmTerco.findFirst({ where: { cicloId: 1, professor: { email: 'p04@homolog.nexo' }, anoSerie, disciplina: { nome: disc } }, include: { respostas: { include: { semana: true } } } }); return Object.fromEntries((e?.respostas ?? []).map(x => [x.semana.numero, x.texto])); };
async function reabrir(storageState, { mexer } = {}) {
  if (mexer) mexer(storageState);
  const X = await abrir();
  const ctx = await X.browser.newContext({ ignoreHTTPSErrors: true, storageState, viewport: { width: 1280, height: 800 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const page = await ctx.newPage();
  return { X, ctx, page };
}
const tokenP04 = async () => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'p04@homolog.nexo', senha: SENHA04 }) })).json()).token;
// Prepara: abre o cartão online, salva a semana 1, corta a rede, escreve na semana 2 e espera o autosave ir para a fila.
async function editarOffline(cartao, texto, arq) {
  const A = await abrir();
  await login(A.page, 'p04@homolog.nexo', SENHA04);
  await abrirCartao(A.page, cartao);
  await A.page.locator('#conteudos-semana').fill(`Semana 1 online ${TAG} ${Math.random().toString(36).slice(2, 7)}`);
  await A.page.getByRole('button', { name: 'Salvar progresso' }).click(); await A.page.waitForTimeout(2000);
  const indicadorOnline = (await A.page.locator('main').innerText()).match(/Sincronizado|Salvo só neste aparelho|Salvo/)?.[0] ?? '(nenhum)';
  await A.contexto.setOffline(true);
  await A.page.getByRole('tab', { name: 'Semana 2' }).click(); await A.page.waitForTimeout(1200);
  await A.page.locator('#conteudos-semana').fill(texto);
  await A.page.waitForTimeout(5000);
  const indicadorOffline = (await A.page.locator('main').innerText()).match(/Sincronizado|Salvo só neste aparelho[^\n]*|Salvo/)?.[0] ?? '(nenhum)';
  await foto(A.page, arq);
  const fila = await filaDe(A.page);
  return { A, indicadorOnline, indicadorOffline, fila };
}

// ===== 1. DEF-07 no 1/3: fechar offline e reabrir COM internet (mesmo usuário) =====
{
  const texto = `Semana 2 OFFLINE ${TAG} (fechar e reabrir)`;
  const { A, indicadorOnline, indicadorOffline, fila } = await editarOffline(/8º.*Inglês/, texto, `32-${FASE}-1-offline`);
  r('1a', 'Salvar com internet mostra que chegou ao servidor', '"Sincronizado"', indicadorOnline, indicadorOnline === 'Sincronizado');
  r('1b', 'Salvar sem internet NÃO mostra sucesso de servidor', '"Salvo só neste aparelho…"', indicadorOffline, indicadorOffline.startsWith('Salvo só neste aparelho'), `32-${FASE}-1-offline.png`);
  const storage = await A.contexto.storageState({ indexedDB: true });
  await A.browser.close();
  const B = await reabrir(storage);
  await B.page.goto(BASE + '/#/dashboard'); await B.page.waitForLoadState('networkidle');
  let servidor = {}; for (let i = 0; i < 15; i++) { await dormir(1000); servidor = await textos1o3(8, 'Inglês'); if ((servidor[2] || '').includes(TAG)) break; }
  const filaDepois = await filaDe(B.page);
  await foto(B.page, `32-${FASE}-1-reaberto`);
  r('1c', 'DEF-07: reabrir o Nexo com internet envia sozinho a fila pendente (sem abrir o formulário)', 'semana 2 no banco em até 15 s; fila vazia', `fila antes ${JSON.stringify(fila)}; banco S2: "${(servidor[2] || '').slice(0, 45)}"; fila depois ${JSON.stringify(filaDepois)}`, (servidor[2] || '').includes(TAG) && filaDepois.length === 0, `32-${FASE}-1-reaberto.png`);
  await B.X.browser.close();
}

// ===== 2. DEF-07 no PDI (formulário único): offline → Salvar → fechar → reabrir =====
{
  const A = await abrir();
  await login(A.page, 'p04@homolog.nexo', SENHA04);
  await A.page.goto(`${BASE}/#/pdi/aluno/1/3`); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(2500);
  await A.contexto.setOffline(true);
  const tas = A.page.locator('main textarea');
  await tas.nth(1).fill(`Inglês do Pedro OFFLINE ${TAG}`);
  const salvar = A.page.getByRole('button', { name: 'Salvar', exact: true });
  await salvar.focus(); await A.page.keyboard.press('Enter'); // DEF-13 (aviso cobre o botão) fora do escopo: teclado
  await A.page.waitForTimeout(3500);
  const msg = (await A.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await foto(A.page, `32-${FASE}-2-pdi-offline`);
  const fila = await filaDe(A.page);
  r('2a', 'PDI: Salvar sem internet não anuncia "Respostas salvas." como se tivesse chegado ao servidor', 'mensagem de "guardadas neste aparelho"', `${(msg.match(/Sem conexão[^.]*\.|Respostas salvas\.|guardad[^.]*\./) || ['(sem mensagem)'])[0]}; fila ${JSON.stringify(fila)}`, /guardadas neste aparelho/.test(msg) && !/Respostas salvas\./.test(msg), `32-${FASE}-2-pdi-offline.png`);
  const storage = await A.contexto.storageState({ indexedDB: true });
  await A.browser.close();
  const B = await reabrir(storage);
  await B.page.goto(BASE + '/#/dashboard'); await B.page.waitForLoadState('networkidle');
  const ficha = await prisma.fichaPdi.findFirst({ where: { aplicacaoId: 1, alunoId: 3, disciplinaId: 9 } });
  let txt = ''; for (let i = 0; i < 15; i++) { await dormir(1000); txt = JSON.stringify((await prisma.respostaPdi.findMany({ where: { fichaId: ficha.id } })).map(x => x.valor)); if (txt.includes(TAG)) break; }
  const filaDepois = await filaDe(B.page);
  r('2b', 'DEF-07 no PDI: reabrir com internet envia sozinho a resposta guardada', 'resposta no banco em até 15 s; fila vazia', `banco contém o texto: ${txt.includes(TAG)}; fila depois ${JSON.stringify(filaDepois)}`, txt.includes(TAG) && filaDepois.length === 0);
  await B.X.browser.close();
}

// ===== 3. Sessão expirada: nada é perdido; envia depois do novo login =====
{
  const texto = `Semana 2 OFFLINE ${TAG} (sessão expirada)`;
  const { A, fila } = await editarOffline(/9º.*Inglês/, texto, `32-${FASE}-3-offline`);
  const storage = await A.contexto.storageState({ indexedDB: true });
  await A.browser.close();
  const B = await reabrir(storage, { mexer: (s) => s.origins.forEach(o => o.localStorage.forEach(item => { if (item.name === 'authToken') item.value = 'token-expirado-simulado'; })) });
  await B.page.goto(BASE + '/#/dashboard'); await B.page.waitForLoadState('networkidle'); await dormir(5000);
  const filaAposExpirar = await filaDe(B.page);
  const rota = B.page.url().split('#')[1];
  const antesLogin = await textos1o3(9, 'Inglês');
  await login(B.page, 'p04@homolog.nexo', SENHA04);
  let servidor = {}; for (let i = 0; i < 15; i++) { await dormir(1000); servidor = await textos1o3(9, 'Inglês'); if ((servidor[2] || '').includes(TAG)) break; }
  const filaFinal = await filaDe(B.page);
  r('3a', 'Sessão expirada ao reabrir: vai para o login e a alteração continua guardada (não vira erro)', 'rota /login; fila com item pendente; nada enviado', `rota ${rota}; fila ${JSON.stringify(filaAposExpirar)}; banco S2 tem o texto: ${(antesLogin[2] || '').includes(TAG)}`, rota.includes('login') && filaAposExpirar.length === 1 && filaAposExpirar[0].status === 'pending' && !(antesLogin[2] || '').includes(TAG));
  r('3b', 'Depois do novo login do mesmo professor, a fila é enviada', 'semana 2 no banco; fila vazia', `banco S2: "${(servidor[2] || '').slice(0, 45)}"; fila ${JSON.stringify(filaFinal)}`, (servidor[2] || '').includes(TAG) && filaFinal.length === 0);
  await B.X.browser.close();
}

// ===== 4. Dois usuários no mesmo navegador: a fila da P04 nunca é enviada pela sessão do P02 =====
{
  const texto = `Semana 2 OFFLINE ${TAG} (dois usuários)`;
  const { A } = await editarOffline(/7º.*Inglês/, texto, `32-${FASE}-4-offline`);
  const storage = await A.contexto.storageState({ indexedDB: true });
  await A.browser.close();
  // Reabre "deslogado" (token e usuário removidos) e entra como OUTRO professor.
  const B = await reabrir(storage, { mexer: (s) => s.origins.forEach(o => { o.localStorage = o.localStorage.filter(item => !['authToken', 'user'].includes(item.name)); }) });
  await login(B.page, 'p02@homolog.nexo', 'Nexo!Prof02-2026'); await dormir(8000);
  const comP02 = await textos1o3(7, 'Inglês');
  const filaComP02 = await filaDe(B.page);
  r('4a', 'Outro professor (P02) entra no mesmo navegador: a alteração pendente da P04 NÃO é enviada com a sessão dele', 'banco sem o texto; item da P04 continua pendente', `banco S2 tem o texto: ${(comP02[2] || '').includes(TAG)}; fila ${JSON.stringify(filaComP02)}`, !(comP02[2] || '').includes(TAG) && filaComP02.some(i => i.userId === 'p04@homolog.nexo' && i.status === 'pending'));
  await B.page.getByRole('button', { name: 'Sair' }).click(); await dormir(800);
  await login(B.page, 'p04@homolog.nexo', SENHA04);
  let servidor = {}; for (let i = 0; i < 15; i++) { await dormir(1000); servidor = await textos1o3(7, 'Inglês'); if ((servidor[2] || '').includes(TAG)) break; }
  r('4b', 'Quando a P04 volta a entrar, a alteração dela é enviada', 'semana 2 no banco', `banco S2: "${(servidor[2] || '').slice(0, 45)}"`, (servidor[2] || '').includes(TAG));
  await B.X.browser.close();
}

// ===== 5. Falha durante a sincronização (envio interrompido, item preso em "enviando") e envio repetido =====
{
  const texto = `Semana 2 OFFLINE ${TAG} (envio interrompido)`;
  const { A } = await editarOffline(/7º.*Arte/, texto, `32-${FASE}-5-offline`);
  await marcarFila(A.page, 'syncing'); // simula: a aba fechou no meio do envio
  const storage = await A.contexto.storageState({ indexedDB: true });
  await A.browser.close();
  const B = await reabrir(storage);
  await B.page.goto(BASE + '/#/dashboard'); await B.page.waitForLoadState('networkidle');
  let servidor = {}; for (let i = 0; i < 15; i++) { await dormir(1000); servidor = await textos1o3(7, 'Arte'); if ((servidor[2] || '').includes(TAG)) break; }
  const filaDepois = await filaDe(B.page);
  const entregas = await prisma.entregaUmTerco.count({ where: { cicloId: 1, professor: { email: 'p04@homolog.nexo' }, anoSerie: 7, disciplina: { nome: 'Arte' } } });
  r('5', 'Item preso em "enviando" (aba fechada no meio do envio) é reenviado ao abrir, sem duplicar', 'semana 2 no banco; 1 entrega; fila vazia', `banco S2: "${(servidor[2] || '').slice(0, 40)}"; entregas ${entregas}; fila ${JSON.stringify(filaDepois)}`, (servidor[2] || '').includes(TAG) && entregas === 1 && filaDepois.length === 0);
  await B.X.browser.close();
}

// ===== 6. DEF-08: conflito — outro aparelho salvou enquanto este estava offline =====
for (const escolha of ['Manter o meu texto', 'Usar a versão salva']) {
  const tag2 = `${TAG}-${escolha.startsWith('Manter') ? 'M' : 'U'}`;
  const texto = `Semana 2 OFFLINE ${tag2} (este aparelho)`;
  const { A } = await editarOffline(/6º.*Ensino Religioso/, texto, `32-${FASE}-6-offline`);
  const storage = await A.contexto.storageState({ indexedDB: true });
  await A.browser.close();
  // "Outro aparelho" (computador da escola) grava a semana 2 pela API com a versão atual.
  const t = await tokenP04();
  const atual = await (await fetch(`${API}/api/formulario-um-terco/ciclos/1/formularios/6/10`, { headers: { authorization: 'Bearer ' + t } })).json();
  const outro = `Semana 2 do OUTRO APARELHO ${tag2}`;
  const put = await fetch(`${API}/api/formulario-um-terco/ciclos/1/formularios/6/10/respostas`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ baseUpdatedAt: atual.updatedAt, respostas: atual.semanas.map(s => ({ semanaId: s.id, texto: s.numero === 2 ? outro : s.texto })) }) });
  const B = await reabrir(storage);
  await B.page.goto(BASE + '/#/dashboard'); await B.page.waitForLoadState('networkidle'); await dormir(5000);
  const filaAoAbrir = await filaDe(B.page);
  const bancoAntesEscolha = await textos1o3(6, 'Ensino Religioso');
  await abrirCartao(B.page, /6º.*Ensino Religioso/);
  await B.page.getByRole('tab', { name: 'Semana 2' }).click(); await B.page.waitForTimeout(1500);
  const tela = (await B.page.locator('main').innerText()).replace(/\s+/g, ' ');
  const temOpcoes = await B.page.getByRole('button', { name: 'Usar a versão salva' }).count() > 0;
  const textoNaTela = await B.page.locator('#conteudos-semana').inputValue();
  await foto(B.page, `32-${FASE}-6-conflito-${tag2}`);
  const falsoSalvo = /\bSincronizado\b|\bSalvo\b(?! só)/.test(tela);
  await B.page.getByRole('tab', { name: 'Semana 3' }).click(); await B.page.waitForTimeout(2500); // trocar de semana com conflito aberto
  await B.page.getByRole('tab', { name: 'Semana 2' }).click(); await B.page.waitForTimeout(1500);
  const bancoDuranteConflito = await textos1o3(6, 'Ensino Religioso');
  if (escolha.startsWith('Manter')) {
    r('6a', 'DEF-08: outro aparelho salvou antes; ao reabrir, a fila NÃO sobrescreve o servidor', 'banco com o texto do outro aparelho', `outro aparelho HTTP ${put.status}; fila ao abrir ${JSON.stringify(filaAoAbrir)}; banco S2: "${(bancoAntesEscolha[2] || '').slice(0, 40)}"`, (bancoAntesEscolha[2] || '').includes('OUTRO APARELHO'));
    r('6b', 'DEF-08: ao abrir o formulário, aparecem as opções de conflito, com o texto deste aparelho preservado, sem "Salvo"/"Sincronizado", e trocar de semana NÃO envia nada', 'botões de conflito; texto local na tela; banco ainda com o texto do outro aparelho', `opções: ${temOpcoes}; texto na tela: "${textoNaTela.slice(0, 40)}"; indicador de sucesso falso: ${falsoSalvo}; banco após trocar de semana: "${(bancoDuranteConflito[2] || '').slice(0, 40)}"`, temOpcoes && textoNaTela.includes(tag2) && !falsoSalvo && (bancoDuranteConflito[2] || '').includes('OUTRO APARELHO'), `32-${FASE}-6-conflito-${tag2}.png`);
  }
  if (temOpcoes) {
    await B.page.getByRole('button', { name: escolha }).click(); await B.page.waitForTimeout(4500);
  }
  const bancoFinal = await textos1o3(6, 'Ensino Religioso');
  const filaFinal = await filaDe(B.page);
  if (escolha.startsWith('Manter')) r('6c', 'DEF-08: "Manter o meu texto" envia o texto deste aparelho e limpa a fila', 'banco com o texto deste aparelho; fila vazia', `banco S2: "${(bancoFinal[2] || '').slice(0, 40)}"; fila ${JSON.stringify(filaFinal)}`, (bancoFinal[2] || '').includes(`OFFLINE ${tag2}`) && filaFinal.length === 0);
  else r('6d', 'DEF-08: "Usar a versão salva" mantém o servidor e descarta o envio pendente', 'banco com o texto do outro aparelho; fila vazia', `banco S2: "${(bancoFinal[2] || '').slice(0, 40)}"; fila ${JSON.stringify(filaFinal)}`, (bancoFinal[2] || '').includes('OUTRO APARELHO') && filaFinal.length === 0);
  await B.X.browser.close();
}
console.log('fim', FASE, TAG);
await prisma.$disconnect();
