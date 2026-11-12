// OBSOLETO desde 12/11/2026: testa o modelo ANTIGO do 1/3 (ano/série + disciplina, via PTD) e usa o .env,
// que nesta máquina aponta para a PRODUÇÃO. Não rodar. O teste atual é scripts/umTerco/testar-cargos.ts (só banco local).
process.exit(1);
// Teste de integração do Formulário 1/3 contra o banco configurado (.env).
// Cria SÓ dados identificados como teste (prefixo ZZTESTE-UT, ano letivo 2099) e remove tudo no fim,
// inclusive restos de uma execução interrompida. Imprime contagens de tabelas antes e depois.
//   Rodar:   npx tsx scripts/umTerco/testar-integracao.ts
//   Limpar:  npx tsx scripts/umTerco/testar-integracao.ts --limpar
import 'dotenv/config';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { prisma } from '../../src/lib/prisma.js';
import { createApp } from '../../src/api/app.js';
import { assinarToken } from '../../src/api/middleware/auth.js';

const PREFIXO = 'ZZTESTE-UT';
const ANO = 2099;
const EMAIL = (n: string) => `${PREFIXO.toLowerCase()}-${n}@teste.invalid`;
const DIA_MS = 86400000;

let ok = 0;
let falhas = 0;
let respostas5xx = 0;
const caso = async (nome: string, fn: () => Promise<void>) => {
  try { await fn(); ok += 1; console.log(`  ok  ${nome}`); } catch (e) { falhas += 1; console.error(`FALHOU ${nome}\n    ${(e as Error).message.split('\n').slice(0, 6).join('\n    ')}`); }
};
const naoTestado = (nome: string, motivo: string) => console.log(`  --  ${nome}: NÃO TESTADO (${motivo})`);

// Data (meia-noite UTC) do dia de Brasília deslocado em N dias — o mesmo formato das colunas @db.Date.
const dia = (offset: number) => {
  const sp = new Date(Date.now() - 3 * 3600000 + offset * DIA_MS);
  return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate()));
};

async function contagens() {
  const [pessoas, escolas, turmas, disciplinas, vinculos, modulos, periodos, ciclos, entregas, reaberturas, aplicacoesPdi, fichasPdi, alunosPdi, habilidades] = await Promise.all([
    prisma.pessoa.count(), prisma.escola.count(), prisma.turma.count(), prisma.disciplina.count(), prisma.professorTurmaDisciplina.count(),
    prisma.escolaModulo.count(), prisma.periodoTrimestre.count(), prisma.cicloUmTerco.count(), prisma.entregaUmTerco.count(), prisma.reaberturaUmTerco.count(),
    prisma.aplicacaoPdi.count(), prisma.fichaPdi.count(), prisma.alunoPdi.count(), prisma.habilidadeCurricular.count(),
  ]);
  return { pessoas, escolas, turmas, disciplinas, vinculos, modulos, periodos, ciclos, entregas, reaberturas, aplicacoesPdi, fichasPdi, alunosPdi, habilidadesCrmg: habilidades };
}

async function limpar() {
  const pessoaIds = (await prisma.pessoa.findMany({ where: { email: { startsWith: PREFIXO.toLowerCase() } }, select: { id: true } })).map((p) => p.id);
  const cicloIds = (await prisma.cicloUmTerco.findMany({ where: { anoLetivo: ANO }, select: { id: true } })).map((c) => c.id);
  await prisma.entregaUmTerco.deleteMany({ where: { OR: [{ cicloId: { in: cicloIds } }, { professorId: { in: pessoaIds } }] } });
  await prisma.reaberturaUmTerco.deleteMany({ where: { cicloId: { in: cicloIds } } });
  await prisma.cicloUmTerco.deleteMany({ where: { id: { in: cicloIds } } });
  await prisma.professorTurmaDisciplina.deleteMany({ where: { OR: [{ professorId: { in: pessoaIds } }, { turma: { anoLetivo: ANO } }] } });
  const escolaIds = (await prisma.escola.findMany({ where: { nome: { startsWith: PREFIXO } }, select: { id: true } })).map((e) => e.id);
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolaIds } } });
  await prisma.escolaModulo.deleteMany({ where: { escolaId: { in: escolaIds } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolaIds } } });
  await prisma.disciplina.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
  await prisma.periodoTrimestre.deleteMany({ where: { ano: ANO } });
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoaIds } } });
}

