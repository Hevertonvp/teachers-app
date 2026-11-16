// Teste de integração: CARGOS do Professor e o Formulário 1/3 POR CARGO (decisões de 12/11/2026).
// SÓ BANCO LOCAL: recusa rodar se DATABASE_URL não for localhost. Cria dados com prefixo ZZCARGO-T e
// apaga tudo no fim (e restos de execução anterior no começo).
//   DATABASE_URL=postgresql://homolog:homolog@localhost:54329/nexo_homolog npx tsx scripts/umTerco/testar-cargos.ts
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Recusado: este teste só roda contra o banco LOCAL (DATABASE_URL com localhost).');
  process.exit(1);
}
process.env.JWT_SECRET ||= 'teste-local-cargos-apenas-para-homologacao-0123456789';

const { prisma } = await import('../../src/lib/prisma.js');
const { createApp } = await import('../../src/api/app.js');
const { assinarToken } = await import('../../src/api/middleware/auth.js');

const PREFIXO = 'ZZCARGO-T';
const EMAIL = (n: string) => `${PREFIXO.toLowerCase()}-${n}@teste.invalid`;
const H = 3600000;
const DIA = 24 * H;

let ok = 0;
let falhas = 0;
let respostas5xx = 0;
const caso = async (nome: string, fn: () => Promise<void>) => {
  try { await fn(); ok += 1; console.log(`  ok  ${nome}`); } catch (e) { falhas += 1; console.error(`FALHOU ${nome}\n    ${(e as Error).message.split('\n').slice(0, 8).join('\n    ')}`); }
};

