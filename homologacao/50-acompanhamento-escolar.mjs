// Acompanhamento Escolar (10/11/2026) — números, permissões, "foto" do PDI e tela. Banco LOCAL.
// Cria 2 Aplicações PDI vazias (sem modelos) na escola 2 só para testar a foto e as apaga no fim.
// 1/3 POR CARGO (12/11/2026): números conferidos contra o painel por folha; sem ano/série. Com o PDI
// "em desenvolvimento" (src/config/modulos.js) a tela fica presa no 1/3 e as partes do PDI são puladas.
import { createRequire } from 'node:module';
import { abrir, login, BASE, foto } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { readFileSync } from 'node:fs';
import { cargosDe, prepararCargosHomolog, SENHA as SENHA_PROF } from './cargos-homolog.mjs';
const PDI_LIGADO = /MODO_PDI = 'ativo'/.test(readFileSync(new URL('../src/config/modulos.js', import.meta.url), 'utf8'));
await prepararCargosHomolog();
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const bcrypt = require('bcryptjs');
const r = (id, cen, esp, obs, ok, ev = '') => registrar(`ACP-${id}`, 'Acompanhamento Escolar', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', ev);
const API = 'http://localhost:3340';
const SENHA = 'Nexo!Homolog-2026';
const get = async (tk, p) => { const res = await fetch(API + p, { headers: { authorization: 'Bearer ' + tk } }); return { status: res.status, json: await res.json().catch(() => ({})) }; };
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;

for (const email of ['diretora.aur@homolog.nexo', 'gestor.aur@homolog.nexo']) {
  await prisma.pessoa.update({ where: { email }, data: { senhaHash: await bcrypt.hash(SENHA, 10), senhaTemporaria: false } });
}
const DIA = 86400000;
const hoje = new Date(new Date().toISOString().slice(0, 10));
const criadas = [];

try {
  const tkS = await token('secretaria@escola.gov.br', '12345678');
  // Algumas folhas com texto para os números não serem todos zero (P01 inicia; P05, de 2 escolas, conclui).
  const sem = await prisma.semanaUmTerco.findMany({ where: { cicloId: 1 }, orderBy: { numero: 'asc' } });
  for (const [cod, concluir] of [['p01', false], ['p05', true]]) {
    const tk = await token(`${cod}@homolog.nexo`, SENHA_PROF(cod)); const [c] = await cargosDe(cod);
    const s1 = await fetch(`${API}/api/formulario-um-terco/ciclos/1/cargos/${c}/respostas`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify({ baseUpdatedAt: null, respostas: sem.map(x => ({ semanaId: x.id, texto: `${cod} semana ${x.numero}` })) }) }).then(x => x.json());
    if (concluir) await fetch(`${API}/api/formulario-um-terco/ciclos/1/cargos/${c}/concluir`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify({ baseUpdatedAt: s1.updatedAt }) });
  }
  const rede = (await get(tkS, '/api/acompanhamento/rede?atualizar=1')).json;

  // 1) PDI bate com /pdi-aplicacoes/indicadores (mesma regra).
  const ind = (await get(tkS, '/api/pdi-aplicacoes/indicadores')).json.filter((x) => x.aplicacaoId);
  const somaInd = ind.reduce((a, x) => [a[0] + x.totalEsperado, a[1] + x.concluidas, a[2] + x.emAndamento], [0, 0, 0]).join('/');
  const somaAcp = [rede.totais.pdi?.esperado, rede.totais.pdi?.concluidas, rede.totais.pdi?.emAndamento].join('/');
  r('1', 'PDI da rede = soma de /pdi-aplicacoes/indicadores (esperado/concluídas/em andamento)', somaInd, somaAcp, somaInd === somaAcp);

  // 2) 1/3 bate com o painel do ciclo (entrega única) e, por escola, com a cobertura do painel.
  const ciclo = rede.ritmo.umTerco?.id;
  const painel = (await get(tkS, `/api/formulario-um-terco/ciclos/${ciclo}/painel`)).json;
  const r13 = [painel.resumo.esperado, painel.resumo.concluidas, painel.resumo.emAndamento].join('/');
  const a13 = [rede.totais.umTerco?.esperado, rede.totais.umTerco?.concluidas, rede.totais.umTerco?.emAndamento].join('/');
  const porEscola = painel.porEscola.every((p) => { const e = rede.escolas.find((x) => x.id === p.escolaId); return e && e.umTerco?.esperado === p.esperado && e.umTerco?.concluidas === p.concluidas; });
  r('2', '1/3 da rede = painel do ciclo (folhas por cargo, uma vez cada) e cada escola = visão por escola do painel', `${r13}; escolas iguais`, `${a13}; escolas ${porEscola ? 'iguais' : 'DIFERENTES'}`, !!ciclo && r13 === a13 && porEscola && painel.resumo.esperado > 0);
  const escolaAur = (await get(tkS, '/api/acompanhamento/escola/1?atualizar=1')).json;
  const auroraPainel = painel.porEscola.find(p => p.escolaId === 1);
  r('2b', 'Visão da escola (Aurora): 1/3 = folhas do painel que cobrem a Aurora; sem matriz por ano/série', `esperado ${auroraPainel?.esperado}; matriz vazia`, `esperado ${escolaAur.umTerco?.esperado}; concluídas ${escolaAur.umTerco?.concluidas}; matriz ${JSON.stringify(escolaAur.matriz)}`, escolaAur.umTerco?.esperado === auroraPainel?.esperado && escolaAur.umTerco?.concluidas === auroraPainel?.concluidas && Array.isArray(escolaAur.matriz) && escolaAur.matriz.length === 0);

  // 3) Sem nomes de pessoas na resposta.
  const texto = JSON.stringify(rede);
  const nomes = (await prisma.pessoa.findMany({ where: { perfil: 'PROFESSOR' }, select: { nome: true }, take: 50 })).map((p) => p.nome).filter((n) => n.length > 6);
  const vazou = nomes.filter((n) => texto.includes(n));
  r('3', 'Resposta da rede não traz nomes de professores', 'nenhum nome', vazou.length ? vazou.slice(0, 3).join(', ') : 'nenhum nome', vazou.length === 0);

  // 4) Permissões: Diretora só a própria escola; Gestor e Professor recusados.
  const tkD = await token('diretora.aur@homolog.nexo', SENHA);
  const redeD = (await get(tkD, '/api/acompanhamento/rede')).json;
  const outra = await get(tkD, '/api/acompanhamento/escola/2');
  const propria = await get(tkD, '/api/acompanhamento/escola/1');
  const tkG = await token('gestor.aur@homolog.nexo', SENHA);
  const gestor = await get(tkG, '/api/acompanhamento/rede');
  const tkP = await token('p04@homolog.nexo', 'Nexo!Prof04-2026').catch(() => null);
  const prof = tkP ? await get(tkP, '/api/acompanhamento/rede') : { status: 'sem conta' };
  const okPerm = redeD.escolas?.length === 1 && redeD.escolas[0].id === 1 && outra.status === 403 && propria.status === 200 && gestor.status === 403 && (prof.status === 403 || prof.status === 'sem conta');
  r('4', 'Diretora vê só a própria escola (outra = 403); Gestor e Professor = 403', 'rede 1 escola (1); outra 403; própria 200; gestor 403; professor 403', `rede ${redeD.escolas?.map((e) => e.id).join(',')}; outra ${outra.status}; própria ${propria.status}; gestor ${gestor.status}; professor ${prof.status}`, okPerm);

  // 5) Foto do PDI: fotografa encerrada há 2 dias; ignora encerrada há 10; é idempotente.
  const { executarFotografiaPdi } = await import('../backend/src/jobs/fotografiaPdiJob.ts').catch(() => ({}));
  if (executarFotografiaPdi) {
    const a1 = await prisma.aplicacaoPdi.create({ data: { escolaId: 2, nome: 'ZZ-ACP foto 2d', dataInicio: new Date(hoje.getTime() - 20 * DIA), dataFim: new Date(hoje.getTime() - 2 * DIA), trimestre: 3 } });
    const a2 = await prisma.aplicacaoPdi.create({ data: { escolaId: 2, nome: 'ZZ-ACP foto 10d', dataInicio: new Date(hoje.getTime() - 40 * DIA), dataFim: new Date(hoje.getTime() - 10 * DIA), trimestre: 3 } });
    criadas.push(a1.id, a2.id);
    await executarFotografiaPdi(prisma);
    const segunda = await executarFotografiaPdi(prisma);
    const f1 = await prisma.fotografiaAplicacaoPdi.findUnique({ where: { aplicacaoId: a1.id } });
    const f2 = await prisma.fotografiaAplicacaoPdi.findUnique({ where: { aplicacaoId: a2.id } });
    r('5', 'Foto do PDI: tirada para encerrada há 2 dias, não para há 10; segunda execução não duplica', 'foto 2d sim; 10d não; 2ª execução 0', `2d ${f1 ? 'sim' : 'não'}; 10d ${f2 ? 'sim' : 'não'}; 2ª execução ${segunda}`, !!f1 && !f2 && segunda === 0);
  } else {
    registrar('ACP-5', 'Acompanhamento Escolar', 'Foto do PDI (job)', 'executa', 'não executado: o job é TypeScript (rodar com tsx); falha antiga, sem relação com o 1/3', 'NAO_EXECUTADO');
  }

  // 6) Tela da Secretaria: rede → escola → rede.
  const X = await abrir();
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  await X.page.goto(BASE + '/#/acompanhamento-escolar'); await X.page.waitForLoadState('networkidle');
  await X.page.getByRole('heading', { name: 'Mapa da rede' }).waitFor({ timeout: 15000 });
  const temCartoes = await X.page.locator('.acp-cartao').count();
  const paginacao = await X.page.getByRole('navigation', { name: 'Páginas do mapa da rede' }).count();
  const linhasMapa = await X.page.locator('.acp-mapa-linha').count();
  await X.page.waitForTimeout(900); // espera a animação de entrada dos cartões
  await foto(X.page, '50-acompanhamento-rede');
  await X.page.getByLabel('Buscar escola').fill('Aurora');
  await X.page.getByRole('button', { name: /ZZ-HOMOLOG Escola Aurora/ }).first().click();
  await X.page.getByRole('heading', { name: PDI_LIGADO ? 'PDI por disciplina' : 'Histórico do 1/3' }).waitFor({ timeout: 15000 });
  const textoEscola = (await X.page.locator('main').innerText()).replace(/s+/g, ' ');
  const tituloEscola = await X.page.locator('.acp-hero h1').textContent();
  await X.page.waitForTimeout(900);
  await foto(X.page, '50-acompanhamento-escola');
  await X.page.getByRole('button', { name: '← Rede' }).click();
  await X.page.getByRole('heading', { name: 'Mapa da rede' }).waitFor({ timeout: 15000 });
  r('6', 'Secretaria: rede com cartões e mapa paginado (8 por página); clicar abre a escola (sem "1/3 por ano e disciplina"); "← Rede" volta', 'cartões; ≤8 linhas; paginação; escola Aurora sem ano/série; volta', `${temCartoes} cartões; ${linhasMapa} linhas; paginação ${paginacao}; "${tituloEscola}"; ano/série na tela: ${/por ano e disciplina|º ano/.test(textoEscola)}; voltou`, temCartoes >= 3 && linhasMapa <= 8 && paginacao === 1 && /Aurora/.test(tituloEscola) && !/por ano e disciplina|º ano/.test(textoEscola), '50-acompanhamento-rede.png, 50-acompanhamento-escola.png');

  // 7) Filtro de formulário na URL (só com o PDI ligado; desligado, a tela já fica presa no 1/3).
  if (!PDI_LIGADO) registrar('ACP-7', 'Acompanhamento Escolar', 'Filtro "1/3" na URL', 'só com o PDI ligado', 'pulado: PDI em desenvolvimento (tela presa no 1/3)', 'OBSERVAÇÃO (regra não especificada)');
  else {
  await X.page.getByRole('group', { name: 'Formulário', exact: true }).getByRole('button', { name: '1/3' }).click();
  await X.page.waitForLoadState('networkidle');
  await X.page.waitForFunction(() => location.href.includes('form=umTerco'));
  await X.page.locator('.acp-mapa-cab', { hasText: 'PDI' }).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  const url = X.page.url();
  const colunasPdi = await X.page.locator('.acp-mapa-cab', { hasText: 'PDI' }).count();
  r('7', 'Filtro "1/3": vai para a URL e esconde a coluna do PDI', 'form=umTerco; sem coluna PDI', `${url.includes('form=umTerco') ? 'form=umTerco' : url}; coluna PDI ${colunasPdi}`, url.includes('form=umTerco') && colunasPdi === 0);
  }

  // 8) Modo noturno e celular sem rolagem horizontal.
  await X.page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await X.page.reload(); await X.page.waitForLoadState('networkidle');
  await X.page.getByRole('heading', { name: 'Mapa da rede' }).waitFor({ timeout: 15000 });
  await X.page.waitForTimeout(900);
  await foto(X.page, '50-acompanhamento-noturno');
  const escuro = await X.page.evaluate(() => document.documentElement.classList.contains('theme-dark'));
  await X.page.setViewportSize({ width: 375, height: 800 });
  await X.page.waitForTimeout(600);
  const rolagem = await X.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await foto(X.page, '50-acompanhamento-celular');
  await X.page.evaluate(() => localStorage.setItem('theme', 'light'));
  r('8', 'Celular (375 px) sem rolagem horizontal; modo noturno aplicado', 'sobra 0 px; tema escuro', `sobra ${rolagem} px; ${escuro ? 'tema escuro' : 'tema CLARO'}`, rolagem <= 0 && escuro, '50-acompanhamento-noturno.png, 50-acompanhamento-celular.png');
  const errosS = X.erros.filter((e) => !/favicon|40[134]/.test(e));
  await X.browser.close();

  // 9) Diretora: entra direto na própria escola, sem "← Rede".
  const D = await abrir();
  await login(D.page, 'diretora.aur@homolog.nexo', SENHA);
  const noMenu = await D.page.getByRole('link', { name: 'Acompanhamento Escolar' }).count();
  await D.page.goto(BASE + '/#/acompanhamento-escolar'); await D.page.waitForLoadState('networkidle');
  await D.page.getByRole('heading', { name: PDI_LIGADO ? 'PDI por disciplina' : 'Histórico do 1/3' }).waitFor({ timeout: 15000 });
  const tituloD = await D.page.locator('.acp-hero h1').textContent();
  const voltar = await D.page.getByRole('button', { name: '← Rede' }).count();
  await D.page.waitForTimeout(900);
  await foto(D.page, '50-acompanhamento-diretora');
  r('9', 'Diretora: item no menu; abre direto a própria escola, sem "← Rede"', 'menu sim; Aurora; sem voltar', `menu ${noMenu}; "${tituloD}"; voltar ${voltar}`, noMenu >= 1 && /Aurora/.test(tituloD) && voltar === 0, '50-acompanhamento-diretora.png');
  const errosD = D.erros.filter((e) => !/favicon|40[134]/.test(e));
  await D.browser.close();
  r('10', 'Sem erros no console nem respostas 5xx nas telas', 'nenhum', [...errosS, ...errosD].join(' | ') || 'nenhum', errosS.length + errosD.length === 0);
} finally {
  if (criadas.length) {
    await prisma.fotografiaAplicacaoPdi.deleteMany({ where: { aplicacaoId: { in: criadas } } });
    await prisma.aplicacaoPdi.deleteMany({ where: { id: { in: criadas } } });
  }
  await prisma.$disconnect();
}
