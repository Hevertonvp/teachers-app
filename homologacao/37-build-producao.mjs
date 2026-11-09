// Verificação do BUILD DE PRODUÇÃO (vite build + vite preview), isolado: frontend em https://localhost:5181
// (pasta de build temporária, sem tocar no dist/ versionado) e backend de homologação na porta 3341,
// ambos apontando para o banco PostgreSQL LOCAL. Chromium real.
import { chromium } from 'playwright';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const BASE = 'https://localhost:5181';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const EVID = new URL('./evidencias/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`PROD-${id}`, 'Build de produção', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const dormir = (ms) => new Promise(res => setTimeout(res, ms));

async function abrir(viewport = { width: 1280, height: 800 }, storageState) {
  const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const contexto = await browser.newContext({ ignoreHTTPSErrors: true, viewport, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ...(storageState ? { storageState } : {}) });
  const page = await contexto.newPage();
  const erros = [], falhas = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR ' + e.message));
  page.on('response', resp => { if (resp.status() >= 400 && !resp.url().includes('/api/')) falhas.push(`${resp.status()} ${resp.url()}`); });
  return { browser, contexto, page, erros, falhas };
}
async function login(page, email, senha) {
  await page.goto(BASE + '/#/login'); await page.waitForLoadState('networkidle');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').first().fill(senha);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForFunction(() => !location.hash.includes('/login'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
}
const foto = (page, nome) => page.screenshot({ path: EVID + nome + '.png', fullPage: true });
const cartao = async (page, regex) => {
  await page.goto(BASE + '/#/formulario-um-terco'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  await page.locator('h2.text-xl', { hasText: regex }).first().locator('xpath=ancestor::div[contains(@class,"flex-col")][1]').getByRole('button').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
};
const s2 = async () => { const e = await prisma.entregaUmTerco.findFirst({ where: { cicloId: 1, professor: { email: 'p04@homolog.nexo' }, anoSerie: 6, disciplina: { nome: 'Arte' } }, include: { respostas: { include: { semana: true } } } }); return Object.fromEntries((e?.respostas ?? []).map(x => [x.semana.numero, x.texto])); };
const livre = (loc) => loc.evaluate((el) => { const b = el.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!t && (t === el || el.contains(t)); });

// 1) Carga, arquivos do build e Service Worker
const A = await abrir();
await login(A.page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
await dormir(2000);
const sw = await A.page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); return { registrado: !!reg, ativo: reg?.active?.state ?? null, controla: !!navigator.serviceWorker.controller, caches: await caches.keys() }; });
await A.page.reload(); await A.page.waitForLoadState('networkidle'); await dormir(1500);
const swDepois = await A.page.evaluate(() => !!navigator.serviceWorker.controller);
r('01', 'Build de produção carrega, faz login e não tem erro de console nem arquivo 404', 'fora do /login; 0 erros; 0 falhas de arquivo', `rota ${A.page.url().split('#')[1]}; erros ${A.erros.length}${A.erros.length ? ': ' + A.erros.slice(0, 2).join(' | ') : ''}; falhas ${A.falhas.length}${A.falhas.length ? ': ' + A.falhas.slice(0, 2).join(' | ') : ''}`, !A.page.url().includes('login') && A.erros.length === 0 && A.falhas.length === 0);
r('02', 'Service Worker registra, fica ativo e controla a página no build de produção', 'registrado, ativo, controla', `${JSON.stringify(sw)}; controla após recarregar: ${swDepois}`, sw.registrado && sw.ativo === 'activated' && swDepois);

// 2) Formulário 1/3: cartões e gravação online
await A.page.goto(BASE + '/#/formulario-um-terco'); await A.page.waitForLoadState('networkidle'); await dormir(1500);
const cartoes = await A.page.locator('h2.text-xl').count();
await cartao(A.page, /6º.*Arte/);
const ta = A.page.locator('#conteudos-semana');
await ta.fill(`PROD semana 1 ${TAG}`);
await A.page.getByRole('button', { name: 'Salvar progresso' }).click(); await dormir(2500);
const ind = (await A.page.locator('main').innerText()).match(/Sincronizado|Salvo só neste aparelho/)?.[0] ?? '(nenhum)';
const b1 = await s2();
r('03', 'Professor com vários vínculos vê 7 cartões e grava online (indicador "Sincronizado")', '7 cartões; S1 no banco; "Sincronizado"', `${cartoes} cartões; indicador: ${ind}; banco S1: "${(b1[1] || '').slice(0, 30)}"`, cartoes === 7 && ind === 'Sincronizado' && (b1[1] || '').includes(TAG));

// 3) Offline no build: indicador honesto, botões livres, fila enviada ao reabrir
await A.contexto.setOffline(true);
await A.page.getByRole('tab', { name: 'Semana 2' }).click(); await dormir(800);
await ta.fill(`PROD semana 2 OFFLINE ${TAG}`);
await dormir(6000);
const indOff = (await A.page.locator('main').innerText()).match(/Sincronizado|Salvo só neste aparelho/)?.[0] ?? '(nenhum)';
const proxLivre = await livre(A.page.getByRole('button', { name: 'Próximo' }));
await foto(A.page, '37-prod-offline');
r('04', 'Sem rede (build de produção): indicador "Salvo só neste aparelho" e "Próximo" não coberto pelo aviso', 'indicador honesto; botão livre', `indicador: ${indOff}; Próximo livre: ${proxLivre}`, indOff === 'Salvo só neste aparelho' && proxLivre, '37-prod-offline.png');
const storage = await A.contexto.storageState({ indexedDB: true });
await A.browser.close();
const B = await abrir(undefined, storage);
await B.page.goto(BASE + '/#/dashboard'); await B.page.waitForLoadState('networkidle');
let b2 = {}; for (let i = 0; i < 15; i++) { await dormir(1000); b2 = await s2(); if ((b2[2] || '').includes(TAG)) break; }
r('05', 'Build de produção: reabrir com internet envia sozinho a alteração feita offline (DEF-07)', 'S2 no banco em até 15 s', `banco S2: "${(b2[2] || '').slice(0, 40)}"`, (b2[2] || '').includes(TAG));
await B.browser.close();

// 4) Gestor abre o perfil do aluno (DEF-17) no build de produção
const G = await abrir();
await login(G.page, 'gestor.aur@homolog.nexo', 'Nexo!Homolog-2026');
await G.page.goto(BASE + '/#/pdi/alunos/4'); await G.page.waitForLoadState('networkidle'); await dormir(3000);
const perfil = (await G.page.locator('main').innerText()).replace(/\s+/g, ' ');
await foto(G.page, '37-prod-gestor-perfil');
r('06', 'Build de produção: Gestor real abre o perfil de aluno da própria escola (DEF-17)', 'perfil da Larissa', `abriu: ${perfil.includes('Larissa') && !perfil.includes('Aluno não encontrado')}; erros de console: ${G.erros.length}`, perfil.includes('Larissa') && !perfil.includes('Aluno não encontrado'), '37-prod-gestor-perfil.png');
await G.browser.close();
await prisma.$disconnect();
