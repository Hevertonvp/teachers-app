// DEF-19 — o formulário do PDI pode sobrescrever em silêncio uma versão mais recente salva em outro aparelho?
// Uso: node 34-def19-pdi-sobrescrita.mjs antes|depois. Dois contextos de navegador (Chromium) da MESMA
// professora (P04): "aparelho A" (casa) e "aparelho B" (escola). Banco LOCAL. Aluno: Pedro (Aurora 6M2,
// Inglês = P04, ficha da Aplicação 1). Cada variante usa textos com marcação própria.
//   R1 — A digita e fecha SEM salvar (rascunho no aparelho); B salva; A reabre e clica Salvar.
//   R2 — A fica offline, digita e salva (vai para a fila); fecha; B salva; A reabre COM internet.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const FASE = (process.argv[2] || 'antes').toUpperCase();
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const SENHA = 'Nexo!Prof04-2026';
const URL_PEDRO = `${BASE}/#/pdi/aluno/1/3`;
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`DEF19-${FASE}-${id}`, 'PDI conflito entre aparelhos (DEF-19)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);

const fichaPedro = await prisma.fichaPdi.findFirst({ where: { aplicacaoId: 1, alunoId: 3, disciplinaId: 9 } });
const doBanco = async () => {
  const ingles = JSON.stringify((await prisma.respostaPdi.findMany({ where: { fichaId: fichaPedro.id } })).map(x => x.valor));
  const comum = JSON.stringify((await prisma.respostaPadraoPdi.findMany({ where: { bloco: { aplicacaoId: 1, alunoId: 3, turmaId: 2, professorId: 14 } } })).map(x => x.valor));
  return { ingles, comum };
};
const campos = async (page) => { const t = page.locator('main textarea'); return [await t.nth(0).inputValue(), await t.nth(1).inputValue()]; };
const novoContexto = async (storageState) => {
  const X = await abrir();
  if (!storageState) return X;
  const ctx = await X.browser.newContext({ ignoreHTTPSErrors: true, storageState, viewport: { width: 1280, height: 800 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  return { ...X, contexto: ctx, page: await ctx.newPage() };
};
const salvar = async (page) => { const b = page.getByRole('button', { name: 'Salvar', exact: true }); await b.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(3500); };

for (const variante of ['R1', 'R2']) {
  const tag = `${TAG}-${variante}`;
  // --- Aparelho A: abre online, digita (R2: offline + salva na fila), fecha ---
  const A = await novoContexto();
  await login(A.page, 'p04@homolog.nexo', SENHA);
  await A.page.goto(URL_PEDRO); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(2500);
  if (variante === 'R2') await A.contexto.setOffline(true);
  const tA = A.page.locator('main textarea');
  await tA.nth(0).fill(`A comum ${tag}`);
  await tA.nth(1).fill(`A Inglês ${tag}`);
  await A.page.waitForTimeout(1500); // rascunho local (debounce 500 ms)
  if (variante === 'R2') await salvar(A.page);
  const storage = await A.contexto.storageState({ indexedDB: true });
  await A.browser.close();

  // --- Aparelho B: abre online, digita e salva (fica mais recente no servidor) ---
  const B = await novoContexto();
  await login(B.page, 'p04@homolog.nexo', SENHA);
  await B.page.goto(URL_PEDRO); await B.page.waitForLoadState('networkidle'); await B.page.waitForTimeout(2500);
  const tB = B.page.locator('main textarea');
  await tB.nth(0).fill(`B comum ${tag}`);
  await tB.nth(1).fill(`B Inglês ${tag}`);
  await salvar(B.page);
  await B.browser.close();
  const depoisB = await doBanco();

  // --- Aparelho A reabre com internet ---
  const A2 = await novoContexto(storage);
  await A2.page.goto(BASE + '/#/dashboard'); await A2.page.waitForLoadState('networkidle'); await dormir(5000); // DEF-07: fila enviada ao abrir
  const aposFila = await doBanco();
  await A2.page.goto(URL_PEDRO); await A2.page.waitForLoadState('networkidle'); await A2.page.waitForTimeout(3000);
  const naTela = await campos(A2.page);
  const telaAntes = (await A2.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await foto(A2.page, `34-${FASE}-${variante}-reaberto`);
  await salvar(A2.page);
  const telaDepois = (await A2.page.locator('body').innerText()).replace(/\s+/g, ' ');
  await foto(A2.page, `34-${FASE}-${variante}-depois-salvar`);
  const final = await doBanco();
  const bIntacto = final.ingles.includes(`B Inglês ${tag}`) && final.comum.includes(`B comum ${tag}`);
  const sucessoFalso = /Respostas salvas\./.test(telaDepois) && !bIntacto;
  r(`${variante}a`, `${variante === 'R1' ? 'Rascunho não salvo' : 'Edição offline na fila'}: depois que o aparelho B salvou, a fila/abertura do aparelho A não sobrescreve o servidor`, 'banco com o texto do aparelho B', `B salvou: ${depoisB.ingles.includes('B Inglês')}; após A reabrir (fila): Inglês B=${aposFila.ingles.includes(`B Inglês ${tag}`)}, comum B=${aposFila.comum.includes(`B comum ${tag}`)}`, aposFila.ingles.includes(`B Inglês ${tag}`) && aposFila.comum.includes(`B comum ${tag}`));
  const aTextoNaTela = telaAntes.includes(`A Inglês ${tag}`) && telaAntes.includes(`A comum ${tag}`);
  const aviso = /alterad[ao] depois em outro lugar|alterad[ao] em outr/i.test(telaAntes);
  r(`${variante}b`, `${variante}: aparelho A reabre o formulário — o texto dele é preservado e visível, o conflito é avisado e os campos mostram a versão salva (B)`, 'texto de A visível (aviso) + aviso de alteração + campos com o texto de B', `campos: comum "${naTela[0].slice(0, 28)}", Inglês "${naTela[1].slice(0, 28)}"; texto de A na tela: ${aTextoNaTela}; aviso: ${aviso}`, aTextoNaTela && aviso && naTela[0].includes(`B comum ${tag}`) && naTela[1].includes(`B Inglês ${tag}`), `34-${FASE}-${variante}-reaberto.png`);
  r(`${variante}c`, `${variante}: o aparelho A clica Salvar sem escolher — o texto do aparelho B NÃO é sobrescrito em silêncio e não aparece "Respostas salvas."`, 'banco ainda com B; sem mensagem de sucesso', `banco final: Inglês B=${final.ingles.includes(`B Inglês ${tag}`)}, comum B=${final.comum.includes(`B comum ${tag}`)}; sucesso falso: ${sucessoFalso}; mensagem: "${(telaDepois.match(/Respostas salvas\.|não foram salvas[^.]*\./) || [''])[0]}"`, bIntacto && !sucessoFalso, `34-${FASE}-${variante}-depois-salvar.png`);
  // Escolha explícita do professor (só existe depois da correção).
  const botao = variante === 'R1' ? 'Restaurar o meu texto' : 'Usar a versão salva';
  const nBotoes = await A2.page.getByRole('button', { name: botao }).count();
  if (nBotoes > 0) {
    for (let i = 0; i < nBotoes; i++) { await A2.page.getByRole('button', { name: botao }).first().click(); await A2.page.waitForTimeout(500); }
    if (variante === 'R1') await salvar(A2.page); else await A2.page.waitForTimeout(1500);
    const escolha = await doBanco();
    const filaRestante = await A2.page.evaluate(() => new Promise((res) => { const rq = indexedDB.open('teachers-app-offline'); rq.onsuccess = () => { const g = rq.result.transaction('queue').objectStore('queue').getAll(); g.onsuccess = () => res(g.result.length); }; rq.onerror = () => res(-1); }));
    await foto(A2.page, `34-${FASE}-${variante}-escolha`);
    if (variante === 'R1') r('R1d', 'R1: o professor escolhe "Restaurar o meu texto" e salva — agora (por decisão explícita) o texto do aparelho A vai para o servidor', 'banco com o texto de A', `Inglês A=${escolha.ingles.includes(`A Inglês ${tag}`)}, comum A=${escolha.comum.includes(`A comum ${tag}`)}; fila restante ${filaRestante}`, escolha.ingles.includes(`A Inglês ${tag}`) && escolha.comum.includes(`A comum ${tag}`) && filaRestante === 0, `34-${FASE}-R1-escolha.png`);
    else r('R2d', 'R2: o professor escolhe "Usar a versão salva" — o servidor mantém B e o envio pendente do aparelho A é descartado', 'banco com B; fila vazia', `Inglês B=${escolha.ingles.includes(`B Inglês ${tag}`)}, comum B=${escolha.comum.includes(`B comum ${tag}`)}; fila restante ${filaRestante}`, escolha.ingles.includes(`B Inglês ${tag}`) && escolha.comum.includes(`B comum ${tag}`) && filaRestante === 0, `34-${FASE}-R2-escolha.png`);
  } else r(`${variante}d`, `${variante}: opções de escolha ("${botao}") disponíveis`, 'botão presente', 'ausente', false);
  await A2.browser.close();
}
console.log('fim', FASE, TAG);
await prisma.$disconnect();
