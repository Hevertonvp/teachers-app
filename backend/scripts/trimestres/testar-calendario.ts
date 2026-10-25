// Teste de integração ponta a ponta (API real via createApp) do calendário de trimestres por ano e
// da criação de Aplicação PDI com trimestre obrigatório. CRIA dados de teste (escolas, pessoas,
// Modelos, Aplicações, calendários dos anos 2091-2095 e 2027) — por isso só roda contra um banco
// descartável: localhost, ou um branch do Neon confirmado explicitamente pelo host.
//
// Uso (branch do Neon):
//   $env:DATABASE_URL="postgresql://...@ep-BRANCH-pooler..."; $env:CONFIRMAR_BANCO_TESTE="ep-BRANCH-pooler...(host completo)"
//   npx tsx scripts/trimestres/testar-calendario.ts
import 'dotenv/config';
import type { AddressInfo } from 'node:net';

const url = process.env.DATABASE_URL ?? '';
const host = url.match(/@([^/:?]+)/)?.[1] ?? '';
const local = /^(localhost|127\.0\.0\.1)$/.test(host);
if (!local && process.env.CONFIRMAR_BANCO_TESTE !== host) {
  console.error(`Recusado: este teste cria dados. Rode contra um banco descartável e confirme o host em CONFIRMAR_BANCO_TESTE (host atual: "${host}").`);
  process.exit(1);
}

const { createApp } = await import('../../src/api/app.js');
const { assinarToken } = await import('../../src/api/middleware/auth.js');
const { prisma } = await import('../../src/lib/prisma.js');

let falhas = 0;
let total = 0;
const ok = (cond: unknown, nome: string, detalhe?: unknown) => {
  total++;
  if (cond) console.log(`  ✔ ${nome}`);
  else { falhas++; console.log(`  ✘ ${nome}${detalhe !== undefined ? ` — ${JSON.stringify(detalhe).slice(0, 500)}` : ''}`); }
};
const secao = (t: string) => console.log(`\n${t}`);

const server = createApp().listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
type Resp = { status: number; data: any };
const api = async (token: string | null, method: string, path: string, body?: unknown): Promise<Resp> => {
  const r = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const hoje = new Date().toISOString().slice(0, 10); // mesmo "hoje" UTC do backend (hojeComoData)
const anoAtual = Number(hoje.slice(0, 4));
const ANOS_TESTE = [2091, 2092, 2093, 2094, 2095];
const MSG_INCOMPLETO = 'Calendário de trimestres incompleto. Configure o 1º, 2º e 3º trimestre antes de criar uma Aplicação PDI.';
const periodo = (trimestre: number, dataInicio: string | null, dataFim: string | null) => ({ trimestre, dataInicio, dataFim });
const putCal = (token: string, ano: number | string, periodos: unknown[]) => api(token, 'PUT', `/api/trimestres/${ano}`, { periodos });

// --- Fotografia de dados antigos (comparada no fim) --------------------------------------------
const aplicacoesAntigas = await prisma.aplicacaoPdi.findMany({ orderBy: { id: 'asc' } });
const fotoSnapshotsAntigos = async () => JSON.stringify({
  aplicacoes: await prisma.aplicacaoPdi.findMany({ where: { id: { in: aplicacoesAntigas.map((a) => a.id) } }, orderBy: { id: 'asc' } }),
  perguntas: await prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModelo: { aplicacaoId: { in: aplicacoesAntigas.map((a) => a.id) } } }, orderBy: { id: 'asc' } }),
  padrao: await prisma.aplicacaoPerguntaPadraoPdi.findMany({ where: { aplicacaoId: { in: aplicacoesAntigas.map((a) => a.id) } }, orderBy: { id: 'asc' } }),
});
const antes = await fotoSnapshotsAntigos();
const calendarioAnoAtualAntes = await prisma.periodoTrimestre.findMany({ where: { ano: anoAtual }, orderBy: { trimestre: 'asc' } });

// --- Fixtures ----------------------------------------------------------------------------------
const sufixo = Date.now();
let nEscola = 0;
const novaEscola = async () => {
  nEscola += 1;
  const escola = await prisma.escola.create({ data: { nome: `ESCOLA TESTE CALENDARIO ${nEscola} ${sufixo}` } });
  await prisma.escolaModulo.create({ data: { escolaId: escola.id, modulo: 'PDI' } });
  return escola;
};
const novaPessoa = (perfil: 'SECRETARIA' | 'GESTOR' | 'DIRETORA' | 'PROFESSOR' | 'AUXILIAR' | 'SUPORTE_SISTEMA') =>
  prisma.pessoa.create({ data: { nome: `${perfil} Teste Calendário`, email: `${perfil.toLowerCase()}-cal-${sufixo}@teste.local`, perfil } });

