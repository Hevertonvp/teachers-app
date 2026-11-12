import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ConflitoVersaoError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import {
  cicloEditavelAgora, dataLocalSp, exigirAberturaNaoPassada, paraDataIsoUtc, statusDoCiclo, TEXTO_SEMANA_MAX, validarCiclo, validarReabertura,
  type JanelaInstantes,
} from '../../domain/umTerco.js';
import { calcularFolhas, chaveDeCargos, rotuloDaFolha, rotulosDosCargos, type Composicao } from '../../domain/cargos.js';
import { formatarCorrecao, idsDePessoasDasCorrecoes, OBSERVACAO_MAX, PRAZO_CORRECAO_MS, situacaoCorrecao, textoMensagemCorrecao } from '../../domain/correcoes.js';
import { criarMensagensDeCorrecao, nomesDePessoas, notificarMensagensDeCorrecao } from '../../lib/mensagemCorrecao.js';

// Formulário 1/3 — registro dos conteúdos ensinados, por semana.
// POR CARGO (decisão do usuário, 12/11/2026; substitui ano/série + disciplina): a identidade do
// preenchimento é ciclo + professor + cargo. Cada cargo gera UMA folha (um texto por semana, sem bloco
// por disciplina, sem turmas); dois cargos do mesmo Professor com a mesma parte no ciclo dividem a folha.
// A parte do cargo é a composição que valia na ABERTURA (versões em CargoVersao), restrita às escolas
// do ciclo. Vale para TODOS os Professores (Educação Infantil, Fundamental I e II): nada filtra por etapa.
// Ciclos: vários por trimestre, janelas (abertura → prazo) nunca se sobrepõem entre ciclos com escola
// em comum. Acesso: Secretaria (administra) e Professor (preenche o que é seu).
export const formularioUmTercoRouter = Router();

type Actor = { id: number; perfil: string };
type Db = Prisma.TransactionClient | typeof prisma;

const exigirSecretaria = (actor: Actor) => {
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria pode administrar o Formulário 1/3.');
};
const exigirProfessor = (actor: Actor) => {
  if (actor.perfil !== 'PROFESSOR') throw new ForbiddenError('Somente o Professor preenche o Formulário 1/3.');
};

const lerId = (valor: unknown, rotulo = 'Identificador'): number => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`${rotulo} inválido.`);
  return n;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const dataIso = (d: Date) => paraDataIsoUtc(d);
const dataUtc = (s: string) => new Date(`${s}T00:00:00Z`);
const ehConflitoUnico = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

// --- Ciclo ---------------------------------------------------------------------------------

const cicloInclude = {
  semanas: { orderBy: { numero: 'asc' as const } },
  reaberturas: { orderBy: { inicioEm: 'asc' as const } },
  escolas: { include: { escola: { select: { id: true, nome: true } } } },
};

// Escolas atendidas pelo ciclo (decisão de 10/11/2026): `null` = todas (inclusive as criadas depois).
type EscopoEscolas = { todasEscolas: boolean; escolas: { escolaId: number }[] };
const escolasDoCiclo = (ciclo: EscopoEscolas): number[] | null => (ciclo.todasEscolas ? null : ciclo.escolas.map((e) => e.escolaId));
type CicloCompleto = Prisma.CicloUmTercoGetPayload<{ include: typeof cicloInclude }>;

const janelasDe = (ciclo: CicloCompleto): JanelaInstantes[] => ciclo.reaberturas.map((r) => ({ inicioEm: r.inicioEm, fimEm: r.fimEm }));