// Dia de Brasília (YYYY-MM-DD) deslocado em N dias.
const diaSp = (offset = 0) => new Date(Date.now() - 3 * H + offset * DIA).toISOString().slice(0, 10);
const dataDb = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function limpar() {
  const pessoas = (await prisma.pessoa.findMany({ where: { email: { startsWith: PREFIXO.toLowerCase() } }, select: { id: true } })).map((p) => p.id);
  const escolas = (await prisma.escola.findMany({ where: { nome: { startsWith: PREFIXO } }, select: { id: true } })).map((e) => e.id);
  const ciclos = (await prisma.cicloUmTerco.findMany({ where: { titulo: { startsWith: PREFIXO } }, select: { id: true } })).map((c) => c.id);
  const entregas = (await prisma.entregaUmTerco.findMany({ where: { OR: [{ cicloId: { in: ciclos } }, { professorId: { in: pessoas } }] }, select: { id: true } })).map((e) => e.id);
  await prisma.correcaoEntregaUmTerco.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.entregaUmTerco.deleteMany({ where: { id: { in: entregas } } });
  await prisma.reaberturaUmTerco.deleteMany({ where: { cicloId: { in: ciclos } } });
  await prisma.cicloUmTerco.deleteMany({ where: { id: { in: ciclos } } });
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: pessoas } }, select: { id: true } })).map((c) => c.id);
  await prisma.cargoVersao.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoProfessor.deleteMany({ where: { id: { in: cargos } } });
  await prisma.professorTurmaDisciplina.deleteMany({ where: { OR: [{ professorId: { in: pessoas } }, { turma: { escolaId: { in: escolas } } }] } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.vinculoEscolar.deleteMany({ where: { OR: [{ pessoaId: { in: pessoas } }, { escolaId: { in: escolas } }] } });
  await prisma.pessoaEvento.deleteMany({ where: { OR: [{ pessoaId: { in: pessoas } }, { autorId: { in: pessoas } }] } });
  await prisma.notificacao.deleteMany({ where: { pessoaId: { in: pessoas } } }).catch(() => undefined);
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
  await prisma.disciplina.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
  await prisma.atuacaoPedagogica.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
}

const contar = async () => ({ pessoas: await prisma.pessoa.count(), escolas: await prisma.escola.count(), ciclos: await prisma.cicloUmTerco.count(), entregas: await prisma.entregaUmTerco.count(), cargos: await prisma.cargoProfessor.count(), vinculos: await prisma.vinculoEscolar.count() });

await limpar();
const antes = await contar();
console.log('Contagens ANTES:', JSON.stringify(antes));

const server = createApp().listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const api = async (token: string, metodo: string, caminho: string, corpo?: unknown) => {
  const r = await fetch(`${base}/api${caminho}`, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const json = await r.json().catch(() => null);
  if (r.status >= 500) { respostas5xx += 1; console.error(`    !! 5xx em ${metodo} ${caminho}: ${r.status} ${JSON.stringify(json)}`); }
  return { status: r.status, json };
};

try {
  // ---------- Massa ----------
  const mk = (n: string, perfil: 'SECRETARIA' | 'PROFESSOR' | 'DIRETORA') => prisma.pessoa.create({ data: { nome: `${PREFIXO} ${n}`, email: EMAIL(n), perfil, status: 'ATIVO' } });
  const sec = await mk('sec', 'SECRETARIA');
  const dir = await mk('dir', 'DIRETORA');
  const tSec = assinarToken(sec);
  const tDir = assinarToken(dir);
  const esc = (n: string) => prisma.escola.create({ data: { nome: `${PREFIXO} ${n}` } });
  const prud = await esc('Prudenciana'); const tres = await esc('Tres Marias'); const cmei = await esc('CMEI Infantil');
  await prisma.vinculoEscolar.create({ data: { escolaId: prud.id, pessoaId: dir.id, status: 'ATIVO', dataInicio: new Date() } });
  const [ing, geo] = await Promise.all(['Ingles', 'Geografia'].map((n) => prisma.disciplina.create({ data: { nome: `${PREFIXO} ${n}` } })));
  const C = (...itens: ([number, number[]] | [number, number[], number[]])[]) => itens.map(([escolaId, disciplinaIds, atuacaoIds]) => ({ escolaId, disciplinaIds, atuacaoIds: atuacaoIds ?? [] }));
  // Atuações pedagógicas (12/11/2026): as três iniciais vêm da migration.
  const regente = await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { nome: 'Professor Regente' } });
  const oficina = await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { nome: 'Oficina do Brincar' } });
  const intervencao = await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { nome: 'Professor de Intervenção' } });

  let seq = 0;
  const novoProfessor = async (cargos: { dataInicio?: string; composicao: unknown }[]) => {
    seq += 1;
    const r = await api(tSec, 'POST', '/pessoas/professores', { nome: `${PREFIXO} Prof ${seq}`, email: EMAIL(`prof${seq}`), cargos: cargos.map((c) => ({ dataInicio: c.dataInicio ?? diaSp(-30), composicao: c.composicao })) });
    assert.equal(r.status, 201, `cadastro: ${r.status} ${JSON.stringify(r.json)}`);
    // Simula o primeiro acesso já feito (com senha temporária a API só deixa trocar a senha).
    const pessoa = await prisma.pessoa.update({ where: { email: EMAIL(`prof${seq}`) }, data: { senhaTemporaria: false } });
    return { id: pessoa.id, token: assinarToken(pessoa) };
  };
  const cargosDe = async (id: number, encerrados = false) => (await api(tSec, 'GET', `/pessoas/professores/${id}/cargos${encerrados ? '?incluirEncerrados=1' : ''}`)).json as { id: number; rotulo: string; status: string; dataInicio: string; dataFim: string | null; updatedAt: string; composicao: { escolaId: number; disciplinas: { id: number }[] }[] }[];
  const vinculosAtivos = (id: number) => prisma.vinculoEscolar.findMany({ where: { pessoaId: id, status: 'ATIVO' }, select: { escolaId: true } }).then((v) => v.map((x) => x.escolaId).sort());

  // Volta no tempo o cadastro do cargo (e da 1ª versão) para simular "cadastrado antes da abertura".
  const recuar = async (professorId: number, horas: number) => {
    const quando = new Date(Date.now() - horas * H);
    const cargos = await prisma.cargoProfessor.findMany({ where: { professorId }, select: { id: true } });
    for (const c of cargos) {
      await prisma.cargoProfessor.update({ where: { id: c.id }, data: { createdAt: quando } });
      await prisma.cargoVersao.updateMany({ where: { cargoId: c.id }, data: { criadaEm: quando } });
    }
  };
  // Ciclo de teste direto no banco (aberto há 2 h, prazo em 10 dias), só das escolas de teste.
  const novoCiclo = async (opcoes: { abreHa?: number; abreEmHoras?: number; escolas?: number[] } = {}) => {
    // Corte do ciclo = fim do DIA da abertura (12/11/2026): o ciclo principal abre ONTEM (30 h atrás).
    const abreEm = new Date(Date.now() - (opcoes.abreHa ?? 30) * H + (opcoes.abreEmHoras ?? 0) * H);
    const prazoEm = new Date(abreEm.getTime() + 10 * DIA);
    return prisma.cicloUmTerco.create({
      data: {
        anoLetivo: 2099, trimestre: 3, titulo: `${PREFIXO} ciclo`, abreEm, prazoEm, todasEscolas: false,
        escolas: { create: (opcoes.escolas ?? [prud.id, tres.id, cmei.id]).map((escolaId) => ({ escolaId })) },
        semanas: { create: [{ numero: 1, dataInicio: dataDb(diaSp(0)), dataFim: dataDb(diaSp(2)) }, { numero: 2, dataInicio: dataDb(diaSp(3)), dataFim: dataDb(diaSp(5)) }] },
      },
      include: { semanas: { orderBy: { numero: 'asc' } } },
    });
  };
  type Item = { ciclo: { id: number }; cargoId: number; cargoIds: number[]; compartilhada: boolean; esperada: boolean; editavelAgora: boolean; composicao: { escolaId: number; escolaNome: string; disciplinas: { id: number; nome: string }[] }[]; rotulo: string };
  const minhas = async (token: string, cicloId: number) => ((await api(token, 'GET', '/formulario-um-terco/minhas')).json as Item[]).filter((i) => i.ciclo.id === cicloId);
  const painel = async (cicloId: number, q = '') => (await api(tSec, 'GET', `/formulario-um-terco/ciclos/${cicloId}/painel${q}`)).json as { resumo: { esperado: number; concluidas: number }; linhas: Item[]; foraDoEsperado: Item[]; porEscola: { escolaId: number; esperado: number }[] };

  console.log('\n— Cadastro de cargos —');
  let p1: { id: number; token: string };
  await caso('1. Professor com 1 cargo (rótulo "Cargo 1", vínculo escolar criado)', async () => {
    p1 = await novoProfessor([{ composicao: C([prud.id, [ing.id]]) }]);
    const cs = await cargosDe(p1.id);
    assert.equal(cs.length, 1); assert.equal(cs[0].rotulo, 'Cargo 1');
    assert.deepEqual(await vinculosAtivos(p1.id), [prud.id]);
  });
  let p2: { id: number; token: string };
  await caso('2/4. Professor com 2 cargos, um em cada escola', async () => {
    p2 = await novoProfessor([{ composicao: C([prud.id, [ing.id]]) }, { composicao: C([tres.id, [geo.id]]) }]);
    const cs = await cargosDe(p2.id);
    assert.deepEqual(cs.map((c) => c.rotulo), ['Cargo 1', 'Cargo 2']);
    assert.deepEqual(await vinculosAtivos(p2.id), [prud.id, tres.id].sort());
  });
  await caso('3. Dois cargos na mesma escola', async () => {
    const p = await novoProfessor([{ composicao: C([prud.id, [ing.id]]) }, { composicao: C([prud.id, [geo.id]]) }]);
    assert.equal((await cargosDe(p.id)).length, 2);
    assert.deepEqual(await vinculosAtivos(p.id), [prud.id], 'vínculo não pode duplicar');
  });
  await caso('5/6/7. Um cargo com várias escolas, várias disciplinas e a mesma disciplina em escolas diferentes', async () => {
    const p = await novoProfessor([{ composicao: C([prud.id, [ing.id]], [tres.id, [ing.id, geo.id]]) }]);
    const [c] = await cargosDe(p.id);
    assert.equal(c.composicao.length, 2);
    assert.equal(c.composicao.find((x) => x.escolaId === tres.id)!.disciplinas.length, 2);
    assert.deepEqual(await vinculosAtivos(p.id), [prud.id, tres.id].sort());
  });
  await caso('8. Terceiro cargo ativo bloqueado', async () => {
    const r = await api(tSec, 'POST', `/pessoas/professores/${p2.id}/cargos`, { dataInicio: diaSp(), composicao: C([cmei.id, [], [regente.id]]) });
    assert.equal(r.status, 409, JSON.stringify(r.json));
  });
  await caso('9. Disciplina repetida na mesma escola do cargo bloqueada', async () => {
    const r = await api(tSec, 'POST', `/pessoas/professores/${p1.id}/cargos`, { dataInicio: diaSp(), composicao: C([tres.id, [geo.id, geo.id]]) });
    assert.equal(r.status, 400, JSON.stringify(r.json));
  });
  await caso('10. Escola repetida no mesmo cargo bloqueada', async () => {
    const r = await api(tSec, 'POST', `/pessoas/professores/${p1.id}/cargos`, { dataInicio: diaSp(), composicao: C([tres.id, [geo.id]], [tres.id, [ing.id]]) });
    assert.equal(r.status, 400, JSON.stringify(r.json));
  });
  await caso('Data de início manual é gravada como informada', async () => {
    const p = await novoProfessor([{ dataInicio: '2026-02-03', composicao: C([prud.id, [geo.id]]) }]);
    assert.equal((await cargosDe(p.id))[0].dataInicio, '2026-02-03');
  });
  console.log('\n— Atuações pedagógicas —');
  await caso('Escola sem disciplina E sem atuação é recusada (regra de 12/11/2026)', async () => {
    const r = await api(tSec, 'POST', `/pessoas/professores/${p1.id}/cargos`, { dataInicio: diaSp(), composicao: C([cmei.id, []]) });
    assert.equal(r.status, 400, JSON.stringify(r.json));
    assert.match(r.json.message, /ao menos uma disciplina ou uma atuação/);
  });
  await caso('2/5. Cargo só com atuação: Professor Regente na Educação Infantil (sem disciplina inventada)', async () => {
    const p = await novoProfessor([{ composicao: C([cmei.id, [], [regente.id]]) }]);
    const [c] = await cargosDe(p.id);
    assert.deepEqual(c.composicao.map((x) => [x.disciplinas.length, (x as unknown as { atuacoes: { nome: string }[] }).atuacoes.map((a) => a.nome)]), [[0, ['Professor Regente']]]);
    assert.equal(await prisma.disciplina.count({ where: { nome: { contains: 'Regente' } } }), 0);
  });
  await caso('3/4. Disciplina + atuação na mesma escola; duas atuações na mesma escola; atuação repetida recusada', async () => {
    const p = await novoProfessor([{ composicao: C([prud.id, [ing.id], [intervencao.id]], [cmei.id, [], [regente.id, oficina.id]]) }]);
    const [c] = await cargosDe(p.id);
    const porEscola = Object.fromEntries(c.composicao.map((x) => [x.escolaId, (x as unknown as { atuacoes: { id: number }[] }).atuacoes.length]));
    assert.equal(porEscola[prud.id], 1); assert.equal(porEscola[cmei.id], 2);
    const rep = await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos`, { dataInicio: diaSp(), composicao: C([cmei.id, [], [regente.id, regente.id]]) });
    assert.equal(rep.status, 400, JSON.stringify(rep.json));
  });
  await caso('Catálogo: Secretaria cadastra, renomeia e desativa; nome repetido 409; Diretora só consulta; inativa não entra em cargo novo', async () => {
    const nova = await api(tSec, 'POST', '/atuacoes-pedagogicas', { nome: `${PREFIXO} Apoio` });
    assert.equal(nova.status, 201, JSON.stringify(nova.json));
    assert.equal((await api(tSec, 'POST', '/atuacoes-pedagogicas', { nome: `${PREFIXO.toLowerCase()} apoio` })).status, 409);
    assert.equal((await api(tDir, 'POST', '/atuacoes-pedagogicas', { nome: 'x de diretora' })).status, 403);
    assert.equal((await api(tDir, 'GET', '/atuacoes-pedagogicas')).status, 200);
    assert.equal((await api(tSec, 'PUT', `/atuacoes-pedagogicas/${nova.json.id}`, { status: 'inativa' })).status, 200);
    const comInativa = await api(tSec, 'POST', `/pessoas/professores/${p1.id}/cargos`, { dataInicio: diaSp(), composicao: C([cmei.id, [], [nova.json.id]]) });
    assert.equal(comInativa.status, 400, JSON.stringify(comInativa.json));
  });
  await caso('Educação Infantil (folha antiga, gravada sem atuação): composição antiga continua lida como está', async () => {
    const p = await novoProfessor([{ composicao: C([cmei.id, [], [regente.id]]) }]);
    const [c] = await cargosDe(p.id);
    // Simula uma versão gravada ANTES das atuações (sem o campo atuacaoIds), direto no banco.
    await prisma.cargoVersao.updateMany({ where: { cargoId: c.id }, data: { composicao: [{ escolaId: cmei.id, disciplinaIds: [] }] } });
    assert.equal((await cargosDe(p.id))[0].composicao[0].disciplinas.length, 0);
  });
  await caso('Diretora consulta cargos, mas não cria, altera nem encerra', async () => {
    assert.equal((await api(tDir, 'GET', `/pessoas/professores/${p1.id}/cargos`)).status, 200);
    assert.equal((await api(tDir, 'POST', `/pessoas/professores/${p1.id}/cargos`, { dataInicio: diaSp(), composicao: C([prud.id, [geo.id]]) })).status, 403);
    const [c] = await cargosDe(p1.id);
    assert.equal((await api(tDir, 'PUT', `/pessoas/professores/${p1.id}/cargos/${c.id}`, { composicao: C([prud.id, [geo.id]]) })).status, 403);
    assert.equal((await api(tDir, 'POST', `/pessoas/professores/${p1.id}/cargos/${c.id}/encerrar`, { dataFim: diaSp() })).status, 403);
  });
  // MUDOU em 13/11/2026 (decisão do usuário): a escola do Professor vem do cargo.
  const turmaEm = (escolaId: number, n: number) => prisma.turma.create({ data: { escolaId, anoLetivo: 2099, etapa: 'FUNDAMENTAL', anoSerie: 6, turno: 'MANHA', identificador: n, nome: `${PREFIXO} 6º ${n}`, identidadeChave: `${PREFIXO}-${escolaId}-${n}-${Date.now()}` } });
  const turmasAtivas = (id: number) => prisma.professorTurmaDisciplina.count({ where: { professorId: id, status: 'ATIVO' } });
  await caso('Tirar escola do cargo: prévia lista escola e turma; sem confirmar = 409 e nada muda; confirmado = sai da escola e da turma lá', async () => {
    const p = await novoProfessor([{ composicao: C([prud.id, [ing.id]], [tres.id, [geo.id]]) }]);
    const t = await turmaEm(tres.id, 1);
    await prisma.professorTurmaDisciplina.create({ data: { turmaId: t.id, professorId: p.id, disciplinaId: geo.id, status: 'ATIVO', dataInicio: dataDb(diaSp(-5)) } });
    const [c] = await cargosDe(p.id);
    const previa = await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c.id}/saidas`, { composicao: C([prud.id, [ing.id]]) });
    assert.equal(previa.status, 200, JSON.stringify(previa.json));
    assert.deepEqual(previa.json.map((s: { escolaId: number; turmas: unknown[] }) => [s.escolaId, s.turmas.length]), [[tres.id, 1]]);
    assert.equal((await api(tDir, 'POST', `/pessoas/professores/${p.id}/cargos/${c.id}/saidas`, { encerrar: true })).status, 403);
    const semConfirmar = await api(tSec, 'PUT', `/pessoas/professores/${p.id}/cargos/${c.id}`, { composicao: C([prud.id, [ing.id]]), baseUpdatedAt: c.updatedAt });
    assert.equal(semConfirmar.status, 409, JSON.stringify(semConfirmar.json));
    assert.deepEqual(await vinculosAtivos(p.id), [prud.id, tres.id].sort());
    assert.equal((await cargosDe(p.id))[0].composicao.length, 2);
    const r = await api(tSec, 'PUT', `/pessoas/professores/${p.id}/cargos/${c.id}`, { composicao: C([prud.id, [ing.id]]), baseUpdatedAt: c.updatedAt, confirmarSaida: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(await vinculosAtivos(p.id), [prud.id]);
    assert.equal(await turmasAtivas(p.id), 0);
  });
  await caso('Escola que continua no outro cargo NÃO sai (alterar e encerrar não pedem confirmação)', async () => {
    const p = await novoProfessor([{ composicao: C([prud.id, [ing.id]], [tres.id, [geo.id]]) }, { composicao: C([tres.id, [ing.id]]) }]);
    const [c1, c2] = await cargosDe(p.id);
    const r = await api(tSec, 'PUT', `/pessoas/professores/${p.id}/cargos/${c1.id}`, { composicao: C([prud.id, [ing.id]]), baseUpdatedAt: c1.updatedAt });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(await vinculosAtivos(p.id), [prud.id, tres.id].sort());
    assert.equal((await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c2.id}/saidas`, { encerrar: true })).json.length, 1);
    const enc = await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c2.id}/encerrar`, { dataFim: diaSp() });
    assert.equal(enc.status, 409, 'Cargo 2 era o único com a Três Marias: precisa confirmar');
  });
  await caso('Incluir escola no cargo: o professor entra na escola na hora', async () => {
    const p = await novoProfessor([{ composicao: C([prud.id, [ing.id]]) }]);
    const [c] = await cargosDe(p.id);
    const r = await api(tSec, 'PUT', `/pessoas/professores/${p.id}/cargos/${c.id}`, { composicao: C([prud.id, [ing.id]], [tres.id, [ing.id]]), baseUpdatedAt: c.updatedAt });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(await vinculosAtivos(p.id), [prud.id, tres.id].sort());
  });
  await caso('Vínculo escolar de Professor fora do cargo é recusado: Diretora não cadastra; janela "Escolas" não vincula, encerra nem reativa', async () => {
    const p = await novoProfessor([{ composicao: C([tres.id, [ing.id]]) }]);
    const dirCad = await api(tDir, 'POST', '/pessoas/professores', { nome: `${PREFIXO} Prof Dir`, email: EMAIL('prof-dir'), escolaIds: [prud.id] });
    assert.equal(dirCad.status, 403, JSON.stringify(dirCad.json));
    assert.equal(await prisma.pessoa.count({ where: { email: EMAIL('prof-dir') } }), 0);
    assert.equal((await api(tSec, 'POST', '/pessoas/professores', { nome: 'x', email: EMAIL('prof-sem-cargo'), escolaIds: [prud.id] })).status, 400);
    assert.equal((await api(tSec, 'POST', '/pessoas/professores', { email: EMAIL(`prof${seq}`), cargos: [{ dataInicio: diaSp(), composicao: C([prud.id, [ing.id]]) }] })).status, 409);
    assert.equal((await api(tSec, 'POST', '/vinculos-escolares', { pessoaId: p.id, escolaId: prud.id })).status, 400);
    assert.equal((await api(tDir, 'POST', '/vinculos-escolares', { pessoaId: p.id, escolaId: prud.id })).status, 400);
    const v = await prisma.vinculoEscolar.findFirstOrThrow({ where: { pessoaId: p.id, status: 'ATIVO' } });
    assert.equal((await api(tSec, 'POST', `/vinculos-escolares/${v.id}/encerrar`)).status, 400);
    assert.deepEqual(await vinculosAtivos(p.id), [tres.id]);
  });
  await caso('Encerramento: data futura e antes do início recusadas; encerrado some da tela normal e continua no banco; renumeração 2 → 1 mantém o id', async () => {
    const p = await novoProfessor([{ dataInicio: diaSp(-30), composicao: C([prud.id, [ing.id]]) }, { dataInicio: diaSp(-10), composicao: C([tres.id, [geo.id]]) }]);
    const [c1, c2] = await cargosDe(p.id);
    assert.equal(c2.rotulo, 'Cargo 2');
    assert.equal((await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c1.id}/encerrar`, { dataFim: diaSp(3) })).status, 400);
    assert.equal((await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c1.id}/encerrar`, { dataFim: diaSp(-40) })).status, 400);
    assert.equal((await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c1.id}/encerrar`, { dataFim: diaSp() })).status, 409, 'sem confirmar a saída da Prudenciana');
    assert.equal((await cargosDe(p.id)).length, 2);
    assert.equal((await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos/${c1.id}/encerrar`, { dataFim: diaSp(-2), confirmarSaida: true })).status, 200);
    // Encerrar o cargo tira o professor da escola DESSE cargo, na data do encerramento.
    assert.deepEqual(await vinculosAtivos(p.id), [tres.id]);
    const vPrud = await prisma.vinculoEscolar.findFirstOrThrow({ where: { pessoaId: p.id, escolaId: prud.id } });
    assert.equal(vPrud.status, 'ENCERRADO');
    // O vínculo nasceu hoje (cadastro); a data de fim nunca fica antes do início.
    assert.equal(vPrud.dataFim?.toISOString().slice(0, 10), vPrud.dataInicio.toISOString().slice(0, 10));
    const visiveis = await cargosDe(p.id);
    assert.deepEqual(visiveis.map((c) => [c.id, c.rotulo]), [[c2.id, 'Cargo 1']]);
    const todos = await cargosDe(p.id, true);
    assert.equal(todos.find((c) => c.id === c1.id)?.status, 'encerrado');
    assert.equal(await prisma.cargoProfessor.count({ where: { id: c1.id } }), 1);
  });

  console.log('\n— Ciclos —');
  // Professores do ciclo, todos com cargos "cadastrados antes da abertura".
  const pUm = await novoProfessor([{ composicao: C([prud.id, [ing.id]]) }]);
  const pDois = await novoProfessor([{ composicao: C([prud.id, [ing.id]]) }, { composicao: C([tres.id, [geo.id]]) }]);
  const pIguais = await novoProfessor([{ composicao: C([prud.id, [ing.id]]) }, { composicao: C([prud.id, [ing.id]]) }]);
  const pQuase = await novoProfessor([{ composicao: C([prud.id, [ing.id]]) }, { composicao: C([prud.id, [ing.id, geo.id]]) }]);
  const pMulti = await novoProfessor([{ composicao: C([prud.id, [ing.id]], [tres.id, [ing.id, geo.id]]) }]);
  const pInfantil = await novoProfessor([{ composicao: C([cmei.id, [], [regente.id]]) }]);
  const pRegentes = await novoProfessor([{ composicao: C([cmei.id, [], [regente.id]]) }, { composicao: C([cmei.id, [], [regente.id]]) }]);
  const pRegenteOficina = await novoProfessor([{ composicao: C([cmei.id, [], [regente.id]]) }, { composicao: C([cmei.id, [], [oficina.id]]) }]);
  const pEncerra = await novoProfessor([{ composicao: C([prud.id, [geo.id]]) }]);
  const pEncerraComTexto = await novoProfessor([{ composicao: C([tres.id, [ing.id]]) }]);
  const pMuda = await novoProfessor([{ composicao: C([prud.id, [ing.id]]) }]);
  const pNovo = await novoProfessor([{ composicao: C([prud.id, [geo.id]]) }]);
  const pIguaisUmEncerra = await novoProfessor([{ composicao: C([tres.id, [geo.id]]) }, { composicao: C([tres.id, [geo.id]]) }]);
  for (const p of [pRegentes, pRegenteOficina, pUm, pDois, pIguais, pQuase, pMulti, pInfantil, pEncerra, pEncerraComTexto, pMuda, pNovo, pIguaisUmEncerra]) await recuar(p.id, 40);
  const ciclo = await novoCiclo();

  await caso('11. 1 cargo → 1 folha (sem turmas, com escola e disciplina)', async () => {
    const itens = await minhas(pUm.token, ciclo.id);
    assert.equal(itens.length, 1);
    assert.equal(itens[0].rotulo, 'Cargo 1');
    assert.deepEqual(itens[0].composicao.map((p) => [p.escolaId, p.disciplinas.map((d) => d.id)]), [[prud.id, [ing.id]]]);
    assert.equal((itens[0] as unknown as { validoPara?: unknown }).validoPara, undefined);
  });
  await caso('12. 2 cargos diferentes → 2 folhas', async () => { assert.equal((await minhas(pDois.token, ciclo.id)).length, 2); });
  await caso('13. 2 cargos iguais → 1 folha compartilhada com aviso', async () => {
    const itens = await minhas(pIguais.token, ciclo.id);
    assert.equal(itens.length, 1);
    assert.equal(itens[0].compartilhada, true);
    assert.equal(itens[0].cargoIds.length, 2);
    const det = (await api(pIguais.token, 'GET', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${itens[0].cargoIds[1]}`)).json as { avisoCompartilhada: string; rotulo: string };
    assert.match(det.avisoCompartilhada, /representa os dois cargos/);
    assert.equal(det.rotulo, 'Cargos 1 e 2');
  });
  await caso('14. Cargos quase iguais → 2 folhas', async () => { assert.equal((await minhas(pQuase.token, ciclo.id)).length, 2); });
  await caso('Rede inteira: Professor da Educação Infantil (escola sem disciplina) tem folha', async () => {
    const itens = await minhas(pInfantil.token, ciclo.id);
    assert.equal(itens.length, 1);
    assert.equal(itens[0].composicao[0].escolaId, cmei.id);
  });
  await caso('6. Professor Regente gera folha normalmente, com "CMEI — Professor Regente"', async () => {
    const itens = await minhas(pInfantil.token, ciclo.id);
    assert.equal(itens.length, 1);
    assert.deepEqual(itens[0].composicao.map((p) => [p.escolaNome, p.disciplinas.length, (p as unknown as { atuacoes: { nome: string }[] }).atuacoes.map((a) => a.nome)]), [[cmei.nome, 0, ['Professor Regente']]]);
  });
  await caso('11. Dois cargos com a MESMA atuação na mesma escola → 1 folha compartilhada', async () => {
    const itens = await minhas(pRegentes.token, ciclo.id);
    assert.equal(itens.length, 1); assert.equal(itens[0].compartilhada, true);
  });
  await caso('12. Atuações diferentes (Regente × Oficina do Brincar) → 2 folhas', async () => {
    assert.equal((await minhas(pRegenteOficina.token, ciclo.id)).length, 2);
  });
  await caso('7/10. Conclusão da folha só com atuação; filtro por disciplina não a traz; filtro por escola traz', async () => {
    const [item] = await minhas(pInfantil.token, ciclo.id);
    const s1 = await api(pInfantil.token, 'PUT', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${item.cargoId}/respostas`, { baseUpdatedAt: null, respostas: ciclo.semanas.map((x, i) => ({ semanaId: x.id, texto: `Regente semana ${i + 1}` })) });
    const fim = await api(pInfantil.token, 'POST', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${item.cargoId}/concluir`, { baseUpdatedAt: (s1.json as { updatedAt: string }).updatedAt });
    assert.equal((fim.json as { status: string }).status, 'concluida', JSON.stringify(fim.json));
    const entrega = await prisma.entregaUmTerco.findFirstOrThrow({ where: { cicloId: ciclo.id, professorId: pInfantil.id } });
    assert.match(JSON.stringify(entrega.composicao), /Professor Regente/, 'a foto guarda o nome da atuação');
    const porDisc = await painel(ciclo.id, `?disciplinaId=${ing.id}`);
    assert.ok(!porDisc.linhas.some((l) => l.professorId === pInfantil.id));
    assert.ok((await painel(ciclo.id, `?escolaId=${cmei.id}`)).linhas.some((l) => l.professorId === pInfantil.id));
  });
  const semanas = ciclo.semanas;
  const salvar = (token: string, cargoId: number, base: string | null, textos = ['Semana 1: verbos', 'Semana 2: mapas']) =>
    api(token, 'PUT', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${cargoId}/respostas`, { baseUpdatedAt: base, respostas: semanas.map((s, i) => ({ semanaId: s.id, texto: textos[i] ?? '' })) });
  // Informática fora do 1/3 "por enquanto" (decisão do usuário, 15/11/2026): só a Informática some da folha.
  {
    const info = await prisma.disciplina.upsert({ where: { nome: 'Informática' }, update: {}, create: { nome: 'Informática' } });
    const pSoInfo = await novoProfessor([{ composicao: C([prud.id, [info.id]]) }]);
    const pInfoMais = await novoProfessor([{ composicao: C([prud.id, [ing.id, info.id]]) }]);
    const pDuasEscolas = await novoProfessor([{ composicao: C([prud.id, [ing.id]], [tres.id, [info.id]]) }]);
    for (const p of [pSoInfo, pInfoMais, pDuasEscolas]) await recuar(p.id, 40);
    await caso('INFO 1. Professor SÓ de Informática não recebe folha nem conta no esperado', async () => {
      assert.equal((await minhas(pSoInfo.token, ciclo.id)).length, 0);
      assert.equal((await painel(ciclo.id, `?professorId=${pSoInfo.id}`)).linhas.length, 0);
    });
    await caso('INFO 2. Informática + Inglês na mesma escola: folha normal só com Inglês', async () => {
      const itens = await minhas(pInfoMais.token, ciclo.id);
      assert.equal(itens.length, 1);
      assert.deepEqual(itens[0].composicao.map((p) => p.disciplinas.map((d) => d.nome)), [[ing.nome]]);
    });
    await caso('INFO 3. Cargo com duas escolas, uma só com Informática: a folha fica só com a outra escola', async () => {
      const itens = await minhas(pDuasEscolas.token, ciclo.id);
      assert.equal(itens.length, 1);
      assert.deepEqual(itens[0].composicao.map((p) => p.escolaId), [prud.id]);
    });
  }

  // Biblioteca fora do 1/3 (decisão do usuário, 16/11/2026: "1/3 é pra quem dá aula").
  {
    const biblio = await prisma.atuacaoPedagogica.upsert({ where: { nome: 'Biblioteca' }, update: {}, create: { nome: 'Biblioteca' } });
    const tae = await prisma.atuacaoPedagogica.upsert({ where: { nome: 'TAE' }, update: {}, create: { nome: 'TAE' } });
    const pSoBiblio = await novoProfessor([{ composicao: C([prud.id, [], [biblio.id]]) }]);
    const pBiblioRegente = await novoProfessor([{ composicao: C([prud.id, [], [biblio.id, regente.id]]) }]);
    const pBiblioDisc = await novoProfessor([{ composicao: C([prud.id, [ing.id], [biblio.id]]) }]);
    const pElegiveis = await Promise.all([regente, oficina, intervencao, tae].map((a) => novoProfessor([{ composicao: C([prud.id, [], [a.id]]) }])));
    for (const p of [pSoBiblio, pBiblioRegente, pBiblioDisc, ...pElegiveis]) await recuar(p.id, 40);
    await caso('BIBLIO 1. Professor SÓ de Biblioteca não recebe folha nem conta no painel', async () => {
      assert.equal((await minhas(pSoBiblio.token, ciclo.id)).length, 0);
      assert.equal((await painel(ciclo.id, `?professorId=${pSoBiblio.id}`)).linhas.length, 0);
    });
    await caso('BIBLIO 2. Biblioteca + Professor Regente: uma folha, só com Professor Regente', async () => {
      const itens = await minhas(pBiblioRegente.token, ciclo.id);
      assert.equal(itens.length, 1);
      assert.deepEqual(itens[0].composicao.map((p) => (p as unknown as { atuacoes: { nome: string }[] }).atuacoes.map((a) => a.nome)), [['Professor Regente']]);
      assert.equal((await painel(ciclo.id, `?professorId=${pBiblioRegente.id}`)).linhas.length, 1);
    });
    await caso('BIBLIO 3. Biblioteca + Inglês: uma folha com Inglês', async () => {
      const itens = await minhas(pBiblioDisc.token, ciclo.id);
      assert.equal(itens.length, 1);
      assert.deepEqual(itens[0].composicao.map((p) => p.disciplinas.map((d) => d.nome)), [[ing.nome]]);
    });
    await caso('BIBLIO 4. Regente, Oficina do Brincar, Intervenção e TAE (sozinhos) geram folha', async () => {
      for (const p of pElegiveis) assert.equal((await minhas(p.token, ciclo.id)).length, 1);
    });
  }

  // Regra de 15/11/2026: cargo criado com o ciclo aberto entra no ciclo atual (antes: só no próximo).
  const respostasAntes = await prisma.respostaSemanaUmTerco.findMany({ where: { entrega: { cicloId: ciclo.id } }, select: { id: true, texto: true, updatedAt: true }, orderBy: { id: 'asc' } });
  const entregasAntes = await prisma.entregaUmTerco.findMany({ where: { cicloId: ciclo.id }, select: { id: true, status: true, chaveCargos: true }, orderBy: { id: 'asc' } });
  await caso('NOVA 1. Cargo existente antes da abertura entra normalmente (folha do Cargo 1)', async () => {
    const itens = await minhas(pNovo.token, ciclo.id);
    assert.equal(itens.length, 1); assert.equal(itens[0].esperada, true);
  });
  await caso('NOVA 2/6. Cargo criado com o ciclo aberto entra no ciclo atual: 2 folhas, esperado +1, filtro da escola nova, mesmo prazo', async () => {
    const antesP = await painel(ciclo.id);
    const r = await api(tSec, 'POST', `/pessoas/professores/${pNovo.id}/cargos`, { dataInicio: diaSp(), composicao: C([tres.id, [ing.id]]) });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const itens = await minhas(pNovo.token, ciclo.id);
    assert.equal(itens.length, 2, 'Cargo 1 + Cargo 2 no ciclo atual');
    const nova = itens.find((i) => i.composicao.some((p) => p.escolaId === tres.id))!;
    assert.ok(nova, 'folha da escola nova');
    assert.equal(nova.esperada, true); assert.equal(nova.editavelAgora, true);
    const depois = await painel(ciclo.id);
    assert.equal(depois.resumo.esperado, antesP.resumo.esperado + 1, 'esperado sobe 1');
    assert.ok((await painel(ciclo.id, `?escolaId=${tres.id}`)).linhas.some((l) => l.professorId === pNovo.id && l.cargoId === nova.cargoId), 'aparece no filtro da escola nova');
    assert.ok(!(await painel(ciclo.id, `?escolaId=${prud.id}`)).linhas.some((l) => l.cargoId === nova.cargoId), 'não aparece na outra escola');
    const c = await prisma.cicloUmTerco.findUniqueOrThrow({ where: { id: ciclo.id } });
    assert.equal(c.prazoEm.getTime(), ciclo.prazoEm.getTime(), 'prazo do ciclo não muda');
  });
  await caso('NOVA 3. Folha nova criada uma única vez (duas primeiras gravações ao mesmo tempo + regravação)', async () => {
    const nova = (await minhas(pNovo.token, ciclo.id)).find((i) => i.composicao.some((p) => p.escolaId === tres.id))!;
    const corpo = { baseUpdatedAt: null, respostas: [{ semanaId: ciclo.semanas[0].id, texto: 'Cargo novo: semana 1' }] };
    const rs = await Promise.all([1, 2].map(() => api(pNovo.token, 'PUT', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${nova.cargoId}/respostas`, corpo)));
    assert.deepEqual(rs.map((x) => x.status).sort(), [200, 409], 'uma grava, a outra recebe conflito');
    const base = (rs.find((x) => x.status === 200)!.json as { updatedAt: string }).updatedAt;
    assert.equal((await api(pNovo.token, 'PUT', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${nova.cargoId}/respostas`, { ...corpo, baseUpdatedAt: base })).status, 200);
    assert.equal(await prisma.entregaUmTercoCargo.count({ where: { cargoId: nova.cargoId, entrega: { cicloId: ciclo.id } } }), 1, 'uma entrega só para o cargo novo');
    assert.equal((await minhas(pNovo.token, ciclo.id)).length, 2);
  });
  await caso('NOVA 5. Cargo equivalente criado no meio do ciclo: folha compartilhada, mesma entrega, texto intacto, esperado igual', async () => {
    const p = await novoProfessor([{ composicao: C([prud.id, [geo.id]]) }]);
    await recuar(p.id, 40);
    const [item] = await minhas(p.token, ciclo.id);
    assert.equal((await salvar(p.token, item.cargoId, null, ['texto do Cargo 1', ''])).status, 200);
    const entrega = await prisma.entregaUmTerco.findFirstOrThrow({ where: { cicloId: ciclo.id, professorId: p.id }, include: { respostas: true } });
    const esperadoAntes = (await painel(ciclo.id)).resumo.esperado;
    assert.equal((await api(tSec, 'POST', `/pessoas/professores/${p.id}/cargos`, { dataInicio: diaSp(), composicao: C([prud.id, [geo.id]]) })).status, 201);
    const itens = await minhas(p.token, ciclo.id);
    assert.equal(itens.length, 1, 'cargos iguais = 1 folha'); assert.equal(itens[0].compartilhada, true);
    assert.equal((await painel(ciclo.id)).resumo.esperado, esperadoAntes, 'não cria obrigação nova');
    const depois = await prisma.entregaUmTerco.findMany({ where: { cicloId: ciclo.id, professorId: p.id }, include: { respostas: true } });
    assert.equal(depois.length, 1); assert.equal(depois[0].id, entrega.id); assert.equal(depois[0].chaveCargos, entrega.chaveCargos);
    assert.deepEqual(depois[0].respostas.map((r) => r.texto), entrega.respostas.map((r) => r.texto));
  });
  await caso('NOVA 7. Folhas e respostas que já existiam no ciclo continuam iguais (id, status, chave, texto)', async () => {
    const r = await prisma.respostaSemanaUmTerco.findMany({ where: { id: { in: respostasAntes.map((x) => x.id) } }, select: { id: true, texto: true, updatedAt: true }, orderBy: { id: 'asc' } });
    assert.deepEqual(r, respostasAntes);
    const e = await prisma.entregaUmTerco.findMany({ where: { id: { in: entregasAntes.map((x) => x.id) } }, select: { id: true, status: true, chaveCargos: true }, orderBy: { id: 'asc' } });
    assert.deepEqual(e, entregasAntes);
  });
  await caso('NOVA 4. Cargo criado depois do encerramento não entra (prazo de hoje, já passado); ciclo antigo (prazo antes de 15/11) mantém a regra antiga', async () => {
    const encerrado = await prisma.cicloUmTerco.create({ data: { anoLetivo: 2099, trimestre: 3, titulo: `${PREFIXO} ciclo`, abreEm: new Date(Date.now() - 3 * DIA), prazoEm: new Date(Date.now() - 60 * 1000), todasEscolas: false, escolas: { create: [{ escolaId: prud.id }] }, semanas: { create: [{ numero: 1, dataInicio: dataDb(diaSp(-3)), dataFim: dataDb(diaSp(-1)) }] } } });
    const depoisDoPrazo = await novoProfessor([{ dataInicio: diaSp(-5), composicao: C([prud.id, [ing.id]]) }]);
    assert.equal((await painel(encerrado.id, `?professorId=${depoisDoPrazo.id}`)).linhas.length, 0, 'criado depois do prazo não entra');
    // Ciclo que terminou em 10/11/2026 e cargo criado no meio dele (07/11): continua fora (não muda o passado).
    const antigo = await prisma.cicloUmTerco.create({ data: { anoLetivo: 2099, trimestre: 3, titulo: `${PREFIXO} ciclo`, abreEm: new Date('2026-11-02T03:00:00Z'), prazoEm: new Date('2026-11-11T02:59:59Z'), todasEscolas: false, escolas: { create: [{ escolaId: prud.id }] }, semanas: { create: [{ numero: 1, dataInicio: dataDb('2026-11-02'), dataFim: dataDb('2026-11-06') }] } } });
    const meio = await novoProfessor([{ dataInicio: '2026-11-01', composicao: C([prud.id, [ing.id]]) }]);
    const quando = new Date('2026-11-07T15:00:00Z');
    await prisma.cargoProfessor.updateMany({ where: { professorId: meio.id }, data: { createdAt: quando } });
    await prisma.cargoVersao.updateMany({ where: { cargo: { professorId: meio.id } }, data: { criadaEm: quando } });
    assert.equal((await painel(antigo.id, `?professorId=${meio.id}`)).linhas.length, 0, 'ciclo antigo não ganha folha retroativa');
  });
  await caso('NOVA 8. Fuso: a regra usa a hora do SERVIDOR em São Paulo (fim do dia do prazo), não a data UTC', async () => {
    const { composicaoNaAbertura } = await import('../../src/domain/cargos.js');
    const cicloX = { abreEm: new Date('2026-11-20T03:00:00Z'), prazoEm: new Date('2026-12-01T02:59:59.999Z') }; // 20/11 a 30/11 (SP)
    const cargo = (criado: string, versoes: [string, number][] = [[criado, prud.id]]) => ({ id: 1, professorId: 1, createdAt: new Date(criado), dataInicio: dataDb(criado.slice(0, 10)), dataFim: null, versoes: versoes.map(([q, e]) => ({ criadaEm: new Date(q), composicao: [{ escolaId: e, disciplinaIds: [ing.id] }] })) });
    assert.ok(composicaoNaAbertura(cargo('2026-11-24T15:00:00Z'), cicloX), '24/11 entra');
    assert.ok(composicaoNaAbertura({ ...cargo('2026-12-01T02:30:00Z'), dataInicio: dataDb('2026-11-30') }, cicloX), '30/11 23:30 em SP (01/12 em UTC) ainda entra');
    assert.equal(composicaoNaAbertura({ ...cargo('2026-12-01T03:10:00Z'), dataInicio: dataDb('2026-12-01') }, cicloX), null, '01/12 00:10 em SP não entra');
    // Criado no meio do ciclo e corrigido no mesmo dia: vale a composição do fim daquele dia; correção no dia seguinte, não.
    const c = cargo('2026-11-24T13:00:00Z', [['2026-11-24T13:00:00Z', prud.id], ['2026-11-25T02:00:00Z', tres.id], ['2026-11-25T13:00:00Z', cmei.id]]);
    assert.deepEqual(composicaoNaAbertura(c, cicloX)?.map((i) => i.escolaId), [tres.id]);
  });


  await caso('17. Cargo encerrado durante o ciclo sem texto → deixa de ser esperado e some da lista', async () => {
    const antesP = await painel(ciclo.id);
    const [c] = await cargosDe(pEncerra.id);
    assert.equal((await api(tSec, 'POST', `/pessoas/professores/${pEncerra.id}/cargos/${c.id}/encerrar`, { dataFim: diaSp(), confirmarSaida: true })).status, 200);
    const depois = await painel(ciclo.id);
    assert.equal(depois.resumo.esperado, antesP.resumo.esperado - 1);
    assert.equal((await minhas(pEncerra.token, ciclo.id)).length, 0);
  });
  await caso('18. Texto escrito antes do encerramento → preservado, fora do esperado, só leitura', async () => {
    const [item] = await minhas(pEncerraComTexto.token, ciclo.id);
    assert.equal((await salvar(pEncerraComTexto.token, item.cargoId, null)).status, 200);
    const [c] = await cargosDe(pEncerraComTexto.id);
    const esperadoAntes = (await painel(ciclo.id)).resumo.esperado;
    assert.equal((await api(tSec, 'POST', `/pessoas/professores/${pEncerraComTexto.id}/cargos/${c.id}/encerrar`, { dataFim: diaSp(), confirmarSaida: true })).status, 200);
    const p = await painel(ciclo.id);
    assert.equal(p.resumo.esperado, esperadoAntes - 1);
    assert.ok(p.foraDoEsperado.some((l) => l.professorId === pEncerraComTexto.id), 'deve aparecer em foraDoEsperado');
    assert.ok(!p.linhas.some((l) => l.professorId === pEncerraComTexto.id));
    const [depois] = await minhas(pEncerraComTexto.token, ciclo.id);
    assert.equal(depois.esperada, false); assert.equal(depois.editavelAgora, false);
    const det = (await api(pEncerraComTexto.token, 'GET', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${item.cargoId}`)).json as { semanas: { texto: string }[]; updatedAt: string };
    assert.equal(det.semanas[0].texto, 'Semana 1: verbos');
    assert.equal((await salvar(pEncerraComTexto.token, item.cargoId, det.updatedAt)).status, 403);
  });
  await caso('Cargos iguais e um deles encerrado durante o ciclo → a folha continua esperada', async () => {
    const [c1] = await cargosDe(pIguaisUmEncerra.id);
    await api(tSec, 'POST', `/pessoas/professores/${pIguaisUmEncerra.id}/cargos/${c1.id}/encerrar`, { dataFim: diaSp(), confirmarSaida: true });
    const itens = await minhas(pIguaisUmEncerra.token, ciclo.id);
    assert.equal(itens.length, 1); assert.equal(itens[0].esperada, true);
  });
  let cargoMuda = 0;
  await caso('19/24. Alteração de escola/disciplina durante o ciclo → formulário atual não muda (nem a foto já gravada)', async () => {
    const [c] = await cargosDe(pMuda.id);
    cargoMuda = c.id;
    assert.equal((await salvar(pMuda.token, c.id, null, ['a', ''])).status, 200);
    const r = await api(tSec, 'PUT', `/pessoas/professores/${pMuda.id}/cargos/${c.id}`, { composicao: C([tres.id, [geo.id]]), baseUpdatedAt: c.updatedAt, confirmarSaida: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const [item] = await minhas(pMuda.token, ciclo.id);
    assert.deepEqual(item.composicao.map((p) => p.escolaId), [prud.id], 'continua Prudenciana neste ciclo');
  });
  await caso('Painel: folha com 2 escolas aparece no filtro de cada escola e conta 1 vez no total', async () => {
    const total = await painel(ciclo.id);
    const naPrud = await painel(ciclo.id, `?escolaId=${prud.id}`);
    const naTres = await painel(ciclo.id, `?escolaId=${tres.id}`);
    const doMulti = (p: Awaited<ReturnType<typeof painel>>) => p.linhas.filter((l) => l.professorId === pMulti.id).length;
    assert.equal(doMulti(total), 1); assert.equal(doMulti(naPrud), 1); assert.equal(doMulti(naTres), 1);
    assert.equal(total.linhas.length, total.resumo.esperado);
    const ids = total.linhas.map((l) => `${l.professorId}:${l.cargoId}`);
    assert.equal(new Set(ids).size, ids.length, 'sem duplicar folhas');
    assert.equal((await painel(ciclo.id, `?disciplinaId=${geo.id}`)).linhas.every((l) => l.composicao.some((p) => p.disciplinas.some((d) => d.id === geo.id))), true);
  });
  await caso('Concluir exige todas as semanas; conflito (base antiga) não sobrescreve', async () => {
    const [item] = await minhas(pUm.token, ciclo.id);
    const s1 = await salvar(pUm.token, item.cargoId, null, ['só a primeira', '']);
    assert.equal(s1.status, 200);
    const base1 = (s1.json as { updatedAt: string }).updatedAt;
    assert.equal((await api(pUm.token, 'POST', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${item.cargoId}/concluir`, { baseUpdatedAt: base1 })).status, 400);
    const s2 = await salvar(pUm.token, item.cargoId, base1);
    assert.equal(s2.status, 200);
    const velho = await salvar(pUm.token, item.cargoId, base1, ['outra aba', 'outra aba']);
    assert.equal(velho.status, 409, 'base antiga tem que dar conflito');
    const base2 = (s2.json as { updatedAt: string }).updatedAt;
    const fim = await api(pUm.token, 'POST', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${item.cargoId}/concluir`, { baseUpdatedAt: base2 });
    assert.equal(fim.status, 200, JSON.stringify(fim.json));
    assert.equal((fim.json as { status: string }).status, 'concluida');
  });
  await caso('Professor não abre folha de cargo de outro Professor', async () => {
    const [item] = await minhas(pDois.token, ciclo.id);
    assert.equal((await api(pUm.token, 'GET', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${item.cargoId}`)).status, 404);
  });

  console.log('\n— Próximo ciclo —');
  // A segunda janela abre daqui a 1 h: tudo cadastrado até agora já vale.
  const proximo = await novoCiclo({ abreHa: 0, abreEmHoras: 1 });
  await caso('16. Próximo ciclo → o cargo novo passa a gerar folha', async () => {
    assert.equal((await painel(proximo.id, `?professorId=${pNovo.id}`)).linhas.length, 2);
  });
  await caso('20. Próximo ciclo → usa a nova composição', async () => {
    const l = (await painel(proximo.id, `?professorId=${pMuda.id}`)).linhas;
    assert.equal(l.length, 1); assert.deepEqual(l[0].composicao.map((p) => p.escolaId), [tres.id]);
    assert.equal(l[0].cargoIds[0], cargoMuda, 'mesmo cargo (id), composição nova');
  });
  await caso('Cargos que deixam de ser iguais no próximo ciclo → 2 folhas (o ciclo antigo continua com 1)', async () => {
    const [c1, c2] = await cargosDe(pIguais.id);
    assert.equal((await api(tSec, 'PUT', `/pessoas/professores/${pIguais.id}/cargos/${c2.id}`, { composicao: C([prud.id, [ing.id, geo.id]]), baseUpdatedAt: c2.updatedAt })).status, 200);
    assert.ok(c1);
    const proximo2 = await novoCiclo({ abreHa: 0, abreEmHoras: 2 });
    assert.equal((await painel(proximo2.id, `?professorId=${pIguais.id}`)).linhas.length, 2);
    assert.equal((await minhas(pIguais.token, ciclo.id)).length, 1);
  });
  await caso('Corte = DIA da abertura (caso do ciclo #14 da produção): ciclo aberto hoje às 00:00 e cargo cadastrado agora → entra', async () => {
    const p = await novoProfessor([{ dataInicio: diaSp(), composicao: C([cmei.id, [], [regente.id]]) }]);
    const hoje = await prisma.cicloUmTerco.create({ data: { anoLetivo: 2099, trimestre: 3, titulo: `${PREFIXO} ciclo`, abreEm: new Date(`${diaSp()}T00:00:00-03:00`), prazoEm: new Date(Date.now() + 10 * DIA), todasEscolas: false, escolas: { create: [{ escolaId: cmei.id }] }, semanas: { create: [{ numero: 1, dataInicio: dataDb(diaSp(0)), dataFim: dataDb(diaSp(2)) }] } } });
    assert.equal((await painel(hoje.id, `?professorId=${p.id}`)).linhas.length, 1, 'cadastrado no dia da abertura tem que entrar');
    assert.equal((await minhas(p.token, hoje.id)).length, 1);
  });
  await caso('Ciclo só de uma escola mostra só a parte do cargo nessa escola; partes iguais viram 1 folha', async () => {
    const p = await novoProfessor([{ composicao: C([prud.id, [ing.id]], [tres.id, [geo.id]]) }, { composicao: C([prud.id, [ing.id]]) }]);
    const soPrud = await novoCiclo({ abreHa: 0, abreEmHoras: 3, escolas: [prud.id] });
    const l = (await painel(soPrud.id, `?professorId=${p.id}`)).linhas;
    assert.equal(l.length, 1, 'as duas partes são "Prudenciana — Inglês": uma folha');
    assert.deepEqual(l[0].composicao.map((x) => x.escolaId), [prud.id]);
    assert.equal(l[0].compartilhada, true);
  });
} finally {
  server.close();
  await limpar();
  const depois = await contar();
  console.log('\nContagens DEPOIS:', JSON.stringify(depois));
  if (JSON.stringify(antes) !== JSON.stringify(depois)) { console.error('!! As contagens mudaram: sobrou dado de teste.'); falhas += 1; }
  await prisma.$disconnect();
}

console.log(`\n${ok} ok, ${falhas} falha(s), ${respostas5xx} resposta(s) 5xx.`);
process.exitCode = falhas || respostas5xx ? 1 : 0;
