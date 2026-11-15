// Bateria do 1/3 — parte de NAVEGADOR que faltava (15/11/2026): cliques duplos, recarregar/voltar/fechar aba,
// duas abas com conflito pela tela, relógio do navegador errado e celular 390 px na folha.
// Offline, Excel e concorrência pela API já são cobertos por 10, 12, 32, 61 e 07 (rodar-um-terco.sh).
// Navegador real, banco LOCAL. Ciclo local #1 (aberto até 20/11) + folha do Cargo 1 do P01.
// Intervenção declarada: leitura direta do banco local para conferir; o ciclo criado no teste do clique duplo é apagado no fim.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, prepararCargosHomolog, resetarFolhas } from './cargos-homolog.mjs';

const r = (id, cen, esp, obs, ok, ev = '') => registrar(`UT-NAV-${id}`, 'Formulário 1/3 (navegador)', cen, esp, String(obs).slice(0, 300), ok === null ? 'OBSERVAÇÃO' : ok ? 'APROVADO' : 'REPROVADO', ev);
const CICLO = 1;
await prepararCargosHomolog();
const [C1] = await cargosDe('p01');
await resetarFolhas('p01', CICLO);
const SENHA = 'Nexo!Prof01-2026';
const ROTA = `/formulario-um-terco/${CICLO}/cargo/${C1}`;
const ir = async (page, rota) => { await page.goto(BASE + '/#' + rota); await page.waitForLoadState('networkidle'); await page.waitForTimeout(900); };
const ta = (page) => page.locator('#conteudos-semana');
const textoNoBanco = async (n) => (await folhaDoCargo(C1, CICLO))?.respostas.find(x => x.semana.numero === n)?.texto ?? '';
const semRolagemLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const errosTodos = [];

// ===== 1. Secretaria: clique duplo em "Salvar" do novo ciclo cria UM ciclo só =====
const JAN = { abre: new Date('2026-12-01T03:00:00Z'), prazo: new Date('2026-12-04T02:59:59Z') };
const sobrepostos = await prisma.cicloUmTerco.count({ where: { status: 'ATIVA', abreEm: { lte: JAN.prazo }, prazoEm: { gte: JAN.abre } } });
const S = await abrir();
const idsAntes = (await prisma.cicloUmTerco.findMany({ select: { id: true } })).map(c => c.id);
try {
  await login(S.page, 'secretaria@escola.gov.br', '12345678');
  if (sobrepostos) {
    r('01', 'Clique duplo em Salvar do novo ciclo', '1 ciclo criado', `não executado: já há ${sobrepostos} ciclo ativo em 01–03/12 no banco local`, null);
  } else {
    await ir(S.page, '/formulario-um-terco');
    await S.page.getByRole('button', { name: '+ Novo ciclo' }).first().click();
    const m = S.page.locator('div.fixed.inset-0');
    await m.getByLabel('Abertura', { exact: true }).fill('2026-12-01');
    await m.getByLabel('Prazo de entrega', { exact: true }).fill('2026-12-03');
    await m.getByLabel('Quantidade de semanas').fill('1');
    await m.getByLabel('Semana 1: início').fill('2026-12-01');
    await m.getByLabel('Semana 1: fim').fill('2026-12-03');
    await m.getByRole('button', { name: 'Salvar' }).dblclick();
    await S.page.waitForTimeout(2500);
    const novos = await prisma.cicloUmTerco.findMany({ where: { id: { notIn: idsAntes } } });
    r('01', 'Secretaria dá clique duplo em "Salvar" do novo ciclo', '1 ciclo criado, nenhum erro 5xx', `${novos.length} ciclo(s) novo(s); erros: ${S.erros.filter(e => /HTTP 5/.test(e)).length}`, novos.length === 1 && !S.erros.some(e => /HTTP 5/.test(e)));
  }
} finally {
  const novos = (await prisma.cicloUmTerco.findMany({ where: { id: { notIn: idsAntes } }, select: { id: true } })).map(c => c.id);
  for (const id of novos) {
    await prisma.entregaUmTerco.deleteMany({ where: { cicloId: id } });
    await prisma.cicloUmTerco.delete({ where: { id } }).catch(async () => { await prisma.cicloUmTerco.update({ where: { id }, data: { status: 'INATIVA' } }); });
  }
  errosTodos.push(...S.erros);
  await S.browser.close();
}

// ===== 2. Professor: recarregar, voltar, fechar a aba =====
const A = await abrir();
await login(A.page, 'p01@homolog.nexo', SENHA);
await ir(A.page, ROTA);
const temCampo = await ta(A.page).count();
r('02', 'Professor abre a folha do Cargo 1 pelo endereço direto', 'campo da semana editável', temCampo ? 'campo visível' : 'campo ausente', temCampo > 0);