function formatarCiclo(ciclo: CicloCompleto, extra: Record<string, unknown> = {}) {
  const agora = new Date();
  return {
    id: ciclo.id,
    anoLetivo: ciclo.anoLetivo,
    trimestre: ciclo.trimestre,
    titulo: ciclo.titulo,
    abreEm: iso(ciclo.abreEm),
    prazoEm: iso(ciclo.prazoEm),
    statusRegistro: ciclo.status === 'ATIVA' ? 'ativa' : 'inativa',
    statusPrazo: statusDoCiclo(ciclo, agora),
    editavelAgora: ciclo.status === 'ATIVA' && cicloEditavelAgora(ciclo, janelasDe(ciclo), agora),
    todasEscolas: ciclo.todasEscolas,
    escolas: ciclo.escolas.map((e) => ({ id: e.escola.id, nome: e.escola.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    semanas: ciclo.semanas.map((s) => ({ id: s.id, numero: s.numero, rotulo: `Semana ${s.numero}`, dataInicio: dataIso(s.dataInicio), dataFim: dataIso(s.dataFim) })),
    reaberturas: ciclo.reaberturas.map((r) => ({ id: r.id, inicioEm: iso(r.inicioEm), fimEm: iso(r.fimEm), motivo: r.motivo, createdAt: iso(r.createdAt) })),
    updatedAt: iso(ciclo.updatedAt ?? ciclo.createdAt),
    ...extra,
  };
}

async function buscarCiclo(db: Db, id: number): Promise<CicloCompleto> {
  const ciclo = await db.cicloUmTerco.findUnique({ where: { id }, include: cicloInclude });
  if (!ciclo) throw new NotFoundError('Ciclo do Formulário 1/3 não encontrado.');
  return ciclo;
}

async function janelaDoTrimestre(db: Db, ano: number, trimestre: number) {
  const periodo = await db.periodoTrimestre.findUnique({ where: { ano_trimestre: { ano, trimestre } } });
  return periodo ? { dataInicio: dataIso(periodo.dataInicio), dataFim: dataIso(periodo.dataFim) } : null;
}

const cicloSchema = z.object({
  anoLetivo: z.number().int(),
  trimestre: z.number().int(),
  titulo: z.string().optional(),
  abreEm: z.string(),
  prazoEm: z.string(),
  semanas: z.array(z.object({ dataInicio: z.string().nullish(), dataFim: z.string().nullish() })),
  // Ausente = todas (compatível com clientes antigos da API, que criavam ciclos globais).
  todasEscolas: z.boolean().optional(),
  escolaIds: z.array(z.number().int()).optional(),
});

// Valida a escolha de escolas: "todas" ou uma lista não vazia de escolas existentes e ATIVAS
// (escola inativa já escolhida antes pode continuar na lista de um ciclo existente).
async function validarEscolas(db: Db, dados: { todasEscolas?: boolean; escolaIds?: number[] }, jaNoCiclo: number[] = []): Promise<{ todasEscolas: boolean; escolaIds: number[] }> {
  if (dados.todasEscolas !== false) return { todasEscolas: true, escolaIds: [] };
  const escolaIds = [...new Set(dados.escolaIds ?? [])];
  if (escolaIds.length === 0) throw new ValidationError('Escolha ao menos uma escola, ou marque "Todas as escolas".');
  const escolas = await db.escola.findMany({ where: { id: { in: escolaIds } }, select: { id: true, nome: true, status: true } });
  if (escolas.length !== escolaIds.length) throw new ValidationError('Uma das escolas escolhidas não existe.');
  const inativa = escolas.find((e) => e.status !== 'ATIVA' && !jaNoCiclo.includes(e.id));
  if (inativa) throw new ValidationError(`A escola "${inativa.nome}" está inativa e não pode ser escolhida.`);
  return { todasEscolas: false, escolaIds };
}

// Janelas (abertura → prazo) de ciclos ATIVOS nunca se sobrepõem. Vários ciclos no mesmo trimestre
// são permitidos, desde que não fiquem abertos ao mesmo tempo. Chamar DENTRO da transação, depois de
// travar (travarJanelasDeCiclo), para duas gravações simultâneas não validarem uma contra o estado
// antigo da outra.
const travarJanelasDeCiclo = (tx: Db) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'um-terco-janelas-de-ciclo'}::text))`;

// ESCOLAS (10/11/2026): a sobreposição só é proibida entre ciclos que atendem alguma escola em comum
// ("todas" tem tudo em comum com qualquer ciclo). Ciclos de escolas diferentes podem coincidir.
async function exigirJanelaLivre(tx: Db, janela: { abreEm: Date; prazoEm: Date } & EscopoEscolas, ignorarId?: number) {
  const candidatos = await tx.cicloUmTerco.findMany({
    where: { status: 'ATIVA', ...(ignorarId ? { id: { not: ignorarId } } : {}), abreEm: { lte: janela.prazoEm }, prazoEm: { gte: janela.abreEm } },
    include: { escolas: { include: { escola: { select: { nome: true } } } } },
    orderBy: { abreEm: 'asc' },
  });
  const minhas = escolasDoCiclo(janela);
  for (const outro of candidatos) {
    const dele = escolasDoCiclo(outro);
    const comuns = minhas && dele ? outro.escolas.filter((e) => minhas.includes(e.escolaId)).map((e) => e.escola.nome) : null;
    if (comuns && comuns.length === 0) continue;
    const motivo = comuns ? `as duas atendem ${comuns.slice(0, 3).join(', ')}${comuns.length > 3 ? '…' : ''}` : 'um deles atende todas as escolas';
    throw new ConflictError(`A janela de preenchimento se sobrepõe ao "${outro.titulo}" (${outro.trimestre}º trimestre, ${formatarDataHoraSp(outro.abreEm)} a ${formatarDataHoraSp(outro.prazoEm)}) e ${motivo}. Dois Formulários 1/3 da mesma escola não podem ficar abertos ao mesmo tempo.`);
  }
}

const formatarDataHoraSp = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);

async function registrarEvento(db: Db, entregaId: number, tipo: Prisma.HistoricoEntregaUmTercoUncheckedCreateInput['tipo'], pessoaId: number | null, detalhe?: Prisma.InputJsonValue) {
  await db.historicoEntregaUmTerco.create({ data: { entregaId, tipo, pessoaId, detalhe } });
}

// --- Folhas por cargo --------------------------------------------------------------------------

// Composição com nomes, no formato da tela e da foto gravada na entrega: escola → disciplinas.
type ParteNomeada = { escolaId: number; escolaNome: string; disciplinas: { id: number; nome: string }[] };

async function carregarNomes(db: Db) {
  const [escolas, disciplinas] = await Promise.all([
    db.escola.findMany({ select: { id: true, nome: true } }),
    db.disciplina.findMany({ select: { id: true, nome: true } }),
  ]);
  return { escola: new Map(escolas.map((e) => [e.id, e.nome])), disciplina: new Map(disciplinas.map((d) => [d.id, d.nome])) };
}
type Nomes = Awaited<ReturnType<typeof carregarNomes>>;

const ordenarPartes = (partes: ParteNomeada[]) => partes
  .map((p) => ({ ...p, disciplinas: [...p.disciplinas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }))
  .sort((a, b) => a.escolaNome.localeCompare(b.escolaNome, 'pt-BR'));

const nomear = (composicao: Composicao, nomes: Nomes): ParteNomeada[] => ordenarPartes(composicao.map((i) => ({
  escolaId: i.escolaId,
  escolaNome: nomes.escola.get(i.escolaId) ?? '—',
  disciplinas: i.disciplinaIds.map((id) => ({ id, nome: nomes.disciplina.get(id) ?? '—' })),
})));

// Foto gravada na entrega (nunca recalculada). Tolerante a formatos estranhos.
function lerFoto(json: unknown): ParteNomeada[] {
  if (!Array.isArray(json)) return [];
  return ordenarPartes(json.map((p) => ({
    escolaId: Number((p as ParteNomeada)?.escolaId),
    escolaNome: String((p as ParteNomeada)?.escolaNome ?? '—'),
    disciplinas: Array.isArray((p as ParteNomeada)?.disciplinas) ? (p as ParteNomeada).disciplinas.map((d) => ({ id: Number(d.id), nome: String(d.nome) })) : [],
  })).filter((p) => Number.isInteger(p.escolaId)));
}

// "Prudenciana — Inglês, Geografia" (escola sem disciplina: só o nome da escola).
const descreverParte = (p: ParteNomeada) => (p.disciplinas.length ? `${p.escolaNome} — ${p.disciplinas.map((d) => d.nome).join(', ')}` : p.escolaNome);

export const AVISO_FOLHA_COMPARTILHADA = 'Este formulário representa os dois cargos cadastrados, pois possuem a mesma configuração de escolas e disciplinas.';

const entregaInclude = {
  respostas: true,
  cargos: { select: { cargoId: true } },
  professor: { select: { id: true, nome: true } },
  correcoes: { orderBy: { criadaEm: 'desc' as const } },
} satisfies Prisma.EntregaUmTercoInclude;
type EntregaCarregada = Prisma.EntregaUmTercoGetPayload<{ include: typeof entregaInclude }>;

type Folha = {
  professorId: number;
  professorNome: string;
  cargoIds: number[]; // ordenados; o menor é o id usado na rota
  idRota: number;
  composicao: ParteNomeada[];
  esperada: boolean; // conta no esperado do ciclo (cargo não encerrado até o prazo)
  rotulo: string;
  entrega: EntregaCarregada | null;
};

// Folhas de um ciclo (de um Professor, ou de todos):
// 1. calcula as folhas esperadas pelos cargos (domain/cargos.ts: versão da abertura, cadastro antes da
//    abertura, parte nas escolas do ciclo, cargos iguais juntos);
// 2. casa cada entrega já existente com a folha que tem algum cargo em comum (a entrega nunca muda de
//    folha por causa de mudanças posteriores no cadastro);
// 3. entrega que não casa com nenhuma folha esperada (cargo encerrado) continua listada como histórico,
//    fora do esperado. Entregas do modelo antigo (sem cargos) são ignoradas.
async function folhasDoCiclo(db: Db, ciclo: CicloCompleto, filtro: { professorId?: number } = {}): Promise<Folha[]> {
  const cicloEmCurso = ciclo.prazoEm.getTime() >= Date.now();
  const [cargos, entregas, nomes] = await Promise.all([
    db.cargoProfessor.findMany({
      where: { createdAt: { lte: ciclo.abreEm }, professor: { perfil: 'PROFESSOR' }, ...(filtro.professorId ? { professorId: filtro.professorId } : {}) },
      include: { versoes: { where: { criadaEm: { lte: ciclo.abreEm } }, orderBy: { criadaEm: 'desc' }, take: 1 }, professor: { select: { id: true, nome: true, status: true } } },
    }),
    db.entregaUmTerco.findMany({ where: { cicloId: ciclo.id, chaveCargos: { not: null }, ...(filtro.professorId ? { professorId: filtro.professorId } : {}) }, include: entregaInclude }),
    carregarNomes(db),
  ]);
  const professores = new Map(cargos.map((c) => [c.professorId, c.professor]));
  const calculadas = calcularFolhas(cargos, ciclo, escolasDoCiclo(ciclo));

  // Rótulos "Cargo 1/2" pelos cargos de HOJE do Professor (só visual).
  const ids = [...new Set([...calculadas.map((f) => f.professorId), ...entregas.map((e) => e.professorId)])];
  const todosCargos = ids.length ? await db.cargoProfessor.findMany({ where: { professorId: { in: ids } }, select: { id: true, professorId: true, status: true, dataInicio: true } }) : [];
  const rotulosPorProfessor = new Map<number, Map<number, string>>();
  for (const id of ids) rotulosPorProfessor.set(id, rotulosDosCargos(todosCargos.filter((c) => c.professorId === id)));

  const folhas: Folha[] = calculadas.map((f) => {
    const professor = professores.get(f.professorId)!;
    return {
      professorId: f.professorId, professorNome: professor.nome, cargoIds: f.cargoIds, idRota: f.cargoIds[0],
      composicao: nomear(f.composicao, nomes),
      // Professor inativo deixa de ser esperado enquanto o ciclo corre (depois do prazo o passado não muda).
      esperada: f.esperada && (!cicloEmCurso || professor.status === 'ATIVO'),
      rotulo: '', entrega: null,
    };
  });
  for (const e of entregas) {
    const cargosDaEntrega = e.cargos.map((c) => c.cargoId).sort((a, b) => a - b);
    const folha = folhas.find((f) => f.professorId === e.professorId && !f.entrega && f.cargoIds.some((id) => cargosDaEntrega.includes(id)));
    if (folha) {
      folha.entrega = e;
      folha.composicao = lerFoto(e.composicao);
      folha.cargoIds = [...new Set([...folha.cargoIds, ...cargosDaEntrega])].sort((a, b) => a - b);
      folha.idRota = folha.cargoIds[0];
    } else {
      folhas.push({ professorId: e.professorId, professorNome: e.professor.nome, cargoIds: cargosDaEntrega, idRota: cargosDaEntrega[0], composicao: lerFoto(e.composicao), esperada: false, rotulo: '', entrega: e });
    }
  }
  for (const f of folhas) f.rotulo = rotuloDaFolha(f.cargoIds, rotulosPorProfessor.get(f.professorId) ?? new Map());
  return folhas.sort((a, b) => a.professorNome.localeCompare(b.professorNome, 'pt-BR') || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

const statusDaEntrega = (e: EntregaCarregada | null) => (e ? (e.status === 'CONCLUIDA' ? 'concluida' : 'em_andamento') : 'nao_iniciado');
const semanasPreenchidas = (e: EntregaCarregada | null) => (e ? e.respostas.filter((r) => r.texto.trim().length > 0).length : 0);

// Campos comuns da folha para as telas (sem turmas, sem séries).
const resumoFolha = (f: Folha) => ({
  professorId: f.professorId,
  professorNome: f.professorNome,
  cargoId: f.idRota,
  cargoIds: f.cargoIds,
  rotulo: f.rotulo,
  compartilhada: f.cargoIds.length > 1,
  composicao: f.composicao,
  esperada: f.esperada,
});

// --- Montagem do detalhe de uma folha (Professor e Secretaria) -----------------------------------

async function buscarFolha(db: Db, ciclo: CicloCompleto, professorId: number, cargoId: number) {
  const folha = (await folhasDoCiclo(db, ciclo, { professorId })).find((f) => f.cargoIds.includes(cargoId));
  if (!folha) throw new NotFoundError('Formulário não encontrado para este cargo neste ciclo.');
  return folha;
}

async function montarDetalhe(db: Db, ciclo: CicloCompleto, professorId: number, cargoId: number, opcoes: { podeEditar: boolean }) {
  const folha = await buscarFolha(db, ciclo, professorId, cargoId);
  const entrega = folha.entrega;
  const historico = entrega ? await db.historicoEntregaUmTerco.findMany({ where: { entregaId: entrega.id }, orderBy: { quando: 'asc' } }) : [];
  const respostaPorSemana = new Map((entrega?.respostas ?? []).map((r) => [r.semanaId, r.texto]));
  const prazoAberto = ciclo.status === 'ATIVA' && cicloEditavelAgora(ciclo, janelasDe(ciclo), new Date());
  // Correções desta entrega (fluxo de correções, 10/11/2026), mais recente primeiro.
  const correcoes = entrega?.correcoes ?? [];
  const nomes = await nomesDePessoas(db, idsDePessoasDasCorrecoes(correcoes));
  const correcaoAberta = correcoes.some((c) => c.status === 'ABERTA');
  return {
    ciclo: formatarCiclo(ciclo),
    ...resumoFolha(folha),
    avisoCompartilhada: folha.cargoIds.length > 1 ? AVISO_FOLHA_COMPARTILHADA : null,
    entregaId: entrega?.id ?? null,
    status: statusDaEntrega(entrega),
    iniciadaEm: iso(entrega?.iniciadaEm ?? null),
    concluidaEm: iso(entrega?.concluidaEm ?? null),
    updatedAt: iso(entrega?.updatedAt ?? null),
    // Pode editar = prazo/reabertura aberto E o cargo ainda é esperado neste ciclo, ou há uma correção
    // aberta para esta entrega (devolvida pela Secretaria).
    editavelAgora: opcoes.podeEditar && ciclo.status === 'ATIVA' && ((prazoAberto && folha.esperada) || correcaoAberta),
    correcao: correcoes[0] ? formatarCorrecao(correcoes[0], nomes) : null,
    correcoes: correcoes.map((c) => formatarCorrecao(c, nomes)),
    semanas: ciclo.semanas.map((s) => ({
      id: s.id, numero: s.numero, rotulo: `Semana ${s.numero}`, dataInicio: dataIso(s.dataInicio), dataFim: dataIso(s.dataFim),
      texto: respostaPorSemana.get(s.id) ?? '',
    })),
    historico: historico.map((h) => ({ id: h.id, tipo: h.tipo, pessoaId: h.pessoaId, quando: iso(h.quando), detalhe: h.detalhe })),
  };
}

const paramsFormulario = (req: { params: Record<string, string | string[] | undefined> }) => ({
  cicloId: lerId(req.params.cicloId, 'Ciclo'),
  cargoId: lerId(req.params.cargoId, 'Cargo'),
});

// Professor só enxerga/edita o que é dele: a folha precisa ser de um cargo dele neste ciclo.
async function carregarParaProfessor(actor: Actor, cicloId: number, cargoId: number) {
  exigirProfessor(actor);
  const ciclo = await buscarCiclo(prisma, cicloId);
  return montarDetalhe(prisma, ciclo, actor.id, cargoId, { podeEditar: true });
}

// ===== Secretaria: ciclos ===================================================================

formularioUmTercoRouter.get('/ciclos', async (_req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const ciclos = await prisma.cicloUmTerco.findMany({ include: cicloInclude, orderBy: [{ anoLetivo: 'desc' }, { trimestre: 'desc' }, { id: 'desc' }] });
  const contagens = await prisma.entregaUmTerco.groupBy({ by: ['cicloId'], _count: { _all: true } });
  const porCiclo = new Map(contagens.map((c) => [c.cicloId, c._count._all]));
  res.json(ciclos.map((c) => formatarCiclo(c, { entregasIniciadas: porCiclo.get(c.id) ?? 0 })));
});

formularioUmTercoRouter.post('/ciclos', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = cicloSchema.parse(req.body);

  const criado = await prisma.$transaction(async (tx) => {
    await travarJanelasDeCiclo(tx);
    const valido = validarCiclo({ ...dados }, await janelaDoTrimestre(tx, dados.anoLetivo, dados.trimestre));
    exigirAberturaNaoPassada(valido.abreEm);
    const escolha = await validarEscolas(tx, dados);
    await exigirJanelaLivre(tx, { ...valido, todasEscolas: escolha.todasEscolas, escolas: escolha.escolaIds.map((escolaId) => ({ escolaId })) });
    return tx.cicloUmTerco.create({
      data: {
        anoLetivo: valido.anoLetivo, trimestre: valido.trimestre, titulo: valido.titulo, abreEm: valido.abreEm, prazoEm: valido.prazoEm,
        todasEscolas: escolha.todasEscolas,
        escolas: { create: escolha.escolaIds.map((escolaId) => ({ escolaId })) },
        createdBy: String(actor.id),
        semanas: { create: valido.semanas.map((s) => ({ numero: s.numero, dataInicio: dataUtc(s.dataInicio), dataFim: dataUtc(s.dataFim) })) },
      },
    });
  });
  res.status(201).json(formatarCiclo(await buscarCiclo(prisma, criado.id)));
});

// Escolas com preenchimento iniciado neste ciclo (pela foto das entregas por cargo e, nas entregas
// antigas, pela cobertura de turmas).
async function escolasComPreenchimento(tx: Db, cicloId: number): Promise<Map<number, string>> {
  const [porCargo, antigas] = await Promise.all([
    tx.entregaUmTerco.findMany({ where: { cicloId, chaveCargos: { not: null } }, select: { composicao: true } }),
    tx.coberturaEntregaUmTerco.findMany({ where: { entrega: { cicloId } }, select: { escolaId: true, escola: { select: { nome: true } } }, distinct: ['escolaId'] }),
  ]);
  const mapa = new Map<number, string>();
  for (const e of porCargo) for (const p of lerFoto(e.composicao)) mapa.set(p.escolaId, p.escolaNome);
  for (const c of antigas) mapa.set(c.escolaId, c.escola.nome);
  return mapa;
}

// Editar: livre enquanto nenhum Professor começou. Com entregas iniciadas, ano/trimestre e a
// QUANTIDADE de semanas ficam travados (reduzir semanas apagaria texto já escrito); datas, prazo
// e título continuam editáveis, sempre revalidados contra o calendário.
formularioUmTercoRouter.put('/ciclos/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = lerId(req.params.id);
  const dados = cicloSchema.parse(req.body);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ciclos_um_terco WHERE id = ${id} FOR UPDATE`;
    const atual = await buscarCiclo(tx, id);
    const entregas = await tx.entregaUmTerco.count({ where: { cicloId: id } });
    if (entregas > 0) {
      if (dados.anoLetivo !== atual.anoLetivo || dados.trimestre !== atual.trimestre) throw new ConflictError('Ano e trimestre não podem mudar depois que algum Professor começou a preencher.');
      if (dados.semanas.length !== atual.semanas.length) throw new ConflictError('A quantidade de semanas não pode mudar depois que algum Professor começou a preencher.');
    }
    await travarJanelasDeCiclo(tx);
    const valido = validarCiclo({ ...dados }, await janelaDoTrimestre(tx, dados.anoLetivo, dados.trimestre));
    if (dataLocalSp(valido.abreEm) !== dataLocalSp(atual.abreEm)) {
      exigirAberturaNaoPassada(valido.abreEm);
      // A abertura define a foto dos cargos: com preenchimento iniciado ela não muda de dia.
      if (entregas > 0) throw new ConflictError('A data de abertura não pode mudar depois que algum Professor começou a preencher.');
    }
    // Escolas: sem o campo, mantém as que o ciclo já tem (cliente antigo da API não apaga a escolha).
    const escolha = dados.todasEscolas === undefined
      ? { todasEscolas: atual.todasEscolas, escolaIds: atual.escolas.map((e) => e.escolaId) }
      : await validarEscolas(tx, dados, atual.escolas.map((e) => e.escolaId));
    // Escola com preenchimento iniciado neste ciclo não pode sair (o texto escrito ficaria órfão).
    if (!escolha.todasEscolas) {
      const emUso = [...(await escolasComPreenchimento(tx, id)).entries()].filter(([escolaId]) => !escolha.escolaIds.includes(escolaId)).map(([, nome]) => nome);
      if (emUso.length) throw new ConflictError(`Não é possível retirar ${emUso.map((nome) => `"${nome}"`).join(', ')}: já há Professor preenchendo este Formulário 1/3 nessa escola.`);
    }
    if (atual.status === 'ATIVA') await exigirJanelaLivre(tx, { ...valido, todasEscolas: escolha.todasEscolas, escolas: escolha.escolaIds.map((escolaId) => ({ escolaId })) }, id);

    await tx.cicloUmTerco.update({ where: { id }, data: { anoLetivo: valido.anoLetivo, trimestre: valido.trimestre, titulo: valido.titulo, abreEm: entregas > 0 ? atual.abreEm : valido.abreEm, prazoEm: valido.prazoEm, todasEscolas: escolha.todasEscolas, updatedBy: String(actor.id) } });
    await tx.cicloUmTercoEscola.deleteMany({ where: { cicloId: id } });
    if (!escolha.todasEscolas) await tx.cicloUmTercoEscola.createMany({ data: escolha.escolaIds.map((escolaId) => ({ cicloId: id, escolaId })) });
    if (entregas > 0) {
      for (const s of valido.semanas) {
        await tx.semanaUmTerco.update({ where: { cicloId_numero: { cicloId: id, numero: s.numero } }, data: { dataInicio: dataUtc(s.dataInicio), dataFim: dataUtc(s.dataFim) } });
      }
    } else {
      await tx.semanaUmTerco.deleteMany({ where: { cicloId: id } });
      await tx.semanaUmTerco.createMany({ data: valido.semanas.map((s) => ({ cicloId: id, numero: s.numero, dataInicio: dataUtc(s.dataInicio), dataFim: dataUtc(s.dataFim) })) });
    }
  });
  res.json(formatarCiclo(await buscarCiclo(prisma, id)));
});