async function main() {
  if (process.argv.includes('--limpar')) {
    await limpar();
    console.log('Contagens após limpeza:', JSON.stringify(await contagens()));
    await prisma.$disconnect();
    return;
  }

  await limpar(); // restos de execução anterior
  const antes = await contagens();
  console.log('Contagens ANTES:', JSON.stringify(antes));

  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const chamar = async (token: string, metodo: string, caminho: string, corpo?: unknown) => {
    const r = await fetch(`${base}/api/formulario-um-terco${caminho}`, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const json = await r.json().catch(() => null);
    if (r.status >= 500) { respostas5xx += 1; console.error(`    !! 5xx inesperado em ${metodo} ${caminho}: ${r.status} ${JSON.stringify(json)}`); }
    return { status: r.status, json };
  };

  try {
    // ---------- Massa de teste ----------
    const mk = (n: string, perfil: 'SECRETARIA' | 'PROFESSOR' | 'GESTOR') => prisma.pessoa.create({ data: { nome: `${PREFIXO} ${n}`, email: EMAIL(n), perfil, status: 'ATIVO' } });
    const [sec, p1, p2, p3, p4, p5, gestor] = await Promise.all([mk('sec', 'SECRETARIA'), mk('prof1', 'PROFESSOR'), mk('prof2', 'PROFESSOR'), mk('prof3', 'PROFESSOR'), mk('prof4', 'PROFESSOR'), mk('prof5', 'PROFESSOR'), mk('gestor', 'GESTOR')]);
    const tokenDe = (p: { id: number; perfil: string; authVersion: number }) => assinarToken(p);
    const tSec = tokenDe(sec); const tP1 = tokenDe(p1); const tP2 = tokenDe(p2); const tGestor = tokenDe(gestor);

    // Nenhuma dessas escolas recebe linha em escola_modulos: o formulário é global.
    const esc = async (n: string, status: 'ATIVA' | 'INATIVA' = 'ATIVA') => prisma.escola.create({ data: { nome: `${PREFIXO} Escola ${n}`, status } });
    const escA = await esc('A'); const escB = await esc('B'); const escInfantil = await esc('Infantil'); const escInativa = await esc('Inativa', 'INATIVA'); const escSemTurma = await esc('SemTurma');
    const [mat, cie] = await Promise.all(['Matemática', 'Ciências'].map((n) => prisma.disciplina.create({ data: { nome: `${PREFIXO} ${n}` } })));
    let seq = 0;
    const turma = (escolaId: number, anoSerie: number, ident: number, extra: { etapa?: 'FUNDAMENTAL' | 'EDUCACAO_INFANTIL'; anoLetivo?: number } = {}) => {
      seq += 1;
      const etapa = extra.etapa ?? 'FUNDAMENTAL';
      const anoLetivo = extra.anoLetivo ?? ANO;
      return prisma.turma.create({ data: etapa === 'FUNDAMENTAL'
        ? { escolaId, anoLetivo, etapa, anoSerie, turno: 'MANHA', identificador: ident, nome: `${anoSerie}M${ident}`, identidadeChave: `${PREFIXO}|${seq}` }
        : { escolaId, anoLetivo, etapa, segmento: 'PRE_ESCOLA', nivel: 'PRE_I', turno: 'MANHA', identificador: ident, nome: `Infantil ${ident}`, identidadeChave: `${PREFIXO}|${seq}` } });
    };
    // Um vínculo ATIVO por (turma, disciplina) é garantido pelo banco — cada professor ganha turmas próprias.
    const vinc = (turmaId: number, professorId: number, disciplinaId: number, inicio: Date = new Date('2000-01-01T00:00:00Z')) => prisma.professorTurmaDisciplina.create({ data: { turmaId, professorId, disciplinaId, status: 'ATIVO', dataInicio: inicio } });

    const tA61 = await turma(escA.id, 6, 1); const tA62 = await turma(escA.id, 6, 2); const tB61 = await turma(escB.id, 6, 1);
    const tA71 = await turma(escA.id, 7, 1); const tA64 = await turma(escA.id, 6, 4);
    const tInf = await turma(escInfantil.id, 0, 1, { etapa: 'EDUCACAO_INFANTIL' });
    const tAnoOutro = await turma(escSemTurma.id, 6, 1, { anoLetivo: ANO - 1 });
    const tInativa = await turma(escInativa.id, 8, 1);
    const tA91 = await turma(escA.id, 9, 1); const tA92 = await turma(escA.id, 9, 2);

    await prisma.periodoTrimestre.createMany({ data: [
      { ano: ANO, trimestre: 1, dataInicio: new Date(`${ANO}-02-01T00:00:00Z`), dataFim: new Date(`${ANO}-04-30T00:00:00Z`) },
      { ano: ANO, trimestre: 2, dataInicio: new Date(`${ANO}-05-01T00:00:00Z`), dataFim: new Date(`${ANO}-08-31T00:00:00Z`) },
      { ano: ANO, trimestre: 3, dataInicio: new Date(`${ANO}-09-01T00:00:00Z`), dataFim: new Date(`${ANO}-12-15T00:00:00Z`) },
    ] });

    const sem = (ini: string, fim: string) => ({ dataInicio: `${ANO}-${ini}`, dataFim: `${ANO}-${fim}` });
    const quatroSemanas = [sem('09-02', '09-04'), sem('09-05', '09-07'), sem('09-08', '09-10'), sem('09-11', '09-13')];
    const ciclo = (extra: Record<string, unknown> = {}) => ({ anoLetivo: ANO, trimestre: 3, titulo: 'Formulário 1/3', abreEm: `${ANO}-09-01T08:00`, prazoEm: `${ANO}-09-15T23:59`, semanas: quatroSemanas, ...extra });

    // =================== CICLOS ===================
    console.log('\nCiclos');
    let c1 = 0; let c2 = 0; let c4 = 0;
    await caso('01: um ciclo no trimestre (semanas Semana 1..4 geradas pelo sistema)', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo());
      assert.equal(r.status, 201, JSON.stringify(r.json)); c1 = r.json.id;
      assert.deepEqual(r.json.semanas.map((s: { rotulo: string }) => s.rotulo), ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4']);
    });
    await caso('02: segundo ciclo no MESMO trimestre, sem sobreposição -> permitido', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'Formulário B', abreEm: `${ANO}-09-20T08:00`, prazoEm: `${ANO}-09-30T23:59`, semanas: [sem('09-21', '09-25')] }));
      assert.equal(r.status, 201, JSON.stringify(r.json)); c2 = r.json.id;
    });
    await caso('03: sobreposição parcial com o primeiro -> bloqueia (409) e não salva', async () => {
      const antes2 = await prisma.cicloUmTerco.count({ where: { anoLetivo: ANO } });
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'Sobreposto', abreEm: `${ANO}-09-10T08:00`, prazoEm: `${ANO}-09-18T23:59` }));
      assert.equal(r.status, 409); assert.match(r.json.message, /sobrep/i);
      assert.equal(await prisma.cicloUmTerco.count({ where: { anoLetivo: ANO } }), antes2);
    });
    await caso('03: ciclo que engloba outro por inteiro -> bloqueia', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'Engloba', abreEm: `${ANO}-09-01T08:00`, prazoEm: `${ANO}-10-30T23:59`, semanas: [sem('09-02', '09-04')] }));
      assert.equal(r.status, 409);
    });
    await caso('04: começa logo depois que o primeiro termina (e termina antes do segundo) -> permitido', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'Entre os dois', abreEm: `${ANO}-09-16T00:00`, prazoEm: `${ANO}-09-19T23:59`, semanas: [sem('09-16', '09-18')] }));
      assert.equal(r.status, 201, JSON.stringify(r.json)); c4 = r.json.id;
    });
    await caso('04b: abertura no mesmo instante do prazo do outro conta como sobreposição (prazo é inclusivo)', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'Encosta', abreEm: `${ANO}-09-15T23:59`, prazoEm: `${ANO}-09-15T23:59:30`, semanas: [sem('09-02', '09-04')] }));
      assert.equal(r.status, 409, JSON.stringify(r.json));
    });
    await caso('05: ciclo fora do trimestre -> 400', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'Fora', abreEm: `${ANO}-08-30T08:00`, prazoEm: `${ANO}-09-02T08:00` }));
      assert.equal(r.status, 400); assert.match(r.json.message, /fora do 3º trimestre/);
    });
    await caso('05: prazo fora do trimestre -> 400', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'Fora2', abreEm: `${ANO}-12-10T08:00`, prazoEm: `${ANO}-12-16T08:00`, semanas: [sem('12-10', '12-12')] }));
      assert.equal(r.status, 400); assert.match(r.json.message, /prazo .* fora/i);
    });
    await caso('06: semana fora do trimestre -> 400', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'SemanaFora', abreEm: `${ANO}-12-01T08:00`, prazoEm: `${ANO}-12-10T08:00`, semanas: [sem('12-14', '12-18')] }));
      assert.equal(r.status, 400); assert.match(r.json.message, /Semana 1 .* fora/);
    });
    await caso('06: semana com início depois do fim -> 400', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'SemanaInvertida', abreEm: `${ANO}-12-01T08:00`, prazoEm: `${ANO}-12-10T08:00`, semanas: [sem('12-08', '12-04')] }));
      assert.equal(r.status, 400);
    });
    await caso('12: prazo antes da abertura -> 400', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'PrazoInvertido', abreEm: `${ANO}-12-05T08:00`, prazoEm: `${ANO}-12-04T08:00`, semanas: [sem('12-04', '12-04')] }));
      assert.equal(r.status, 400); assert.match(r.json.message, /depois da abertura/);
    });
    await caso('07: calendário de trimestres incompleto/inexistente para o ano -> 400', async () => {
      const r = await chamar(tSec, 'POST', '/ciclos', ciclo({ anoLetivo: ANO - 2, abreEm: `${ANO - 2}-09-01T08:00`, prazoEm: `${ANO - 2}-09-05T08:00`, semanas: [{ dataInicio: `${ANO - 2}-09-01`, dataFim: `${ANO - 2}-09-02` }] }));
      assert.equal(r.status, 400); assert.match(r.json.message, /não está configurado no calendário/);
    });
    await caso('concorrência: dois ciclos de janela sobreposta criados AO MESMO TEMPO -> um vence, outro 409', async () => {
      const [a, b] = await Promise.all(['Corrida A', 'Corrida B'].map((titulo) => chamar(tSec, 'POST', '/ciclos', ciclo({ titulo, abreEm: `${ANO}-11-01T08:00`, prazoEm: `${ANO}-11-10T23:59`, semanas: [sem('11-02', '11-04')] }))));
      assert.deepEqual([a.status, b.status].sort(), [201, 409]);
      assert.equal(await prisma.cicloUmTerco.count({ where: { anoLetivo: ANO, titulo: { startsWith: 'Corrida' } } }), 1);
    });
    await caso('editar o ciclo não conflita consigo mesmo; mover para cima de outro conflita', async () => {
      const ok1 = await chamar(tSec, 'PUT', `/ciclos/${c4}`, ciclo({ titulo: 'Entre os dois (editado)', abreEm: `${ANO}-09-16T00:00`, prazoEm: `${ANO}-09-19T20:00`, semanas: [sem('09-16', '09-18')] }));
      assert.equal(ok1.status, 200, JSON.stringify(ok1.json));
      const ruim = await chamar(tSec, 'PUT', `/ciclos/${c4}`, ciclo({ titulo: 'x', abreEm: `${ANO}-09-14T00:00`, prazoEm: `${ANO}-09-19T20:00`, semanas: [sem('09-16', '09-18')] }));
      assert.equal(ruim.status, 409);
    });
    await caso('inativar libera a janela; reativar sobreposto é bloqueado', async () => {
      const novo = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'Temporário', abreEm: `${ANO}-12-01T08:00`, prazoEm: `${ANO}-12-05T08:00`, semanas: [sem('12-02', '12-03')] }));
      assert.equal(novo.status, 201);
      assert.equal((await chamar(tSec, 'POST', `/ciclos/${novo.json.id}/inativar`)).status, 200);
      const reocupa = await chamar(tSec, 'POST', '/ciclos', ciclo({ titulo: 'Ocupa', abreEm: `${ANO}-12-02T08:00`, prazoEm: `${ANO}-12-04T08:00`, semanas: [sem('12-02', '12-03')] }));
      assert.equal(reocupa.status, 201);
      assert.equal((await chamar(tSec, 'POST', `/ciclos/${novo.json.id}/reativar`)).status, 409);
    });
    await caso('permissões: Professor/Gestor não administram; Secretaria não preenche', async () => {
      assert.equal((await chamar(tP1, 'GET', '/ciclos')).status, 403);
      assert.equal((await chamar(tGestor, 'GET', '/ciclos')).status, 403);
      assert.equal((await chamar(tGestor, 'GET', '/minhas')).status, 403);
      assert.equal((await chamar(tSec, 'GET', '/minhas')).status, 403);
      assert.equal((await chamar(tP1, 'POST', '/ciclos', ciclo())).status, 403);
    });

    // Ciclo principal (c1) aberto em torno de "agora"; c4 também aberto (para testar "outro ciclo -> outra entrega");
    // c2 vira um ciclo JÁ ENCERRADO (para testar "esperado" histórico).
    const agora = Date.now();
    await prisma.cicloUmTerco.update({ where: { id: c1 }, data: { abreEm: new Date(agora - DIA_MS), prazoEm: new Date(agora + 30 * DIA_MS) } });
    await prisma.cicloUmTerco.update({ where: { id: c4 }, data: { abreEm: new Date(agora - DIA_MS), prazoEm: new Date(agora + 30 * DIA_MS) } });
    await prisma.cicloUmTerco.update({ where: { id: c2 }, data: { abreEm: new Date(agora - 20 * DIA_MS), prazoEm: new Date(agora - 10 * DIA_MS) } });

    // =================== IDENTIDADE E VÍNCULOS ===================
    console.log('\nIdentidade da entrega e escolas');
    await vinc(tA61.id, p1.id, mat.id);
    const minhas = async (t = tP1) => (await chamar(t, 'GET', '/minhas')).json as Array<{ ciclo: { id: number }; anoSerie: number; disciplinaId: number; validoPara: Array<{ turmaNome: string; escolaNome: string }>; status: string }>;
    const doCiclo = (lista: Awaited<ReturnType<typeof minhas>>, id: number) => lista.filter((x) => x.ciclo.id === id);
    await caso('08/17: Matemática 6º numa turma; escola SEM linha de módulo funciona (global)', async () => {
      assert.equal(await prisma.escolaModulo.count({ where: { escolaId: escA.id } }), 0);
      const m = doCiclo(await minhas(), c1); assert.equal(m.length, 1); assert.equal(m[0].validoPara.length, 1);
    });
    await vinc(tA62.id, p1.id, mat.id);
    await caso('09: mesma combinação em duas turmas da mesma escola -> UMA entrega', async () => {
      const m = doCiclo(await minhas(), c1); assert.equal(m.length, 1); assert.equal(m[0].validoPara.length, 2);
    });
    await vinc(tB61.id, p1.id, mat.id);
    await caso('10: mesma combinação em duas escolas -> UMA entrega cobrindo 3 turmas', async () => {
      const m = doCiclo(await minhas(), c1); assert.equal(m.length, 1);
      assert.equal(m[0].validoPara.length, 3); assert.equal(new Set(m[0].validoPara.map((v) => v.escolaNome)).size, 2);
    });
    await vinc(tA61.id, p1.id, cie.id);
    await vinc(tA71.id, p1.id, mat.id);
    await caso('11/12: Ciências 6º e Matemática 7º são entregas diferentes', async () => {
      const m = doCiclo(await minhas(), c1); assert.equal(m.length, 3);
      assert.equal(new Set(m.map((x) => `${x.anoSerie}:${x.disciplinaId}`)).size, 3);
    });
    await caso('18: escola só com Educação Infantil / turma de outro ano letivo / escola sem turma NÃO geram entrega', async () => {
      await vinc(tInf.id, p1.id, mat.id); await vinc(tAnoOutro.id, p1.id, mat.id);
      const m = doCiclo(await minhas(), c1); assert.equal(m.length, 3);
      const painel = (await chamar(tSec, 'GET', `/ciclos/${c1}/painel`)).json;
      const escolasNoPainel = new Set(painel.linhas.flatMap((l: { turmas: Array<{ escolaNome: string }> }) => l.turmas.map((t) => t.escolaNome)));
      for (const nome of [escInfantil.nome, escSemTurma.nome]) assert.equal(escolasNoPainel.has(nome), false, nome);
    });
    await caso('escola INATIVA com vínculo em andamento não entra num ciclo em curso', async () => {
      await vinc(tInativa.id, p3.id, mat.id);
      const painel = (await chamar(tSec, 'GET', `/ciclos/${c1}/painel`)).json;
      assert.equal(painel.linhas.some((l: { professorId: number }) => l.professorId === p3.id), false);
    });
    await caso('13: outro ciclo -> outra entrega (mesma combinação em c1 e c4 são independentes)', async () => {
      const todas = await minhas();
      assert.equal(doCiclo(todas, c1).length, 3); assert.equal(doCiclo(todas, c4).length, 3);
    });

    // =================== PREENCHIMENTO ===================
    console.log('\nPreenchimento');
    const caminho = (cid: number, serie: number, disc: number) => `/ciclos/${cid}/formularios/${serie}/${disc}`;
    const semanasDe = async (cid = c1) => (await chamar(tP1, 'GET', caminho(cid, 6, mat.id))).json.semanas as Array<{ id: number }>;
    const put = (t: string, cid: number, serie: number, disc: number, base: string | null, respostas: Array<{ semanaId: number; texto: string }>) => chamar(t, 'PUT', `${caminho(cid, serie, disc)}/respostas`, { baseUpdatedAt: base, respostas });
    let upd: string | null = null;
    await caso('19/20: salvar rascunho parcial (avançar etapas) mantém "em andamento"; GET novo recupera (reload)', async () => {
      const s = await semanasDe();
      const r = await put(tP1, c1, 6, mat.id, null, [{ semanaId: s[0].id, texto: 'Frações' }, { semanaId: s[1].id, texto: '' }]);
      assert.equal(r.status, 200, JSON.stringify(r.json)); upd = r.json.updatedAt;
      assert.equal(r.json.status, 'em_andamento');
      const g = await chamar(tP1, 'GET', caminho(c1, 6, mat.id));
      assert.equal(g.json.semanas[0].texto, 'Frações'); assert.equal(g.json.status, 'em_andamento');
    });
    await caso('uma única entrega no banco para a combinação; cobertura com 1 linha por vínculo', async () => {
      assert.equal(await prisma.entregaUmTerco.count({ where: { cicloId: c1, professorId: p1.id, anoSerie: 6, disciplinaId: mat.id } }), 1);
      assert.equal(await prisma.coberturaEntregaUmTerco.count({ where: { entrega: { cicloId: c1, professorId: p1.id, anoSerie: 6, disciplinaId: mat.id } } }), 3);
    });
    await caso('13: a mesma combinação em outro ciclo é outra entrega (c4) e as respostas não vazam entre ciclos', async () => {
      const s4 = await semanasDe(c4);
      const r = await put(tP1, c4, 6, mat.id, null, [{ semanaId: s4[0].id, texto: 'Ciclo B' }]);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(await prisma.entregaUmTerco.count({ where: { professorId: p1.id, anoSerie: 6, disciplinaId: mat.id } }), 2);
      assert.equal((await chamar(tP1, 'GET', caminho(c1, 6, mat.id))).json.semanas[0].texto, 'Frações');
    });
    await caso('42: segunda aba com updatedAt antigo -> 409 CONFLITO_VERSAO, sem sobrescrever', async () => {
      const s = await semanasDe();
      const ok1 = await put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[1].id, texto: 'Decimais' }]);
      assert.equal(ok1.status, 200); const novo = ok1.json.updatedAt;
      const velho = await put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[1].id, texto: 'SOBRESCRITA' }]);
      assert.equal(velho.status, 409); assert.equal(velho.json.codigo, 'CONFLITO_VERSAO');
      assert.equal(velho.json.dadosAtuais.semanas[1].texto, 'Decimais'); upd = novo;
    });
    await caso('39/41: duas abas criando a MESMA entrega ao mesmo tempo -> uma vence, outra 409, 1 registro', async () => {
      await vinc(tA64.id, p2.id, mat.id);
      const s = (await chamar(tP2, 'GET', caminho(c1, 6, mat.id))).json.semanas as Array<{ id: number }>;
      const [a, b] = await Promise.all([put(tP2, c1, 6, mat.id, null, [{ semanaId: s[0].id, texto: 'aba1' }]), put(tP2, c1, 6, mat.id, null, [{ semanaId: s[0].id, texto: 'aba2' }])]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
      assert.equal(await prisma.entregaUmTerco.count({ where: { cicloId: c1, professorId: p2.id, anoSerie: 6, disciplinaId: mat.id } }), 1);
    });
    await caso('39: duas gravações simultâneas com a MESMA versão -> uma 200 e outra 409', async () => {
      const s = await semanasDe();
      const [a, b] = await Promise.all([put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[2].id, texto: 'A' }]), put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[2].id, texto: 'B' }])]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
      upd = (await chamar(tP1, 'GET', caminho(c1, 6, mat.id))).json.updatedAt;
    });
    await caso('texto grande demais -> 400; semana de outro ciclo -> 400; professor sem vínculo -> 403/404', async () => {
      const s = await semanasDe();
      assert.equal((await put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[0].id, texto: 'x'.repeat(10001) }])).status, 400);
      const s4 = await semanasDe(c4);
      assert.equal((await put(tP1, c1, 6, mat.id, upd, [{ semanaId: s4[0].id, texto: 'x' }])).status, 400);
      assert.equal((await chamar(tP2, 'GET', caminho(c1, 7, mat.id))).status, 404);
      assert.equal((await put(tP2, c1, 7, mat.id, null, [{ semanaId: s[0].id, texto: 'x' }])).status, 403);
    });

    console.log('\nConclusão');
    await caso('21/22/23: concluir com semana vazia -> 400 listando as faltantes; segue em andamento', async () => {
      const r = await chamar(tP1, 'POST', `${caminho(c1, 6, mat.id)}/concluir`, { baseUpdatedAt: upd });
      assert.equal(r.status, 400); assert.match(r.json.message, /Semana 4/);
      assert.equal((await chamar(tP1, 'GET', caminho(c1, 6, mat.id))).json.status, 'em_andamento');
    });
    await caso('22/40: concluir com tudo preenchido; duplo clique simultâneo -> sucesso nos dois, 1 evento', async () => {
      const s = await semanasDe();
      const salvo = await put(tP1, c1, 6, mat.id, upd, s.map((x, i) => ({ semanaId: x.id, texto: `Conteúdo ${i + 1}` })));
      assert.equal(salvo.status, 200); upd = salvo.json.updatedAt;
      const [a, b] = await Promise.all([chamar(tP1, 'POST', `${caminho(c1, 6, mat.id)}/concluir`, { baseUpdatedAt: upd }), chamar(tP1, 'POST', `${caminho(c1, 6, mat.id)}/concluir`, { baseUpdatedAt: upd })]);
      assert.equal(a.status, 200, JSON.stringify(a.json)); assert.equal(b.status, 200, JSON.stringify(b.json));
      assert.equal(a.json.status, 'concluida');
      assert.equal(await prisma.historicoEntregaUmTerco.count({ where: { tipo: 'CONCLUIDA', entrega: { cicloId: c1, professorId: p1.id, anoSerie: 6, disciplinaId: mat.id } } }), 1);
      upd = (await chamar(tP1, 'GET', caminho(c1, 6, mat.id))).json.updatedAt;
    });
    await caso('24: editar depois de concluir, antes do prazo, é permitido e segue concluído', async () => {
      const s = await semanasDe();
      const r = await put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[0].id, texto: 'Frações (revisado)' }]);
      assert.equal(r.status, 200); assert.equal(r.json.status, 'concluida'); upd = r.json.updatedAt;
    });

    // =================== COBERTURA E VÍNCULOS ===================
    console.log('\nCobertura e vínculos');
    await caso('14: novo vínculo equivalente DURANTE a janela entra na MESMA entrega (sem duplicar)', async () => {
      const t = await turma(escA.id, 6, 3);
      await vinc(t.id, p1.id, mat.id, dia(0));
      const s = await semanasDe();
      const r = await put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[0].id, texto: 'Frações (revisado 2)' }]);
      assert.equal(r.status, 200); upd = r.json.updatedAt;
      assert.equal(r.json.validoPara.length, 4);
      assert.equal(await prisma.entregaUmTerco.count({ where: { cicloId: c1, professorId: p1.id, anoSerie: 6, disciplinaId: mat.id } }), 1);
      assert.equal(await prisma.coberturaEntregaUmTerco.count({ where: { entrega: { cicloId: c1, professorId: p1.id, anoSerie: 6, disciplinaId: mat.id } } }), 4);
    });
    await caso('15/9: vínculo encerrado preserva a entrega e registra o período na cobertura', async () => {
      await prisma.professorTurmaDisciplina.updateMany({ where: { turmaId: tB61.id, professorId: p1.id, disciplinaId: mat.id }, data: { status: 'ENCERRADO', dataFim: dia(0) } });
      const s = await semanasDe();
      const r = await put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[1].id, texto: 'Decimais (revisado)' }]);
      assert.equal(r.status, 200); upd = r.json.updatedAt;
      assert.equal(r.json.validoPara.length, 3);
      const h = r.json.coberturaHistorica.find((c: { turmaId: number }) => c.turmaId === tB61.id);
      assert.ok(h && h.ate && h.desde, 'cobertura da turma encerrada deve manter desde/ate');
      assert.equal(await prisma.entregaUmTerco.count({ where: { cicloId: c1, professorId: p1.id, anoSerie: 6, disciplinaId: mat.id } }), 1);
    });
    await caso('16/29: esperado histórico (c2 encerrado): vínculo da janela entra mesmo já encerrado; vínculo nascido depois NÃO entra', async () => {
      await vinc(tA92.id, p5.id, mat.id, dia(-15)); // começou dentro da janela de c2
      await prisma.professorTurmaDisciplina.updateMany({ where: { turmaId: tA92.id, professorId: p5.id }, data: { status: 'ENCERRADO', dataFim: dia(-12) } });
      await vinc(tA91.id, p4.id, cie.id, dia(-9)); // nasceu DEPOIS do prazo de c2 (-10d)
      const painel = (await chamar(tSec, 'GET', `/ciclos/${c2}/painel`)).json;
      assert.equal(painel.linhas.some((l: { professorId: number }) => l.professorId === p5.id), true, 'p5 teve vínculo na janela');
      assert.equal(painel.linhas.some((l: { professorId: number }) => l.professorId === p4.id), false, 'p4 só ganhou vínculo depois do prazo');
      const painel1 = (await chamar(tSec, 'GET', `/ciclos/${c1}/painel`)).json;
      assert.equal(painel1.linhas.some((l: { professorId: number }) => l.professorId === p4.id), true, 'p4 entra no ciclo seguinte');
      assert.equal(painel1.linhas.some((l: { professorId: number }) => l.professorId === p5.id), false, 'p5 encerrou antes da janela de c1');
    });
    await caso('38: histórico de c2 não muda quando o estado ATUAL muda (professor inativo, turma inativa, vínculo apagado da lista ativa)', async () => {
      const foto = async () => JSON.stringify((await chamar(tSec, 'GET', `/ciclos/${c2}/painel`)).json.linhas.map((l: { professorId: number; anoSerie: number; disciplinaId: number; status: string }) => [l.professorId, l.anoSerie, l.disciplinaId, l.status]));
      const antes2 = await foto();
      await prisma.pessoa.update({ where: { id: p5.id }, data: { status: 'INATIVO' } });
      await prisma.turma.update({ where: { id: tA92.id }, data: { status: 'INATIVA' } });
      await prisma.escola.update({ where: { id: escB.id }, data: { status: 'INATIVA' } });
      assert.equal(await foto(), antes2);
      await prisma.pessoa.update({ where: { id: p5.id }, data: { status: 'ATIVO' } });
      await prisma.turma.update({ where: { id: tA92.id }, data: { status: 'ATIVA' } });
      await prisma.escola.update({ where: { id: escB.id }, data: { status: 'ATIVA' } });
    });

    // =================== PRAZO E REABERTURA ===================
    console.log('\nPrazo e reabertura');
    await caso('25: após o prazo -> somente leitura (PUT 400, editavelAgora=false)', async () => {
      await prisma.cicloUmTerco.update({ where: { id: c1 }, data: { prazoEm: new Date(Date.now() - 60000) } });
      assert.equal((await chamar(tP1, 'GET', caminho(c1, 6, mat.id))).json.editavelAgora, false);
      const s = await semanasDe();
      const r = await put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[0].id, texto: 'tarde demais' }]);
      assert.equal(r.status, 400); assert.match(r.json.message, /prazo/i);
      assert.equal((await chamar(tP1, 'POST', `${caminho(c1, 6, mat.id)}/concluir`, { baseUpdatedAt: upd })).status, 400);
    });
    await caso('26/27: reabertura só pela Secretaria; libera a edição sem alterar o prazo original', async () => {
      const prazoOriginal = (await prisma.cicloUmTerco.findUniqueOrThrow({ where: { id: c1 } })).prazoEm.getTime();
      assert.equal((await chamar(tP1, 'POST', `/ciclos/${c1}/reaberturas`, { inicioEm: new Date().toISOString(), fimEm: new Date(Date.now() + 3600000).toISOString() })).status, 403);
      const r = await chamar(tSec, 'POST', `/ciclos/${c1}/reaberturas`, { inicioEm: new Date(Date.now() - 3600000).toISOString(), fimEm: new Date(Date.now() + DIA_MS).toISOString(), motivo: 'teste' });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.equal((await prisma.cicloUmTerco.findUniqueOrThrow({ where: { id: c1 } })).prazoEm.getTime(), prazoOriginal);
      const s = await semanasDe();
      const w = await put(tP1, c1, 6, mat.id, upd, [{ semanaId: s[0].id, texto: 'Frações (reaberto)' }]);
      assert.equal(w.status, 200, JSON.stringify(w.json)); upd = w.json.updatedAt;
    });
    await caso('28: reabertura sobreposta -> 400; fim antes do início -> 400', async () => {
      const ini = new Date(Date.now() - 1800000).toISOString(); const fim = new Date(Date.now() + 1800000).toISOString();
      const a = await chamar(tSec, 'POST', `/ciclos/${c1}/reaberturas`, { inicioEm: ini, fimEm: fim });
      assert.equal(a.status, 400); assert.match(a.json.message, /sobreposto/);
      assert.equal((await chamar(tSec, 'POST', `/ciclos/${c1}/reaberturas`, { inicioEm: fim, fimEm: ini })).status, 400);
    });
    await caso('28: duas reaberturas sobrepostas ao mesmo tempo -> uma 201, outra 400', async () => {
      const ini = new Date(Date.now() + 5 * DIA_MS); const fim = new Date(Date.now() + 6 * DIA_MS);
      const mk2 = () => chamar(tSec, 'POST', `/ciclos/${c1}/reaberturas`, { inicioEm: ini.toISOString(), fimEm: fim.toISOString() });
      const [a, b] = await Promise.all([mk2(), mk2()]);
      assert.deepEqual([a.status, b.status].sort(), [201, 400]);
    });
    await caso('editar ciclo com preenchimento: quantidade de semanas travada; datas editáveis', async () => {
      const menos = await chamar(tSec, 'PUT', `/ciclos/${c1}`, ciclo({ semanas: quatroSemanas.slice(0, 3) }));
      assert.equal(menos.status, 409);
      const mesmas = await chamar(tSec, 'PUT', `/ciclos/${c1}`, ciclo({ prazoEm: `${ANO}-09-15T22:00` }));
      assert.equal(mesmas.status, 200, JSON.stringify(mesmas.json));
      const troca = await chamar(tSec, 'PUT', `/ciclos/${c1}`, ciclo({ trimestre: 2 }));
      assert.equal(troca.status, 409);
      await prisma.cicloUmTerco.update({ where: { id: c1 }, data: { abreEm: new Date(Date.now() - DIA_MS), prazoEm: new Date(Date.now() + 30 * DIA_MS) } });
    });

    // =================== PAINEL ===================
    console.log('\nPainel de entregas (c1)');
    await vinc(tA71.id, p2.id, cie.id); // p2 ainda não iniciou Ciências 7º
    const painelC1 = async (q = '') => (await chamar(tSec, 'GET', `/ciclos/${c1}/painel${q}`)).json;
    await caso('29-33: esperado, concluído, em andamento, não iniciado e % — por entrega ÚNICA, sem duplicar por turma/escola', async () => {
      const r = await chamar(tSec, 'GET', `/ciclos/${c1}/painel`);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      // p1: Mat6(concluída; 3 turmas/2 escolas) + Ciên6 + Mat7 | p2: Mat6(em andamento) + Ciên7 | p4: Ciên9
      assert.equal(r.json.resumo.esperado, 6);
      assert.equal(r.json.resumo.concluidas, 1);
      assert.equal(r.json.resumo.emAndamento, 1);
      assert.equal(r.json.resumo.naoIniciadas, 4);
      assert.equal(r.json.resumo.percentualEntrega, 17);
      const mat6 = r.json.linhas.filter((l: { professorId: number; anoSerie: number; disciplinaId: number }) => l.professorId === p1.id && l.anoSerie === 6 && l.disciplinaId === mat.id);
      assert.equal(mat6.length, 1); assert.equal(mat6[0].status, 'concluida'); assert.ok(mat6[0].turmas.length >= 3);
    });
    await caso('34: filtro por escola (cobertura) sem multiplicar a entrega', async () => {
      const r = await painelC1(`?escolaId=${escB.id}`);
      assert.equal(r.linhas.length, 1); assert.equal(r.linhas[0].professorId, p1.id);
      const a = await painelC1(`?escolaId=${escA.id}`);
      assert.equal(a.linhas.filter((l: { professorId: number; anoSerie: number; disciplinaId: number }) => l.professorId === p1.id && l.anoSerie === 6 && l.disciplinaId === mat.id).length, 1);
    });
    await caso('35: filtro por disciplina', async () => {
      const r = await painelC1(`?disciplinaId=${cie.id}`);
      assert.ok(r.linhas.length >= 3 && r.linhas.every((l: { disciplinaId: number }) => l.disciplinaId === cie.id));
    });
    await caso('36: filtro por ano/série', async () => {
      const r = await painelC1('?anoSerie=7');
      assert.ok(r.linhas.length >= 1 && r.linhas.every((l: { anoSerie: number }) => l.anoSerie === 7));
    });
    await caso('37: filtro por Professor e por status', async () => {
      const r = await painelC1(`?professorId=${p2.id}`);
      assert.equal(r.linhas.length, 2); assert.ok(r.linhas.every((l: { professorId: number }) => l.professorId === p2.id));
      assert.equal((await painelC1('?status=concluida')).linhas.length, 1);
      assert.equal((await painelC1('?status=nao_iniciado')).linhas.length, 4);
    });
    await caso('38: mudar o vínculo ATUAL não reescreve o esperado de um ciclo ENCERRADO (c2 idêntico antes/depois)', async () => {
      const fotoC2 = async () => (await chamar(tSec, 'GET', `/ciclos/${c2}/painel`)).json.resumo.esperado;
      const antes2 = await fotoC2();
      const novaTurma = await turma(escA.id, 9, 3);
      await vinc(novaTurma.id, p4.id, mat.id, dia(0)); // vínculo novo, depois do prazo de c2
      await prisma.professorTurmaDisciplina.updateMany({ where: { turmaId: tA61.id, professorId: p1.id, disciplinaId: cie.id }, data: { status: 'ENCERRADO', dataFim: dia(0) } });
      assert.equal(await fotoC2(), antes2);
    });
    await caso('Secretaria consulta um preenchimento (leitura, com histórico e cobertura)', async () => {
      const r = await chamar(tSec, 'GET', `/ciclos/${c1}/entregas/${p1.id}/6/${mat.id}`);
      assert.equal(r.status, 200); assert.equal(r.json.editavelAgora, false);
      assert.ok(r.json.historico.length >= 3); assert.ok(r.json.coberturaHistorica.length >= 4);
    });
    await caso('43: nenhuma resposta 5xx inesperada em toda a bateria', async () => { assert.equal(respostas5xx, 0); });

    console.log('\nOffline (navegador)');
    for (const n of ['44 digitar offline', '45 reload', '46 recuperar rascunho', '47 reconectar', '48 sincronizar', '49 concluir somente online']) naoTestado(n, 'exige navegador real; não executado nesta bateria');
  } finally {
    server.close();
    await limpar();
    const depois = await contagens();
    console.log('\nContagens DEPOIS:', JSON.stringify(depois));
    const diff = Object.keys(antes).filter((k) => (antes as Record<string, number>)[k] !== (depois as Record<string, number>)[k]);
    console.log(diff.length === 0 ? 'Limpeza: contagens idênticas às de antes — nenhum resíduo.' : `ATENÇÃO: contagens diferentes em ${diff.join(', ')}`);
    await prisma.$disconnect();
  }
  console.log(`\n${ok} ok, ${falhas} falhas`);
  process.exitCode = falhas ? 1 : 0;
}

main().catch(async (e) => { console.error(e); try { await limpar(); } catch { /* */ } await prisma.$disconnect(); process.exit(1); });
