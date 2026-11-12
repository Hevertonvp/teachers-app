// BATERIA PESADA do Formulário 1/3 (12/11/2026) — comportamento real pela API, SÓ BANCO LOCAL.
// Recusa rodar se DATABASE_URL não for localhost. Todos os dados artificiais têm o prefixo ZZE2E-UMTERCO-;
// os IDs criados ficam em REGISTRO (arquivo JSON) e a limpeza apaga SOMENTE esses IDs. Nunca toca em dado existente:
// não usa pessoas/escolas/ciclos já existentes para nada que grave (o ciclo local #1 só é LIDO pela regra de
// sobreposição). Trimestres artificiais usam o ano 2099 (não existe no calendário real).
//   DATABASE_URL=postgresql://homolog:homolog@localhost:54329/nexo_homolog TZ=UTC npx tsx scripts/umTerco/bateria-e2e-um-terco.ts <registro.json>
//   ... --so-datas   (só as checagens puras de data/fuso, para rodar com outros TZ)
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

// --tz=Area/Cidade: fuso do PROCESSO (simula servidor em outro fuso). No Windows o Git Bash não repassa TZ com '/'.
const argTz = process.argv.find((x) => x.startsWith('--tz='));
if (argTz) process.env.TZ = argTz.slice(5);
const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error('Recusado: só roda contra o banco LOCAL.'); process.exit(1); }
process.env.JWT_SECRET ||= 'teste-local-bateria-um-terco-apenas-homologacao-0123456789';
const ARQ_REGISTRO = process.argv.find((a) => a.endsWith('.json')) ?? 'registro-bateria.json';
const SO_DATAS = process.argv.includes('--so-datas');

const H = 3600000; const DIA = 24 * H;
const P = 'ZZE2E-UMTERCO-';
const resultados: { secao: string; nome: string; ok: boolean; erro?: string }[] = [];
let secaoAtual = '';
const secao = (s: string) => { secaoAtual = s; console.log(`\n— ${s} —`); };
const caso = async (nome: string, fn: () => Promise<void>) => {
  try { await fn(); resultados.push({ secao: secaoAtual, nome, ok: true }); console.log(`  ok  ${nome}`); }
  catch (e) { const erro = (e as Error).message.split('\n').slice(0, 6).join(' | '); resultados.push({ secao: secaoAtual, nome, ok: false, erro }); console.error(`FALHOU ${nome}\n    ${erro}`); }
};
const diaSp = (offset = 0, base = Date.now()) => new Date(base - 3 * H + offset * DIA).toISOString().slice(0, 10);
const dataDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const inicioDoDiaSp = (iso: string) => new Date(`${iso}T00:00:00-03:00`);

// ===================== Datas e fuso (puras, sem banco) =====================
const dom = await import('../../src/domain/umTerco.js');
const domCargos = await import('../../src/domain/cargos.js');
secao(`6/datas. Fuso (processo TZ=${process.env.TZ ?? '(padrão)'}; offset local ${new Date().getTimezoneOffset()} min)`);
await caso('"2026-11-12T00:00" (tela) vira 03:00 UTC, em qualquer fuso do servidor', async () => {
  assert.equal(dom.lerInstante('2026-11-12T00:00', 'x').toISOString(), '2026-11-12T03:00:00.000Z');
  assert.equal(dom.lerInstante('2026-11-12T23:59', 'x').toISOString(), '2026-11-13T02:59:00.000Z');
});
await caso('Dia de São Paulo correto nas viradas (21:00–23:59 SP já é o dia seguinte em UTC)', async () => {
  assert.equal(dom.dataLocalSp(new Date('2026-11-13T02:30:00Z')), '2026-11-12');
  assert.equal(dom.dataLocalSp(new Date('2026-11-13T03:00:00Z')), '2026-11-13');
});
await caso('Abertura "hoje" aceita até 23:59 SP mesmo quando o UTC já virou o dia', async () => {
  const abre = dom.lerInstante('2026-11-12T00:00', 'x');
  dom.exigirAberturaNaoPassada(abre, new Date('2026-11-13T02:59:00Z'));
  assert.throws(() => dom.exigirAberturaNaoPassada(abre, new Date('2026-11-13T03:00:01Z')), /passado/);
});
await caso('Ciclo que abre hoje 00:00 já está aberto às 00:01 SP e às 23:59 SP', async () => {
  const c = { abreEm: dom.lerInstante('2026-11-12T00:00', 'x'), prazoEm: dom.lerInstante('2026-11-20T23:59', 'x') };
  assert.equal(dom.statusDoCiclo(c, new Date('2026-11-12T03:01:00Z')), 'aberto');
  assert.equal(dom.statusDoCiclo(c, new Date('2026-11-13T02:59:00Z')), 'aberto');
  assert.equal(dom.statusDoCiclo(c, new Date('2026-11-12T02:59:00Z')), 'agendado');
  assert.equal(dom.statusDoCiclo(c, new Date('2026-11-21T03:00:00Z')), 'encerrado');
});
await caso('Corte do ciclo = 23:59:59.999 SP do dia da abertura (independe do TZ do servidor)', async () => {
  assert.equal(domCargos.corteDoCiclo(dom.lerInstante('2026-11-12T00:00', 'x')).toISOString(), '2026-11-13T02:59:59.999Z');
  assert.equal(domCargos.corteDoCiclo(dom.lerInstante('2026-11-12T22:30', 'x')).toISOString(), '2026-11-13T02:59:59.999Z');
});
if (SO_DATAS) {
  const f = resultados.filter((r) => !r.ok).length;
  console.log(`\nDATAS (TZ=${process.env.TZ}): ${resultados.length - f} ok, ${f} falhas`);
  process.exit(f ? 1 : 0);
}

// ===================== Infra (banco local + app no processo) =====================
const { prisma } = await import('../../src/lib/prisma.js');
const { createApp } = await import('../../src/api/app.js');
const { assinarToken } = await import('../../src/api/middleware/auth.js');
const [{ current_database }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
if (current_database !== 'nexo_homolog') { console.error('Recusado: banco inesperado ' + current_database); process.exit(1); }

const reg = { pessoas: [] as number[], escolas: [] as number[], disciplinas: [] as number[], ciclos: [] as number[], periodos: [] as { ano: number; trimestre: number }[], atuacoes: [] as number[] };
const salvarRegistro = () => writeFileSync(ARQ_REGISTRO, JSON.stringify(reg, null, 1));

async function limpar(ids = reg) {
  const pessoas = ids.pessoas; const escolas = ids.escolas;
  const ciclos = [...ids.ciclos, ...(await prisma.cicloUmTerco.findMany({ where: { titulo: { startsWith: P } }, select: { id: true } })).map((c) => c.id)];
  const entregas = (await prisma.entregaUmTerco.findMany({ where: { OR: [{ cicloId: { in: ciclos } }, { professorId: { in: pessoas } }] }, select: { id: true } })).map((e) => e.id);
  await prisma.historicoCorrecaoSemanaUmTerco.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.correcaoEntregaUmTerco.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.historicoEntregaUmTerco.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.respostaSemanaUmTerco.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.entregaUmTercoCargo.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.entregaUmTerco.deleteMany({ where: { id: { in: entregas } } });
  await prisma.reaberturaUmTerco.deleteMany({ where: { cicloId: { in: ciclos } } });
  await prisma.semanaUmTerco.deleteMany({ where: { cicloId: { in: ciclos } } });
  await prisma.cicloUmTercoEscola.deleteMany({ where: { cicloId: { in: ciclos } } });
  await prisma.cicloUmTerco.deleteMany({ where: { id: { in: ciclos } } });
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: pessoas } }, select: { id: true } })).map((c) => c.id);
  await prisma.cargoVersao.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoProfessor.deleteMany({ where: { id: { in: cargos } } });
  // Conversas/mensagens/notificações das correções: só as que envolvem pessoas ou escolas artificiais.
  const convs = (await prisma.conversaMensagem.findMany({ where: { OR: [{ escolaId: { in: escolas } }, { participantes: { some: { pessoaId: { in: pessoas } } } }] }, select: { id: true } })).map((c) => c.id);
  await prisma.mensagem.deleteMany({ where: { OR: [{ conversaId: { in: convs } }, { remetenteId: { in: pessoas } }] } });
  await prisma.participanteConversa.deleteMany({ where: { OR: [{ conversaId: { in: convs } }, { pessoaId: { in: pessoas } }] } });
  await prisma.conversaMensagem.deleteMany({ where: { id: { in: convs } } });
  await prisma.notificacao.deleteMany({ where: { destinatarioId: { in: pessoas } } });
  await prisma.vinculoEscolar.deleteMany({ where: { OR: [{ pessoaId: { in: pessoas } }, { escolaId: { in: escolas } }] } });
  await prisma.pessoaEvento.deleteMany({ where: { OR: [{ pessoaId: { in: pessoas } }, { autorId: { in: pessoas } }] } });
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
  await prisma.disciplina.deleteMany({ where: { id: { in: ids.disciplinas } } });
  await prisma.atuacaoPedagogica.deleteMany({ where: { id: { in: ids.atuacoes } } });
  for (const p of ids.periodos) await prisma.periodoTrimestre.deleteMany({ where: { ano: p.ano, trimestre: p.trimestre } });
}