formularioUmTercoRouter.post('/ciclos/:id/inativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = lerId(req.params.id);
  const ciclo = await buscarCiclo(prisma, id);
  // MUDOU (decisão do usuário, 10/11/2026): pode inativar mesmo com preenchimentos. Nada é apagado:
  // o ciclo só sai das listas (o professor deixa de vê-lo) e volta inteiro ao reativar. A tela avisa
  // quantos professores já preencheram antes de confirmar.
  await prisma.cicloUmTerco.update({ where: { id: ciclo.id }, data: { status: 'INATIVA', updatedBy: String(actor.id) } });
  res.json(formatarCiclo(await buscarCiclo(prisma, id)));
});

formularioUmTercoRouter.post('/ciclos/:id/reativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = lerId(req.params.id);
  await prisma.$transaction(async (tx) => {
    const ciclo = await buscarCiclo(tx, id);
    await travarJanelasDeCiclo(tx);
    await exigirJanelaLivre(tx, ciclo, id);
    await tx.cicloUmTerco.update({ where: { id }, data: { status: 'ATIVA', updatedBy: String(actor.id) } });
  });
  res.json(formatarCiclo(await buscarCiclo(prisma, id)));
});

// ===== Secretaria: reabertura (do ciclo inteiro) =============================================