const pessoas = {
  SECRETARIA: await novaPessoa('SECRETARIA'),
  GESTOR: await novaPessoa('GESTOR'),
  DIRETORA: await novaPessoa('DIRETORA'),
  PROFESSOR: await novaPessoa('PROFESSOR'),
  AUXILIAR: await novaPessoa('AUXILIAR'),
  SUPORTE_SISTEMA: await novaPessoa('SUPORTE_SISTEMA'),
};
const tokens = Object.fromEntries(Object.entries(pessoas).map(([k, p]) => [k, assinarToken(p)])) as Record<keyof typeof pessoas, string>;
const tSec = tokens.SECRETARIA;

// Modelo de teste numa disciplina própria (nunca colide com o "um Modelo ATIVO por disciplina" dos
// Modelos reais): pergunta sempre visível + uma de cada trimestre, e duas cópias de pergunta padrão
// (uma sempre, uma do 2º) apontando pra perguntas padrão INATIVAS de teste — exercita o filtro por
// trimestre também no bloco compartilhado, sem mexer na lista real de perguntas padrão ativas.
const disciplinaTeste = await prisma.disciplina.create({ data: { nome: `Disciplina Teste Calendário ${sufixo}` } });
const padraoSempre = await prisma.perguntaPdiPadrao.create({ data: { secao: 'Teste', texto: `Padrão sempre ${sufixo}`, origem: 'ESTRUTURADA', tipoResposta: 'TEXTO', ordem: 900001, status: 'INATIVA', trimestre: null } });
const padraoT2 = await prisma.perguntaPdiPadrao.create({ data: { secao: 'Teste', texto: `Padrão só 2º ${sufixo}`, origem: 'QUALITATIVA', tipoResposta: 'TEXTO', ordem: 900002, status: 'INATIVA', trimestre: 2 } });
const modeloTeste = await prisma.modeloPdi.create({
  data: {
    nome: `Modelo Teste Calendário ${sufixo}`,
    disciplinaId: disciplinaTeste.id,
    perguntas: {
      create: [
        { secao: 'Teste', texto: 'Sempre visível', origem: 'ESTRUTURADA', tipoResposta: 'TEXTO', ordem: 1, trimestre: null },
        { secao: 'Teste', texto: 'Só 1º trimestre', origem: 'QUALITATIVA', tipoResposta: 'TEXTO', ordem: 2, trimestre: 1 },
        { secao: 'Teste', texto: 'Só 2º trimestre', origem: 'QUALITATIVA', tipoResposta: 'TEXTO', ordem: 3, trimestre: 2 },
        { secao: 'Teste', texto: 'Só 3º trimestre', origem: 'QUALITATIVA', tipoResposta: 'TEXTO', ordem: 4, trimestre: 3 },
        { secao: 'Teste', texto: padraoSempre.texto, origem: 'ESTRUTURADA', tipoResposta: 'TEXTO', ordem: 5, trimestre: null, padraoOriginalId: padraoSempre.id },
        { secao: 'Teste', texto: padraoT2.texto, origem: 'QUALITATIVA', tipoResposta: 'TEXTO', ordem: 6, trimestre: 2, padraoOriginalId: padraoT2.id },
      ],
    },
  },
});

const criarAplicacao = (escolaId: number, dataInicio: string, dataFim: string, modeloIds = [modeloTeste.id], token = tSec) =>
  api(token, 'POST', '/api/pdi-aplicacoes', { escolaId, dataInicio, dataFim, modeloIds });

// Textos copiados pro snapshot de uma Aplicação (específicas + padrão), pra comparar exatamente.
const textosDoSnapshot = async (aplicacaoId: number) => {
  const especificas = await prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModelo: { aplicacaoId, disciplinaId: disciplinaTeste.id } }, orderBy: { ordem: 'asc' } });
  const padrao = await prisma.aplicacaoPerguntaPadraoPdi.findMany({ where: { aplicacaoId, padraoOriginalId: { in: [padraoSempre.id, padraoT2.id] } }, orderBy: { ordem: 'asc' } });
  return { especificas: especificas.map((p) => p.texto), padrao: padrao.map((p) => p.texto) };
};

const aplicacoesCriadas: number[] = [];
const guardar = (r: Resp) => { if (r.status === 201 && r.data?.id) aplicacoesCriadas.push(r.data.id); return r; };

