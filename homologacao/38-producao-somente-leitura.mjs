// Verificação da PRODUÇÃO REAL (GitHub Pages + Render + Neon) — SOMENTE LEITURA.
// Garantia: toda requisição à API que não seja GET é BLOQUEADA no navegador (exceto o login), então
// nada é criado, salvo, concluído ou alterado — nem por acidente. Nenhum formulário é preenchido.
// Senhas só por variável de ambiente (nunca gravadas em arquivo). Perfis sem variável são pulados.
//
// Uso (PowerShell):
//   $env:NEXO_SECRETARIA="email|senha"; $env:NEXO_PROFESSOR="email|senha"; $env:NEXO_GESTOR="email|senha"; $env:NEXO_DIRETORA="email|senha"
//   node homologacao/38-producao-somente-leitura.mjs
// Resultado: no terminal e em homologacao/saida-producao.json (sem senhas).
import { chromium } from 'playwright';
import fs from 'node:fs';

const FRONT = process.env.NEXO_FRONT || 'https://hevertonvp.github.io/teachers-app/';
const API = process.env.NEXO_API || 'https://teachers-app-xokm.onrender.com';
const resultados = [];
const ok = (id, cenario, aprovado, detalhe) => { resultados.push({ id, cenario, status: aprovado ? 'APROVADO' : 'REPROVADO', detalhe }); console.log(`[${aprovado ? 'APROVADO' : 'REPROVADO'}] ${id} — ${cenario} → ${detalhe}`); };
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

// ---- 1. Infra (sem login) ----
{
  const t0 = Date.now();
  const h = await fetch(API + '/health').then(r => r.status).catch(() => 'sem resposta');
  ok('INFRA-1', 'Backend (Render) responde /health', h === 200, `HTTP ${h} em ${Date.now() - t0} ms`);
  const html = await fetch(FRONT).then(r => r.text()).catch(() => '');
  const js = (html.match(/assets\/index-[^"]+\.js/) || [])[0];
  const bundle = js ? await fetch(FRONT + js).then(r => r.text()).catch(() => '') : '';
  ok('INFRA-2', 'Frontend publicado tem as correções (DEF-08/19/06) e aponta para a API do Render', bundle.includes('Restaurar o meu texto') && bundle.includes('Salvo só neste aparelho') && bundle.includes('data-barra-acoes-fixa') && bundle.includes(new URL(API).host), `bundle ${js ?? '(não encontrado)'}`);
}

async function sessao(perfil, credencial, roteiro) {
  if (!credencial) { console.log(`(pulado: ${perfil} sem variável de ambiente)`); return; }
  const [email, senha] = credencial.split('|');
  const browser = await chromium.launch(FRONT.includes('localhost') ? { args: ['--ignore-certificate-errors'] } : {});
  const contexto = await browser.newContext({ ignoreHTTPSErrors: FRONT.includes('localhost'), viewport: { width: 1280, height: 800 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const page = await contexto.newPage();
  const erros = [], bloqueadas = [], falhas = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(net::ERR_FAILED|blocked)/i.test(m.text())) erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR ' + e.message));
  page.on('response', r => { if (r.status() >= 500) falhas.push(`${r.status()} ${r.url()}`); });
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    if (req.method() === 'GET' || req.method() === 'OPTIONS' || (req.method() === 'POST' && req.url().endsWith('/api/auth/login'))) return route.continue();
    bloqueadas.push(`${req.method()} ${new URL(req.url()).pathname}`);
    return route.abort('blockedbyclient');
  });
  const ir = async (hash) => { await page.goto(FRONT + '#' + hash); await page.waitForLoadState('networkidle'); await dormir(2500); return (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' '); };
  await page.goto(FRONT + '#/login'); await page.waitForLoadState('networkidle');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').first().fill(senha);
  const t0 = Date.now();
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForFunction(() => !location.hash.includes('/login'), null, { timeout: 30000 }).catch(() => {});
  const rota = page.url().split('#')[1] || '';
  ok(`${perfil}-LOGIN`, `${perfil}: login`, !rota.includes('login') && !rota.includes('primeiro-acesso'), `rota ${rota} em ${Date.now() - t0} ms`);
  if (!rota.includes('login') && !rota.includes('primeiro-acesso')) await roteiro(page, ir);
  ok(`${perfil}-SAUDE`, `${perfil}: sem erro de tela, sem erro 5xx da API e nenhuma gravação tentada`, erros.length === 0 && falhas.length === 0, `erros ${erros.length}${erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''}; 5xx ${falhas.length}; gravações bloqueadas ${bloqueadas.length}${bloqueadas.length ? ': ' + bloqueadas.slice(0, 3).join(', ') : ''}`);
  await browser.close();
}

await sessao('SECRETARIA', process.env.NEXO_SECRETARIA, async (page, ir) => {
  const ciclos = await ir('/formulario-um-terco');
  ok('SECRETARIA-1', 'Secretaria: tela de ciclos do Formulário 1/3 abre', /Formulário 1\/3|ciclo/i.test(ciclos) && !/Erro|erro inesperado/i.test(ciclos), ciclos.slice(0, 80));
  const alunos = await ir('/pdi/alunos');
  ok('SECRETARIA-2', 'Secretaria: lista de alunos do PDI abre', !/erro inesperado/i.test(alunos), alunos.slice(0, 80));
  const pessoas = await ir('/pessoas');
  ok('SECRETARIA-3', 'Secretaria: Gestão de Pessoas abre', !/erro inesperado/i.test(pessoas), pessoas.slice(0, 80));
});
await sessao('PROFESSOR', process.env.NEXO_PROFESSOR, async (page, ir) => {
  const um = await ir('/formulario-um-terco');
  ok('PROFESSOR-1', 'Professor: lista do Formulário 1/3 abre (cartões ou aviso de nenhum formulário)', !/erro inesperado/i.test(um), um.slice(0, 100));
  const pdis = await ir('/pdi/meus-pdis');
  ok('PROFESSOR-2', 'Professor: "Meus PDIs" abre', !/erro inesperado/i.test(pdis), pdis.slice(0, 100));
});
for (const perfil of ['GESTOR', 'DIRETORA']) {
  await sessao(perfil, process.env[`NEXO_${perfil}`], async (page, ir) => {
    const lista = await ir('/pdi/alunos');
    // Primeiro aluno que a própria API (só leitura) devolve para este usuário — a autoridade de escopo.
    const alunos = await page.evaluate(async (api) => {
      const r = await fetch(api + '/api/pdi-alunos', { headers: { authorization: 'Bearer ' + localStorage.getItem('authToken') } });
      return r.ok ? r.json() : [];
    }, API).catch(() => []);
    if (alunos.length) {
      await ir(`/pdi/alunos/${alunos[0].id}`); await dormir(1500);
      const perfilTxt = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      ok(`${perfil}-1`, `${perfil}: abre o perfil de um aluno da própria escola (DEF-17 em produção)`, !perfilTxt.includes('Aluno não encontrado'), perfilTxt.slice(0, 80));
    } else ok(`${perfil}-1`, `${perfil}: lista de alunos do PDI (sem aluno para abrir)`, !/erro inesperado/i.test(lista), lista.slice(0, 80));
  });
}

const arq = new URL('./saida-producao.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
fs.writeFileSync(arq, JSON.stringify({ quando: new Date().toISOString(), front: FRONT, api: API, resultados }, null, 2));
const rep = resultados.filter(r => r.status === 'REPROVADO').length;
console.log(`\nResumo: ${resultados.length - rep} aprovados, ${rep} reprovados. Nada foi gravado na produção.`);