const reaberturaSchema = z.object({ inicioEm: z.string(), fimEm: z.string(), motivo: z.string().trim().max(500).optional() });

formularioUmTercoRouter.post('/ciclos/:id/reaberturas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = lerId(req.params.id);
  const dados = reaberturaSchema.parse(req.body);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ciclos_um_terco WHERE id = ${id} FOR UPDATE`;
    const ciclo = await buscarCiclo(tx, id);
    // Reabrir só depois do prazo (decisão do usuário, 10/11/2026); para estender um ciclo ainda
    // agendado ou aberto, o caminho é "Editar" o prazo.
    if (statusDoCiclo(ciclo) !== 'encerrado') throw new ConflictError('Só é possível reabrir depois do prazo. Para estender o prazo, use "Editar".');
    const janela = validarReabertura(dados, janelasDe(ciclo));
    await tx.reaberturaUmTerco.create({ data: { cicloId: id, inicioEm: janela.inicioEm, fimEm: janela.fimEm, motivo: dados.motivo || null, createdBy: String(actor.id) } });
  });
  res.status(201).json(formatarCiclo(await buscarCiclo(prisma, id)));
});

// ===== Secretaria: painel de entrega ===========================================================

formularioUmTercoRouter.get('/ciclos/:id/painel', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  res.json(await montarPainel(lerId(req.params.id), req.query));
});

// Cálculo do painel (esperado/concluído/andamento/não iniciado, por folha e por escola) com os filtros
// da tela. Compartilhado pelo painel, pela exportação para Excel e pelo Acompanhamento Escolar
// (routes/acompanhamento.ts) — mesmos números.
// Unidade = FOLHA (cargo, ou cargos iguais juntos). Folha que cobre duas escolas aparece no filtro de
// cada uma e conta UMA vez no total (regra mantida por enquanto, a discutir com a equipe).
// Folhas fora do esperado (cargo encerrado durante o ciclo, já com texto) vão em `foraDoEsperado`:
// preservadas para consulta, sem entrar nas contagens nem nos percentuais.
export async function montarPainel(cicloId: number, q: Record<string, unknown>) {
  const ciclo = await buscarCiclo(prisma, cicloId);
  const filtroEscola = q.escolaId ? lerId(q.escolaId, 'Escola') : null;
  const filtroDisciplina = q.disciplinaId ? lerId(q.disciplinaId, 'Disciplina') : null;
  const filtroProfessor = q.professorId ? lerId(q.professorId, 'Professor') : null;
  const filtroStatus = typeof q.status === 'string' && ['nao_iniciado', 'em_andamento', 'concluida'].includes(q.status) ? q.status : null;
  // Fluxo de correções (10/11/2026): só as entregas cuja correção aguarda o professor ou a conferência.
  const filtroCorrecao = q.correcao === 'em_andamento';

  const folhas = await folhasDoCiclo(prisma, ciclo);
  const totalSemanas = ciclo.semanas.length;
  const linha = (f: Folha) => {
    const disciplinas = new Map<number, string>();
    for (const p of f.composicao) for (const d of p.disciplinas) disciplinas.set(d.id, d.nome);
    return {
      ...resumoFolha(f),
      escolas: f.composicao.map((p) => ({ escolaId: p.escolaId, escolaNome: p.escolaNome })),
      disciplinas: [...disciplinas.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      entregaId: f.entrega?.id ?? null, status: statusDaEntrega(f.entrega), semanasPreenchidas: semanasPreenchidas(f.entrega), totalSemanas,
      // Situação da correção mais recente (nula = nunca devolvida). Ver domain/correcoes.ts.
      correcao: f.entrega?.correcoes[0] ? situacaoCorrecao(f.entrega.correcoes[0]) : null,
      concluidaEm: iso(f.entrega?.concluidaEm ?? null), atualizadoEm: iso(f.entrega?.updatedAt ?? null),
    };
  };
  type Linha = ReturnType<typeof linha>;
  const passaFiltros = (l: Linha) => (!filtroEscola || l.escolas.some((e) => e.escolaId === filtroEscola))
    && (!filtroDisciplina || l.disciplinas.some((d) => d.id === filtroDisciplina))
    && (!filtroProfessor || l.professorId === filtroProfessor)
    && (!filtroStatus || l.status === filtroStatus)
    && (!filtroCorrecao || ['solicitada', 'prazo_encerrado', 'recebida'].includes(l.correcao ?? ''));

  const todas = folhas.filter((f) => f.esperada).map(linha).filter(passaFiltros);
  const foraDoEsperado = folhas.filter((f) => !f.esperada && f.entrega).map(linha).filter(passaFiltros);

  // Total é por folha ÚNICA (nunca multiplica por escola ou disciplina).
  const esperado = todas.length;
  const concluidas = todas.filter((l) => l.status === 'concluida').length;
  const emAndamento = todas.filter((l) => l.status === 'em_andamento').length;
  const naoIniciadas = todas.filter((l) => l.status === 'nao_iniciado').length;

  // Por escola: uma mesma folha aparece em cada escola que ela cobre — visão por escola, NÃO soma ao total.
  const porEscola = new Map<number, { escolaId: number; escolaNome: string; esperado: number; concluidas: number }>();
  for (const l of todas) {
    for (const e of l.escolas) {
      const item = porEscola.get(e.escolaId) ?? { escolaId: e.escolaId, escolaNome: e.escolaNome, esperado: 0, concluidas: 0 };
      item.esperado += 1;
      if (l.status === 'concluida') item.concluidas += 1;
      porEscola.set(e.escolaId, item);
    }
  }

  return {
    ciclo: formatarCiclo(ciclo),
    resumo: { esperado, concluidas, emAndamento, naoIniciadas, percentualEntrega: esperado ? Math.round((concluidas / esperado) * 100) : 0 },
    porEscola: [...porEscola.values()].sort((a, b) => a.escolaNome.localeCompare(b.escolaNome, 'pt-BR')),
    linhas: todas,
    foraDoEsperado,
  };
}

// Exportação para Excel (somente leitura, só Secretaria): o mesmo painel, com os MESMOS filtros da
// tela, mais os conteúdos registrados em cada semana das entregas listadas. Nada novo é calculado.
formularioUmTercoRouter.get('/ciclos/:id/exportacao', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const painel = await montarPainel(lerId(req.params.id), req.query);
  const entregaIds = painel.linhas.map((l) => l.entregaId).filter((id): id is number => id !== null);
  const respostas = entregaIds.length
    ? await prisma.respostaSemanaUmTerco.findMany({ where: { entregaId: { in: entregaIds } }, include: { semana: true }, orderBy: [{ entregaId: 'asc' }, { semana: { numero: 'asc' } }] })
    : [];
  const linhaDaEntrega = new Map(painel.linhas.filter((l) => l.entregaId !== null).map((l) => [l.entregaId as number, l]));
  const conteudos = respostas.map((r) => {
    const l = linhaDaEntrega.get(r.entregaId)!;
    return {
      entregaId: r.entregaId, professorNome: l.professorNome, rotulo: l.rotulo, cobertura: l.composicao.map(descreverParte).join(' · '),
      semanaNumero: r.semana.numero, semanaInicio: dataIso(r.semana.dataInicio), semanaFim: dataIso(r.semana.dataFim), texto: r.texto,
    };
  });
  res.json({ ...painel, conteudos });
});

// ===== Secretaria: devolver para correção e aceitar (fluxo de correções, 10/11/2026) ==============
// Mesmo desenho do PDI: orientações obrigatórias, prazo FIXO de 3 dias corridos, mensagem automática
// na caixa do Professor dono da entrega, devoluções ilimitadas (uma aberta por vez). A entrega é a
// do próprio Professor (uma folha de cargo), então nunca mistura professores; a devolução libera só ela.
const devolverEntregaSchema = z.object({ observacao: z.string().trim().min(1, 'Escreva o que precisa ser corrigido.').max(OBSERVACAO_MAX, `Use no máximo ${OBSERVACAO_MAX} caracteres.`) });

formularioUmTercoRouter.post('/entregas/:entregaId/devolver', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const entregaId = lerId(req.params.entregaId, 'Entrega');
  const { observacao } = devolverEntregaSchema.parse(req.body);

  const { correcao, criadas } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM entregas_um_terco WHERE id = ${entregaId} FOR UPDATE`;
    const entrega = await tx.entregaUmTerco.findUnique({ where: { id: entregaId }, include: { professor: true, ciclo: true, cargos: { select: { cargoId: true } } } });
    if (!entrega) throw new NotFoundError('Entrega não encontrada.');
    if (entrega.ciclo.status !== 'ATIVA') throw new ValidationError('Este Formulário 1/3 foi inativado.');
    if (entrega.status !== 'CONCLUIDA') throw new ValidationError('Só é possível devolver um formulário já concluído.');
    if (entrega.professor.status !== 'ATIVO') throw new ValidationError('O professor desta entrega está inativo. Não há quem receba a correção.');
    if (!entrega.chaveCargos) throw new ValidationError('Este preenchimento é do modelo antigo (ano/série e disciplina) e não pode ser devolvido.');
    const aberta = await tx.correcaoEntregaUmTerco.findFirst({ where: { entregaId, status: 'ABERTA' } });
    if (aberta) throw new ConflictError('Este formulário já tem uma correção aguardando o professor. Aguarde o envio para devolver de novo.');

    const agora = new Date();
    await tx.correcaoEntregaUmTerco.updateMany({ where: { entregaId, status: 'RESOLVIDA', conferencia: null }, data: { conferencia: 'DEVOLVIDA', conferidaEm: agora, conferidaPor: String(actor.id) } });
    const nova = await tx.correcaoEntregaUmTerco.create({ data: { entregaId, observacao, criadaPor: String(actor.id), criadaEm: agora, prazoAte: new Date(agora.getTime() + PRAZO_CORRECAO_MS) } });

    const cargoIds = entrega.cargos.map((c) => c.cargoId).sort((a, b) => a - b);
    const rotulos = rotulosDosCargos(await tx.cargoProfessor.findMany({ where: { professorId: entrega.professorId }, select: { id: true, status: true, dataInicio: true } }));
    const rotulo = rotuloDaFolha(cargoIds, rotulos);
    const partes = lerFoto(entrega.composicao);
    const msgs = await criarMensagensDeCorrecao(tx, {
      remetenteId: actor.id, destinatarioIds: [entrega.professorId], escolasPreferidas: partes.map((p) => p.escolaId),
      assunto: `Correção pendente · Formulário 1/3 · ${rotulo}`,
      conteudo: textoMensagemCorrecao({ formulario: `Formulário 1/3 (${entrega.ciclo.titulo})`, identificacao: [rotulo, ...partes.map(descreverParte)], observacao, prazoAte: nova.prazoAte }),
      link: `/formulario-um-terco/${entrega.cicloId}/cargo/${cargoIds[0]}`,
    });
    return { correcao: nova, criadas: msgs };
  });
  await notificarMensagensDeCorrecao(prisma, actor.id, criadas, `correcao-um-terco-${correcao.id}`);
  res.status(201).json({ ...formatarCorrecao(correcao), mensagensEnviadas: criadas.length });
});