// 2a. Salva e recarrega.
await ta(A.page).fill('NAV-02a semana 1: frações equivalentes (salvo).');
await A.page.getByRole('button', { name: 'Salvar progresso' }).click();
await A.page.waitForTimeout(1500);
await A.page.reload(); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(1200);
const aposReload = await ta(A.page).inputValue();
r('03', 'Salvar progresso e recarregar a página (F5)', 'texto continua na tela e no banco', `tela: "${aposReload}" | banco: "${await textoNoBanco(1)}"`, aposReload.includes('NAV-02a') && (await textoNoBanco(1)).includes('NAV-02a'));

// 2b. Digita SEM salvar e recarrega na hora: o rascunho local precisa voltar.
await ta(A.page).fill('NAV-02b semana 1: digitado e recarregado sem clicar em salvar.');
await A.page.waitForTimeout(300);
await A.page.reload(); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(1500);
const rascunho = await ta(A.page).inputValue();
await A.page.waitForTimeout(3000);
r('04', 'Digitar e recarregar SEM clicar em salvar', 'o texto digitado não se perde (rascunho local ou salvamento automático)', `tela: "${rascunho}" | banco: "${await textoNoBanco(1)}"`, rascunho.includes('NAV-02b'));

// 2c. Voltar do navegador e avançar de novo.
await ta(A.page).fill('NAV-02c semana 1: antes de usar o botão Voltar do navegador.');
await A.page.waitForTimeout(300);
await A.page.goBack(); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(1000);
await A.page.goForward(); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(1500);
const aposVoltar = await ta(A.page).inputValue().catch(() => '(sem campo)');
r('05', 'Digitar, usar Voltar do navegador e depois Avançar', 'texto continua', `tela: "${aposVoltar}"`, aposVoltar.includes('NAV-02c'));

// 2d. Fecha a aba logo depois de digitar e abre outra (mesmo navegador).
await ta(A.page).fill('NAV-02d semana 1: aba fechada logo depois de digitar.');
await A.page.waitForTimeout(300);
await A.page.close({ runBeforeUnload: true });
const p2 = await A.contexto.newPage();
p2.on('console', m => { if (m.type() === 'error') A.erros.push(m.text()); });
await ir(p2, ROTA);
const aposFechar = await ta(p2).inputValue();
r('06', 'Digitar, fechar a aba e abrir de novo no mesmo navegador', 'texto continua', `tela: "${aposFechar}" | banco: "${await textoNoBanco(1)}"`, aposFechar.includes('NAV-02d'));
await p2.getByRole('button', { name: 'Salvar progresso' }).click().catch(() => {});
await p2.waitForTimeout(1500);

// ===== 3. Duas abas: a segunda grava por cima de uma versão antiga =====
const abaB = await A.contexto.newPage();
await ir(abaB, ROTA);
await ta(p2).fill('NAV-03 aba A: versão gravada primeiro.');
await p2.getByRole('button', { name: 'Salvar progresso' }).click();
await p2.waitForTimeout(1500);
await ta(abaB).fill('NAV-03 aba B: versão antiga tentando gravar depois.');
await abaB.getByRole('button', { name: 'Salvar progresso' }).click();
await abaB.waitForTimeout(2500);
const aviso = await abaB.getByText('Este formulário foi alterado em outra aba ou dispositivo').isVisible().catch(() => false);
const bancoConf = await textoNoBanco(1);
r('07', 'Duas abas da mesma folha: a aba B salva depois da aba A, partindo da versão antiga', 'aviso de conflito na aba B; banco fica com a versão da aba A', `aviso: ${aviso} | banco: "${bancoConf}"`, aviso && bancoConf.includes('aba A'));
await foto(abaB, '67-conflito-duas-abas');
if (aviso) {
  await abaB.getByRole('button', { name: 'Manter o meu texto' }).click();
  await abaB.waitForTimeout(500);
  await abaB.getByRole('button', { name: 'Salvar progresso' }).click().catch(() => {});
  await abaB.waitForTimeout(2000);
  const depois = await textoNoBanco(1);
  r('08', 'Na aba B, escolher "Manter o meu texto" e salvar', 'banco fica com o texto da aba B', `banco: "${depois}"`, depois.includes('aba B'));
}

