// Teste de integração: DESATIVADOS por área (decisões do usuário, 15/11/2026).
// SÓ BANCO LOCAL: recusa rodar se DATABASE_URL não for localhost. Cria dados com prefixo ZZDESAT e apaga tudo
// no fim (e restos de execução anterior no começo).
//   DATABASE_URL=postgresql://homolog:homolog@localhost:54329/nexo_homolog npx tsx scripts/desativados/testar-desativados.ts
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Recusado: este teste só roda contra o banco LOCAL (DATABASE_URL com localhost).');
  process.exit(1);
}
process.env.JWT_SECRET ||= 'teste-local-desativados-apenas-para-homologacao-0123456789';

const { prisma } = await import('../../src/lib/prisma.js');
const { createApp } = await import('../../src/api/app.js');
const { assinarToken } = await import('../../src/api/middleware/auth.js');

const P = 'ZZDESAT';
let ok = 0;
let falhas = 0;
let respostas5xx = 0;
const caso = async (nome: string, fn: () => Promise<void>) => {
  try { await fn(); ok += 1; console.log(`  ok  ${nome}`); } catch (e) { falhas += 1; console.error(`FALHOU ${nome}\n    ${(e as Error).message.split('\n').slice(0, 6).join('\n    ')}`); }
};

async function limpar() {
  const pessoas = (await prisma.pessoa.findMany({ where: { email: { startsWith: P.toLowerCase() } }, select: { id: true } })).map((p) => p.id);
  const escolas = (await prisma.escola.findMany({ where: { nome: { startsWith: P } }, select: { id: true } })).map((e) => e.id);
  await prisma.alunoPdi.deleteMany({ where: { nome: { startsWith: P } } });
  await prisma.cicloUmTerco.deleteMany({ where: { titulo: { startsWith: P } } });
  await prisma.perguntaPdiPadrao.deleteMany({ where: { texto: { startsWith: P } } });
  const modelos = (await prisma.modeloPdi.findMany({ where: { nome: { startsWith: P } }, select: { id: true } })).map((m) => m.id);
  await prisma.perguntaPdi.deleteMany({ where: { modeloId: { in: modelos } } });
  await prisma.modeloPdi.deleteMany({ where: { id: { in: modelos } } });
  await prisma.disciplina.deleteMany({ where: { nome: { startsWith: P } } });
  await prisma.atuacaoPedagogica.deleteMany({ where: { nome: { startsWith: P } } });
  await prisma.professorTurmaDisciplina.deleteMany({ where: { OR: [{ professorId: { in: pessoas } }, { turma: { escolaId: { in: escolas } } }] } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.vinculoEscolar.deleteMany({ where: { OR: [{ pessoaId: { in: pessoas } }, { escolaId: { in: escolas } }] } });
  await prisma.pessoaEvento.deleteMany({ where: { OR: [{ pessoaId: { in: pessoas } }, { autorId: { in: pessoas } }] } });
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
}

const contar = async () => ({ pessoas: await prisma.pessoa.count(), escolas: await prisma.escola.count(), turmas: await prisma.turma.count(), ciclos: await prisma.cicloUmTerco.count(), alunos: await prisma.alunoPdi.count(), modelos: await prisma.modeloPdi.count() });

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
type Linha = { tipo: string; id: number; titulo: string; detalhe: string; motivo: string; data: string | null; por: string | null; ref?: Record<string, unknown> };
type Pagina = { itens: Linha[]; total: number; pagina: number; porPagina: number };

try {
  const mk = (n: string, perfil: 'SECRETARIA' | 'PROFESSOR' | 'DIRETORA') => prisma.pessoa.create({ data: { nome: `${P} ${n}`, email: `${P.toLowerCase()}-${n}@teste.invalid`, perfil, status: 'ATIVO' } });
  const sec = await mk('sec', 'SECRETARIA');
  const dir = await mk('dir', 'DIRETORA');
  const prof = await mk('prof', 'PROFESSOR');
  const tSec = assinarToken(sec);
  const lista = async (tipo: string, q = '') => (await api(tSec, 'GET', `/desativados?tipo=${tipo}${q}`)).json as Pagina;

  const e1 = await prisma.escola.create({ data: { nome: `${P} Escola 1` } });
  const e2 = await prisma.escola.create({ data: { nome: `${P} Escola 2` } });
  await prisma.vinculoEscolar.create({ data: { pessoaId: dir.id, escolaId: e1.id, dataInicio: new Date() } });

  await caso('Só a Secretaria: Diretora e Professor recebem 403; sem token 401; tipo inválido 400', async () => {
    assert.equal((await api(assinarToken(dir), 'GET', '/desativados?tipo=escolas')).status, 403);
    assert.equal((await api(assinarToken(prof), 'GET', '/desativados?tipo=escolas')).status, 403);
    assert.equal((await fetch(`${base}/api/desativados?tipo=escolas`)).status, 401);
    assert.equal((await api(tSec, 'GET', '/desativados?tipo=qualquer')).status, 400);
  });

  await caso('Escola: inativar grava data e autor; lista traz a mais recente primeiro, com o nome de quem desativou; reativar limpa', async () => {
    assert.equal((await api(tSec, 'POST', `/escolas/${e1.id}/inativar`)).status, 200);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal((await api(tSec, 'POST', `/escolas/${e2.id}/inativar`)).status, 200);
    const b1 = await prisma.escola.findUniqueOrThrow({ where: { id: e1.id } });
    assert.ok(b1.desativadoEm); assert.equal(b1.desativadoPor, String(sec.id));
    const l = await lista('escolas');
    const nossas = l.itens.filter((i) => i.titulo.startsWith(P));
    assert.deepEqual(nossas.map((i) => i.id), [e2.id, e1.id], 'mais recente primeiro');
    assert.equal(nossas[0].por, sec.nome); assert.equal(nossas[0].motivo, 'manual');
    assert.equal((await api(tSec, 'POST', `/escolas/${e2.id}/reativar`)).status, 200);
    const b2 = await prisma.escola.findUniqueOrThrow({ where: { id: e2.id } });
    assert.equal(b2.desativadoEm, null); assert.equal(b2.desativadoPor, null);
    assert.ok(!(await lista('escolas')).itens.some((i) => i.id === e2.id), 'reativada sai da lista');
  });

  await caso('Paginação: porPagina=1 → total certo, página 2 traz o próximo, sem repetir', async () => {
    const e3 = await prisma.escola.create({ data: { nome: `${P} Escola 3` } });
    await api(tSec, 'POST', `/escolas/${e3.id}/inativar`);
    const p1 = await lista('escolas', '&porPagina=1&pagina=1');
    const p2 = await lista('escolas', '&porPagina=1&pagina=2');
    assert.equal(p1.itens.length, 1); assert.equal(p2.itens.length, 1);
    assert.ok(p1.total >= 2); assert.notEqual(p1.itens[0].id, p2.itens[0].id);
    assert.equal(p1.itens[0].id, e3.id, 'a mais recente na página 1');
  });

  await caso('Turma: inativar/reativar grava e limpa; aparece na lista com escola e ano', async () => {
    const t = await prisma.turma.create({ data: { escolaId: e2.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 6, turno: 'MANHA', identificador: 1, nome: `${P} 6M1`, identidadeChave: `zzdesat-${Date.now()}` } });
    assert.equal((await api(tSec, 'POST', `/turmas/${t.id}/inativar`)).status, 200);
    const l = (await lista('turmas')).itens.find((i) => i.id === t.id);
    assert.ok(l); assert.ok(l!.detalhe.includes(`${P} Escola 2`) && l!.detalhe.includes('2026'));
    assert.equal((await prisma.turma.findUniqueOrThrow({ where: { id: t.id } })).desativadoPor, String(sec.id));
    assert.equal((await api(tSec, 'POST', `/turmas/${t.id}/reativar`)).status, 200);
    assert.equal((await prisma.turma.findUniqueOrThrow({ where: { id: t.id } })).desativadoEm, null);
  });

  await caso('Pessoa: inativar Diretora grava data; filtro por perfil; ref.perfil para o Reativar; reativar limpa', async () => {
    const d2 = await mk('dir2', 'DIRETORA');
    await prisma.vinculoEscolar.create({ data: { pessoaId: d2.id, escolaId: e2.id, dataInicio: new Date() } });
    assert.equal((await api(tSec, 'POST', `/pessoas/diretoras/${d2.id}/inativar`)).status, 200);
    const l = await lista('pessoas', '&perfil=DIRETORA');
    const item = l.itens.find((i) => i.id === d2.id);
    assert.ok(item); assert.equal(item!.ref?.perfil, 'DIRETORA'); assert.equal(item!.por, sec.nome);
    assert.ok(l.itens.every((i) => (i.ref?.perfil as string) === 'DIRETORA'), 'filtro por perfil');
    assert.ok(!(await lista('pessoas', '&perfil=PROFESSOR')).itens.some((i) => i.id === d2.id));
    assert.equal((await api(tSec, 'POST', `/pessoas/diretoras/${d2.id}/reativar`)).status, 200);
    assert.equal((await prisma.pessoa.findUniqueOrThrow({ where: { id: d2.id } })).desativadoEm, null);
  });

  await caso('Atuação: desativar grava; renomear inativa NÃO mexe na data; reativar limpa', async () => {
    const a = await prisma.atuacaoPedagogica.create({ data: { nome: `${P} Atuação` } });
    assert.equal((await api(tSec, 'PUT', `/atuacoes-pedagogicas/${a.id}`, { status: 'inativa' })).status, 200);
    const d1 = (await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { id: a.id } })).desativadoEm;
    assert.ok(d1);
    assert.equal((await api(tSec, 'PUT', `/atuacoes-pedagogicas/${a.id}`, { nome: `${P} Atuação renomeada` })).status, 200);
    assert.equal((await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { id: a.id } })).desativadoEm?.getTime(), d1!.getTime());
    assert.ok((await lista('atuacoes')).itens.some((i) => i.id === a.id));
    assert.equal((await api(tSec, 'PUT', `/atuacoes-pedagogicas/${a.id}`, { status: 'ativa' })).status, 200);
    assert.equal((await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { id: a.id } })).desativadoEm, null);
  });

  await caso('Ciclo do 1/3: inativar grava desativadoEm e a API devolve o campo; reativar limpa', async () => {
    const c = await prisma.cicloUmTerco.create({ data: { anoLetivo: 2099, trimestre: 3, titulo: `${P} ciclo`, abreEm: new Date('2099-11-01T03:00:00Z'), prazoEm: new Date('2099-11-10T02:59:59Z'), todasEscolas: false, escolas: { create: [{ escolaId: e2.id }] }, semanas: { create: [{ numero: 1, dataInicio: new Date('2099-11-01'), dataFim: new Date('2099-11-05') }] } } });
    const r = await api(tSec, 'POST', `/formulario-um-terco/ciclos/${c.id}/inativar`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok((r.json as { desativadoEm: string | null }).desativadoEm, 'API devolve desativadoEm');
    assert.equal((await prisma.cicloUmTerco.findUniqueOrThrow({ where: { id: c.id } })).desativadoPor, String(sec.id));
    assert.equal((await api(tSec, 'POST', `/formulario-um-terco/ciclos/${c.id}/reativar`)).status, 200);
    assert.equal((await prisma.cicloUmTerco.findUniqueOrThrow({ where: { id: c.id } })).desativadoEm, null);
  });

  await caso('Pergunta padrão PDI: inativar grava; lista mostra o texto; reativar limpa', async () => {
    const pp = await prisma.perguntaPdiPadrao.create({ data: { secao: `${P} Seção`, texto: `${P} pergunta`, origem: 'ESTRUTURADA', tipoResposta: 'TEXTO', ordem: 9999 } });
    assert.equal((await api(tSec, 'POST', `/pdi-perguntas-padrao/${pp.id}/inativar`)).status, 200);
    assert.ok((await lista('perguntas-padrao')).itens.some((i) => i.id === pp.id && i.titulo === `${P} pergunta`));
    assert.equal((await api(tSec, 'POST', `/pdi-perguntas-padrao/${pp.id}/reativar`)).status, 200);
    assert.equal((await prisma.perguntaPdiPadrao.findUniqueOrThrow({ where: { id: pp.id } })).desativadoEm, null);
  });

  await caso('Modelo PDI: inativar grava; lista traz disciplina; reativar limpa', async () => {
    const disc = await prisma.disciplina.create({ data: { nome: `${P} Disciplina` } });
    const m = await prisma.modeloPdi.create({ data: { nome: `${P} Modelo`, disciplinaId: disc.id } });
    assert.equal((await api(tSec, 'POST', `/pdi-modelos/${m.id}/inativar`)).status, 200);
    const l = (await lista('modelos-pdi')).itens.find((i) => i.id === m.id);
    assert.ok(l); assert.equal(l!.detalhe, `${P} Disciplina`);
    assert.equal((await api(tSec, 'POST', `/pdi-modelos/${m.id}/reativar`)).status, 200);
    assert.equal((await prisma.modeloPdi.findUniqueOrThrow({ where: { id: m.id } })).desativadoEm, null);
  });

  await caso('Aluno PDI: arquivar grava; lista "alunos-pdi"; reativar limpa', async () => {
    const t = await prisma.turma.create({ data: { escolaId: e2.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 7, turno: 'TARDE', identificador: 2, nome: `${P} 7T2`, identidadeChave: `zzdesat-al-${Date.now()}` } });
    const al = await prisma.alunoPdi.create({ data: { nome: `${P} Aluno`, turmaId: t.id, responsavelNome: 'Resp', responsavelParentesco: 'MAE', responsavelTelefone: '000' } });
    const r = await api(tSec, 'POST', `/pdi-alunos/${al.id}/arquivar`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok((await lista('alunos-pdi')).itens.some((i) => i.id === al.id));
    assert.equal((await prisma.alunoPdi.findUniqueOrThrow({ where: { id: al.id } })).desativadoPor, String(sec.id));
    assert.equal((await api(tSec, 'POST', `/pdi-alunos/${al.id}/reativar`)).status, 200);
    assert.equal((await prisma.alunoPdi.findUniqueOrThrow({ where: { id: al.id } })).desativadoEm, null);
  });

  await caso('Encerrados: vínculo escolar e turma do professor aparecem com motivo "encerrado" e a data de fim', async () => {
    const v = await prisma.vinculoEscolar.create({ data: { pessoaId: prof.id, escolaId: e2.id, dataInicio: new Date('2026-01-01'), status: 'ENCERRADO', dataFim: new Date('2026-11-10') } });
    const lv = (await lista('vinculos-escolares')).itens.find((i) => i.id === v.id);
    assert.ok(lv); assert.equal(lv!.motivo, 'encerrado'); assert.equal(lv!.data?.slice(0, 10), '2026-11-10');
    for (const tipo of ['cargos', 'turmas-professor', 'turmas-auxiliar']) assert.equal((await api(tSec, 'GET', `/desativados?tipo=${tipo}`)).status, 200, tipo);
  });

  await caso('Cada tipo responde 200 com {itens,total,pagina,porPagina}; porPagina limitado a 100', async () => {
    for (const tipo of ['escolas', 'turmas', 'pessoas', 'cargos', 'vinculos-escolares', 'turmas-professor', 'turmas-auxiliar', 'atuacoes', 'perguntas-padrao', 'alunos-pdi', 'modelos-pdi']) {
      const r = await api(tSec, 'GET', `/desativados?tipo=${tipo}&porPagina=500`);
      assert.equal(r.status, 200, tipo);
      const j = r.json as Pagina;
      assert.ok(Array.isArray(j.itens) && typeof j.total === 'number' && j.porPagina === 100, tipo);
    }
  });
} finally {
  server.close();
  await limpar();
  const depois = await contar();
  console.log('\nContagens DEPOIS:', JSON.stringify(depois));
  if (JSON.stringify(antes) !== JSON.stringify(depois)) { falhas += 1; console.error('FALHOU contagens diferentes antes/depois'); }
  console.log(`\n${ok} ok, ${falhas} falha(s), ${respostas5xx} resposta(s) 5xx.`);
  await prisma.$disconnect();
  process.exit(falhas || respostas5xx ? 1 : 0);
}