formularioUmTercoRouter.post('/entregas/:entregaId/aceitar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const entregaId = lerId(req.params.entregaId, 'Entrega');
  const ultima = await prisma.correcaoEntregaUmTerco.findFirst({ where: { entregaId }, orderBy: { criadaEm: 'desc' } });
  if (!ultima || ultima.status !== 'RESOLVIDA' || ultima.conferencia) throw new ConflictError('Não há correção recebida aguardando conferência neste formulário.');
  await prisma.correcaoEntregaUmTerco.updateMany({ where: { id: ultima.id, status: 'RESOLVIDA', conferencia: null }, data: { conferencia: 'ACEITA', conferidaEm: new Date(), conferidaPor: String(actor.id) } });
  res.json(formatarCorrecao(await prisma.correcaoEntregaUmTerco.findUniqueOrThrow({ where: { id: ultima.id } })));
});

// Secretaria consulta uma folha específica (somente leitura, com histórico).
formularioUmTercoRouter.get('/ciclos/:cicloId/entregas/:professorId/cargos/:cargoId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const { cicloId, cargoId } = paramsFormulario(req);
  const ciclo = await buscarCiclo(prisma, cicloId);
  res.json(await montarDetalhe(prisma, ciclo, lerId(req.params.professorId, 'Professor'), cargoId, { podeEditar: false }));
});

