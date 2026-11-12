import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { hojeComoData, statusVigencia } from '../../domain/pdiAplicacoes.js';
import { dataLocalSp, paraDataIsoUtc, statusDoCiclo } from '../../domain/umTerco.js';
import {
  curvaAcumulada, fimDoDiaSp, inicioDoDiaSp, LIMITES, motivoAcompanhamento,
  type Contagem, type MotivoAcompanhamento, type SituacaoPeriodo,
} from '../../domain/acompanhamento.js';
import { contarFichasPdi, type ContagemAplicacao } from '../../lib/contagemFichasPdi.js';
import { escolasPermitidas } from './pessoas.js';
import { montarPainel } from './formularioUmTerco.js';

// Acompanhamento Escolar (decisões do usuário, 10/11/2026; ver PROPOSTA_ACOMPANHAMENTO_ESCOLAR.md).
// SÓ LEITURA: nenhuma rota aqui cria, altera ou apaga nada.
// Acesso: Secretaria (rede inteira) e Diretora (só as próprias escolas, via escolasPermitidas).
// Nenhum nome de aluno ou professor sai daqui; só números por escola e disciplina.
// Unidades iguais às telas existentes: PDI = Ficha (aluno × disciplina); 1/3 = entrega única
// (folha de cargo do Professor, 12/11/2026), contada uma vez na rede e em cada escola que cobre.

export const acompanhamentoRouter = Router();

type Actor = { id: number; perfil: string };
const DIA_MS = 86400000;

async function escopoDoAtor(actor: Actor): Promise<number[] | null> {
  if (actor.perfil === 'SECRETARIA') return null;
  if (actor.perfil === 'DIRETORA') return escolasPermitidas(actor);
  throw new ForbiddenError('Você não tem permissão para ver o Acompanhamento Escolar.');
}

const lerInteiro = (valor: unknown, rotulo: string): number | null => {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`${rotulo} inválido.`);
  return n;
};
const anoAtualSp = () => Number(dataLocalSp(new Date()).slice(0, 4));

// Cache curto em memória: várias pessoas da Secretaria abrindo a aba não refazem o cálculo.
const CACHE_MS = 60_000;
const cache = new Map<string, { em: number; dados: unknown }>();
async function comCache<T>(chave: string, ignorar: boolean, calcular: () => Promise<T>): Promise<T> {
  const item = cache.get(chave);
  if (!ignorar && item && Date.now() - item.em < CACHE_MS) return item.dados as T;
  const dados = await calcular();
  cache.set(chave, { em: Date.now(), dados });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return dados;
}

// ----- Carga base do ano --------------------------------------------------------------------

type Aplicacao = Awaited<ReturnType<typeof carregarAplicacoes>>[number];
type Ciclo = Awaited<ReturnType<typeof carregarCiclos>>[number];
type Painel = Awaited<ReturnType<typeof montarPainel>>;

const carregarAplicacoes = (ano: number, escolaIds: number[]) => prisma.aplicacaoPdi.findMany({
  where: { status: 'ATIVA', escolaId: { in: escolaIds }, dataInicio: { gte: new Date(`${ano}-01-01`), lte: new Date(`${ano}-12-31`) } },
  include: { modelos: { select: { disciplinaId: true, disciplinaNome: true } }, reaberturas: { select: { dataInicio: true, dataFim: true } }, fotografia: true },
  orderBy: { dataInicio: 'asc' },
});

const carregarCiclos = (ano: number) => prisma.cicloUmTerco.findMany({
  where: { status: 'ATIVA', anoLetivo: ano },
  include: { escolas: { select: { escolaId: true } }, reaberturas: { select: { inicioEm: true, fimEm: true } } },
  orderBy: { abreEm: 'asc' },
});

