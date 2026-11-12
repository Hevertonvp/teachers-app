// DEF-01 (troca rápida de semana com rede lenta) e DEF-06/13 (aviso offline cobrindo botões).
// Uso: node 35-def01-def06-ui.mjs antes|depois. Chromium real; rede lenta = atraso de 2,5 s nas
// gravações do 1/3 (page.route); offline = setOffline. Banco LOCAL.
// 1/3 POR CARGO (12/11/2026): DEF-01 na folha do Cargo 1 do P04; DEF-06 na folha do Cargo 2.
import { abrir, login, foto, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { readFileSync } from 'node:fs';
const PDI_LIGADO = /MODO_PDI = 'ativo'/.test(readFileSync(new URL('../src/config/modulos.js', import.meta.url), 'utf8'));
import { cargosDe, folhaDoCargo, prepararCargosHomolog } from './cargos-homolog.mjs';
await prepararCargosHomolog();
const [C1, C2] = await cargosDe('p04');
const FASE = (process.argv[2] || 'depois').toUpperCase();
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const SENHA = 'Nexo!Prof04-2026';
const r = (id, mod, cen, esp, obs, ok, evid = '') => registrar(`${id}-${FASE}`, mod, cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const semanas = async () => Object.fromEntries(((await folhaDoCargo(C1))?.respostas ?? []).map(x => [x.semana.numero, x.texto]));
const lento = async (page) => page.route('**/api/formulario-um-terco/**/respostas', async route => { await new Promise(res => setTimeout(res, 2500)); await route.continue(); });
// O botão está realmente acessível? (nenhum outro elemento por cima do centro dele)
const livre = (loc) => loc.evaluate((el) => { const b = el.getBoundingClientRect(); const topo = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!topo && (topo === el || el.contains(topo)); });

// ===== DEF-01a — digitar logo depois de "Próximo" com rede lenta =====
{
  const X = await abrir();
  await login(X.page, 'p04@homolog.nexo', SENHA);
  await abrirCartao(X.page, /^Cargo 1$/);
  const ta = X.page.locator('#conteudos-semana');
  await X.page.getByRole('tab', { name: 'Semana 1' }).click(); await X.page.waitForTimeout(800);
  await ta.fill(`SEMANA-UM ${TAG}`);
  await lento(X.page);
  await X.page.getByRole('button', { name: 'Próximo' }).click();
  await X.page.waitForTimeout(300);
  const titulo300 = await X.page.locator('h2.text-2xl').first().innerText();
  await ta.pressSequentially(` SEMANA-DOIS-DIGITADA-APOS-PROXIMO ${TAG}`, { delay: 10 });
  await foto(X.page, `35-${FASE}-def01-durante`);
  await X.page.waitForTimeout(12000);
  await X.page.unroute('**/api/formulario-um-terco/**/respostas');
  await X.page.waitForTimeout(4000);
  const b = await semanas();
  r('DEF01-a', 'Formulário 1/3 (DEF-01)', 'Rede lenta: depois de "Próximo", o texto digitado vai para a semana 2 e a semana 1 fica intacta', 'tela na Semana 2 em 300 ms; banco: S1 sem o texto; S2 com o texto', `tela aos 300 ms: ${titulo300}; S1: "${(b[1] || '').slice(0, 40)}"; S2: "${(b[2] || '').slice(0, 50)}"`, titulo300.includes('Semana 2') && (b[1] || '').includes(`SEMANA-UM ${TAG}`) && !(b[1] || '').includes('DIGITADA') && (b[2] || '').includes(`SEMANA-DOIS-DIGITADA-APOS-PROXIMO ${TAG}`), `35-${FASE}-def01-durante.png`);

  // ===== DEF-01b — digitar DURANTE um salvamento em andamento (nada pode se perder) =====
  await lento(X.page);
  await X.page.getByRole('tab', { name: 'Semana 3' }).click(); await X.page.waitForTimeout(600);
  await ta.fill(`TERCEIRA-PARTE-1 ${TAG}`);
  await X.page.getByRole('button', { name: 'Salvar progresso' }).click();
  await X.page.waitForTimeout(500);
  await ta.pressSequentially(` TERCEIRA-PARTE-2 ${TAG}`, { delay: 10 }); // enquanto o envio anterior está no ar
  await X.page.waitForTimeout(14000);
  await X.page.unroute('**/api/formulario-um-terco/**/respostas');
  await X.page.waitForTimeout(4000);
  const c = await semanas();
  r('DEF01-b', 'Formulário 1/3 (DEF-01)', 'Rede lenta: o que é digitado DURANTE um salvamento também chega ao servidor (não é perdido nem marcado como salvo antes da hora)', 'S3 com as duas partes', `S3: "${(c[3] || '').slice(0, 70)}"`, (c[3] || '').includes(`TERCEIRA-PARTE-1 ${TAG}`) && (c[3] || '').includes(`TERCEIRA-PARTE-2 ${TAG}`));

  // ===== DEF-01c — "Sair" logo depois de digitar, com rede lenta: só sai depois de salvar tudo =====
  await lento(X.page);
  await X.page.getByRole('tab', { name: 'Semana 4' }).click(); await X.page.waitForTimeout(600);
  await ta.fill(`QUARTA ${TAG}`);
  await X.page.getByRole('tab', { name: 'Semana 1' }).click(); // dispara envio em segundo plano
  await X.page.locator('div.fixed.inset-x-0.bottom-0.z-30').getByRole('button', { name: 'Sair' }).click(); // o Sair da barra do formulário (não o do cabeçalho)
  await X.page.waitForURL(/formulario-um-terco$/, { timeout: 20000 }).catch(() => {});
  await X.page.unroute('**/api/formulario-um-terco/**/respostas');
  const d = await semanas();
  r('DEF01-c', 'Formulário 1/3 (DEF-01)', 'Rede lenta: "Sair" logo depois de trocar de semana espera o envio em andamento e não perde a semana 4', 'S4 no banco ao sair', `rota: ${X.page.url().split('#')[1]}; S4: "${(d[4] || '').slice(0, 30)}"`, (d[4] || '').includes(`QUARTA ${TAG}`));
  await X.browser.close();
}

// ===== DEF-06 (1/3) e DEF-13 (PDI) — aviso offline não cobre botões, desktop e celular =====
for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  await login(X.page, 'p04@homolog.nexo', SENHA);
  await abrirCartao(X.page, /^Cargo 2$/);
  await X.contexto.setOffline(true);
  await X.page.locator('#conteudos-semana').fill(`offline ${nome} ${TAG}`);
  await X.page.waitForTimeout(6000);
  const aviso = await X.page.getByText(/Sem conexão com a internet/).count();
  const proximoLivre = await livre(X.page.getByRole('button', { name: 'Próximo' }));
  const salvarLivre = await livre(X.page.getByRole('button', { name: 'Salvar progresso' }));
  await foto(X.page, `35-${FASE}-def06-${nome}`);
  r(`DEF06-${nome}`, 'Offline (DEF-06)', `1/3 sem rede (${nome}): aviso visível e "Próximo"/"Salvar progresso" não ficam cobertos`, 'aviso visível; botões livres', `aviso: ${aviso > 0}; Próximo livre: ${proximoLivre}; Salvar progresso livre: ${salvarLivre}`, aviso > 0 && proximoLivre && salvarLivre, `35-${FASE}-def06-${nome}.png`);
  await X.contexto.setOffline(false); await X.page.waitForTimeout(500);

  if (!PDI_LIGADO) { registrar(`DEF13-${nome}-${FASE}`, 'Offline (DEF-13)', `PDI sem rede (${nome})`, 'só com o PDI ligado', 'pulado: PDI em desenvolvimento', 'OBSERVAÇÃO (regra não especificada)'); await X.browser.close(); continue; }
  await X.page.goto(`${BASE}/#/pdi/aluno/1/4`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
  await X.contexto.setOffline(true);
  await X.page.locator('main textarea').nth(1).fill(`PDI offline ${nome} ${TAG}`);
  // força o aviso global (uma chamada que falha por rede) e vai até o fim da página
  await X.page.evaluate(() => fetch('/api/health').catch(() => {}));
  await X.page.getByRole('button', { name: 'Salvar', exact: true }).focus(); await X.page.keyboard.press('Tab'); await X.page.keyboard.press('Shift+Tab'); // não clica: só foca
  await X.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await X.page.waitForTimeout(6000);
  const salvarPdi = X.page.getByRole('button', { name: 'Salvar', exact: true });
  await salvarPdi.scrollIntoViewIfNeeded();
  await X.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await X.page.waitForTimeout(800);
  const pdiLivre = await livre(salvarPdi);
  await foto(X.page, `35-${FASE}-def13-${nome}`);
  r(`DEF13-${nome}`, 'Offline (DEF-13)', `PDI sem rede (${nome}), página rolada até o fim: botão "Salvar" não fica coberto pelo aviso`, 'Salvar livre', `Salvar livre: ${pdiLivre}`, pdiLivre, `35-${FASE}-def13-${nome}.png`);
  await X.browser.close();
}
console.log('fim', FASE, TAG);
await prisma.$disconnect();
