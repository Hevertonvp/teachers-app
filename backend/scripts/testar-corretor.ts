import { chromium } from 'playwright';
import { prisma } from '../src/lib/prisma.js';

const BASE = 'http://localhost:3333';
const FRONT = 'https://localhost:5173';

async function login(email: string, senha = '123456') {
  const resp = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) });
  return (await resp.json()).token as string;
}

async function main() {
  const tokenSecretaria = await login('secretaria@escola.gov.br');
  const ingles = await prisma.disciplina.findFirstOrThrow({ where: { nome: 'Inglês' } });
  const modeloIngles = await prisma.modeloPdi.findFirstOrThrow({ where: { disciplinaId: ingles.id, status: 'ATIVA' } });
  const hoje = new Date().toISOString().slice(0, 10);
  const fim = new Date(); fim.setDate(fim.getDate() + 5);

  const criar = await fetch(`${BASE}/api/pdi-aplicacoes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSecretaria}` },
    body: JSON.stringify({ escolaId: 38, nome: 'Teste corretor criado_por_ia', dataInicio: hoje, dataFim: fim.toISOString().slice(0, 10), modeloIds: [modeloIngles.id] }),
  });
  const aplicacao = await criar.json();
  console.log('aplicação criada:', aplicacao.id);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, ignoreHTTPSErrors: true });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  page.on('console', (msg) => console.log(`[console ${msg.type()}]`, msg.text()));
  page.on('requestfailed', (req) => console.log('[request falhou]', req.url(), req.failure()?.errorText));
  page.on('response', (resp) => { if (resp.url().includes('dictionaries')) console.log('[resposta dicionário]', resp.url(), resp.status()); });

  await page.goto(`${FRONT}/#/login`);
  await page.getByPlaceholder('seu.email@escola.gov.br').fill('prof.b.ia@teste.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForTimeout(2000);

  const urlFicha = `${FRONT}/#/pdi/fichas/${aplicacao.id}/${ingles.id}/33`;
  const inicio = Date.now();
  await page.goto(urlFicha);
  await page.locator('[role="radiogroup"]').first().waitFor({ state: 'visible', timeout: 60000 });
  console.log(`ficha carregou em ${Date.now() - inicio}ms`);

  // dá um tempo pro corretor pré-carregar em paralelo (~5MB)
  await page.waitForTimeout(500);

  const textarea = page.locator('textarea').first();
  await textarea.scrollIntoViewIfNeeded();

  console.log('\n--- digitando um erro de digitação proposital ("desenvolvimento" -> "desemvolvimento") ---');
  await textarea.fill('O aluno apresentou bom desemvolvimento na atividade de leitura.');
  const tInicioBlur = Date.now();
  await textarea.blur();

  // espera a sugestão aparecer (até o dicionário carregar + checar, pode levar alguns segundos
  // na primeira vez por causa do ~5MB sendo baixado e parseado)
  const sugestaoLocator = page.locator('text=Possível erro de digitação');
  try {
    await sugestaoLocator.waitFor({ state: 'visible', timeout: 20000 });
    console.log(`[OK] sugestão apareceu em ${Date.now() - tInicioBlur}ms após sair do campo`);
  } catch {
    console.log('[FALHA] nenhuma sugestão apareceu em 20s');
  }

  const textoChips = await page.locator('body').innerText();
  const idx = textoChips.indexOf('Possível erro de digitação');
  console.log('trecho da UI de sugestão:', idx >= 0 ? JSON.stringify(textoChips.slice(idx, idx + 200)) : '(não encontrado)');

  await page.screenshot({ path: 'corretor-sugestao.png', fullPage: false });

  console.log('\n--- clicando na primeira sugestão ---');
  const primeiroChip = page.locator('span', { hasText: 'desemvolvimento' }).locator('button').first();
  const existeChip = await primeiroChip.count();
  if (existeChip > 0) {
    const textoSugestao = await primeiroChip.textContent();
    await primeiroChip.click();
    await page.waitForTimeout(500);
    const valorFinal = await textarea.inputValue();
    console.log('sugestão clicada:', textoSugestao);
    console.log('texto final do campo:', valorFinal);
    console.log(`[${valorFinal.includes('desemvolvimento') ? 'FALHA — ainda contém o erro' : 'OK — erro foi substituído'}]`);
    const sugestaoSumiu = await sugestaoLocator.count();
    console.log(`[${sugestaoSumiu === 0 ? 'OK — aviso sumiu depois de corrigido' : 'FALHA — aviso continua aparecendo'}]`);
  } else {
    console.log('[FALHA] não achei o botão de sugestão pra clicar');
  }

  await browser.close();

  await prisma.respostaPdi.deleteMany({ where: { ficha: { aplicacaoId: aplicacao.id } } });
  await prisma.fichaPdi.deleteMany({ where: { aplicacaoId: aplicacao.id } });
  await prisma.aplicacaoPerguntaPdi.deleteMany({ where: { aplicacaoModelo: { aplicacaoId: aplicacao.id } } });
  await prisma.aplicacaoModeloPdi.deleteMany({ where: { aplicacaoId: aplicacao.id } });
  await prisma.aplicacaoPdi.delete({ where: { id: aplicacao.id } });
  await prisma.$disconnect();
  console.log('\nresíduo removido.');
}
main().catch((e) => { console.error(e); process.exit(1); });