// Situação da Aplicação pela MESMA regra do resto do sistema (statusVigencia, por data).
function situacaoAplicacao(a: Aplicacao): SituacaoPeriodo {
  const vigencia = statusVigencia(a);
  if (vigencia === 'scheduled') return 'agendado';
  if (vigencia === 'active') return 'aberto';
  const hoje = hojeComoData();
  return a.reaberturas.some((r) => hoje >= r.dataInicio && hoje <= r.dataFim) ? 'reabertura' : 'encerrado';
}
function situacaoCiclo(c: Ciclo): SituacaoPeriodo {
  const s = statusDoCiclo(c);
  if (s === 'agendado') return 'agendado';
  if (s === 'aberto') return 'aberto';
  const agora = Date.now();
  return c.reaberturas.some((r) => agora >= r.inicioEm.getTime() && agora <= r.fimEm.getTime()) ? 'reabertura' : 'encerrado';
}
const cicloAtende = (c: Ciclo, escolaId: number) => c.todasEscolas || c.escolas.some((e) => e.escolaId === escolaId);

// Ordem de "foco": aberto > em reabertura > último encerrado > próximo agendado.
const PESO: Record<SituacaoPeriodo, number> = { aberto: 0, reabertura: 1, encerrado: 2, agendado: 3 };
function escolherFoco<T>(itens: T[], situacao: (t: T) => SituacaoPeriodo, fim: (t: T) => Date, inicio: (t: T) => Date): T | null {
  return [...itens].sort((a, b) => {
    const pa = PESO[situacao(a)]; const pb = PESO[situacao(b)];
    if (pa !== pb) return pa - pb;
    if (situacao(a) === 'agendado') return inicio(a).getTime() - inicio(b).getTime();
    return fim(b).getTime() - fim(a).getTime();
  })[0] ?? null;
}

const tituloAplicacao = (a: Aplicacao) => a.nome || (a.trimestre ? `PDI · ${a.trimestre}º trimestre` : 'PDI');
const periodoAplicacao = (a: Aplicacao) => ({ inicio: inicioDoDiaSp(a.dataInicio), fim: fimDoDiaSp(a.dataFim) });

// Contagem de uma Aplicação. Aberta ou em reabertura: ao vivo. Encerrada: só pela foto; sem foto, o
// percentual não é confiável e sai só o número absoluto de concluídas (esperado = null).
function contagemAplicacao(a: Aplicacao, vivas: Map<number, ContagemAplicacao>, concluidasAbsolutas: Map<number, number>): Contagem & { fonte: 'ao_vivo' | 'foto' | 'absoluto' | 'agendado' } {
  const s = situacaoAplicacao(a);
  if (s === 'agendado') return { esperado: null, concluidas: 0, emAndamento: 0, fonte: 'agendado' };
  if (s === 'aberto' || s === 'reabertura') {
    const c = vivas.get(a.id);
    return { esperado: c?.esperado ?? 0, concluidas: c?.concluidas ?? 0, emAndamento: c?.emAndamento ?? 0, fonte: 'ao_vivo' };
  }
  if (a.fotografia) return { esperado: a.fotografia.esperado, concluidas: a.fotografia.concluidas, emAndamento: a.fotografia.emAndamento, fonte: 'foto' };
  return { esperado: null, concluidas: concluidasAbsolutas.get(a.id) ?? 0, emAndamento: 0, fonte: 'absoluto' };
}

// Linhas de um painel do 1/3 que tocam uma escola (cobertura).
const linhasDaEscola = (p: Painel, escolaId: number) => p.linhas.filter((l) => l.escolas.some((e) => e.escolaId === escolaId));
const contarLinhas = (linhas: Painel['linhas']): Contagem => ({
  esperado: linhas.length,
  concluidas: linhas.filter((l) => l.status === 'concluida').length,
  emAndamento: linhas.filter((l) => l.status === 'em_andamento').length,
});

const iso = (d: Date) => d.toISOString();

