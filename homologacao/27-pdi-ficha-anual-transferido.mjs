// PDI — o CONTEÚDO das fichas da escola anterior é legível pela Ficha Anual? (Secretaria e professor da nova escola)
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const MARINA = 2;
const txt = async (page) => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
// Trechos reais gravados nas fichas da Aurora (Inglês da P04; Arte alterada pelo P10).
const trechos = ['Conteúdo ainda não consolidado em Inglês', 'P10 ALTEROU a ficha de Arte'];

for (const [quem, email, senha, id] of [['Secretaria', 'secretaria@escola.gov.br', '123456', 'PDI-TRF-E8'], ['P04 (professora da nova escola)', 'p04@homolog.nexo', 'Nexo!Prof04-2026', 'PDI-TRF-E9']]) {
  const X = await abrir();
  await login(X.page, email, senha);
  await X.page.goto(`${BASE}/#/pdi/alunos/${MARINA}/ficha-anual`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
  const lista = await txt(X.page);
  for (const disc of ['Inglês', 'Arte']) {
    const item = X.page.locator('main').getByText(disc, { exact: true }).first();
    if (await item.count()) { await item.click().catch(() => {}); await X.page.waitForTimeout(1500); }
  }
  const tela = await txt(X.page);
  const arq = `27-ficha-anual-${quem.startsWith('Sec') ? 'secretaria' : 'p04'}`;
  await foto(X.page, arq);
  const visiveis = trechos.filter(t => tela.includes(t));
  registrar(id, 'PDI transferência', `${quem} abre a Ficha Anual da Marina (transferida) e tenta ler o conteúdo das fichas feitas na Aurora`, 'registrar', `lista mostra Aurora: ${lista.includes('Aurora')}; conteúdo legível: ${visiveis.length ? visiveis.join(' | ') : 'nenhum trecho'}; rota: ${X.page.url().split('#')[1]}`, 'OBSERVAÇÃO (regra não especificada)', arq + '.png');
  await X.browser.close();
}
const ap = await prisma.aplicacaoPdi.findUnique({ where: { id: 1 } });
registrar('PDI-TRF-E10', 'PDI transferência', 'Datas da Aplicação na Ficha Anual batem com o cadastro (04/11/2026 a 15/12/2026)', '04/11/2026 a 15/12/2026', `banco: ${ap.dataInicio.toISOString().slice(0, 10)} a ${ap.dataFim.toISOString().slice(0, 10)}; tela: 03/11/2026 a 14/12/2026 (captura 26-sec-ficha-anual-marina.png)`, 'REPROVADO', '26-sec-ficha-anual-marina.png', 'Datas exibidas um dia antes (provável conversão de data UTC para o fuso local na tela).');
await prisma.$disconnect();