try {
  // Limpa sobras de execuções anteriores nos anos de teste (banco descartável).
  await prisma.periodoTrimestre.deleteMany({ where: { ano: { in: [...ANOS_TESTE, 2027] } } });

  secao('A. Permissões — chamadas diretas à API');
  for (const perfil of Object.keys(pessoas) as (keyof typeof pessoas)[]) {
    const r = await api(tokens[perfil], 'GET', '/api/trimestres?ano=2026');
    ok(r.status === 200, `${perfil} visualiza o calendário (GET 200)`, r);
  }
  for (const perfil of ['GESTOR', 'DIRETORA', 'PROFESSOR', 'AUXILIAR', 'SUPORTE_SISTEMA'] as const) {
    const r = await putCal(tokens[perfil], 2091, [periodo(1, '2091-02-01', '2091-04-30')]);
    ok(r.status === 403, `${perfil} NÃO configura o calendário (PUT 403)`, r);
  }
  const semToken = await api(null, 'PUT', '/api/trimestres/2091', { periodos: [periodo(1, '2091-02-01', '2091-04-30')] });
  ok(semToken.status === 401, 'sem autenticação → 401');
  ok((await prisma.periodoTrimestre.count({ where: { ano: 2091 } })) === 0, 'nenhuma tentativa não autorizada gravou nada');

  secao('B. Validação do calendário (backend)');
  const casosInvalidos: [string, unknown[], number | string][] = [
    ['1º sem data inicial', [periodo(1, null, '2091-04-30')], 2091],
    ['1º sem data final', [periodo(1, '2091-02-01', null)], 2091],
    ['2º incompleto (sem fim)', [periodo(2, '2091-05-01', null)], 2091],
    ['3º incompleto (sem início)', [periodo(3, '', '2091-12-15')], 2091],
    ['início posterior ao fim', [periodo(1, '2091-04-30', '2091-02-01')], 2091],
    ['trimestres sobrepostos no mesmo envio', [periodo(1, '2091-02-01', '2091-05-10'), periodo(2, '2091-05-10', '2091-08-15')], 2091],
    ['mesmo trimestre duas vezes no envio', [periodo(1, '2091-02-01', '2091-03-01'), periodo(1, '2091-03-02', '2091-04-01')], 2091],
    ['datas de outro ano', [periodo(1, '2092-02-01', '2092-04-30')], 2091],
    ['fim no ano seguinte', [periodo(3, '2091-09-01', '2092-01-10')], 2091],
    ['data inexistente (30/02)', [periodo(1, '2091-02-30', '2091-04-30')], 2091],
    ['data em formato inválido', [periodo(1, '01/02/2091', '2091-04-30')], 2091],
    ['trimestre 4', [periodo(4, '2091-02-01', '2091-04-30')], 2091],
    ['ano inválido na URL', [periodo(1, '2091-02-01', '2091-04-30')], 'abc'],
    ['ano fora da faixa', [periodo(1, '1999-02-01', '1999-04-30')], 1999],
  ];
  for (const [nome, periodos, ano] of casosInvalidos) {
    const r = await putCal(tSec, ano as number, periodos);
    ok(r.status === 400 && typeof r.data?.message === 'string', `${nome} → 400 ("${r.data?.message}")`, r);
  }
  const vazio = await putCal(tSec, 2091, []);
  ok(vazio.status === 400, 'lista vazia → 400');
  ok((await prisma.periodoTrimestre.count({ where: { ano: 2091 } })) === 0, 'nenhum envio inválido gravou nada');

  // Sobreposição contra o que JÁ está salvo (não só dentro do mesmo envio).
  ok((await putCal(tSec, 2091, [periodo(1, '2091-02-01', '2091-04-30')])).status === 200, 'salva só o 1º trimestre (calendário parcial permitido)');
  const contraSalvo = await putCal(tSec, 2091, [periodo(2, '2091-04-15', '2091-08-15')]);
  ok(contraSalvo.status === 400 && /sobrepostas/.test(contraSalvo.data?.message), '2º sobrepondo o 1º já salvo → 400', contraSalvo);
  const fronteira = await putCal(tSec, 2091, [periodo(2, '2091-04-30', '2091-08-15')]);
  ok(fronteira.status === 400, 'fronteira igual (2º começa no dia em que o 1º termina) conta como sobreposição');

  secao('C. Banco — última barreira (constraints)');
  const dupPk = await prisma.periodoTrimestre.create({ data: { ano: 2091, trimestre: 1, dataInicio: new Date('2091-06-01'), dataFim: new Date('2091-06-02') } }).then(() => 'gravou', (e) => e.code);
  ok(dupPk === 'P2002', 'duplicar (ano, trimestre) direto no banco → recusado pela chave primária', dupPk);
  const foraDoAno = await prisma.periodoTrimestre.create({ data: { ano: 2091, trimestre: 3, dataInicio: new Date('2092-01-01'), dataFim: new Date('2092-01-02') } }).then(() => 'gravou', () => 'recusado');
  ok(foraDoAno === 'recusado', 'datas fora do ano direto no banco → recusado (CHECK)');
  const invertido = await prisma.periodoTrimestre.create({ data: { ano: 2091, trimestre: 3, dataInicio: new Date('2091-12-10'), dataFim: new Date('2091-12-01') } }).then(() => 'gravou', () => 'recusado');
  ok(invertido === 'recusado', 'fim antes do início direto no banco → recusado (CHECK)');

  secao('D. Criação de Aplicação com calendário ausente/incompleto/inválido');
  const escolaD = await novaEscola();
  const semCal = await criarAplicacao(escolaD.id, '2095-03-01', '2095-03-10');
  ok(semCal.status === 400 && semCal.data?.codigo === 'CALENDARIO_TRIMESTRES_INCOMPLETO' && semCal.data.message.startsWith(MSG_INCOMPLETO), '18/1. nenhum trimestre configurado → bloqueia com a mensagem combinada', semCal);
  const so1 = await criarAplicacao(escolaD.id, '2091-03-01', '2091-03-10');
  ok(so1.status === 400 && so1.data?.codigo === 'CALENDARIO_TRIMESTRES_INCOMPLETO', '19/2. só o 1º configurado → bloqueia', so1);
  await putCal(tSec, 2091, [periodo(2, '2091-05-01', '2091-08-15')]);
  const so12 = await criarAplicacao(escolaD.id, '2091-03-01', '2091-03-10');
  ok(so12.status === 400 && so12.data?.codigo === 'CALENDARIO_TRIMESTRES_INCOMPLETO', '3/6. 1º e 2º configurados (falta o 3º) → bloqueia', so12);
  // falta o 1º / falta o 2º — montados direto no banco (ano 2094 limpo)
  await prisma.periodoTrimestre.createMany({ data: [
    { ano: 2094, trimestre: 2, dataInicio: new Date('2094-05-01'), dataFim: new Date('2094-08-15') },
    { ano: 2094, trimestre: 3, dataInicio: new Date('2094-08-16'), dataFim: new Date('2094-12-15') },
  ] });
  const falta1 = await criarAplicacao(escolaD.id, '2094-06-01', '2094-06-10');
  ok(falta1.status === 400 && falta1.data?.codigo === 'CALENDARIO_TRIMESTRES_INCOMPLETO', '4. falta o 1º → bloqueia', falta1);
  await prisma.periodoTrimestre.deleteMany({ where: { ano: 2094, trimestre: 2 } });
  await prisma.periodoTrimestre.create({ data: { ano: 2094, trimestre: 1, dataInicio: new Date('2094-02-01'), dataFim: new Date('2094-04-30') } });
  const falta2 = await criarAplicacao(escolaD.id, '2094-03-01', '2094-03-10');
  ok(falta2.status === 400 && falta2.data?.codigo === 'CALENDARIO_TRIMESTRES_INCOMPLETO', '5. falta o 2º → bloqueia', falta2);
  await prisma.periodoTrimestre.deleteMany({ where: { ano: 2094 } });
  // calendário inválido gravado por fora da API (legado/manual): sobreposição que o banco aceita
  await prisma.periodoTrimestre.createMany({ data: [
    { ano: 2093, trimestre: 1, dataInicio: new Date('2093-02-01'), dataFim: new Date('2093-05-31') },
    { ano: 2093, trimestre: 2, dataInicio: new Date('2093-05-01'), dataFim: new Date('2093-08-15') },
    { ano: 2093, trimestre: 3, dataInicio: new Date('2093-08-16'), dataFim: new Date('2093-12-15') },
  ] });
  const invalido = await criarAplicacao(escolaD.id, '2093-03-01', '2093-03-10');
  ok(invalido.status === 400 && invalido.data?.codigo === 'CALENDARIO_TRIMESTRES_INVALIDO', '20. calendário inválido (sobreposto) → bloqueia', invalido);
  ok((await prisma.aplicacaoPdi.count({ where: { escolaId: escolaD.id } })) === 0, 'nenhuma das tentativas bloqueadas criou Aplicação (nem com trimestre null)');

  secao('E. Calendário completo — trimestre resolvido e snapshot exato');
  const cal2092 = await putCal(tSec, 2092, [
    periodo(1, '2092-02-01', '2092-04-30'),
    periodo(2, '2092-05-10', '2092-08-15'), // gap 01/05–09/05 de propósito (gaps são permitidos)
    periodo(3, '2092-08-16', '2092-12-15'),
  ]);
  ok(cal2092.status === 200 && cal2092.data.length === 3 && cal2092.data.every((p: any) => p.ano === 2092), '14. calendário completo válido salvo', cal2092);
  const esperado = {
    1: { especificas: ['Sempre visível', 'Só 1º trimestre'], padrao: [padraoSempre.texto] },
    2: { especificas: ['Sempre visível', 'Só 2º trimestre'], padrao: [padraoSempre.texto, padraoT2.texto] },
    3: { especificas: ['Sempre visível', 'Só 3º trimestre'], padrao: [padraoSempre.texto] },
  } as const;
  const datasPorTrimestre = { 1: ['2092-03-01', '2092-03-20'], 2: ['2092-06-01', '2092-06-20'], 3: ['2092-09-01', '2092-09-20'] } as const;
  const aplicacaoPorTrimestre: Record<number, any> = {};
  for (const t of [1, 2, 3] as const) {
    const escola = await novaEscola();
    const r = guardar(await criarAplicacao(escola.id, datasPorTrimestre[t][0], datasPorTrimestre[t][1]));
    aplicacaoPorTrimestre[t] = r.data;
    ok(r.status === 201 && r.data.trimestre === t, `${21 + t}. Aplicação no ${t}º trimestre → trimestre ${t}`, r);
    const snap = await textosDoSnapshot(r.data.id);
    ok(JSON.stringify(snap) === JSON.stringify(esperado[t]), `26. snapshot do ${t}º: exatamente ${JSON.stringify(esperado[t])}`, snap);
    const trimestrais = await prisma.aplicacaoPerguntaPdi.count({ where: { aplicacaoModelo: { aplicacaoId: r.data.id }, perguntaOriginal: { trimestre: { not: null } } } });
    ok(trimestrais === 1, `27. só UMA pergunta trimestral específica no snapshot do ${t}º (nunca as três)`, trimestrais);
  }
  const escolaGap = await novaEscola();
  const noGap = await criarAplicacao(escolaGap.id, '2092-05-03', '2092-05-20');
  ok(noGap.status === 400 && noGap.data?.codigo === 'DATA_FORA_DO_CALENDARIO', '25. início num intervalo entre trimestres → bloqueia (nunca null)', noGap);
  const atravessa = guardar(await criarAplicacao(escolaGap.id, '2092-04-25', '2092-05-20'));
  ok(atravessa.status === 201 && atravessa.data.trimestre === 1, 'Aplicação que começa no 1º e termina depois → vale o trimestre do início (decisão do usuário)', atravessa);

  secao('F. Calendário de um ano nunca serve para outro');
  const escola2027 = await novaEscola();
  const sem2027 = await criarAplicacao(escola2027.id, '2027-02-10', '2027-02-20');
  ok(sem2027.status === 400 && sem2027.data?.codigo === 'CALENDARIO_TRIMESTRES_INCOMPLETO', '15. calendário de 2026 não serve para Aplicação de 2027', sem2027);
  const cal2027 = await putCal(tSec, 2027, [periodo(1, '2027-02-01', '2027-04-30'), periodo(2, '2027-05-01', '2027-08-15'), periodo(3, '2027-08-16', '2027-12-17')]);
  ok(cal2027.status === 200, 'calendário de 2027 configurado');
  const com2027 = guardar(await criarAplicacao(escola2027.id, '2027-02-10', '2027-02-20'));
  ok(com2027.status === 201 && com2027.data.trimestre === 1, '16. calendário completo de 2027 funciona normalmente (1º trimestre)', com2027);

  secao('G. Alterações posteriores não reinterpretam Aplicações já criadas');
  const apT2 = aplicacaoPorTrimestre[2];
  const fotoT2 = async () => JSON.stringify({ apl: await prisma.aplicacaoPdi.findUnique({ where: { id: apT2.id }, select: { trimestre: true } }), snap: await textosDoSnapshot(apT2.id) });
  const antesT2 = await fotoT2();
  // Calendário de 2092 muda: 01/06 (início da Aplicação do 2º) passa a cair no 1º trimestre.
  const muda = await putCal(tSec, 2092, [periodo(2, '2092-07-01', '2092-08-15')]);
  const muda2 = await putCal(tSec, 2092, [periodo(1, '2092-02-01', '2092-06-30')]);
  ok(muda.status === 200 && muda2.status === 200, 'calendário de 2092 editado (1º passa a cobrir junho)');
  ok((await fotoT2()) === antesT2, '17/28. Aplicação já criada mantém trimestre 2 e snapshot intactos após editar o calendário');
  const editaDatas = await api(tSec, 'PUT', `/api/pdi-aplicacoes/${apT2.id}`, { nome: null, dataInicio: '2092-03-01', dataFim: '2092-03-20' });
  ok(editaDatas.status === 200 && editaDatas.data.trimestre === 2, 'editar datas da Aplicação para outro trimestre é permitido e NÃO muda o trimestre (decisão do usuário)', editaDatas);
  ok((await fotoT2()) === antesT2, 'snapshot continua congelado após editar as datas da Aplicação');

  secao('H. Escopo e regras que continuam valendo');
  const [escA, escB] = [await novaEscola(), await novaEscola()];
  const rA = guardar(await criarAplicacao(escA.id, '2092-10-01', '2092-10-10'));
  const rB = guardar(await criarAplicacao(escB.id, '2092-10-01', '2092-10-10'));
  ok(rA.status === 201 && rB.status === 201 && rA.data.trimestre === 3 && rB.data.trimestre === 3, '29. escolas diferentes, mesmo calendário (global) → mesmo trimestre');
  const sobrepoe = await criarAplicacao(escA.id, '2092-10-05', '2092-10-20');
  ok(sobrepoe.status === 409, '30. sobreposição de Aplicações na mesma escola continua bloqueada (409)', sobrepoe);
  const passado = await criarAplicacao(escA.id, '2020-03-01', '2020-03-10');
  ok(passado.status === 400 && !passado.data?.codigo, 'início no passado continua bloqueado pela regra antiga');
  const naoSec = await criarAplicacao(escA.id, '2092-11-01', '2092-11-10', [modeloTeste.id], tokens.GESTOR);
  ok(naoSec.status === 403, 'Gestor continua sem criar Aplicação (403)');

  secao('I. Concorrência');
  // mesmo calendário salvo 6x ao mesmo tempo (ano ainda inexistente = criação simultânea)
  const iguais = await Promise.all(Array.from({ length: 6 }, () => putCal(tSec, 2095, [periodo(1, '2095-02-01', '2095-04-30'), periodo(2, '2095-05-01', '2095-08-15'), periodo(3, '2095-08-16', '2095-12-15')])));
  ok(iguais.every((r) => r.status === 200), '6 gravações idênticas simultâneas → todas 200, nenhum 500', iguais.map((r) => r.status));
  ok((await prisma.periodoTrimestre.count({ where: { ano: 2095 } })) === 3, 'sem duplicidade: exatamente 3 linhas em 2095');
  // duas gravações válidas sozinhas, mas que juntas se sobrepõem
  await prisma.periodoTrimestre.deleteMany({ where: { ano: 2094 } });
  const [g1, g2] = await Promise.all([
    putCal(tSec, 2094, [periodo(1, '2094-02-01', '2094-05-20')]),
    putCal(tSec, 2094, [periodo(2, '2094-05-10', '2094-08-15')]),
  ]);
  const st = [g1.status, g2.status].sort();
  ok(st[0] === 200 && st[1] === 400, 'duas gravações que juntas se sobrepõem → uma 200, outra 400 (nunca as duas)', [g1, g2]);
  ok((await prisma.periodoTrimestre.count({ where: { ano: 2094 } })) === 1, 'banco ficou com só uma delas');
  // várias Aplicações simultâneas na mesma escola, mesmas datas
  const escC = await novaEscola();
  const simult = await Promise.all(Array.from({ length: 5 }, () => criarAplicacao(escC.id, '2092-11-01', '2092-11-10')));
  simult.forEach(guardar);
  const st201 = simult.filter((r) => r.status === 201).length;
  ok(st201 === 1 && simult.every((r) => r.status === 201 || r.status === 409), `5 criações simultâneas na mesma escola → 1 criada, resto 409 (${simult.map((r) => r.status)})`);
  // Aplicações em escolas diferentes enquanto o calendário do mesmo ano é regravado
  const escolasD = await Promise.all([novaEscola(), novaEscola(), novaEscola()]);
  const misto = await Promise.all([
    ...escolasD.map((e) => criarAplicacao(e.id, '2095-03-01', '2095-03-10')),
    putCal(tSec, 2095, [periodo(1, '2095-02-01', '2095-04-30')]),
  ]);
  misto.slice(0, 3).forEach(guardar);
  ok(misto.every((r) => r.status === 200 || r.status === 201), 'criar Aplicações enquanto o calendário é regravado → sem 500 nem bloqueio', misto.map((r) => r.status));
  ok(misto.slice(0, 3).every((r) => r.data.trimestre === 1), 'todas resolvidas no 1º trimestre');

  secao('J. Regressão — Ficha, bloco padrão, CRMG, Correções, Ficha Anual, Mensagens, Feedback, auth');
  const modeloMat = await prisma.modeloPdi.findFirst({ where: { status: 'ATIVA', disciplina: { nome: 'Matemática' } }, include: { perguntas: { where: { status: 'ATIVA' } } } });
  const calAtual = await prisma.periodoTrimestre.findMany({ where: { ano: anoAtual } });
  const triHoje = calAtual.find((p) => p.dataInicio.toISOString().slice(0, 10) <= hoje && hoje <= p.dataFim.toISOString().slice(0, 10))?.trimestre;
  if (!modeloMat || !triHoje || calAtual.length !== 3) {
    ok(false, `pré-condição: Modelo ativo de Matemática e calendário ${anoAtual} completo contendo hoje`, { modeloMat: !!modeloMat, triHoje, calAtual: calAtual.length });
  } else {
    const escR = await novaEscola();
    const turma = await prisma.turma.create({ data: { escolaId: escR.id, anoLetivo: anoAtual, etapa: 'FUNDAMENTAL', anoSerie: 6, turno: 'MANHA', identificador: 91, nome: '6º Teste Cal', identidadeChave: `teste-cal-${sufixo}` } });
    const prof = pessoas.PROFESSOR;
    await prisma.vinculoEscolar.create({ data: { escolaId: escR.id, pessoaId: prof.id, dataInicio: new Date() } });
    await prisma.professorTurmaDisciplina.create({ data: { turmaId: turma.id, professorId: prof.id, disciplinaId: modeloMat.disciplinaId, dataInicio: new Date() } });
    const aluno = await prisma.alunoPdi.create({ data: { nome: 'Aluno Teste Calendário', turmaId: turma.id, responsavelNome: 'Resp', responsavelParentesco: 'Mãe', responsavelTelefone: '0000' } });
    const fim = `${anoAtual}-12-31` < calAtual.find((p) => p.trimestre === triHoje)!.dataFim.toISOString().slice(0, 10) ? `${anoAtual}-12-31` : calAtual.find((p) => p.trimestre === triHoje)!.dataFim.toISOString().slice(0, 10);
    const ap = guardar(await criarAplicacao(escR.id, hoje, fim, [modeloMat.id]));
    ok(ap.status === 201 && ap.data.trimestre === triHoje, `Aplicação de hoje com o Modelo REAL de Matemática → ${triHoje}º trimestre`, ap);
    const padraoTrimestraisDoModelo = modeloMat.perguntas.filter((p) => p.padraoOriginalId && p.trimestre !== null);
    const snapPadrao = await prisma.aplicacaoPerguntaPadraoPdi.findMany({ where: { aplicacaoId: ap.data.id }, include: { padraoOriginal: true } });
    ok(snapPadrao.every((p) => p.padraoOriginal.trimestre === null || p.padraoOriginal.trimestre === triHoje), `Modelo real: perguntas padrão trimestrais de outros trimestres ficam de fora (modelo tem ${padraoTrimestraisDoModelo.length}, entraram ${snapPadrao.filter((p) => p.padraoOriginal.trimestre !== null).length})`);

    const tProf = tokens.PROFESSOR;
    const ficha = await api(tProf, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: ap.data.id, alunoId: aluno.id, disciplinaId: modeloMat.disciplinaId });
    ok(ficha.status === 200 && ficha.data.ficha.status === 'PENDENTE', 'Ficha criada sob demanda', ficha);
    const fichaId = ficha.data.ficha.id;
    const especificas = ficha.data.perguntas.filter((p: any) => p.tipoResposta !== 'ORIENTACAO');
    const crmg = especificas.find((p: any) => p.tipoResposta === 'HABILIDADE_CRMG');
    const outras = especificas.filter((p: any) => p.tipoResposta !== 'HABILIDADE_CRMG');
    const habMat = await prisma.habilidadeCurricular.findFirst({ where: { componente: 'MATEMATICA', ativa: true } });
    const habIng = await prisma.habilidadeCurricular.findFirst({ where: { componente: 'LINGUA_INGLESA', ativa: true } });
    if (crmg && habIng) {
      const errado = await api(tProf, 'PUT', `/api/pdi-fichas/${fichaId}/respostas`, { respostas: [{ aplicacaoPerguntaId: crmg.id, valor: { habilidadeIds: [habIng.id] } }], baseUpdatedAt: ficha.data.ficha.updatedAt ?? ficha.data.ficha.createdAt });
      ok(errado.status === 400, 'CRMG: habilidade de Inglês numa Ficha de Matemática → 400 (isolamento por disciplina)', errado);
    }
    const respostas = [
      ...outras.map((p: any) => ({ aplicacaoPerguntaId: p.id, valor: { resposta: p.tipoResposta === 'NUMERO' ? 8 : p.tipoResposta === 'SELECAO' ? p.opcoes[0] : 'ok' } })),
      ...especificas.filter((p: any) => p.tipoResposta === 'HABILIDADE_CRMG').map((p: any) => ({ aplicacaoPerguntaId: p.id, valor: { habilidadeIds: habMat ? [habMat.id] : [], todas: !habMat } })),
    ];
    const atual = await prisma.fichaPdi.findUniqueOrThrow({ where: { id: fichaId } });
    if (respostas.length > 0) {
      const salva = await api(tProf, 'PUT', `/api/pdi-fichas/${fichaId}/respostas`, { respostas, baseUpdatedAt: (atual.updatedAt ?? atual.createdAt).toISOString() });
      ok(salva.status === 200 && salva.data.ficha.status === 'EM_ANDAMENTO', 'salvar respostas específicas (inclui CRMG de Matemática)', salva);
    }
    const bloco = ficha.data.blocoPadrao;
    if (bloco) {
      const resp = bloco.perguntas.filter((p: any) => p.tipoResposta !== 'ORIENTACAO').map((p: any) => ({ aplicacaoPerguntaPadraoId: p.id, valor: { resposta: p.tipoResposta === 'NUMERO' ? 7 : p.tipoResposta === 'SELECAO' ? p.opcoes[0] : 'ok' } }));
      const sb = await api(tProf, 'PUT', `/api/pdi-fichas/${fichaId}/respostas-padrao`, { respostas: resp, version: bloco.version });
      ok(sb.status === 200 && sb.data.blocoPadrao.version === 1, 'bloco compartilhado salvo (optimistic lock por version)', sb);
      const conflito = await api(tProf, 'PUT', `/api/pdi-fichas/${fichaId}/respostas-padrao`, { respostas: resp, version: bloco.version });
      ok(conflito.status === 409 && conflito.data?.codigo === 'CONFLITO_VERSAO', 'versão antiga do bloco → 409 CONFLITO_VERSAO (offline/duas abas)', conflito);
    }
    const concl = await api(tProf, 'POST', `/api/pdi-fichas/${fichaId}/concluir`);
    ok(concl.status === 200 && concl.data.ficha.status === 'CONCLUIDA', 'concluir Ficha', concl);
    const corr = await api(tSec, 'GET', `/api/correcoes-pdi/${fichaId}`);
    ok(corr.status === 200, 'Correções: detalhe da Ficha (Secretaria)', corr.status);
    const dev = await api(tSec, 'POST', `/api/correcoes-pdi/${fichaId}/devolver`, { observacao: 'teste calendário' });
    ok(dev.status === 200 || dev.status === 201, 'Correções: devolver Ficha concluída', dev);
    const anual = await api(tSec, 'GET', `/api/pdi-ficha-anual/${aluno.id}/${anoAtual}`);
    ok(anual.status === 200 && JSON.stringify(anual.data).includes(`"aplicacaoId":${ap.data.id}`), 'Ficha Anual lista a Aplicação', anual.status);
    const meus = await api(tProf, 'GET', '/api/pdi-fichas/meus-pdis');
    ok(meus.status === 200 && meus.data.some((l: any) => l.aplicacaoId === ap.data.id), 'Meus PDIs do Professor lista a Aplicação');
  }
  const modelos = await api(tSec, 'GET', '/api/pdi-modelos');
  ok(modelos.status === 200, 'Modelos PDI: listagem');
  ok((await api(tSec, 'GET', '/api/mensagens/conversas')).status === 200, 'Mensagens: listagem de conversas');
  ok((await api(tSec, 'GET', '/api/notificacoes')).status === 200, 'Notificações: listagem');
  ok((await api(tokens.PROFESSOR, 'GET', '/api/feedback-sistema/meus')).status === 200, 'Feedback do Sistema: meus feedbacks');
  ok((await api(tokens.SUPORTE_SISTEMA, 'GET', '/api/feedback-sistema')).status === 200, 'Feedback do Sistema: fila do suporte');
  ok((await api(null, 'POST', '/api/auth/login', { email: pessoas.SECRETARIA.email, senha: 'errada' })).status === 401, 'Auth: login com senha errada → 401');
  ok((await api('token-invalido', 'GET', '/api/trimestres')).status === 401, 'Auth: token inválido → 401');

  secao('K. Dados antigos');
  ok((await fotoSnapshotsAntigos()) === antes, 'Aplicações e snapshots pré-existentes byte a byte iguais (nada foi recalculado)');
  const calAtualDepois = await prisma.periodoTrimestre.findMany({ where: { ano: anoAtual }, orderBy: { trimestre: 'asc' } });
  ok(JSON.stringify(calAtualDepois) === JSON.stringify(calendarioAnoAtualAntes), `calendário real de ${anoAtual} intocado`);
  const nulas = aplicacoesAntigas.filter((a) => a.trimestre === null);
  console.log(`  ℹ Aplicações antigas com trimestre = null (não alteradas): ${nulas.map((a) => `#${a.id} (escola ${a.escolaId}, ${a.dataInicio.toISOString().slice(0, 10)}, ${a.status})`).join(', ') || 'nenhuma'}`);
} finally {
  server.close();
  await prisma.$disconnect();
  console.log(`\n${total - falhas}/${total} verificações OK${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
  console.log(`(dados de teste mantidos neste banco descartável: ${aplicacoesCriadas.length} Aplicações, sufixo ${sufixo})`);
  if (falhas) process.exitCode = 1;
}