// ===== Professor ===============================================================================

// Lista as folhas do Professor logado: uma por ciclo + cargo (cargos iguais juntos), nunca por
// disciplina, escola ou turma. Folha de cargo encerrado com texto aparece só para consulta.
formularioUmTercoRouter.get('/minhas', async (_req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirProfessor(actor);
  const ciclos = await prisma.cicloUmTerco.findMany({ where: { status: 'ATIVA' }, include: cicloInclude, orderBy: [{ anoLetivo: 'desc' }, { trimestre: 'desc' }, { abreEm: 'desc' }] });
  const itens: unknown[] = [];
  for (const ciclo of ciclos) {
    const resumoCiclo = formatarCiclo(ciclo);
    for (const f of await folhasDoCiclo(prisma, ciclo, { professorId: actor.id })) {
      if (!f.esperada && !f.entrega) continue;
      const correcaoAberta = !!f.entrega && f.entrega.correcoes.some((c) => c.status === 'ABERTA');
      itens.push({
        ciclo: { id: ciclo.id, titulo: ciclo.titulo, anoLetivo: ciclo.anoLetivo, trimestre: ciclo.trimestre, abreEm: resumoCiclo.abreEm, prazoEm: resumoCiclo.prazoEm, statusPrazo: resumoCiclo.statusPrazo, editavelAgora: resumoCiclo.editavelAgora },
        ...resumoFolha(f),
        status: statusDaEntrega(f.entrega),
        semanasPreenchidas: semanasPreenchidas(f.entrega),
        totalSemanas: ciclo.semanas.length,
        // Correção solicitada pela Secretaria: indicação discreta na lista e edição liberada só aqui.
        correcaoSolicitada: correcaoAberta,
        editavelAgora: (resumoCiclo.editavelAgora && f.esperada) || correcaoAberta,
      });
    }
  }
  res.json(itens);
});