const server = createApp().listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
let respostas5xx = 0;
type R = { status: number; json: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const api = async (token: string, metodo: string, caminho: string, corpo?: unknown): Promise<R> => {
  const r = await fetch(`${base}/api${caminho}`, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const json = await r.json().catch(() => null);
  if (r.status >= 500) { respostas5xx += 1; console.error(`    !! 5xx em ${metodo} ${caminho}: ${r.status} ${JSON.stringify(json).slice(0, 200)}`); }
  return { status: r.status, json };
};
const st = (r: R, esperado: number) => assert.equal(r.status, esperado, `HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 220)}`);

let seq = 0;
const mkPessoa = async (rotulo: string, perfil: 'SECRETARIA' | 'PROFESSOR' | 'DIRETORA' | 'GESTOR' | 'AUXILIAR') => {
  seq += 1;
  const p = await prisma.pessoa.create({ data: { nome: `${P}${rotulo}`, email: `${P.toLowerCase()}${rotulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${seq}@teste.invalid`, perfil, status: 'ATIVO' } });
  reg.pessoas.push(p.id); salvarRegistro();
  return p;
};
const tk = async (id: number) => assinarToken(await prisma.pessoa.findUniqueOrThrow({ where: { id } }));
const mkEscola = async (n: string) => { const e = await prisma.escola.create({ data: { nome: `${P}${n}` } }); reg.escolas.push(e.id); salvarRegistro(); return e; };
const mkDisc = async (n: string) => { const d = await prisma.disciplina.create({ data: { nome: `${P}${n}` } }); reg.disciplinas.push(d.id); salvarRegistro(); return d; };
type Parte = { escolaId: number; disciplinaIds: number[]; atuacaoIds: number[] };
const C = (...itens: [number, number[], number[]?][]): Parte[] => itens.map(([escolaId, disciplinaIds, atuacaoIds]) => ({ escolaId, disciplinaIds, atuacaoIds: atuacaoIds ?? [] }));


try {
  // ---------- Massa artificial ----------
  const sec = await mkPessoa('Secretaria', 'SECRETARIA'); const tSec = await tk(sec.id);
  const dir = await mkPessoa('Diretora A', 'DIRETORA'); const gestor = await mkPessoa('Gestor', 'GESTOR'); const aux = await mkPessoa('Auxiliar', 'AUXILIAR');
  const EA = await mkEscola('Escola A'); const EB = await mkEscola('Escola B'); const EC = await mkEscola('CMEI C');
  const ED = await mkEscola('Escola D ciclos'); const EE = await mkEscola('Escola E ciclos');
  const EP1 = await mkEscola('Escola P1 painel'); const EP2 = await mkEscola('Escola P2 painel');
  await prisma.vinculoEscolar.create({ data: { escolaId: EA.id, pessoaId: dir.id, status: 'ATIVO', dataInicio: new Date() } });
  await prisma.vinculoEscolar.create({ data: { escolaId: EA.id, pessoaId: gestor.id, status: 'ATIVO', dataInicio: new Date() } });
  await prisma.vinculoEscolar.create({ data: { escolaId: EA.id, pessoaId: aux.id, status: 'ATIVO', dataInicio: new Date() } });
  const tDir = await tk(dir.id); const tGes = await tk(gestor.id); const tAux = await tk(aux.id);
  const ING = await mkDisc('Ingles'); const GEO = await mkDisc('Geografia'); const MAT = await mkDisc('Matematica'); const ART = await mkDisc('Arte');
  const regente = await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { nome: 'Professor Regente' } });
  const oficina = await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { nome: 'Oficina do Brincar' } });
  const intervencao = await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { nome: 'Professor de Intervenção' } });
  // Ciclos pela API usam o calendário REAL já cadastrado (só leitura): 3º tri/2026 para "hoje" e 1º tri/2027 (fev–abr)
  // para os futuros, sempre nas escolas artificiais D/E. Sem calendário artificial (o banco exige datas no próprio ano).
  const tri2027 = await prisma.periodoTrimestre.findUniqueOrThrow({ where: { ano_trimestre: { ano: 2027, trimestre: 1 } } });
  const tri2026 = await prisma.periodoTrimestre.findUniqueOrThrow({ where: { ano_trimestre: { ano: 2026, trimestre: 3 } } });

  let nProf = 0;
  const novoProfessor = async (cargos: { dataInicio?: string; composicao: unknown }[], token = tSec) => {
    nProf += 1;
    const email = `${P.toLowerCase()}prof${nProf}@teste.invalid`;
    const r = await api(token, 'POST', '/pessoas/professores', { nome: `${P}Prof ${nProf}`, email, cargos: cargos.map((c) => ({ dataInicio: c.dataInicio ?? diaSp(-30), composicao: c.composicao })) });
    const pessoa = await prisma.pessoa.findUnique({ where: { email } });
    if (pessoa && !reg.pessoas.includes(pessoa.id)) { reg.pessoas.push(pessoa.id); salvarRegistro(); }
    st(r, 201);
    const atual = await prisma.pessoa.update({ where: { email }, data: { senhaTemporaria: false } });
    return { id: atual.id, email, token: assinarToken(atual) };
  };
  type CargoTela = { id: number; rotulo: string; status: string; dataInicio: string; dataFim: string | null; updatedAt: string; composicao: { escolaId: number; disciplinas: { id: number; nome: string }[]; atuacoes: { id: number; nome: string }[] }[] };
  const cargosDe = async (id: number, encerrados = false) => (await api(tSec, 'GET', `/pessoas/professores/${id}/cargos${encerrados ? '?incluirEncerrados=1' : ''}`)).json as CargoTela[];
  const vincAtivos = async (id: number) => (await prisma.vinculoEscolar.findMany({ where: { pessoaId: id, status: 'ATIVO' }, select: { escolaId: true } })).map((v) => v.escolaId).sort((a, b) => a - b);
  // "Cadastrado antes da abertura": recua cadastro do cargo e da 1ª versão.
  const recuar = async (professorId: number, horas: number) => {
    const quando = new Date(Date.now() - horas * H);
    for (const c of await prisma.cargoProfessor.findMany({ where: { professorId }, select: { id: true } })) {
      await prisma.cargoProfessor.update({ where: { id: c.id }, data: { createdAt: quando } });
      await prisma.cargoVersao.updateMany({ where: { cargoId: c.id }, data: { criadaEm: quando } });
    }
  };
  // Ciclo artificial direto no banco (para datas no passado, que a API não permite criar).
  const novoCiclo = async (o: { abreEm?: Date; prazoEm?: Date; escolas?: number[]; semanas?: number } = {}) => {
    const abreEm = o.abreEm ?? inicioDoDiaSp(diaSp(-1));
    const prazoEm = o.prazoEm ?? new Date(abreEm.getTime() + 10 * DIA);
    const n = o.semanas ?? 3;
    const c = await prisma.cicloUmTerco.create({
      data: {
        anoLetivo: 2026, trimestre: 3, titulo: `${P}ciclo`, abreEm, prazoEm, todasEscolas: false,
        escolas: { create: (o.escolas ?? [EA.id, EB.id, EC.id]).map((escolaId) => ({ escolaId })) },
        semanas: { create: Array.from({ length: n }, (_, i) => ({ numero: i + 1, dataInicio: dataDb(diaSp(i * 2)), dataFim: dataDb(diaSp(i * 2 + 1)) })) },
      },
      include: { semanas: { orderBy: { numero: 'asc' } } },
    });
    reg.ciclos.push(c.id); salvarRegistro();
    return c;
  };
  type Item = { ciclo: { id: number; editavelAgora: boolean }; cargoId: number; cargoIds: number[]; compartilhada: boolean; esperada: boolean; editavelAgora: boolean; status: string; rotulo: string; composicao: { escolaId: number; escolaNome: string; disciplinas: { id: number }[]; atuacoes?: { id: number; nome: string }[] }[]; correcaoSolicitada: boolean };
  const minhas = async (token: string, cicloId: number) => { const r = await api(token, 'GET', '/formulario-um-terco/minhas'); st(r, 200); return (r.json as Item[]).filter((i) => i.ciclo.id === cicloId); };
  type Painel = { resumo: { esperado: number; concluidas: number; emAndamento: number; naoIniciadas: number; percentualEntrega: number }; linhas: (Item & { professorId: number; entregaId: number | null; status: string })[]; foraDoEsperado: (Item & { professorId: number; entregaId: number })[]; porEscola: { escolaId: number; esperado: number; concluidas: number }[] };
  const painel = async (cicloId: number, q = '') => { const r = await api(tSec, 'GET', `/formulario-um-terco/ciclos/${cicloId}/painel${q}`); st(r, 200); return r.json as Painel; };
  const folha = async (token: string, cicloId: number, cargoId: number) => api(token, 'GET', `/formulario-um-terco/ciclos/${cicloId}/cargos/${cargoId}`);
  const salvar = async (token: string, cicloId: number, cargoId: number, base: string | null, respostas: { semanaId: number; texto: string }[]) => api(token, 'PUT', `/formulario-um-terco/ciclos/${cicloId}/cargos/${cargoId}/respostas`, { baseUpdatedAt: base, respostas });
  const concluir = async (token: string, cicloId: number, cargoId: number, base: string | null = null) => api(token, 'POST', `/formulario-um-terco/ciclos/${cicloId}/cargos/${cargoId}/concluir`, { baseUpdatedAt: base });
  const preencherEConcluir = async (prof: { token: string }, ciclo: { id: number; semanas: { id: number }[] }, cargoId: number, prefixo = 'Texto') => {
    const s = await salvar(prof.token, ciclo.id, cargoId, null, ciclo.semanas.map((x, i) => ({ semanaId: x.id, texto: `${prefixo} semana ${i + 1}` })));
    st(s, 200);
    const c = await concluir(prof.token, ciclo.id, cargoId, s.json.updatedAt); st(c, 200);
    assert.equal(c.json.status, 'concluida');
    return c.json as { entregaId: number; updatedAt: string; semanas: { id: number; texto: string }[] };
  };
  const semTurma = (obj: unknown) => assert.ok(!/turma/i.test(JSON.stringify(obj)), 'apareceu "turma" no conteúdo da folha');

  // ===================== 1. Cadastro de Professor =====================
  secao('1. Cadastro de Professor (API)');
  const cad: Record<string, { id: number; email: string; token: string }> = {};
  await caso('1 cargo, 1 escola, várias disciplinas (vínculo escolar criado, rótulo Cargo 1)', async () => {
    cad.um = await novoProfessor([{ composicao: C([EA.id, [ING.id, GEO.id, MAT.id]]) }]);
    const cs = await cargosDe(cad.um.id);
    assert.deepEqual(cs.map((c) => [c.rotulo, c.composicao[0].disciplinas.length]), [['Cargo 1', 3]]);
    assert.deepEqual(await vincAtivos(cad.um.id), [EA.id]);
  });
  await caso('2 cargos, um em cada escola', async () => {
    cad.dois = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }, { composicao: C([EB.id, [GEO.id]]) }]);
    assert.deepEqual((await cargosDe(cad.dois.id)).map((c) => c.rotulo), ['Cargo 1', 'Cargo 2']);
    assert.deepEqual(await vincAtivos(cad.dois.id), [EA.id, EB.id].sort((a, b) => a - b));
  });
  await caso('Várias escolas no mesmo cargo (1 cargo, 3 escolas)', async () => {
    cad.multi = await novoProfessor([{ composicao: C([EA.id, [ING.id]], [EB.id, [ING.id]], [EC.id, [], [regente.id]]) }]);
    assert.equal((await cargosDe(cad.multi.id))[0].composicao.length, 3);
  });
  await caso('Atuação sem disciplina; disciplina + atuação', async () => {
    cad.atu = await novoProfessor([{ composicao: C([EC.id, [], [regente.id]]) }, { composicao: C([EA.id, [ART.id], [intervencao.id]]) }]);
    const cs = await cargosDe(cad.atu.id);
    assert.deepEqual(cs.map((c) => c.composicao.map((p) => [p.disciplinas.length, p.atuacoes.map((a) => a.nome)])), [[[0, ['Professor Regente']]], [[1, ['Professor de Intervenção']]]]);
  });
  await caso('Dois cargos na mesma escola (disciplinas diferentes)', async () => {
    cad.mesmaEscola = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }, { composicao: C([EA.id, [GEO.id]]) }]);
    assert.equal((await cargosDe(cad.mesmaEscola.id)).length, 2);
    assert.deepEqual(await vincAtivos(cad.mesmaEscola.id), [EA.id], 'vínculo escolar não duplica');
  });
  await caso('Dois cargos parcialmente iguais e dois exatamente equivalentes são aceitos', async () => {
    cad.parcial = await novoProfessor([{ composicao: C([EA.id, [ING.id]], [EB.id, [ING.id]]) }, { composicao: C([EA.id, [ING.id]]) }]);
    cad.iguais = await novoProfessor([{ composicao: C([EA.id, [ING.id, GEO.id]]) }, { composicao: C([EA.id, [GEO.id, ING.id]]) }]);
    assert.equal((await cargosDe(cad.iguais.id)).length, 2);
  });
  const contaPessoas = () => prisma.pessoa.count({ where: { email: { startsWith: P.toLowerCase() } } });
  await caso('Erros de cadastro: sem escola, escola/disciplina/atuação repetida, 3 cargos, escola vazia, inexistentes, data inválida → 400 e nada criado', async () => {
    const antesN = await contaPessoas();
    const tentar = async (cargos: unknown[], rx: RegExp) => {
      const r = await api(tSec, 'POST', '/pessoas/professores', { nome: `${P}Erro`, email: `${P.toLowerCase()}erro@teste.invalid`, cargos });
      assert.equal(r.status, 400, `${JSON.stringify(cargos).slice(0, 80)} → ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
      assert.match(JSON.stringify(r.json), rx);
    };
    const d = diaSp(-1);
    await tentar([{ dataInicio: d, composicao: [] }], /escola/i);
    await tentar([{ dataInicio: d, composicao: C([EA.id, [ING.id]], [EA.id, [GEO.id]]) }], /escola|repet|duplic|mais de uma vez/i);
    await tentar([{ dataInicio: d, composicao: C([EA.id, [ING.id, ING.id]]) }], /disciplina|repet|duplic|mais de uma vez/i);
    await tentar([{ dataInicio: d, composicao: C([EC.id, [], [regente.id, regente.id]]) }], /atua|repet|duplic|mais de uma vez/i);
    await tentar([{ dataInicio: d, composicao: C([EA.id, []]) }], /ao menos uma disciplina ou uma atua/i);
    await tentar([{ dataInicio: d, composicao: C([999999999, [ING.id]]) }], /escola/i);
    await tentar([{ dataInicio: d, composicao: C([EA.id, [999999999]]) }], /disciplina/i);
    await tentar([{ dataInicio: d, composicao: C([EA.id, [], [999999999]]) }], /atua/i);
    await tentar([{ dataInicio: '2026-02-31', composicao: C([EA.id, [ING.id]]) }], /data/i);
    await tentar([1, 2, 3].map(() => ({ dataInicio: d, composicao: C([EA.id, [ING.id]]) })), /No máximo 2 cargos/i);
    assert.equal(await contaPessoas(), antesN, 'cadastro com erro não pode deixar pessoa criada');
  });
  await caso('3º cargo pela tela de Cargos → 409 (nunca Cargo 3)', async () => {
    const r = await api(tSec, 'POST', `/pessoas/professores/${cad.dois.id}/cargos`, { dataInicio: diaSp(-1), composicao: C([EC.id, [], [regente.id]]) });
    st(r, 409); assert.equal((await cargosDe(cad.dois.id)).length, 2);
  });
  await caso('Duplo envio do cadastro (2 POST simultâneos, mesmo e-mail) → 1 pessoa, 1 cargo, sem erro 500', async () => {
    const email = `${P.toLowerCase()}duplo@teste.invalid`;
    const corpo = { nome: `${P}Duplo`, email, cargos: [{ dataInicio: diaSp(-1), composicao: C([EA.id, [ING.id]]) }] };
    const rs = await Promise.all([api(tSec, 'POST', '/pessoas/professores', corpo), api(tSec, 'POST', '/pessoas/professores', corpo)]);
    const p = await prisma.pessoa.findMany({ where: { email } });
    p.forEach((x) => { if (!reg.pessoas.includes(x.id)) reg.pessoas.push(x.id); }); salvarRegistro();
    assert.equal(p.length, 1);
    assert.equal(await prisma.cargoProfessor.count({ where: { professorId: p[0].id } }), 1);
    assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409], `status: ${rs.map((r) => `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`).join(' / ')}`);
  });
  await caso('Salvar duas vezes seguidas (mesmo e-mail com cargos) → 2ª recusada, nada duplicado', async () => {
    const r = await api(tSec, 'POST', '/pessoas/professores', { nome: 'x', email: cad.um.email, cargos: [{ dataInicio: diaSp(-1), composicao: C([EA.id, [ING.id]]) }] });
    st(r, 409); assert.equal((await cargosDe(cad.um.id)).length, 1);
  });
  await caso('Clique duplo em "Cadastrar cargo" (2 POST simultâneos) num professor com 1 cargo → 1 aceito, 1 recusado (máx. 2)', async () => {
    const p = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }]);
    const corpo = { dataInicio: diaSp(-1), composicao: C([EB.id, [GEO.id]]) };
    const rs = await Promise.all([api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos`, corpo), api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos`, corpo)]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
    assert.equal((await cargosDe(p.id)).length, 2);
  });
  await caso('Clique duplo em "Cadastrar cargo" num professor SEM cargo (2 POST simultâneos iguais) → não pode virar 2 cargos idênticos', async () => {
    const p = await mkPessoa('SemCargo', 'PROFESSOR');
    await prisma.vinculoEscolar.create({ data: { escolaId: EA.id, pessoaId: p.id, status: 'ATIVO', dataInicio: new Date() } });
    const corpo = { dataInicio: diaSp(-1), composicao: C([EA.id, [ING.id]]) };
    const rs = await Promise.all([api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos`, corpo), api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos`, corpo)]);
    const n = (await cargosDe(p.id)).length;
    assert.equal(n, 1, `criou ${n} cargos (status ${rs.map((r) => r.status).join(',')})`);
  });
  await caso('Diretora não cadastra cargo (403), mas cadastra/vincula professor sem cargo na escola dela', async () => {
    const r = await api(tDir, 'POST', '/pessoas/professores', { nome: `${P}PorDiretora`, email: `${P.toLowerCase()}pordir@teste.invalid`, cargos: [{ dataInicio: diaSp(-1), composicao: C([EA.id, [ING.id]]) }] });
    st(r, 403);
    const r2 = await api(tDir, 'POST', '/pessoas/professores', { nome: `${P}PorDiretora`, email: `${P.toLowerCase()}pordir@teste.invalid`, escolaIds: [EA.id] });
    const p = await prisma.pessoa.findUnique({ where: { email: `${P.toLowerCase()}pordir@teste.invalid` } });
    if (p) { reg.pessoas.push(p.id); salvarRegistro(); }
    st(r2, 201); assert.equal(await prisma.cargoProfessor.count({ where: { professorId: p!.id } }), 0);
  });

  // ===================== 2. Escolas + Cargo (regras de dados; telas no teste 65/70) =====================
  secao('2. Fluxo Escolas + Cargo (dados)');
  await caso('Vínculo escolar duplicado: 2 POST simultâneos da mesma escola → 1 vínculo ativo', async () => {
    const p = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }]);
    await Promise.all([api(tSec, 'POST', '/vinculos-escolares', { pessoaId: p.id, escolaId: EB.id }), api(tSec, 'POST', '/vinculos-escolares', { pessoaId: p.id, escolaId: EB.id })]);
    const n = await prisma.vinculoEscolar.count({ where: { pessoaId: p.id, escolaId: EB.id, status: 'ATIVO' } });
    assert.equal(n, 1, `${n} vínculos ativos na mesma escola`);
  });
  await caso('Escola vinculada fora dos cargos → "escolasForaDosCargos"; incluída no cargo → some; vínculo não duplica', async () => {
    const p = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }]);
    st(await api(tSec, 'POST', '/vinculos-escolares', { pessoaId: p.id, escolaId: EB.id }), 201);
    const lista1 = (await api(tSec, 'GET', '/pessoas/professores')).json.find((x: { id: number }) => x.id === p.id);
    assert.deepEqual(lista1.escolasForaDosCargos.map((e: { id: number }) => e.id), [EB.id]);
    const [c] = await cargosDe(p.id);
    st(await api(tSec, 'PUT', `/pessoas/professores/${p.id}/cargos/${c.id}`, { baseUpdatedAt: c.updatedAt, composicao: C([EA.id, [ING.id]], [EB.id, [GEO.id]]) }), 200);
    const lista2 = (await api(tSec, 'GET', '/pessoas/professores')).json.find((x: { id: number }) => x.id === p.id);
    assert.deepEqual(lista2.escolasForaDosCargos, []);
    assert.equal(await prisma.vinculoEscolar.count({ where: { pessoaId: p.id, escolaId: EB.id } }), 1);
  });
  await caso('Remover escola do cargo NÃO encerra o vínculo escolar (vira pendência visível)', async () => {
    const p = await novoProfessor([{ composicao: C([EA.id, [ING.id]], [EB.id, [ING.id]]) }]);
    const [c] = await cargosDe(p.id);
    st(await api(tSec, 'PUT', `/pessoas/professores/${p.id}/cargos/${c.id}`, { baseUpdatedAt: c.updatedAt, composicao: C([EA.id, [ING.id]]) }), 200);
    assert.deepEqual(await vincAtivos(p.id), [EA.id, EB.id].sort((a, b) => a - b));
    const l = (await api(tSec, 'GET', '/pessoas/professores')).json.find((x: { id: number }) => x.id === p.id);
    assert.deepEqual(l.escolasForaDosCargos.map((e: { id: number }) => e.id), [EB.id]);
  });
  await caso('Diretora vincula escola dela: nenhum cargo criado; pendência aparece para Secretaria e Diretora', async () => {
    const p = await novoProfessor([{ composicao: C([EB.id, [ING.id]]) }]);
    st(await api(tDir, 'POST', '/pessoas/professores', { email: p.email, escolaIds: [EA.id] }), 201);
    assert.equal(await prisma.cargoProfessor.count({ where: { professorId: p.id } }), 1);
    const naDir = (await api(tDir, 'GET', '/pessoas/professores')).json.find((x: { id: number }) => x.id === p.id);
    assert.deepEqual(naDir.escolasForaDosCargos.map((e: { id: number }) => e.id), [EA.id]);
  });

  // ===================== 3/7/8. Edição, foto do ciclo e folhas =====================
  secao('3/7/8. Edição de cargos, foto (snapshot) e geração de folhas');
  // Professores do ciclo "ontem" (C1): cargos cadastrados 2 dias antes.
  const f1 = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }]);
  const f2 = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }, { composicao: C([EB.id, [GEO.id]]) }]);
  const fEq = await novoProfessor([{ composicao: C([EA.id, [ING.id, GEO.id]]) }, { composicao: C([EA.id, [GEO.id, ING.id]]) }]);
  const fQuase = await novoProfessor([{ composicao: C([EA.id, [ING.id]], [EB.id, [ING.id]]) }, { composicao: C([EA.id, [ING.id]]) }]);
  const fMulti = await novoProfessor([{ composicao: C([EA.id, [ING.id, GEO.id, MAT.id]], [EB.id, [ART.id]]) }]);
  const fAtu = await novoProfessor([{ composicao: C([EC.id, [], [regente.id]]) }]);
  const fDA = await novoProfessor([{ composicao: C([EA.id, [ART.id], [intervencao.id]]) }]);
  const fForaCiclo = await novoProfessor([{ composicao: C([ED.id, [ING.id]]) }]);
  const fEdit = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }, { composicao: C([EB.id, [GEO.id]]) }]);
  for (const p of [f1, f2, fEq, fQuase, fMulti, fAtu, fDA, fForaCiclo, fEdit]) await recuar(p.id, 48);
  const C1 = await novoCiclo({ abreEm: inicioDoDiaSp(diaSp(-1)), prazoEm: new Date(Date.now() + 8 * DIA) });
  await caso('8. 1 cargo → 1 folha; 2 diferentes → 2; equivalentes → 1 compartilhada; quase iguais → 2', async () => {
    assert.equal((await minhas(f1.token, C1.id)).length, 1);
    assert.equal((await minhas(f2.token, C1.id)).length, 2);
    const eq = await minhas(fEq.token, C1.id); assert.equal(eq.length, 1); assert.equal(eq[0].compartilhada, true);
    assert.equal((await minhas(fQuase.token, C1.id)).length, 2);
  });
  await caso('8. Várias escolas/disciplinas → 1 folha; atuação só → 1; disciplina+atuação → 1; sem turma em nada', async () => {
    const m = await minhas(fMulti.token, C1.id); assert.equal(m.length, 1); assert.equal(m[0].composicao.length, 2);
    const a = await minhas(fAtu.token, C1.id); assert.equal(a.length, 1); assert.deepEqual(a[0].composicao[0].atuacoes?.map((x) => x.nome), ['Professor Regente']);
    assert.equal((await minhas(fDA.token, C1.id)).length, 1);
    semTurma(m); semTurma(await folha(fMulti.token, C1.id, m[0].cargoId));
    assert.equal(await prisma.disciplina.count({ where: { nome: { in: ['Professor Regente', 'Oficina do Brincar', 'Professor de Intervenção'] } } }), 0, 'atuação virou disciplina');
  });
  await caso('8. Ciclo limitado a uma escola mostra só aquela parte do cargo; cargo só em escola fora do ciclo não gera folha', async () => {
    const Cso = await novoCiclo({ escolas: [EB.id] });
    const m = await minhas(fMulti.token, Cso.id); assert.equal(m.length, 1);
    assert.deepEqual(m[0].composicao.map((p) => p.escolaId), [EB.id]);
    assert.equal((await minhas(fForaCiclo.token, C1.id)).length, 0);
    await prisma.cicloUmTerco.update({ where: { id: Cso.id }, data: { status: 'INATIVA' } });
  });
  let folhaEditAntes: Item[] = [];
  await caso('3/7. Editar cargo DEPOIS da abertura (add/remove escola, disciplina, atuação, troca total): folha do ciclo aberto não muda', async () => {
    folhaEditAntes = await minhas(fEdit.token, C1.id);
    const [c1, c2] = await cargosDe(fEdit.id);
    const put = async (c: CargoTela, comp: Parte[]) => { const atual = (await cargosDe(fEdit.id)).find((x) => x.id === c.id)!; const r = await api(tSec, 'PUT', `/pessoas/professores/${fEdit.id}/cargos/${c.id}`, { baseUpdatedAt: atual.updatedAt, composicao: comp }); st(r, 200); };
    await put(c1, C([EA.id, [ING.id]], [EC.id, [], [oficina.id]]));     // + escola + atuação
    await put(c1, C([EA.id, [ING.id, MAT.id]], [EC.id, [], [oficina.id]])); // + disciplina
    await put(c1, C([EA.id, [MAT.id]]));                                  // - escola, - disciplina, - atuação
    await put(c2, C([EC.id, [], [regente.id]]));                          // troca completa
    const depois = await minhas(fEdit.token, C1.id);
    assert.deepEqual(depois.map((f) => f.composicao), folhaEditAntes.map((f) => f.composicao));
    assert.ok((await prisma.cargoVersao.count({ where: { cargo: { professorId: fEdit.id } } })) >= 6, 'cada mudança vira uma versão');
  });
  await caso('3. Salvar a mesma composição não cria versão; base antiga → 409 (outra pessoa alterou)', async () => {
    const [c] = await cargosDe(fEdit.id);
    const n = await prisma.cargoVersao.count({ where: { cargoId: c.id } });
    st(await api(tSec, 'PUT', `/pessoas/professores/${fEdit.id}/cargos/${c.id}`, { baseUpdatedAt: c.updatedAt, composicao: C([EA.id, [MAT.id]]) }), 200);
    assert.equal(await prisma.cargoVersao.count({ where: { cargoId: c.id } }), n);
    st(await api(tSec, 'PUT', `/pessoas/professores/${fEdit.id}/cargos/${c.id}`, { baseUpdatedAt: c.updatedAt, composicao: C([EA.id, [GEO.id]]) }), 409);
  });
  await caso('3/7. Próximo ciclo pega a configuração nova', async () => {
    const C2 = await novoCiclo({ abreEm: inicioDoDiaSp(diaSp(1)), prazoEm: new Date(Date.now() + 9 * DIA) });
    await prisma.cicloUmTerco.update({ where: { id: C2.id }, data: { abreEm: inicioDoDiaSp(diaSp(0)) } }); // abre hoje: versões de hoje entram
    const prox = await minhas(fEdit.token, C2.id);
    const desc = prox.map((f) => f.composicao.map((p) => [p.escolaId, p.disciplinas.map((d) => d.id), (p.atuacoes ?? []).map((a) => a.id)]));
    assert.deepEqual(desc.sort(), [[[EA.id, [MAT.id], []]], [[EC.id, [], [regente.id]]]].sort());
    await prisma.cicloUmTerco.update({ where: { id: C2.id }, data: { status: 'INATIVA' } });
  });
  await caso('3. Iguais viram diferentes e diferentes viram iguais: ciclo aberto mantém, próximo recalcula', async () => {
    const pI = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }, { composicao: C([EA.id, [ING.id]]) }]);
    const pD = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }, { composicao: C([EA.id, [GEO.id]]) }]);
    await recuar(pI.id, 48); await recuar(pD.id, 48);
    const [i1, i2] = await cargosDe(pI.id); void i1;
    st(await api(tSec, 'PUT', `/pessoas/professores/${pI.id}/cargos/${i2.id}`, { baseUpdatedAt: i2.updatedAt, composicao: C([EA.id, [GEO.id]]) }), 200);
    const [, d2] = await cargosDe(pD.id);
    st(await api(tSec, 'PUT', `/pessoas/professores/${pD.id}/cargos/${d2.id}`, { baseUpdatedAt: d2.updatedAt, composicao: C([EA.id, [ING.id]]) }), 200);
    assert.equal((await minhas(pI.token, C1.id)).length, 1); assert.equal((await minhas(pD.token, C1.id)).length, 2);
    const C3 = await novoCiclo({ abreEm: inicioDoDiaSp(diaSp(0)), prazoEm: new Date(Date.now() + 9 * DIA) });
    assert.equal((await minhas(pI.token, C3.id)).length, 2); assert.equal((await minhas(pD.token, C3.id)).length, 1);
    await prisma.cicloUmTerco.update({ where: { id: C3.id }, data: { status: 'INATIVA' } });
  });
  await caso('7. Cargo cadastrado depois do dia da abertura não entra; data de início retroativa não muda isso', async () => {
    const p = await novoProfessor([{ dataInicio: '2026-01-01', composicao: C([EA.id, [ING.id]]) }]); // cadastrado agora; ciclo C1 abriu ontem
    assert.equal((await minhas(p.token, C1.id)).length, 0);
  });
  await caso('7. Fronteira do corte: cadastrado às 23:59:59 SP do dia da abertura entra; 00:00:01 do dia seguinte não', async () => {
    const corte = new Date(inicioDoDiaSp(diaSp(-1)).getTime() + DIA - 1000);
    const pDentro = await novoProfessor([{ dataInicio: diaSp(-5), composicao: C([EA.id, [ING.id]]) }]);
    const pFora = await novoProfessor([{ dataInicio: diaSp(-5), composicao: C([EA.id, [ING.id]]) }]);
    for (const [p, quando] of [[pDentro, corte], [pFora, new Date(corte.getTime() + 2000)]] as const) {
      const c = await prisma.cargoProfessor.findFirstOrThrow({ where: { professorId: p.id } });
      await prisma.cargoProfessor.update({ where: { id: c.id }, data: { createdAt: quando } });
      await prisma.cargoVersao.updateMany({ where: { cargoId: c.id }, data: { criadaEm: quando } });
    }
    assert.equal((await minhas(pDentro.token, C1.id)).length, 1); assert.equal((await minhas(pFora.token, C1.id)).length, 0);
  });
  await caso('7. Ciclo que abre HOJE: cargo cadastrado agora já gera folha e já é editável', async () => {
    const Choje = await novoCiclo({ abreEm: inicioDoDiaSp(diaSp(0)), escolas: [EB.id] });
    const p = await novoProfessor([{ dataInicio: diaSp(0), composicao: C([EB.id, [ING.id]]) }]);
    const m = await minhas(p.token, Choje.id);
    assert.equal(m.length, 1); assert.equal(m[0].editavelAgora, true);
    st(await salvar(p.token, Choje.id, m[0].cargoId, null, [{ semanaId: Choje.semanas[0].id, texto: 'hoje' }]), 200);
    await prisma.cicloUmTerco.update({ where: { id: Choje.id }, data: { status: 'INATIVA' } });
  });
  await caso('7. Cargo com início DEPOIS do dia da abertura não entra no ciclo', async () => {
    const p = await novoProfessor([{ dataInicio: diaSp(3), composicao: C([EA.id, [ING.id]]) }]);
    await recuar(p.id, 48);
    assert.equal((await minhas(p.token, C1.id)).length, 0);
  });

  // ===================== 9/10/12. Preenchimento, edição pós-conclusão, concorrência =====================
  secao('9/10/12. Preenchimento, edição depois da conclusão e concorrência');
  const [itF1] = await minhas(f1.token, C1.id);
  const textos = { acento: 'Ação, coração, pé, à, ü — çÇ ÁÉÍÓÚ ãõ', quebra: 'linha 1\nlinha 2\r\nlinha 3\n\n- item', especial: `<script>alert(1)</script> & "aspas" 'simples' \\ / % _ ; -- DROP TABLE x;`, formula: '=SOMA(A1:A9)+HYPERLINK("http://x")', grande: 'x'.repeat(10000) };
  let baseF1: string | null = null;
  await caso('9. Primeira gravação cria a folha; textos com acento, quebra de linha, especiais, "=" e 10.000 caracteres voltam idênticos', async () => {
    const r = await salvar(f1.token, C1.id, itF1.cargoId, null, [
      { semanaId: C1.semanas[0].id, texto: textos.acento + '\n' + textos.quebra },
      { semanaId: C1.semanas[1].id, texto: textos.especial + textos.formula },
      { semanaId: C1.semanas[2].id, texto: textos.grande },
    ]);
    st(r, 200); baseF1 = r.json.updatedAt;
    const g = await folha(f1.token, C1.id, itF1.cargoId);
    assert.equal(g.json.semanas[0].texto, textos.acento + '\n' + textos.quebra);
    assert.equal(g.json.semanas[1].texto, textos.especial + textos.formula);
    assert.equal(g.json.semanas[2].texto.length, 10000);
  });
  await caso('9. Texto acima de 10.000 caracteres é recusado (400) sem perder o que já estava salvo', async () => {
    const r = await salvar(f1.token, C1.id, itF1.cargoId, baseF1, [{ semanaId: C1.semanas[2].id, texto: 'y'.repeat(10001) }]);
    st(r, 400);
    assert.equal((await folha(f1.token, C1.id, itF1.cargoId)).json.semanas[2].texto, textos.grande);
  });
  await caso('9. Concluir com semana vazia ou só espaços → 400 com as semanas que faltam', async () => {
    const r1 = await salvar(f1.token, C1.id, itF1.cargoId, baseF1, [{ semanaId: C1.semanas[2].id, texto: '   \n  ' }]);
    st(r1, 200); baseF1 = r1.json.updatedAt;
    const c = await concluir(f1.token, C1.id, itF1.cargoId, baseF1);
    st(c, 400); assert.match(c.json.message ?? '', /Semana 3/);
  });
  await caso('12. Duas abas com a mesma base: a segunda recebe 409 com a versão salva (nada sobrescrito em silêncio)', async () => {
    const a = await salvar(f1.token, C1.id, itF1.cargoId, baseF1, [{ semanaId: C1.semanas[2].id, texto: 'aba A' }]);
    const b = await salvar(f1.token, C1.id, itF1.cargoId, baseF1, [{ semanaId: C1.semanas[2].id, texto: 'aba B' }]);
    st(a, 200); st(b, 409);
    assert.equal(b.json.code ?? b.json.codigo ?? 'CONFLITO_VERSAO', 'CONFLITO_VERSAO');
    assert.equal(b.json.dadosAtuais?.semanas?.[2]?.texto, 'aba A');
    assert.equal((await folha(f1.token, C1.id, itF1.cargoId)).json.semanas[2].texto, 'aba A');
    baseF1 = a.json.updatedAt;
  });
  await caso('12. "Manter o meu texto": regravar com a base nova devolvida no 409 funciona', async () => {
    const r = await salvar(f1.token, C1.id, itF1.cargoId, baseF1, [{ semanaId: C1.semanas[2].id, texto: 'aba B (mantido)' }]);
    st(r, 200); baseF1 = r.json.updatedAt;
  });
  await caso('12. Duas gravações SIMULTÂNEAS com a mesma base → exatamente 1 aceita, 1 conflito', async () => {
    const rs = await Promise.all([1, 2, 3].map((i) => salvar(f1.token, C1.id, itF1.cargoId, baseF1, [{ semanaId: C1.semanas[0].id, texto: `simultânea ${i}` }])));
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409, 409]);
    baseF1 = rs.find((r) => r.status === 200)!.json.updatedAt;
  });
  await caso('12. Primeira gravação simultânea em duas abas (folha ainda não existe) → 1 folha só', async () => {
    const [it] = await minhas(f2.token, C1.id);
    const rs = await Promise.all([1, 2].map((i) => salvar(f2.token, C1.id, it.cargoId, null, [{ semanaId: C1.semanas[0].id, texto: `aba ${i}` }])));
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await prisma.entregaUmTerco.count({ where: { cicloId: C1.id, professorId: f2.id, cargos: { some: { cargoId: it.cargoId } } } }), 1);
  });
  await caso('9/12. Concluir; clique duplo em concluir (2 simultâneos) → 1 evento CONCLUIDA, sem erro', async () => {
    st(await salvar(f1.token, C1.id, itF1.cargoId, baseF1, [{ semanaId: C1.semanas[2].id, texto: 'pronto' }]), 200);
    const rs = await Promise.all([concluir(f1.token, C1.id, itF1.cargoId), concluir(f1.token, C1.id, itF1.cargoId)]);
    rs.forEach((r) => st(r, 200));
    const e = await prisma.entregaUmTerco.findFirstOrThrow({ where: { cicloId: C1.id, professorId: f1.id } });
    assert.equal(e.status, 'CONCLUIDA');
    assert.equal(await prisma.historicoEntregaUmTerco.count({ where: { entregaId: e.id, tipo: 'CONCLUIDA' } }), 1);
  });
  await caso('10. Depois de concluída, antes do prazo: editar continua possível e a folha segue concluída', async () => {
    const g = await folha(f1.token, C1.id, itF1.cargoId);
    assert.equal(g.json.editavelAgora, true);
    const r = await salvar(f1.token, C1.id, itF1.cargoId, g.json.updatedAt, [{ semanaId: C1.semanas[1].id, texto: 'editado depois de concluir' }]);
    st(r, 200); assert.equal(r.json.status, 'concluida');
  });
  await caso('10. Depois do prazo: somente leitura; PUT e concluir manuais são recusados; texto intacto', async () => {
    const pz = await novoProfessor([{ composicao: C([EA.id, [GEO.id]]) }]); await recuar(pz.id, 72);
    const Cvelho = await novoCiclo({ abreEm: inicioDoDiaSp(diaSp(-2)), prazoEm: new Date(Date.now() + DIA), escolas: [EA.id] });
    const [it] = await minhas(pz.token, Cvelho.id);
    const s = await salvar(pz.token, Cvelho.id, it.cargoId, null, [{ semanaId: Cvelho.semanas[0].id, texto: 'antes do prazo' }]); st(s, 200);
    await prisma.cicloUmTerco.update({ where: { id: Cvelho.id }, data: { prazoEm: new Date(Date.now() - H) } });
    const g = await folha(pz.token, Cvelho.id, it.cargoId); assert.equal(g.json.editavelAgora, false);
    const r = await salvar(pz.token, Cvelho.id, it.cargoId, g.json.updatedAt, [{ semanaId: Cvelho.semanas[0].id, texto: 'depois do prazo' }]); st(r, 400);
    st(await concluir(pz.token, Cvelho.id, it.cargoId, g.json.updatedAt), 400);
    assert.equal((await folha(pz.token, Cvelho.id, it.cargoId)).json.semanas[0].texto, 'antes do prazo');
    await prisma.cicloUmTerco.update({ where: { id: Cvelho.id }, data: { status: 'INATIVA' } });
  });

  // ===================== 4/5. Encerramento de cargo e inativação de Professor =====================
  secao('4/5. Encerramento de cargo e inativação de Professor');
  await caso('4. Datas de encerramento: futura, antes do início e inválida → 400; hoje e anterior → ok', async () => {
    const p = await novoProfessor([{ dataInicio: diaSp(-10), composicao: C([EA.id, [ING.id]]) }, { dataInicio: diaSp(-10), composicao: C([EB.id, [ING.id]]) }]);
    const [c1, c2] = await cargosDe(p.id);
    st(await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c1.id}/encerrar`, { dataFim: diaSp(1) }), 400);
    st(await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c1.id}/encerrar`, { dataFim: diaSp(-11) }), 400);
    st(await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c1.id}/encerrar`, { dataFim: '2026-13-01' }), 400);
    st(await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c1.id}/encerrar`, { dataFim: diaSp(0) }), 200);
    st(await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c2.id}/encerrar`, { dataFim: diaSp(-3) }), 200);
    const todos = await cargosDe(p.id, true);
    assert.deepEqual(todos.map((c) => c.status).sort(), ['encerrado', 'encerrado']);
    assert.equal((await cargosDe(p.id)).length, 0, 'encerrado some da lista normal');
  });
  await caso('4. Clique duplo em encerrar (2 simultâneos) → 1 ok, 1 "já encerrado"; cargo não é apagado', async () => {
    const p = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }]);
    const [c] = await cargosDe(p.id);
    const rs = await Promise.all([1, 2].map(() => api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c.id}/encerrar`, { dataFim: diaSp(0) })));
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await prisma.cargoProfessor.count({ where: { id: c.id } }), 1);
  });
  await caso('4. Renumeração: encerrar o Cargo 1 faz o antigo Cargo 2 virar "Cargo 1"; folha antiga continua no ID real', async () => {
    const p = await novoProfessor([{ dataInicio: diaSp(-20), composicao: C([EA.id, [ING.id]]) }, { dataInicio: diaSp(-10), composicao: C([EB.id, [GEO.id]]) }]);
    await recuar(p.id, 48);
    const [c1, c2] = await cargosDe(p.id);
    const fol = await minhas(p.token, C1.id);
    const doC1 = fol.find((f) => f.cargoIds.includes(c1.id))!;
    st(await salvar(p.token, C1.id, doC1.cargoId, null, [{ semanaId: C1.semanas[0].id, texto: 'do cargo 1' }]), 200);
    st(await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c1.id}/encerrar`, { dataFim: diaSp(0) }), 200);
    assert.deepEqual((await cargosDe(p.id)).map((c) => [c.id, c.rotulo]), [[c2.id, 'Cargo 1']]);
    const e = await prisma.entregaUmTerco.findFirstOrThrow({ where: { cicloId: C1.id, professorId: p.id }, include: { cargos: true } });
    assert.deepEqual(e.cargos.map((x) => x.cargoId), [c1.id]);
  });
  // Cenário do painel: ciclo dedicado CP com massa conhecida.
  const CP = await novoCiclo({ abreEm: inicioDoDiaSp(diaSp(-1)), prazoEm: new Date(Date.now() + 8 * DIA), escolas: [EP1.id, EP2.id] });
  const pp = { conc: await novoProfessor([{ composicao: C([EP1.id, [ING.id]], [EP2.id, [ING.id]]) }]), andamento: await novoProfessor([{ composicao: C([EP1.id, [GEO.id]]) }]), nada: await novoProfessor([{ composicao: C([EP2.id, [MAT.id]]) }]), encSem: await novoProfessor([{ composicao: C([EP1.id, [ART.id]]) }]), encCom: await novoProfessor([{ composicao: C([EP2.id, [ART.id]]) }]), encConc: await novoProfessor([{ composicao: C([EP1.id, [MAT.id]]) }]), inat: await novoProfessor([{ composicao: C([EP2.id, [GEO.id]]) }]), inatRasc: await novoProfessor([{ composicao: C([EP1.id, [ING.id]]) }]), inatConc: await novoProfessor([{ composicao: C([EP2.id, [ING.id]]) }]) };
  for (const p of Object.values(pp)) await recuar(p.id, 48);
  const it1 = async (p: { token: string }) => (await minhas(p.token, CP.id))[0];
  await caso('15. Painel com massa conhecida: esperado 9 antes das mudanças', async () => {
    assert.equal((await painel(CP.id)).resumo.esperado, 9);
  });
  await caso('4/5/15. Encerrar e inativar em vários momentos; respostas preservadas; números do painel exatos', async () => {
    await preencherEConcluir(pp.conc, CP, (await it1(pp.conc)).cargoId);
    st(await salvar(pp.andamento.token, CP.id, (await it1(pp.andamento)).cargoId, null, [{ semanaId: CP.semanas[0].id, texto: 'rascunho' }]), 200);
    st(await salvar(pp.encCom.token, CP.id, (await it1(pp.encCom)).cargoId, null, [{ semanaId: CP.semanas[0].id, texto: 'começou e saiu' }]), 200);
    await preencherEConcluir(pp.encConc, CP, (await it1(pp.encConc)).cargoId, 'Concluiu e saiu');
    st(await salvar(pp.inatRasc.token, CP.id, (await it1(pp.inatRasc)).cargoId, null, [{ semanaId: CP.semanas[0].id, texto: 'rascunho inativo' }]), 200);
    await preencherEConcluir(pp.inatConc, CP, (await it1(pp.inatConc)).cargoId, 'Inativo concluído');
    for (const p of [pp.encSem, pp.encCom, pp.encConc]) { const [c] = await cargosDe(p.id); st(await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c.id}/encerrar`, { dataFim: diaSp(0) }), 200); }
    for (const p of [pp.inat, pp.inatRasc, pp.inatConc]) st(await api(tSec, 'POST', `/pessoas/professores/${p.id}/inativar`), 200);
    const pn = await painel(CP.id);
    assert.deepEqual(pn.resumo, { esperado: 3, concluidas: 1, emAndamento: 1, naoIniciadas: 1, percentualEntrega: 33 });
    const fora = pn.foraDoEsperado.map((l) => l.professorId).sort((a, b) => a - b);
    assert.deepEqual(fora, [pp.encCom.id, pp.encConc.id, pp.inatRasc.id, pp.inatConc.id].sort((a, b) => a - b));
    const textosFora = await prisma.respostaSemanaUmTerco.count({ where: { entrega: { cicloId: CP.id, professorId: { in: fora } } } });
    assert.equal(textosFora, 1 + 3 + 1 + 3, 'respostas de quem saiu foram preservadas');
  });
  await caso('4. Folha de cargo encerrado: Professor não edita mais (só consulta)', async () => {
    const f = (await minhas(pp.encCom.token, CP.id))[0];
    assert.equal(f.esperada, false); assert.equal(f.editavelAgora, false);
    const g = await folha(pp.encCom.token, CP.id, f.cargoId);
    const r = await salvar(pp.encCom.token, CP.id, f.cargoId, g.json.updatedAt, [{ semanaId: CP.semanas[1].id, texto: 'tentativa' }]);
    assert.ok([400, 403].includes(r.status), `HTTP ${r.status}`);
  });
  await caso('5. Professor inativo: sessão derrubada (401) e nada some', async () => {
    const r = await api(pp.inatConc.token, 'GET', '/formulario-um-terco/minhas');
    assert.equal(r.status, 401);
  });
  await caso('5. Reativar: obrigação volta, MESMA folha (sem duplicar), respostas intactas', async () => {
    const antesE = await prisma.entregaUmTerco.findMany({ where: { cicloId: CP.id, professorId: pp.inatRasc.id } });
    st(await api(tSec, 'POST', `/pessoas/professores/${pp.inatRasc.id}/reativar`), 200);
    const pn = await painel(CP.id);
    const l = pn.linhas.find((x) => x.professorId === pp.inatRasc.id);
    assert.ok(l, 'voltou ao esperado'); assert.equal(l!.entregaId, antesE[0].id);
    assert.equal(await prisma.entregaUmTerco.count({ where: { cicloId: CP.id, professorId: pp.inatRasc.id } }), 1);
    assert.equal(pn.resumo.esperado, 4);
  });
  await caso('15. Filtros: escola (folha de 2 escolas aparece nas duas e conta 1 na rede), disciplina, Professor, status', async () => {
    const pa = await painel(CP.id, `?escolaId=${EP1.id}`); const pb = await painel(CP.id, `?escolaId=${EP2.id}`);
    assert.ok(pa.linhas.some((l) => l.professorId === pp.conc.id) && pb.linhas.some((l) => l.professorId === pp.conc.id));
    const rede = await painel(CP.id);
    assert.equal(rede.linhas.filter((l) => l.professorId === pp.conc.id).length, 1);
    const porEscola = Object.fromEntries(rede.porEscola.map((e) => [e.escolaId, e.esperado]));
    assert.equal(porEscola[EP1.id] + porEscola[EP2.id], rede.resumo.esperado + 1, 'porEscola soma a folha de 2 escolas nas duas');
    assert.deepEqual((await painel(CP.id, `?disciplinaId=${MAT.id}`)).linhas.map((l) => l.professorId), [pp.nada.id]);
    assert.deepEqual((await painel(CP.id, `?professorId=${pp.andamento.id}`)).linhas.map((l) => l.status), ['em_andamento']);
    assert.equal((await painel(CP.id, '?status=concluida')).linhas.length, 1);
    assert.deepEqual((await painel(CP.id, '?status=nao_iniciado')).linhas.map((l) => l.professorId), [pp.nada.id]);
  });

  // ===================== 13/14. Correções =====================
  secao('13/14. Correções (direta, devolução, rodadas, expiração, prazo encerrado, concorrência)');
  const CR = await novoCiclo({ abreEm: inicioDoDiaSp(diaSp(-1)), prazoEm: new Date(Date.now() + 8 * DIA), escolas: [EA.id, EC.id] });
  const pc = await novoProfessor([{ composicao: C([EA.id, [ING.id]]) }]);
  const pcAtu = await novoProfessor([{ composicao: C([EC.id, [], [oficina.id, regente.id]]) }]);
  await recuar(pc.id, 48); await recuar(pcAtu.id, 48);
  const fc = await preencherEConcluir(pc, CR, (await minhas(pc.token, CR.id))[0].cargoId, 'Original');
  const fcAtu = await preencherEConcluir(pcAtu, CR, (await minhas(pcAtu.token, CR.id))[0].cargoId, 'Oficina');
  const det = async (id: number) => { const r = await api(tSec, 'GET', `/correcoes-um-terco/${id}`); st(r, 200); return r.json; };
  await caso('13. Busca por nome (sem acento/maiúscula), filtros escola/Professor/ciclo/situação', async () => {
    const nomeBusca = `${P}prof`.toUpperCase();
    const l = await api(tSec, 'GET', `/correcoes-um-terco?busca=${encodeURIComponent(nomeBusca)}&cicloId=${CR.id}`);
    st(l, 200); assert.ok(l.json.itens.some((i: { entregaId: number }) => i.entregaId === fc.entregaId));
    assert.ok((await api(tSec, 'GET', `/correcoes-um-terco?escolaId=${EC.id}&cicloId=${CR.id}`)).json.itens.every((i: { entregaId: number }) => i.entregaId === fcAtu.entregaId));
    assert.equal((await api(tSec, 'GET', `/correcoes-um-terco?professorId=${pc.id}`)).json.itens.length, 1);
    assert.ok((await api(tSec, 'GET', `/correcoes-um-terco?busca=${encodeURIComponent('oficina brincar')}&cicloId=${CR.id}`)).json.itens.some((i: { entregaId: number }) => i.entregaId === fcAtu.entregaId), 'busca pela atuação');
  });
  await caso('13. Correção direta: 1 semana e várias; histórico com valor anterior/novo; mensagem ao Professor; NENHUMA janela de 3 dias', async () => {
    const d0 = await det(fc.entregaId);
    const r1 = await api(tSec, 'PUT', `/correcoes-um-terco/${fc.entregaId}/respostas`, { baseUpdatedAt: d0.updatedAt, respostas: [{ semanaId: d0.semanas[0].id, texto: 'Corrigido S1' }] });
    st(r1, 200);
    const r2 = await api(tSec, 'PUT', `/correcoes-um-terco/${fc.entregaId}/respostas`, { baseUpdatedAt: r1.json.updatedAt, respostas: [{ semanaId: d0.semanas[1].id, texto: 'Corrigido S2' }, { semanaId: d0.semanas[2].id, texto: 'Corrigido S3' }] });
    st(r2, 200);
    const d = await det(fc.entregaId);
    assert.equal(d.historicoValores.length, 3);
    assert.ok(d.historicoValores.some((h: { valorAnterior: string; valorNovo: string }) => h.valorAnterior === 'Original semana 1' && h.valorNovo === 'Corrigido S1'));
    assert.equal(await prisma.correcaoEntregaUmTerco.count({ where: { entregaId: fc.entregaId } }), 0);
    assert.equal(await prisma.mensagem.count({ where: { conversa: { participantes: { some: { pessoaId: pc.id } } }, remetenteId: sec.id } }), 2);
  });
  await caso('13. Correção direta: texto vazio e "nenhuma alteração" são recusados', async () => {
    const d = await det(fc.entregaId);
    st(await api(tSec, 'PUT', `/correcoes-um-terco/${fc.entregaId}/respostas`, { baseUpdatedAt: d.updatedAt, respostas: [{ semanaId: d.semanas[0].id, texto: '  ' }] }), 400);
    st(await api(tSec, 'PUT', `/correcoes-um-terco/${fc.entregaId}/respostas`, { baseUpdatedAt: d.updatedAt, respostas: [{ semanaId: d.semanas[0].id, texto: d.semanas[0].texto }] }), 400);
  });
  await caso('14. Correção direta com folha desatualizada (Professor salvou no meio) → 409, nada sobrescrito', async () => {
    const d = await det(fc.entregaId);
    const g = await folha(pc.token, CR.id, (await minhas(pc.token, CR.id))[0].cargoId);
    st(await salvar(pc.token, CR.id, g.json.cargoId, g.json.updatedAt, [{ semanaId: CR.semanas[0].id, texto: 'Professor mudou agora' }]), 200);
    const r = await api(tSec, 'PUT', `/correcoes-um-terco/${fc.entregaId}/respostas`, { baseUpdatedAt: d.updatedAt, respostas: [{ semanaId: d.semanas[0].id, texto: 'Secretaria com versão velha' }] });
    st(r, 409);
    assert.equal((await det(fc.entregaId)).semanas[0].texto, 'Professor mudou agora');
  });
  await caso('14. Professor com a folha aberta enquanto a Secretaria corrige direto → o salvar dele recebe 409', async () => {
    const g = await folha(pc.token, CR.id, (await minhas(pc.token, CR.id))[0].cargoId);
    const d = await det(fc.entregaId);
    st(await api(tSec, 'PUT', `/correcoes-um-terco/${fc.entregaId}/respostas`, { baseUpdatedAt: d.updatedAt, respostas: [{ semanaId: d.semanas[1].id, texto: 'Secretaria corrigiu enquanto ele lia' }] }), 200);
    st(await salvar(pc.token, CR.id, g.json.cargoId, g.json.updatedAt, [{ semanaId: CR.semanas[1].id, texto: 'Professor com versão velha' }]), 409);
    assert.equal((await det(fc.entregaId)).semanas[1].texto, 'Secretaria corrigiu enquanto ele lia');
  });
  await caso('13. Enviar para correção: observação vazia bloqueada; clique duplo → 1 correção; prazo de 3 dias; mensagem ao Professor', async () => {
    st(await api(tSec, 'POST', `/formulario-um-terco/entregas/${fc.entregaId}/devolver`, { observacao: '   ' }), 400);
    const rs = await Promise.all([1, 2].map(() => api(tSec, 'POST', `/formulario-um-terco/entregas/${fc.entregaId}/devolver`, { observacao: 'Rodada 1: detalhe as atividades.' })));
    assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
    const cs = await prisma.correcaoEntregaUmTerco.findMany({ where: { entregaId: fc.entregaId } });
    assert.equal(cs.length, 1);
    assert.equal(cs[0].prazoAte.getTime() - cs[0].criadaEm.getTime(), 3 * DIA);
    assert.ok(cs[0].conversaId);
    assert.ok(await prisma.mensagem.count({ where: { conversaId: cs[0].conversaId!, conteudo: { contains: 'Rodada 1' } } }) === 1);
  });
  await caso('13. 3 rodadas de devolução → reenvio; cada uma com 3 dias novos; histórico íntegro; sem limite', async () => {
    const it = (await minhas(pc.token, CR.id))[0];
    for (let rodada = 1; rodada <= 3; rodada++) {
      if (rodada > 1) st(await api(tSec, 'POST', `/formulario-um-terco/entregas/${fc.entregaId}/devolver`, { observacao: `Rodada ${rodada}: ajuste.` }), 201);
      const m = (await minhas(pc.token, CR.id))[0];
      assert.equal(m.correcaoSolicitada, true); assert.equal(m.editavelAgora, true);
      const g = await folha(pc.token, CR.id, it.cargoId);
      const s = await salvar(pc.token, CR.id, it.cargoId, g.json.updatedAt, CR.semanas.map((x, i) => ({ semanaId: x.id, texto: `R${rodada} semana ${i + 1}` })));
      st(s, 200);
      const c = await concluir(pc.token, CR.id, it.cargoId, s.json.updatedAt); st(c, 200);
      const d = await det(fc.entregaId); assert.equal(d.situacao, 'recebida');
    }
    const cs = await prisma.correcaoEntregaUmTerco.findMany({ where: { entregaId: fc.entregaId }, orderBy: { criadaEm: 'asc' } });
    assert.equal(cs.length, 3); assert.ok(cs.every((c) => c.status === 'RESOLVIDA'));
    assert.ok(cs.every((c) => c.prazoAte.getTime() - c.criadaEm.getTime() === 3 * DIA));
    assert.deepEqual(cs.slice(0, 2).map((c) => c.conferencia), ['DEVOLVIDA', 'DEVOLVIDA']);
    assert.equal(await prisma.historicoCorrecaoSemanaUmTerco.count({ where: { entregaId: fc.entregaId, origem: 'PROFESSOR_POS_DEVOLUCAO' } }), 9);
    st(await api(tSec, 'POST', `/formulario-um-terco/entregas/${fc.entregaId}/aceitar`), 200);
  });
  await caso('13. Reenvio exige todas as semanas preenchidas', async () => {
    st(await api(tSec, 'POST', `/formulario-um-terco/entregas/${fcAtu.entregaId}/devolver`, { observacao: 'Complete' }), 201);
    const it = (await minhas(pcAtu.token, CR.id))[0];
    const g = await folha(pcAtu.token, CR.id, it.cargoId);
    const s = await salvar(pcAtu.token, CR.id, it.cargoId, g.json.updatedAt, [{ semanaId: CR.semanas[1].id, texto: '' }]); st(s, 200);
    const c = await concluir(pcAtu.token, CR.id, it.cargoId, s.json.updatedAt); st(c, 400);
    assert.match(c.json.message, /Semana 2/);
  });
  await caso('16/13. Folha só com atuações: correção direta funciona e a mensagem traz as atuações', async () => {
    const d = await det(fcAtu.entregaId);
    const s2 = d.semanas[1];
    st(await api(tSec, 'PUT', `/correcoes-um-terco/${fcAtu.entregaId}/respostas`, { baseUpdatedAt: d.updatedAt, respostas: [{ semanaId: s2.id, texto: 'Secretaria completou' }] }), 200);
    const msg = await prisma.mensagem.findFirst({ where: { remetenteId: sec.id, conversa: { participantes: { some: { pessoaId: pcAtu.id } }, assunto: { startsWith: 'Correção feita' } } } });
    assert.match(msg?.conteudo ?? '', /Oficina do Brincar, Professor Regente/);
  });
  await caso('13. Correção EXPIRADA com prazo geral encerrado: Professor perde a edição, texto fica; nova devolução reabre 3 dias', async () => {
    const pe = await novoProfessor([{ composicao: C([EA.id, [GEO.id]]) }]); await recuar(pe.id, 48);
    const CE = await novoCiclo({ abreEm: inicioDoDiaSp(diaSp(-1)), prazoEm: new Date(Date.now() + 5 * DIA), escolas: [EA.id] });
    const outro = await novoProfessor([{ composicao: C([EA.id, [MAT.id]]) }]); await recuar(outro.id, 48);
    const fe = await preencherEConcluir(pe, CE, (await minhas(pe.token, CE.id))[0].cargoId, 'Expira');
    st(await salvar(outro.token, CE.id, (await minhas(outro.token, CE.id))[0].cargoId, null, [{ semanaId: CE.semanas[0].id, texto: 'outro' }]), 200);
    st(await api(tSec, 'POST', `/formulario-um-terco/entregas/${fe.entregaId}/devolver`, { observacao: 'vai expirar' }), 201);
    await prisma.cicloUmTerco.update({ where: { id: CE.id }, data: { prazoEm: new Date(Date.now() - H) } });
    // Prazo geral encerrado + correção vigente: só ESTA folha edita; a do outro professor não; o ciclo segue encerrado.
    const it = (await minhas(pe.token, CE.id))[0];
    assert.equal(it.editavelAgora, true); assert.equal(it.ciclo.editavelAgora, false);
    assert.equal((await minhas(outro.token, CE.id))[0].editavelAgora, false);
    const g = await folha(outro.token, CE.id, (await minhas(outro.token, CE.id))[0].cargoId);
    st(await salvar(outro.token, CE.id, g.json.cargoId, g.json.updatedAt, [{ semanaId: CE.semanas[0].id, texto: 'tentativa fora do prazo' }]), 400);
    // Expira:
    await prisma.correcaoEntregaUmTerco.updateMany({ where: { entregaId: fe.entregaId }, data: { prazoAte: new Date(Date.now() - 60000) } });
    const g2 = await folha(pe.token, CE.id, it.cargoId);
    assert.equal(g2.json.editavelAgora, false);
    st(await salvar(pe.token, CE.id, it.cargoId, g2.json.updatedAt, [{ semanaId: CE.semanas[0].id, texto: 'depois de expirar' }]), 400);
    assert.equal((await det(fe.entregaId)).situacao, 'expirada');
    assert.equal(g2.json.semanas[0].texto, 'Expira semana 1');
    st(await api(tSec, 'POST', `/formulario-um-terco/entregas/${fe.entregaId}/devolver`, { observacao: 'nova janela' }), 201);
    const g3 = await folha(pe.token, CE.id, it.cargoId); assert.equal(g3.json.editavelAgora, true);
    st(await salvar(pe.token, CE.id, it.cargoId, g3.json.updatedAt, [{ semanaId: CE.semanas[0].id, texto: 'na nova janela' }]), 200);
    await prisma.cicloUmTerco.update({ where: { id: CE.id }, data: { status: 'INATIVA' } });
  });
  await caso('13. Folha de cargo encerrado: só consulta (sem correção direta e sem devolução)', async () => {
    const e = await prisma.entregaUmTerco.findFirstOrThrow({ where: { cicloId: CP.id, professorId: pp.encConc.id } });
    const d = await det(e.id); assert.equal(d.somenteConsulta, true);
    st(await api(tSec, 'POST', `/formulario-um-terco/entregas/${e.id}/devolver`, { observacao: 'x' }), 400);
    st(await api(tSec, 'PUT', `/correcoes-um-terco/${e.id}/respostas`, { baseUpdatedAt: d.updatedAt, respostas: [{ semanaId: d.semanas[0].id, texto: 'x' }] }), 400);
  });

  // ===================== 17. Exportação (dados para o Excel) =====================
  secao('16/17. Educação Infantil e dados da exportação');
  await caso('17. Exportação: texto com "=" e quebras chega igual; cobertura com escolas, disciplinas e atuações', async () => {
    const [itDA] = await minhas(fDA.token, C1.id);
    st(await salvar(fDA.token, C1.id, itDA.cargoId, null, [{ semanaId: C1.semanas[0].id, texto: textos.formula + '\n' + textos.acento }]), 200);
    const r = await api(tSec, 'GET', `/formulario-um-terco/ciclos/${C1.id}/exportacao`);
    st(r, 200);
    const eDA = await prisma.entregaUmTerco.findFirstOrThrow({ where: { cicloId: C1.id, professorId: fDA.id }, include: { respostas: true } });
    const doDA = r.json.conteudos.filter((x: { entregaId: number }) => x.entregaId === eDA.id);
    assert.equal(doDA.length, 1);
    assert.equal(doDA[0].texto, textos.formula + '\n' + textos.acento, 'texto com "=" e acentos idêntico');
    assert.match(doDA[0].cobertura, /Professor de Intervenção/);
    const e1 = await prisma.entregaUmTerco.findFirstOrThrow({ where: { cicloId: C1.id, professorId: f1.id }, include: { respostas: true } });
    const doF1 = r.json.conteudos.filter((x: { entregaId: number }) => x.entregaId === e1.id).map((x: { texto: string }) => x.texto).sort();
    assert.deepEqual(doF1, e1.respostas.map((x) => x.texto).sort(), 'exportação = textos do banco');
    const atu = r.json.linhas.find((l: { professorId: number }) => l.professorId === fDA.id);
    assert.ok(atu, 'folha disciplina+atuação listada');
    semTurma(r.json.linhas);
  });
  await caso('16. Regente, Oficina, Intervenção e várias atuações: folha, painel e filtro por escola funcionam; nada vira disciplina', async () => {
    const p = await novoProfessor([{ composicao: C([EC.id, [], [regente.id, oficina.id, intervencao.id]]) }]); await recuar(p.id, 48);
    const [it] = await minhas(p.token, C1.id);
    assert.deepEqual(it.composicao[0].atuacoes?.map((a) => a.nome).sort(), ['Oficina do Brincar', 'Professor Regente', 'Professor de Intervenção'].sort());
    assert.ok((await painel(C1.id, `?escolaId=${EC.id}`)).linhas.some((l) => l.professorId === p.id));
    assert.ok(!(await painel(C1.id, `?disciplinaId=${ING.id}`)).linhas.some((l) => l.professorId === p.id));
  });

  // ===================== 6. Criação de ciclo pela API =====================
  secao('6. Criação de ciclo (API, escolas D/E, calendário real só lido)');
  const corpoCiclo = (abre: string, prazo: string, semanas: [string, string][], escolaIds = [ED.id], ano = 2027) => ({ anoLetivo: ano, trimestre: ano === 2027 ? 1 : 3, titulo: `${P}ciclo api`, abreEm: abre, prazoEm: prazo, semanas: semanas.map(([dataInicio, dataFim]) => ({ dataInicio, dataFim })), todasEscolas: false, escolaIds });
  const criar = async (corpo: unknown) => { const r = await api(tSec, 'POST', '/formulario-um-terco/ciclos', corpo); if (r.status === 201) { reg.ciclos.push(r.json.id); salvarRegistro(); } return r; };
  const d = (n: number) => diaSp(n);
  await caso('Abertura hoje (00:00), no horário atual e minutos à frente: a data é aceita (só a sobreposição com o ciclo #1 de todas as escolas impede)', async () => {
    for (const abre of [`${d(0)}T00:00`, new Date().toISOString(), new Date(Date.now() + 5 * 60000).toISOString()]) {
      const r = await criar(corpoCiclo(abre, `${d(3)}T23:59`, [[d(0), d(2)]], [ED.id], 2026));
      assert.equal(r.status, 409, `${abre}: ${r.status} ${r.json?.message}`); assert.match(r.json.message, /sobrepõe/);
    }
  });
  await caso('Abertura no passado (ontem) → 400 "no passado"', async () => {
    const r = await criar(corpoCiclo(`${d(-1)}T00:00`, `${d(3)}T23:59`, [[d(0), d(2)]], [ED.id], 2026)); st(r, 400); assert.match(r.json.message, /passado/);
  });
  // Ciclos futuros no 1º trimestre/2027 (01/02 a 30/04/2027).
  void tri2026; const F = (n: number) => diaSp(n, new Date(`${tri2027.dataInicio.toISOString().slice(0, 10)}T15:00:00Z`).getTime());
  await caso('Futuro: prazo antes/igual à abertura, fora do trimestre, semana fora, semanas sobrepostas, semana depois do prazo → 400', async () => {
    st(await criar(corpoCiclo(`${F(5)}T00:00`, `${F(4)}T23:59`, [[F(5), F(5)]])), 400);
    st(await criar(corpoCiclo(`${F(5)}T00:00`, `${F(5)}T00:00`, [[F(5), F(5)]])), 400);
    st(await criar(corpoCiclo('2027-07-05T00:00', '2027-07-10T23:59', [['2027-07-05', '2027-07-06']])), 400);
    st(await criar(corpoCiclo(`${F(5)}T00:00`, `${F(20)}T23:59`, [[F(5), F(6)], ['2027-07-01', '2027-07-02']])), 400);
    st(await criar(corpoCiclo(`${F(5)}T00:00`, `${F(20)}T23:59`, [[F(5), F(8)], [F(8), F(10)]])), 400);
    st(await criar(corpoCiclo(`${F(5)}T00:00`, `${F(9)}T23:59`, [[F(5), F(8)], [F(9), F(12)]])), 400);
  });
  let cA: R | null = null;
  await caso('Futuro: 1 semana, prazo no mesmo dia da abertura (23:59) → ok; datas gravadas em SP', async () => {
    cA = await criar(corpoCiclo(`${F(1)}T00:00`, `${F(1)}T23:59`, [[F(1), F(1)]])); st(cA, 201);
    const c = await prisma.cicloUmTerco.findUniqueOrThrow({ where: { id: cA.json.id } });
    assert.equal(c.abreEm.toISOString(), `${F(1)}T03:00:00.000Z`);
    assert.equal(dom.dataLocalSp(c.prazoEm), F(1));
  });
  await caso('Ciclo começando no dia seguinte ao prazo do outro → ok; começando no MESMO dia do prazo → 409', async () => {
    st(await criar(corpoCiclo(`${F(1)}T00:00`, `${F(3)}T23:59`, [[F(1), F(2)]])), 409);
    st(await criar(corpoCiclo(`${F(2)}T00:00`, `${F(14)}T23:59`, [[F(2), F(4)], [F(6), F(8)], [F(10), F(12)]])), 201); // semanas com intervalo
  });
  await caso('Sobreposição parcial na mesma escola → 409; mesmo período em outra escola → ok; "todas as escolas" sobreposto → 409', async () => {
    st(await criar(corpoCiclo(`${F(10)}T00:00`, `${F(20)}T23:59`, [[F(10), F(12)]])), 409);
    st(await criar(corpoCiclo(`${F(10)}T00:00`, `${F(20)}T23:59`, [[F(10), F(12)]], [EE.id])), 201);
    st(await criar({ ...corpoCiclo(`${F(12)}T00:00`, `${F(13)}T23:59`, [[F(12), F(12)]]), todasEscolas: true, escolaIds: [] }), 409);
  });
  await caso('Inativar e reativar um ciclo sem sobreposição → volta ATIVO', async () => {
    const id = cA!.json.id;
    st(await api(tSec, 'POST', `/formulario-um-terco/ciclos/${id}/inativar`), 200);
    st(await api(tSec, 'POST', `/formulario-um-terco/ciclos/${id}/reativar`), 200);
  });
  await caso('Várias semanas (12) num ciclo longo → ok', async () => {
    const sem: [string, string][] = Array.from({ length: 12 }, (_, i) => [F(21 + i * 5), F(23 + i * 5)]);
    st(await criar(corpoCiclo(`${F(21)}T00:00`, `${F(80)}T23:59`, sem, [ED.id])), 201);
  });
  await caso('Duplo clique em "Criar" (2 POST simultâneos iguais) → 1 ciclo só', async () => {
    const corpo = corpoCiclo(`${F(30)}T00:00`, `${F(40)}T23:59`, [[F(30), F(32)]], [EE.id]);
    const rs = await Promise.all([criar(corpo), criar(corpo)]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
  });
  await caso('Editar ciclo com preenchimento: abertura não muda de dia, nº de semanas não muda; prazo pode', async () => {
    const r = await api(tSec, 'PUT', `/formulario-um-terco/ciclos/${C1.id}`, { anoLetivo: 2026, trimestre: 3, titulo: `${P}ciclo`, abreEm: `${d(1)}T00:00`, prazoEm: `${d(9)}T23:59`, semanas: C1.semanas.map((s) => ({ dataInicio: s.dataInicio.toISOString().slice(0, 10), dataFim: s.dataFim.toISOString().slice(0, 10) })), todasEscolas: false, escolaIds: [EA.id, EB.id, EC.id] });
    assert.ok([400, 409].includes(r.status), `HTTP ${r.status} ${r.json?.message}`);
    const r2 = await api(tSec, 'PUT', `/formulario-um-terco/ciclos/${C1.id}`, { anoLetivo: 2026, trimestre: 3, titulo: `${P}ciclo`, abreEm: C1.abreEm.toISOString(), prazoEm: `${d(9)}T23:59`, semanas: C1.semanas.slice(0, 2).map((s) => ({ dataInicio: s.dataInicio.toISOString().slice(0, 10), dataFim: s.dataFim.toISOString().slice(0, 10) })), todasEscolas: false, escolaIds: [EA.id, EB.id, EC.id] });
    st(r2, 409);
  });

  // ===================== 18. Permissões (chamadas diretas) =====================
  secao('18. Permissões (chamadas diretas à API)');
  const [itOutro] = await minhas(f2.token, C1.id);
  const proibidos: [string, string, string, string, unknown?][] = [];
  for (const [nome, t] of [['Diretora', tDir], ['Gestor', tGes], ['Auxiliar', tAux], ['Professor', f1.token]] as const) {
    proibidos.push([nome, t, 'POST', `/pessoas/professores/${f1.id}/cargos`, { dataInicio: d(-1), composicao: C([EA.id, [ING.id]]) }]);
    proibidos.push([nome, t, 'PUT', `/pessoas/professores/${f1.id}/cargos/${(await cargosDe(f1.id))[0].id}`, { composicao: C([EA.id, [GEO.id]]) }]);
    proibidos.push([nome, t, 'POST', `/pessoas/professores/${f1.id}/cargos/${(await cargosDe(f1.id))[0].id}/encerrar`, { dataFim: d(0) }]);
    proibidos.push([nome, t, 'GET', `/formulario-um-terco/ciclos/${C1.id}/painel`]);
    proibidos.push([nome, t, 'GET', `/formulario-um-terco/ciclos/${C1.id}/exportacao`]);
    proibidos.push([nome, t, 'POST', '/formulario-um-terco/ciclos', corpoCiclo(`${F(200)}T00:00`, `${F(201)}T23:59`, [[F(200), F(200)]])]);
    proibidos.push([nome, t, 'POST', `/formulario-um-terco/entregas/${fc.entregaId}/devolver`, { observacao: 'x' }]);
    proibidos.push([nome, t, 'GET', '/correcoes-um-terco']);
    proibidos.push([nome, t, 'PUT', `/correcoes-um-terco/${fc.entregaId}/respostas`, { baseUpdatedAt: new Date().toISOString(), respostas: [{ semanaId: CR.semanas[0].id, texto: 'x' }] }]);
    proibidos.push([nome, t, 'POST', '/atuacoes-pedagogicas', { nome: `${P}invasao` }]);
  }
  for (const [nome, t] of [['Diretora', tDir], ['Gestor', tGes], ['Auxiliar', tAux], ['Secretaria', tSec]] as const) {
    proibidos.push([nome, t, 'PUT', `/formulario-um-terco/ciclos/${C1.id}/cargos/${itOutro.cargoId}/respostas`, { baseUpdatedAt: null, respostas: [{ semanaId: C1.semanas[0].id, texto: 'x' }] }]);
  }
  await caso(`Matriz de ${proibidos.length} chamadas proibidas → todas 401/403, nada gravado`, async () => {
    const antesV = await prisma.cargoVersao.count(); const antesC = await prisma.cicloUmTerco.count(); const antesCor = await prisma.correcaoEntregaUmTerco.count();
    const vazou: string[] = [];
    for (const [nome, t, m, cam, corpo] of proibidos) { const r = await api(t, m, cam, corpo); if (![401, 403].includes(r.status)) vazou.push(`${nome} ${m} ${cam} → ${r.status}`); }
    assert.deepEqual(vazou, []);
    assert.equal(await prisma.cargoVersao.count(), antesV); assert.equal(await prisma.cicloUmTerco.count(), antesC); assert.equal(await prisma.correcaoEntregaUmTerco.count(), antesCor);
  });
  await caso('Professor não vê nem grava a folha de outro Professor (404), mesmo sabendo os IDs', async () => {
    st(await folha(f1.token, C1.id, itOutro.cargoId), 404);
    st(await salvar(f1.token, C1.id, itOutro.cargoId, null, [{ semanaId: C1.semanas[0].id, texto: 'invasão' }]), 404);
    st(await concluir(f1.token, C1.id, itOutro.cargoId), 404);
  });
  await caso('Diretora: consulta cargos de professor da escola dela; de outra escola → 403', async () => {
    st(await api(tDir, 'GET', `/pessoas/professores/${f1.id}/cargos`), 200);
    const pB = await novoProfessor([{ composicao: C([EB.id, [ING.id]]) }]);
    st(await api(tDir, 'GET', `/pessoas/professores/${pB.id}/cargos`), 403);
  });
  await caso('Atuações: Diretora consulta; Gestor/Auxiliar/Professor não', async () => {
    st(await api(tDir, 'GET', '/atuacoes-pedagogicas'), 200);
    for (const t of [tGes, tAux, f1.token]) assert.ok([401, 403].includes((await api(t, 'GET', '/atuacoes-pedagogicas')).status));
  });

  // ===================== 19/21. Exclusões e erros de usuário =====================
  secao('19/21. Inativação de ciclo, catálogo e erros de usuário');
  await caso('19. Inativar ciclo com folhas: Professor deixa de ver e não grava; reativar devolve a MESMA folha', async () => {
    const e = await prisma.entregaUmTerco.findFirstOrThrow({ where: { cicloId: C1.id, professorId: f1.id } });
    st(await api(tSec, 'POST', `/formulario-um-terco/ciclos/${C1.id}/inativar`), 200);
    assert.equal((await minhas(f1.token, C1.id)).length, 0);
    assert.equal((await salvar(f1.token, C1.id, itF1.cargoId, null, [{ semanaId: C1.semanas[0].id, texto: 'x' }])).status, 400);
    // Reativar é barrado enquanto o ciclo local #1 (todas as escolas) está aberto: regra de não sobrepor. Correto.
    const re = await api(tSec, 'POST', `/formulario-um-terco/ciclos/${C1.id}/reativar`);
    st(re, 409); assert.match(re.json.message, /sobrepõe/);
    await prisma.cicloUmTerco.update({ where: { id: C1.id }, data: { status: 'ATIVA' } }); // dado de teste: volta direto
    const [m] = await minhas(f1.token, C1.id);
    assert.equal((await folha(f1.token, C1.id, m.cargoId)).json.entregaId, e.id);
  });
  await caso('19. Retirar do ciclo uma escola com preenchimento → 409 (texto nunca fica órfão)', async () => {
    const r = await api(tSec, 'PUT', `/formulario-um-terco/ciclos/${C1.id}`, { anoLetivo: 2026, trimestre: 3, titulo: `${P}ciclo`, abreEm: C1.abreEm.toISOString(), prazoEm: C1.prazoEm.toISOString(), semanas: C1.semanas.map((s) => ({ dataInicio: s.dataInicio.toISOString().slice(0, 10), dataFim: s.dataFim.toISOString().slice(0, 10) })), todasEscolas: false, escolaIds: [EB.id] });
    st(r, 409); assert.match(r.json.message, /retirar/);
  });
  await caso('19. Desativar atuação usada: cargo continua válido e pode ser salvo; cargo NOVO não aceita a inativa', async () => {
    const nova = await api(tSec, 'POST', '/atuacoes-pedagogicas', { nome: `${P}Apoio` }); st(nova, 201); reg.atuacoes.push(nova.json.id); salvarRegistro();
    const p = await novoProfessor([{ composicao: C([EC.id, [], [nova.json.id]]) }]);
    st(await api(tSec, 'PUT', `/atuacoes-pedagogicas/${nova.json.id}`, { status: 'inativa' }), 200);
    const [c] = await cargosDe(p.id);
    st(await api(tSec, 'PUT', `/pessoas/professores/${p.id}/cargos/${c.id}`, { baseUpdatedAt: c.updatedAt, composicao: C([EC.id, [ING.id], [nova.json.id]]) }), 200);
    st(await api(tSec, 'POST', `/pessoas/professores/${f1.id}/cargos`, { dataInicio: d(-1), composicao: C([EC.id, [], [nova.json.id]]) }), 400);
  });
  await caso('21. URL antiga/inexistente e IDs inválidos → 400/404 (nunca 500)', async () => {
    for (const cam of ['/formulario-um-terco/ciclos/999999999/cargos/1', `/formulario-um-terco/ciclos/${C1.id}/cargos/999999999`, '/formulario-um-terco/ciclos/abc/cargos/xyz', '/correcoes-um-terco/999999999', '/correcoes-um-terco/abc']) {
      const r = await api(cam.startsWith('/correcoes') ? tSec : f1.token, 'GET', cam);
      assert.ok([400, 404].includes(r.status), `${cam} → ${r.status}`);
    }
  });
  await caso('21. Sessão expirada e token adulterado → 401', async () => {
    const expirado = jwt.sign({ perfil: 'PROFESSOR', authVersion: 1, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET!, { subject: String(f1.id) });
    assert.equal((await api(expirado, 'GET', '/formulario-um-terco/minhas')).status, 401);
    assert.equal((await api(f1.token.slice(0, -3) + 'abc', 'GET', '/formulario-um-terco/minhas')).status, 401);
  });
  await caso('21. Payloads quebrados (semana de outro ciclo, corpo vazio, tipos errados) → 400', async () => {
    const outraSemana = (await prisma.semanaUmTerco.findFirstOrThrow({ where: { cicloId: CR.id } })).id;
    const g = await folha(f1.token, C1.id, itF1.cargoId);
    st(await salvar(f1.token, C1.id, itF1.cargoId, g.json.updatedAt, [{ semanaId: outraSemana, texto: 'x' }]), 400);
    st(await api(f1.token, 'PUT', `/formulario-um-terco/ciclos/${C1.id}/cargos/${itF1.cargoId}/respostas`, {}), 400);
    st(await api(f1.token, 'PUT', `/formulario-um-terco/ciclos/${C1.id}/cargos/${itF1.cargoId}/respostas`, { baseUpdatedAt: 5, respostas: 'x' }), 400);
  });
} catch (e) {
  console.error('ERRO FORA DOS CENÁRIOS (bateria interrompida):', e);
  resultados.push({ secao: secaoAtual, nome: 'bateria interrompida', ok: false, erro: String(e) });
} finally {
  // Limpeza: SOMENTE os IDs registrados.
  try { await limpar(); } catch (e) { console.error('ERRO NA LIMPEZA', e); }
  const residuos = {
    pessoas: await prisma.pessoa.count({ where: { OR: [{ email: { startsWith: P.toLowerCase() } }, { nome: { startsWith: P } }] } }),
    escolas: await prisma.escola.count({ where: { nome: { startsWith: P } } }),
    disciplinas: await prisma.disciplina.count({ where: { nome: { startsWith: P } } }),
    ciclos: await prisma.cicloUmTerco.count({ where: { titulo: { startsWith: P } } }),
    atuacoes: await prisma.atuacaoPedagogica.count({ where: { nome: { startsWith: P } } }),
    periodos2099: await prisma.periodoTrimestre.count({ where: { ano: 2099 } }),
  };
  server.close();
  await prisma.$disconnect();
  const falhas = resultados.filter((r) => !r.ok);
  const porSecao = new Map<string, [number, number]>();
  for (const r of resultados) { const v = porSecao.get(r.secao) ?? [0, 0]; v[r.ok ? 0 : 1] += 1; porSecao.set(r.secao, v); }
  console.log('\n===== RESUMO =====');
  for (const [s, [ok, f]] of porSecao) console.log(`${String(ok).padStart(3)} ok ${String(f).padStart(2)} falha  ${s}`);
  console.log(`TOTAL: ${resultados.length} cenários, ${resultados.length - falhas.length} ok, ${falhas.length} falhas; respostas 5xx: ${respostas5xx}`);
  console.log('Resíduos do prefixo após limpeza:', JSON.stringify(residuos));
  writeFileSync(ARQ_REGISTRO.replace(/\.json$/, '-resultado.json'), JSON.stringify({ resultados, respostas5xx, residuos, registro: reg }, null, 1));
  process.exit(falhas.length || respostas5xx ? 1 : 0);
}