// Monta tudo o que as duas visões usam, para um conjunto de escolas e um ano.
async function montarBase(ano: number, escopo: number[] | null, filtros: { trimestre: number | null; cicloId: number | null }) {
  const escolas = await prisma.escola.findMany({
    where: { status: 'ATIVA', ...(escopo ? { id: { in: escopo } } : {}) },
    select: { id: true, nome: true }, orderBy: { nome: 'asc' },
  });
  const escolaIds = escolas.map((e) => e.id);
  const [aplicacoes, ciclosTodos] = await Promise.all([carregarAplicacoes(ano, escolaIds), carregarCiclos(ano)]);
  const ciclos = ciclosTodos.filter((c) => escolaIds.some((id) => cicloAtende(c, id)));
  if (filtros.cicloId && !ciclos.some((c) => c.id === filtros.cicloId)) throw new NotFoundError('Ciclo do 1/3 não encontrado neste ano.');

  // PDI: contagem ao vivo das abertas/em reabertura; concluídas absolutas das demais.
  const vivasIds = aplicacoes.filter((a) => ['aberto', 'reabertura'].includes(situacaoAplicacao(a)));
  const encerradasSemFoto = aplicacoes.filter((a) => situacaoAplicacao(a) === 'encerrado' && !a.fotografia).map((a) => a.id);
  const [vivas, absolutas] = await Promise.all([
    contarFichasPdi(prisma, vivasIds.map((a) => ({ id: a.id, escolaId: a.escolaId, disciplinaIds: a.modelos.map((m) => m.disciplinaId) }))),
    encerradasSemFoto.length
      ? prisma.fichaPdi.groupBy({ by: ['aplicacaoId'], where: { aplicacaoId: { in: encerradasSemFoto }, status: 'CONCLUIDA' }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);
  const concluidasAbsolutas = new Map(absolutas.map((g) => [g.aplicacaoId, g._count._all]));

  // 1/3: painel (mesmo cálculo da tela do 1/3) dos ciclos que importam: foco de alguma escola,
  // o filtrado, e os encerrados há pouco (para "encerrado com pendências").
  const focoCicloPorEscola = new Map<number, Ciclo | null>();
  for (const e of escolas) {
    const daEscola = ciclos.filter((c) => cicloAtende(c, e.id));
    focoCicloPorEscola.set(e.id, filtros.cicloId ? daEscola.find((c) => c.id === filtros.cicloId) ?? null : escolherFoco(daEscola, situacaoCiclo, (c) => c.prazoEm, (c) => c.abreEm));
  }
  const relevantes = new Set<number>();
  for (const c of focoCicloPorEscola.values()) if (c) relevantes.add(c.id);
  for (const c of ciclos) {
    const s = situacaoCiclo(c);
    if (s === 'aberto' || s === 'reabertura' || (s === 'encerrado' && Date.now() - c.prazoEm.getTime() <= LIMITES.diasEncerradoRecente * DIA_MS)) relevantes.add(c.id);
  }
  const paineis = new Map<number, Painel>();
  await Promise.all([...relevantes].map(async (id) => { paineis.set(id, await montarPainel(id, {})); }));

  const focoAplicacaoPorEscola = new Map<number, Aplicacao | null>();
  for (const e of escolas) {
    const daEscola = aplicacoes.filter((a) => a.escolaId === e.id);
    focoAplicacaoPorEscola.set(e.id, filtros.trimestre
      ? daEscola.filter((a) => a.trimestre === filtros.trimestre).at(-1) ?? null
      : escolherFoco(daEscola, situacaoAplicacao, (a) => a.dataFim, (a) => a.dataInicio));
  }

  return { escolas, aplicacoes, ciclos, vivas, concluidasAbsolutas, paineis, focoCicloPorEscola, focoAplicacaoPorEscola };
}

type Base = Awaited<ReturnType<typeof montarBase>>;

const resumoAplicacao = (a: Aplicacao | null, base: Base) => {
  if (!a) return null;
  const contagem = contagemAplicacao(a, base.vivas, base.concluidasAbsolutas);
  return { id: a.id, titulo: tituloAplicacao(a), trimestre: a.trimestre, inicio: paraDataIsoUtc(a.dataInicio), fim: paraDataIsoUtc(a.dataFim), situacao: situacaoAplicacao(a), ...contagem };
};
const resumoCiclo = (c: Ciclo | null, escolaId: number | null, base: Base) => {
  if (!c) return null;
  const painel = base.paineis.get(c.id);
  const contagem = painel ? contarLinhas(escolaId ? linhasDaEscola(painel, escolaId) : painel.linhas) : { esperado: null, concluidas: 0, emAndamento: 0 };
  return { id: c.id, titulo: c.titulo, inicio: iso(c.abreEm), fim: iso(c.prazoEm), situacao: situacaoCiclo(c), ...contagem };
};

// Itens que merecem acompanhamento: escola × formulário × período, nunca pessoas.
function itensDeAcompanhamento(base: Base) {
  type Item = { escolaId: number; escolaNome: string; formulario: 'pdi' | 'umTerco'; periodoId: number; titulo: string; motivo: MotivoAcompanhamento; fim: string; esperado: number; concluidas: number; emAndamento: number };
  const itens: Item[] = [];
  const nomes = new Map(base.escolas.map((e) => [e.id, e.nome]));
  for (const a of base.aplicacoes) {
    const situacao = situacaoAplicacao(a);
    const contagem = contagemAplicacao(a, base.vivas, base.concluidasAbsolutas);
    const motivo = motivoAcompanhamento({ situacao, ...periodoAplicacao(a), contagem });
    if (motivo) itens.push({ escolaId: a.escolaId, escolaNome: nomes.get(a.escolaId) ?? '', formulario: 'pdi', periodoId: a.id, titulo: tituloAplicacao(a), motivo, fim: iso(periodoAplicacao(a).fim), esperado: contagem.esperado!, concluidas: contagem.concluidas, emAndamento: contagem.emAndamento });
  }
  for (const c of base.ciclos) {
    const painel = base.paineis.get(c.id);
    if (!painel) continue;
    const situacao = situacaoCiclo(c);
    for (const e of base.escolas) {
      if (!cicloAtende(c, e.id)) continue;
      const contagem = contarLinhas(linhasDaEscola(painel, e.id));
      const motivo = motivoAcompanhamento({ situacao, inicio: c.abreEm, fim: c.prazoEm, contagem });
      if (motivo) itens.push({ escolaId: e.id, escolaNome: e.nome, formulario: 'umTerco', periodoId: c.id, titulo: c.titulo, motivo, fim: iso(c.prazoEm), esperado: contagem.esperado!, concluidas: contagem.concluidas, emAndamento: contagem.emAndamento });
    }
  }
  const agora = Date.now();
  return itens.sort((x, y) => Math.abs(new Date(x.fim).getTime() - agora) - Math.abs(new Date(y.fim).getTime() - agora) || x.escolaNome.localeCompare(y.escolaNome));
}

// Linha do tempo de prazos. Aplicações do PDI com as mesmas datas viram UMA barra ("N escolas"),
// porque normalmente são criadas em lote; ciclos do 1/3 são uma barra cada.
function prazos(base: Base) {
  const grupos = new Map<string, { formulario: 'pdi'; titulo: string; inicio: string; fim: string; situacao: SituacaoPeriodo; escolas: number; reaberturas: { inicio: string; fim: string }[] }>();
  for (const a of base.aplicacoes) {
    const chave = `${paraDataIsoUtc(a.dataInicio)}|${paraDataIsoUtc(a.dataFim)}|${a.trimestre ?? ''}`;
    const g = grupos.get(chave) ?? { formulario: 'pdi' as const, titulo: a.trimestre ? `PDI · ${a.trimestre}º trimestre` : 'PDI', inicio: iso(periodoAplicacao(a).inicio), fim: iso(periodoAplicacao(a).fim), situacao: situacaoAplicacao(a), escolas: 0, reaberturas: [] };
    g.escolas += 1;
    if (situacaoAplicacao(a) === 'reabertura') g.situacao = 'reabertura';
    for (const r of a.reaberturas) {
      const rr = { inicio: iso(inicioDoDiaSp(r.dataInicio)), fim: iso(fimDoDiaSp(r.dataFim)) };
      if (!g.reaberturas.some((x) => x.inicio === rr.inicio && x.fim === rr.fim)) g.reaberturas.push(rr);
    }
    grupos.set(chave, g);
  }
  const ciclos = base.ciclos.map((c) => ({
    formulario: 'umTerco' as const, id: c.id, titulo: c.titulo, inicio: iso(c.abreEm), fim: iso(c.prazoEm), situacao: situacaoCiclo(c),
    escolas: c.todasEscolas ? base.escolas.length : c.escolas.filter((e) => base.escolas.some((x) => x.id === e.escolaId)).length,
    todasEscolas: c.todasEscolas,
    reaberturas: c.reaberturas.map((r) => ({ inicio: iso(r.inicioEm), fim: iso(r.fimEm) })),
  }));
  return [...grupos.values(), ...ciclos].sort((a, b) => a.fim.localeCompare(b.fim));
}

// Ritmo de preenchimento. PDI: concluídas acumuladas das Aplicações abertas/em reabertura das escolas
// (número absoluto, com a linha do esperado). 1/3: iniciadas e concluídas do ciclo em foco, em
// percentual, mais o ciclo anterior alinhado pelo dia relativo (comparação segura no 1/3).
async function ritmo(base: Base, escolaId: number | null, cicloIdFiltro: number | null) {
  const escolas = escolaId ? [escolaId] : base.escolas.map((e) => e.id);
  const pdiAplicacoes = base.aplicacoes.filter((a) => escolas.includes(a.escolaId) && ['aberto', 'reabertura'].includes(situacaoAplicacao(a)));
  let pdi = null;
  if (pdiAplicacoes.length) {
    const de = new Date(Math.min(...pdiAplicacoes.map((a) => inicioDoDiaSp(a.dataInicio).getTime())));
    const ate = new Date(Math.max(...pdiAplicacoes.map((a) => Math.max(fimDoDiaSp(a.dataFim).getTime(), ...a.reaberturas.map((r) => fimDoDiaSp(r.dataFim).getTime())))));
    const instantes = pdiAplicacoes.flatMap((a) => base.vivas.get(a.id)?.concluidasEm ?? []);
    const esperado = pdiAplicacoes.reduce((s, a) => s + (base.vivas.get(a.id)?.esperado ?? 0), 0);
    pdi = { esperado, prazo: iso(new Date(Math.max(...pdiAplicacoes.map((a) => fimDoDiaSp(a.dataFim).getTime())))), pontos: curvaAcumulada(instantes, de, ate) };
  }

  // Ciclo do 1/3 em foco: o filtrado ou o mais comum entre as escolas.
  const contagemFoco = new Map<number, number>();
  for (const id of escolas) { const c = base.focoCicloPorEscola.get(id); if (c) contagemFoco.set(c.id, (contagemFoco.get(c.id) ?? 0) + 1); }
  const cicloId = cicloIdFiltro ?? [...contagemFoco.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const ciclo = base.ciclos.find((c) => c.id === cicloId) ?? null;
  let umTerco = null;
  if (ciclo && situacaoCiclo(ciclo) !== 'agendado') {
    const serie = async (c: Ciclo, painel: Painel) => {
      const linhas = painel.linhas.filter((l) => !escolaId || l.escolas.some((e) => e.escolaId === escolaId)).filter((l) => escolaId || l.escolas.some((e) => escolas.includes(e.escolaId)));
      const ids = linhas.map((l) => l.entregaId).filter((x): x is number => x !== null);
      const entregas = ids.length ? await prisma.entregaUmTerco.findMany({ where: { id: { in: ids } }, select: { iniciadaEm: true, concluidaEm: true, status: true } }) : [];
      const ate = new Date(Math.max(c.prazoEm.getTime(), ...c.reaberturas.map((r) => r.fimEm.getTime())));
      return {
        esperado: linhas.length,
        iniciadas: curvaAcumulada(entregas.map((e) => e.iniciadaEm), c.abreEm, ate),
        concluidas: curvaAcumulada(entregas.filter((e) => e.status === 'CONCLUIDA').map((e) => e.concluidaEm ?? e.iniciadaEm), c.abreEm, ate),
      };
    };
    const atual = await serie(ciclo, base.paineis.get(ciclo.id) ?? await montarPainel(ciclo.id, {}));
    // Anterior: o último ciclo encerrado antes deste que atende alguma das escolas.
    const anteriorCiclo = [...base.ciclos].filter((c) => c.abreEm < ciclo.abreEm && situacaoCiclo(c) === 'encerrado' && escolas.some((id) => cicloAtende(c, id))).at(-1);
    let anterior = null;
    if (anteriorCiclo) {
      const painel = base.paineis.get(anteriorCiclo.id) ?? await montarPainel(anteriorCiclo.id, {});
      const s = await serie(anteriorCiclo, painel);
      anterior = { id: anteriorCiclo.id, titulo: anteriorCiclo.titulo, prazo: iso(anteriorCiclo.prazoEm), inicio: iso(anteriorCiclo.abreEm), ...s };
    }
    umTerco = { id: ciclo.id, titulo: ciclo.titulo, inicio: iso(ciclo.abreEm), prazo: iso(ciclo.prazoEm), ...atual, anterior };
  }
  return { pdi, umTerco };
}

// Estrutura: turmas ATIVAS do ano letivo, professores DISTINTOS com vínculo ATIVO, alunos com PDI ATIVOS.
async function estrutura(ano: number, escolaIds: number[]) {
  const turmas = await prisma.turma.findMany({ where: { escolaId: { in: escolaIds }, anoLetivo: ano, status: 'ATIVA' }, select: { id: true, escolaId: true, etapa: true, turno: true } });
  const turmaIds = turmas.map((t) => t.id);
  const [ptds, alunos] = turmaIds.length ? await Promise.all([
    prisma.professorTurmaDisciplina.findMany({ where: { turmaId: { in: turmaIds }, status: 'ATIVO' }, select: { professorId: true, turmaId: true } }),
    prisma.alunoPdi.groupBy({ by: ['turmaId'], where: { turmaId: { in: turmaIds }, status: 'ATIVO' }, _count: { _all: true } }),
  ]) : [[], []];
  const escolaDaTurma = new Map(turmas.map((t) => [t.id, t.escolaId]));
  const porEscola = new Map<number, { turmas: number; professores: Set<number>; alunosPdi: number; porEtapa: Record<string, number>; porTurno: Record<string, number> }>();
  const item = (id: number) => { if (!porEscola.has(id)) porEscola.set(id, { turmas: 0, professores: new Set(), alunosPdi: 0, porEtapa: {}, porTurno: {} }); return porEscola.get(id)!; };
  for (const t of turmas) { const i = item(t.escolaId); i.turmas += 1; i.porEtapa[t.etapa] = (i.porEtapa[t.etapa] ?? 0) + 1; i.porTurno[t.turno] = (i.porTurno[t.turno] ?? 0) + 1; }
  for (const p of ptds) item(escolaDaTurma.get(p.turmaId)!).professores.add(p.professorId);
  for (const a of alunos) item(escolaDaTurma.get(a.turmaId)!).alunosPdi += a._count._all;
  const rede = { turmas: turmas.length, professores: new Set(ptds.map((p) => p.professorId)).size, alunosPdi: alunos.reduce((s, a) => s + a._count._all, 0) };
  const formatar = (id: number) => { const i = porEscola.get(id); return i ? { turmas: i.turmas, professores: i.professores.size, alunosPdi: i.alunosPdi, porEtapa: i.porEtapa, porTurno: i.porTurno } : { turmas: 0, professores: 0, alunosPdi: 0, porEtapa: {}, porTurno: {} }; };
  return { rede, formatar };
}

// Correções do PDI em aberto, por escola — só informativo (a aba não cria nem resolve nada).
async function correcoesAbertas(escolaIds: number[]) {
  const correcoes = await prisma.correcaoFichaPdi.findMany({ where: { status: 'ABERTA', ficha: { escolaId: { in: escolaIds } } }, select: { ficha: { select: { escolaId: true } } } });
  const porEscola = new Map<number, number>();
  for (const c of correcoes) porEscola.set(c.ficha.escolaId, (porEscola.get(c.ficha.escolaId) ?? 0) + 1);
  return { total: correcoes.length, porEscola };
}

const lerFiltros = (q: Record<string, unknown>) => {
  const trimestre = lerInteiro(q.trimestre, 'Trimestre');
  if (trimestre !== null && trimestre > 3) throw new ValidationError('Trimestre inválido.');
  return { ano: lerInteiro(q.ano, 'Ano') ?? anoAtualSp(), trimestre, cicloId: lerInteiro(q.cicloId, 'Ciclo') };
};

// ----- GET /rede ----------------------------------------------------------------------------
acompanhamentoRouter.get('/rede', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const escopo = await escopoDoAtor(actor);
  const filtros = lerFiltros(req.query);
  const chave = `rede:${filtros.ano}:${filtros.trimestre ?? ''}:${filtros.cicloId ?? ''}:${escopo ? escopo.join(',') : 'todas'}`;
  res.json(await comCache(chave, req.query.atualizar === '1', async () => {
    const base = await montarBase(filtros.ano, escopo, filtros);
    const ids = base.escolas.map((e) => e.id);
    const [est, corr, rit] = await Promise.all([estrutura(filtros.ano, ids), correcoesAbertas(ids), ritmo(base, null, filtros.cicloId)]);

    const escolas = base.escolas.map((e) => ({
      id: e.id, nome: e.nome,
      pdi: resumoAplicacao(base.focoAplicacaoPorEscola.get(e.id) ?? null, base),
      umTerco: resumoCiclo(base.focoCicloPorEscola.get(e.id) ?? null, e.id, base),
      estrutura: est.formatar(e.id),
      correcoesAbertas: corr.porEscola.get(e.id) ?? 0,
    }));

    // Totais da rede. PDI: Fichas são de uma escola só, então somar escolas não duplica (só entram
    // as escolas com esperado conhecido). 1/3: cada entrega UMA vez, mesmo cobrindo várias escolas.
    const pdiComEsperado = escolas.map((e) => e.pdi).filter((p): p is NonNullable<typeof p> => !!p && p.esperado !== null);
    const pdi = pdiComEsperado.length ? {
      esperado: pdiComEsperado.reduce((s, p) => s + p.esperado!, 0), concluidas: pdiComEsperado.reduce((s, p) => s + p.concluidas, 0), emAndamento: pdiComEsperado.reduce((s, p) => s + p.emAndamento, 0),
      escolas: pdiComEsperado.length, aoVivo: pdiComEsperado.every((p) => p.fonte === 'ao_vivo'),
    } : null;
    const unicas = new Map<string, Painel['linhas'][number]>();
    for (const e of base.escolas) {
      const c = base.focoCicloPorEscola.get(e.id);
      const painel = c && base.paineis.get(c.id);
      if (!painel || situacaoCiclo(c) === 'agendado') continue;
      for (const l of linhasDaEscola(painel, e.id)) unicas.set(`${c.id}:${l.professorId}:${l.cargoId}`, l);
    }
    const umTerco = unicas.size ? { ...contarLinhas([...unicas.values()]), ciclos: new Set([...unicas.keys()].map((k) => k.split(':')[0])).size } : null;

    const agora = Date.now();
    const proximos = prazos(base).filter((p) => p.situacao === 'aberto' && new Date(p.fim).getTime() - agora <= LIMITES.diasPrazoProximo * DIA_MS).length;

    return {
      geradoEm: new Date().toISOString(), ano: filtros.ano, escopo: escopo ? 'escolas' : 'rede', limites: LIMITES,
      totais: { pdi, umTerco, prazosProximos: proximos, estrutura: est.rede, correcoesAbertas: corr.total },
      escolas,
      acompanhamento: itensDeAcompanhamento(base),
      prazos: prazos(base),
      ritmo: rit,
      filtrosDisponiveis: {
        ciclos: base.ciclos.map((c) => ({ id: c.id, titulo: c.titulo, inicio: iso(c.abreEm), fim: iso(c.prazoEm), situacao: situacaoCiclo(c) })),
        trimestres: [...new Set(base.aplicacoes.map((a) => a.trimestre).filter((t): t is number => t !== null))].sort(),
      },
    };
  }));
});

// ----- GET /escola/:id ----------------------------------------------------------------------
acompanhamentoRouter.get('/escola/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const escopo = await escopoDoAtor(actor);
  const escolaId = lerInteiro(req.params.id, 'Escola')!;
  if (escopo && !escopo.includes(escolaId)) throw new ForbiddenError('Você não tem acesso a esta escola.');
  const filtros = lerFiltros(req.query);
  const chave = `escola:${escolaId}:${filtros.ano}:${filtros.trimestre ?? ''}:${filtros.cicloId ?? ''}`;
  res.json(await comCache(chave, req.query.atualizar === '1', async () => {
    const base = await montarBase(filtros.ano, [escolaId], filtros);
    const escola = base.escolas[0];
    if (!escola) throw new NotFoundError('Escola não encontrada ou inativa.');
    const aplicacao = base.focoAplicacaoPorEscola.get(escolaId) ?? null;
    const ciclo = base.focoCicloPorEscola.get(escolaId) ?? null;

    // PDI por disciplina: ao vivo se aberta/em reabertura; senão, só concluídas por disciplina.
    let porDisciplina: { disciplinaId: number; disciplina: string; esperado: number | null; concluidas: number; emAndamento: number }[] = [];
    if (aplicacao) {
      const nomes = new Map(aplicacao.modelos.map((m) => [m.disciplinaId, m.disciplinaNome]));
      const viva = base.vivas.get(aplicacao.id);
      if (viva) {
        porDisciplina = [...viva.porDisciplina.entries()].map(([id, c]) => ({ disciplinaId: id, disciplina: nomes.get(id) ?? '', ...c }));
      } else if (situacaoAplicacao(aplicacao) !== 'agendado') {
        const grupos = await prisma.fichaPdi.groupBy({ by: ['disciplinaId'], where: { aplicacaoId: aplicacao.id, status: 'CONCLUIDA' }, _count: { _all: true } });
        porDisciplina = grupos.map((g) => ({ disciplinaId: g.disciplinaId, disciplina: nomes.get(g.disciplinaId) ?? '', esperado: null, concluidas: g._count._all, emAndamento: 0 }));
      }
      porDisciplina.sort((a, b) => a.disciplina.localeCompare(b.disciplina));
    }

    // 1/3 por cargo (12/11/2026): a matriz ano/série × disciplina saiu (decisão do usuário: nada de
    // ano/série nem gráfico por ano/série). Mantido vazio para clientes antigos da API.
    const matriz: never[] = [];

    // Histórico do ano. PDI: percentual só com foto; sem foto, número absoluto. 1/3: todos os ciclos
    // que atendem a escola (o esperado do 1/3 é estável, então o percentual é seguro).
    const historicoPdi = base.aplicacoes.filter((a) => situacaoAplicacao(a) !== 'agendado').map((a) => resumoAplicacao(a, base)!);
    const ciclosDaEscola = base.ciclos.filter((c) => cicloAtende(c, escolaId) && situacaoCiclo(c) !== 'agendado');
    await Promise.all(ciclosDaEscola.filter((c) => !base.paineis.has(c.id)).map(async (c) => { base.paineis.set(c.id, await montarPainel(c.id, {})); }));
    const historicoUmTerco = ciclosDaEscola.map((c) => resumoCiclo(c, escolaId, base)!);

    const [est, corr, rit] = await Promise.all([estrutura(filtros.ano, [escolaId]), correcoesAbertas([escolaId]), ritmo(base, escolaId, filtros.cicloId)]);
    return {
      geradoEm: new Date().toISOString(), ano: filtros.ano, limites: LIMITES,
      escola: { id: escola.id, nome: escola.nome },
      pdi: resumoAplicacao(aplicacao, base), porDisciplina,
      umTerco: resumoCiclo(ciclo, escolaId, base), matriz,
      historico: { pdi: historicoPdi, umTerco: historicoUmTerco },
      estrutura: est.formatar(escolaId),
      correcoesAbertas: corr.total,
      acompanhamento: itensDeAcompanhamento(base),
      prazos: prazos(base),
      ritmo: rit,
      filtrosDisponiveis: {
        ciclos: base.ciclos.filter((c) => cicloAtende(c, escolaId)).map((c) => ({ id: c.id, titulo: c.titulo, inicio: iso(c.abreEm), fim: iso(c.prazoEm), situacao: situacaoCiclo(c) })),
        trimestres: [...new Set(base.aplicacoes.map((a) => a.trimestre).filter((t): t is number => t !== null))].sort(),
      },
    };
  }));
});