// ===== 4. Clique duplo em "Concluir" =====
for (let n = 1; n <= 4; n++) {
  const aba = abaB;
  const tab = aba.getByRole('tab').nth(n - 1);
  if (await tab.count()) { await tab.click(); await aba.waitForTimeout(400); }
  if (await ta(aba).isEditable().catch(() => false)) await ta(aba).fill(`NAV-04 semana ${n}: conteúdo preenchido para concluir.`);
}
const historicoAntes = await prisma.entregaUmTerco.findFirst({ where: { cicloId: CICLO, cargos: { some: { cargoId: C1 } } }, select: { id: true, status: true } });
const concluir = abaB.getByRole('button', { name: /^Concluir$/ });
await concluir.dblclick().catch(() => {});
await abaB.waitForTimeout(1500);
const confirmar = abaB.locator('div.fixed.inset-0').getByRole('button', { name: /Concluir/ });
if (await confirmar.count()) { await confirmar.last().dblclick().catch(() => {}); await abaB.waitForTimeout(2500); }
const folha = await prisma.entregaUmTerco.findMany({ where: { cicloId: CICLO, cargos: { some: { cargoId: C1 } } }, select: { id: true, status: true } });
const erros5xx = [...A.erros].filter(e => /HTTP 5/.test(e));
r('09', 'Clique duplo em "Concluir" da folha', '1 folha só, CONCLUÍDA, sem erro 5xx', `folhas: ${JSON.stringify(folha)} (antes: ${JSON.stringify(historicoAntes)}); 5xx: ${erros5xx.length}; url: ${abaB.url().split('#')[1]}`, folha.length === 1 && /CONCLU/.test(folha[0].status) && !erros5xx.length);
errosTodos.push(...A.erros);
await A.browser.close();

// ===== 5. Relógio do navegador errado =====
await resetarFolhas('p01', CICLO);
for (const [id, quando, desc] of [['10', '2027-03-10T12:00:00-03:00', 'adiantado (10/03/2027, depois do prazo)'], ['11', '2026-10-01T12:00:00-03:00', 'atrasado (01/10/2026, antes da abertura)']]) {
  const B = await abrir();
  await B.page.clock.install({ time: new Date(quando) });
  await login(B.page, 'p01@homolog.nexo', SENHA);
  await ir(B.page, ROTA);
  const editavel = await ta(B.page).isEditable().catch(() => false);
  let gravou = false;
  if (editavel) {
    await ta(B.page).fill(`NAV-${id} relógio ${desc}.`);
    await B.page.getByRole('button', { name: 'Salvar progresso' }).click().catch(() => {});
    await B.page.waitForTimeout(2000);
    gravou = (await textoNoBanco(1)).includes(`NAV-${id}`);
  }
  const somenteLeitura = await B.page.getByText('Somente leitura').isVisible().catch(() => false);
  r(id, `Relógio do computador ${desc}; servidor em 15/11/2026, ciclo aberto`, 'folha editável e salva (vale a hora do servidor)', `editável: ${editavel}; "Somente leitura" na tela: ${somenteLeitura}; gravou no banco: ${gravou}`, editavel && gravou && !somenteLeitura);
  errosTodos.push(...B.erros);
  await B.browser.close();
}

// ===== 6. Celular 390 px: lista e folha do professor; painel da Secretaria =====
{
  const M = await abrir({ viewport: { width: 390, height: 844 } });
  await login(M.page, 'p01@homolog.nexo', SENHA);
  await ir(M.page, '/formulario-um-terco');
  const lista = await semRolagemLateral(M.page);
  await ir(M.page, ROTA);
  const folhaOk = await semRolagemLateral(M.page);
  const botaoVisivel = (await M.page.getByRole('button', { name: 'Voltar' }).last().isVisible().catch(() => false)) && (await M.page.getByRole('button', { name: 'Próximo' }).isVisible().catch(() => false));
  await foto(M.page, '67-folha-celular');
  r('12', 'Celular 390 px (Professor): lista do 1/3 e folha', 'sem rolagem lateral; botões visíveis', `lista sem rolagem: ${lista}; folha sem rolagem: ${folhaOk}; Voltar e Próximo visíveis: ${botaoVisivel}`, lista && folhaOk && botaoVisivel);
  errosTodos.push(...M.erros);
  await M.browser.close();
  const MS = await abrir({ viewport: { width: 390, height: 844 } });
  await login(MS.page, 'secretaria@escola.gov.br', '12345678');
  await ir(MS.page, '/formulario-um-terco');
  const home = await semRolagemLateral(MS.page);
  await ir(MS.page, `/formulario-um-terco/ciclos/${CICLO}`);
  const painel = await semRolagemLateral(MS.page);
  await ir(MS.page, '/correcoes/um-terco');
  const corr = await semRolagemLateral(MS.page);
  await foto(MS.page, '67-painel-secretaria-celular');
  r('13', 'Celular 390 px (Secretaria): ciclos, painel do ciclo e correções do 1/3', 'sem rolagem lateral', `ciclos: ${home}; painel: ${painel}; correções: ${corr}`, home && painel && corr);
  errosTodos.push(...MS.erros);
  await MS.browser.close();
}

const relevantes = errosTodos.filter(e => !/Failed to load resource.*(409|401)/.test(e));
r('14', 'Console do navegador em todo o roteiro', 'nenhum erro de página nem 5xx', relevantes.slice(0, 4).join(' | ') || 'nenhum', !relevantes.some(e => /PAGEERROR|HTTP 5/.test(e)));
await resetarFolhas('p01', CICLO);
await prisma.$disconnect();