formularioUmTercoRouter.get('/ciclos/:cicloId/cargos/:cargoId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const { cicloId, cargoId } = paramsFormulario(req);
  res.json(await carregarParaProfessor(actor, cicloId, cargoId));
});

const respostasSchema = z.object({
  // updatedAt que o cliente tinha da entrega (null = ainda não existia). Se mudou, 409.
  baseUpdatedAt: z.string().nullish(),
  respostas: z.array(z.object({ semanaId: z.number().int(), texto: z.string().max(TEXTO_SEMANA_MAX, `Cada semana aceita no máximo ${TEXTO_SEMANA_MAX} caracteres.`) })).min(1),
});

// Correção aberta (fluxo de correções, 10/11/2026) libera a edição SÓ desta entrega, mesmo depois do
// prazo do ciclo e mesmo com o cargo encerrado. Sem correção: prazo aberto e cargo ainda esperado.
function exigirEditavel(ciclo: CicloCompleto, folha: Folha) {
  if (ciclo.status !== 'ATIVA') throw new ValidationError('Este Formulário 1/3 foi inativado.');
  if (folha.entrega?.correcoes.some((c) => c.status === 'ABERTA')) return;
  if (!cicloEditavelAgora(ciclo, janelasDe(ciclo), new Date())) throw new ValidationError('O prazo deste Formulário 1/3 terminou — ele está somente para leitura. Peça à Secretaria uma reabertura.');
  if (!folha.esperada) throw new ForbiddenError('Este cargo foi encerrado: o formulário fica guardado só para consulta.');
}

// Serializa gravações das folhas do mesmo Professor no ciclo (duas abas / duplo clique) sem depender de timing.
const travarFolhas = (tx: Db, cicloId: number, professorId: number) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`um-terco-folhas:${cicloId}:${professorId}`}::text))`;

const tokenIgual = (base: string | null | undefined, atual: Date | null) => (base ? new Date(base).getTime() === (atual?.getTime() ?? -1) : atual === null);

formularioUmTercoRouter.put('/ciclos/:cicloId/cargos/:cargoId/respostas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirProfessor(actor);
  const { cicloId, cargoId } = paramsFormulario(req);
  const dados = respostasSchema.parse(req.body);

  const conflito = async () => montarDetalhe(prisma, await buscarCiclo(prisma, cicloId), actor.id, cargoId, { podeEditar: true });

  try {
    await prisma.$transaction(async (tx) => {
      await travarFolhas(tx, cicloId, actor.id);
      const ciclo = await buscarCiclo(tx, cicloId);
      const folha = await buscarFolha(tx, ciclo, actor.id, cargoId);
      exigirEditavel(ciclo, folha);
      const semanasValidas = new Set(ciclo.semanas.map((s) => s.id));
      if (dados.respostas.some((r) => !semanasValidas.has(r.semanaId))) throw new ValidationError('Semana não pertence a este ciclo.');

      let entrega = folha.entrega;
      if (entrega) {
        if (!tokenIgual(dados.baseUpdatedAt, entrega.updatedAt)) throw new ConflitoVersaoError('Este formulário foi alterado em outra aba ou dispositivo. Suas alterações foram guardadas.', null);
      } else {
        if (dados.baseUpdatedAt) throw new ConflitoVersaoError('Este formulário foi alterado em outra aba ou dispositivo. Suas alterações foram guardadas.', null);
        // Primeira gravação: congela a parte do cargo neste ciclo (nunca recalculada depois).
        entrega = await tx.entregaUmTerco.create({
          data: {
            cicloId, professorId: actor.id, chaveCargos: chaveDeCargos(folha.cargoIds),
            composicao: folha.composicao as unknown as Prisma.InputJsonValue,
            cargos: { create: folha.cargoIds.map((id) => ({ cargoId: id })) },
          },
          include: entregaInclude,
        });
        await registrarEvento(tx, entrega.id, 'INICIADA', actor.id, { cargos: folha.cargoIds });
      }

      for (const r of dados.respostas) {
        await tx.respostaSemanaUmTerco.upsert({
          where: { entregaId_semanaId: { entregaId: entrega.id, semanaId: r.semanaId } },
          create: { entregaId: entrega.id, semanaId: r.semanaId, texto: r.texto },
          update: { texto: r.texto },
        });
      }
      await tx.entregaUmTerco.update({ where: { id: entrega.id }, data: { updatedAt: new Date() } });

      // Autosave gera muitas gravações: junta em um único evento "SALVA" se a anterior foi do mesmo
      // Professor há menos de 10 minutos (o histórico registra QUANDO e QUEM, sem inflar).
      const ultimo = await tx.historicoEntregaUmTerco.findFirst({ where: { entregaId: entrega.id }, orderBy: { quando: 'desc' } });
      const semanasTocadas = dados.respostas.map((r) => r.semanaId);
      if (ultimo && ultimo.tipo === 'SALVA' && ultimo.pessoaId === actor.id && Date.now() - ultimo.quando.getTime() < 10 * 60 * 1000) {
        await tx.historicoEntregaUmTerco.update({ where: { id: ultimo.id }, data: { quando: new Date(), detalhe: { semanas: semanasTocadas } } });
      } else {
        await registrarEvento(tx, entrega.id, 'SALVA', actor.id, { semanas: semanasTocadas });
      }
    }, { timeout: 15000 });
  } catch (error) {
    if (error instanceof ConflitoVersaoError) throw new ConflitoVersaoError(error.message, await conflito());
    // Duas abas criando a MESMA folha ao mesmo tempo: o índice único segura; o perdedor recebe 409.
    if (ehConflitoUnico(error)) throw new ConflitoVersaoError('Este formulário acabou de ser iniciado em outra aba. Suas alterações foram guardadas.', await conflito());
    throw error;
  }
  res.json(await carregarParaProfessor(actor, cicloId, cargoId));
});

const concluirSchema = z.object({ baseUpdatedAt: z.string().nullish() });

formularioUmTercoRouter.post('/ciclos/:cicloId/cargos/:cargoId/concluir', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirProfessor(actor);
  const { cicloId, cargoId } = paramsFormulario(req);
  const dados = concluirSchema.parse(req.body ?? {});

  await prisma.$transaction(async (tx) => {
    await travarFolhas(tx, cicloId, actor.id);
    const ciclo = await buscarCiclo(tx, cicloId);
    const folha = await buscarFolha(tx, ciclo, actor.id, cargoId);
    exigirEditavel(ciclo, folha);
    const entrega = folha.entrega;
    if (!entrega) throw new ValidationError('Preencha as semanas antes de concluir.');
    // "Enviar correção": a entrega já estava concluída quando foi devolvida; concluir de novo envia a
    // correção (ABERTA -> RESOLVIDA). updateMany com status ABERTA: duplo clique não faz nada.
    // Enviada depois dos 3 dias continua valendo e fica marcada como fora do prazo.
    if (entrega.status === 'CONCLUIDA') {
      await tx.correcaoEntregaUmTerco.updateMany({ where: { entregaId: entrega.id, status: 'ABERTA' }, data: { status: 'RESOLVIDA', concluidaEm: new Date(), concluidaPor: String(actor.id) } });
      return;
    }
    if (dados.baseUpdatedAt !== undefined && dados.baseUpdatedAt !== null && !tokenIgual(dados.baseUpdatedAt, entrega.updatedAt)) {
      throw new ConflitoVersaoError('Este formulário foi alterado em outra aba ou dispositivo.', null);
    }
    const textos = new Map(entrega.respostas.map((r) => [r.semanaId, r.texto.trim()]));
    const faltando = ciclo.semanas.filter((s) => !textos.get(s.id));
    if (faltando.length > 0) {
      throw new ValidationError(`Preencha todas as semanas antes de concluir. Faltam: ${faltando.map((s) => `Semana ${s.numero}`).join(', ')}.`);
    }
    const { count } = await tx.entregaUmTerco.updateMany({ where: { id: entrega.id, status: 'EM_ANDAMENTO' }, data: { status: 'CONCLUIDA', concluidaEm: new Date(), updatedAt: new Date() } });
    if (count === 1) await registrarEvento(tx, entrega.id, 'CONCLUIDA', actor.id);
  }, { timeout: 15000 }).catch(async (error) => {
    if (error instanceof ConflitoVersaoError) {
      throw new ConflitoVersaoError(error.message, await montarDetalhe(prisma, await buscarCiclo(prisma, cicloId), actor.id, cargoId, { podeEditar: true }));
    }
    throw error;
  });
  res.json(await carregarParaProfessor(actor, cicloId, cargoId));
});
