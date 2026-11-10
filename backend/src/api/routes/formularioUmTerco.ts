import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ConflitoVersaoError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import {
  cicloEditavelAgora, dataLocalSp, exigirAberturaNaoPassada, paraDataIsoUtc, statusDoCiclo, TEXTO_SEMANA_MAX, validarCiclo, validarReabertura,
  type JanelaInstantes,
} from '../../domain/umTerco.js';

// Formulário 1/3 — registro dos conteúdos ensinados, por semana.
// Identidade do preenchimento: ciclo + professor + anoSerie + disciplina (EntregaUmTerco, única no
// banco). Escola/turma só dizem a quais vínculos ele vale (CoberturaEntregaUmTerco). Rede inteira e
// global (sem módulo por escola): vários ciclos por trimestre são permitidos, mas as janelas
// (abertura → prazo) nunca se sobrepõem; só entram turmas do Fundamental (anoSerie estruturado). Acesso: Secretaria (administra) e Professor
// (preenche o que é seu); nenhum outro perfil.
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
const chave = (professorId: number, anoSerie: number, disciplinaId: number) => `${professorId}:${anoSerie}:${disciplinaId}`;

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

// --- Vínculos elegíveis e cobertura ----------------------------------------------------------

type VinculoElegivel = Prisma.ProfessorTurmaDisciplinaGetPayload<{
  include: { turma: { include: { escola: true } }; professor: true; disciplina: true };
}>;

// Vínculos que pertencem ao Formulário 1/3 de um ciclo. Global: vale para TODAS as escolas (nada de
// módulo por escola nem lista de IDs) — basta ter turma do Fundamental com anoSerie, do ano letivo do
// ciclo. REGRA DE "ESPERADO": quem teve vínculo em algum momento DENTRO da janela do ciclo
// (abertura → prazo). Vínculo que só nasceu depois do prazo nunca entra retroativamente; vínculo que
// acabou depois do início da janela continua contando (histórico preservado).
// Escola/turma/professor "ativos" só são exigidos de vínculos ainda em andamento E de ciclos que não
// terminaram: depois do prazo o passado não é recalculado pelo estado de hoje.
// ESCOLAS (10/11/2026): ciclo com escolas escolhidas só considera turmas dessas escolas; "todas" = sem filtro.
async function vinculosElegiveis(db: Db, ciclo: { anoLetivo: number; abreEm: Date; prazoEm: Date } & EscopoEscolas, filtro: { professorId?: number; disciplinaId?: number; anoSerie?: number } = {}): Promise<VinculoElegivel[]> {
  const cicloEmCurso = ciclo.prazoEm.getTime() >= Date.now();
  const escolas = escolasDoCiclo(ciclo);
  const vinculos = await db.professorTurmaDisciplina.findMany({
    where: {
      ...(filtro.professorId ? { professorId: filtro.professorId } : {}),
      ...(filtro.disciplinaId ? { disciplinaId: filtro.disciplinaId } : {}),
      dataInicio: { lte: dataUtc(dataLocalSp(ciclo.prazoEm)) },
      OR: [{ status: 'ATIVO' }, { dataFim: { gte: dataUtc(dataLocalSp(ciclo.abreEm)) } }],
      professor: { perfil: 'PROFESSOR' },
      turma: { etapa: 'FUNDAMENTAL', anoSerie: filtro.anoSerie ?? { not: null }, anoLetivo: ciclo.anoLetivo, ...(escolas ? { escolaId: { in: escolas } } : {}) },
    },
    include: { turma: { include: { escola: true } }, professor: true, disciplina: true },
  });
  if (!cicloEmCurso) return vinculos;
  return vinculos.filter((v) => v.status === 'ENCERRADO' || (v.professor.status === 'ATIVO' && v.turma.status === 'ATIVA' && v.turma.escola.status === 'ATIVA'));
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

const apenasAtivos = (vinculos: VinculoElegivel[]) => vinculos.filter((v) => v.status === 'ATIVO');

const descreverVinculo = (v: VinculoElegivel) => ({ vinculoId: v.id, turmaId: v.turmaId, turmaNome: v.turma.nome, escolaId: v.turma.escolaId, escolaNome: v.turma.escola.nome });

async function registrarEvento(db: Db, entregaId: number, tipo: Prisma.HistoricoEntregaUmTercoUncheckedCreateInput['tipo'], pessoaId: number | null, detalhe?: Prisma.InputJsonValue) {
  await db.historicoEntregaUmTerco.create({ data: { entregaId, tipo, pessoaId, detalhe } });
}

// Mantém a cobertura da entrega alinhada aos vínculos reais: vínculo equivalente novo ganha uma
// linha (mesma entrega, nunca outra); vínculo perdido só ganha `ate` (o histórico fica).
async function sincronizarCobertura(db: Db, entrega: { id: number; cicloId: number; professorId: number; anoSerie: number; disciplinaId: number }, ciclo: { anoLetivo: number; abreEm: Date; prazoEm: Date } & EscopoEscolas, pessoaId: number | null) {
  const elegiveis = (await vinculosElegiveis(db, ciclo, { professorId: entrega.professorId, disciplinaId: entrega.disciplinaId, anoSerie: entrega.anoSerie }));
  const atuais = new Map(elegiveis.map((v) => [v.id, v]));
  const linhas = await db.coberturaEntregaUmTerco.findMany({ where: { entregaId: entrega.id } });
  const existentes = new Set(linhas.map((l) => l.vinculoId));

  for (const v of elegiveis) {
    if (existentes.has(v.id)) continue;
    // O período da cobertura é o do próprio vínculo (início real; fim só se já encerrou).
    await db.coberturaEntregaUmTerco.create({ data: { entregaId: entrega.id, vinculoId: v.id, turmaId: v.turmaId, escolaId: v.turma.escolaId, desde: v.dataInicio, ate: v.status === 'ENCERRADO' ? v.dataFim : null } });
    await registrarEvento(db, entrega.id, 'COBERTURA_ADICIONADA', pessoaId, { turma: v.turma.nome, escola: v.turma.escola.nome });
  }
  for (const linha of linhas) {
    const v = atuais.get(linha.vinculoId);
    const aindaVale = v && v.status === 'ATIVO';
    if (linha.ate === null && !aindaVale) {
      await db.coberturaEntregaUmTerco.update({ where: { id: linha.id }, data: { ate: v?.dataFim ?? new Date() } });
      await registrarEvento(db, entrega.id, 'COBERTURA_ENCERRADA', pessoaId, { turmaId: linha.turmaId });
    }
  }
}

// --- Montagem do detalhe de uma entrega (Professor e Secretaria) ---------------------------------

async function montarDetalhe(db: Db, ciclo: CicloCompleto, professorId: number, anoSerie: number, disciplinaId: number, opcoes: { podeEditar: boolean }) {
  const [entrega, disciplina, professor] = await Promise.all([
    db.entregaUmTerco.findUnique({
      where: { cicloId_professorId_anoSerie_disciplinaId: { cicloId: ciclo.id, professorId, anoSerie, disciplinaId } },
      include: {
        respostas: true,
        cobertura: { include: { turma: { include: { escola: true } } }, orderBy: { desde: 'asc' } },
        historico: { orderBy: { quando: 'asc' } },
      },
    }),
    db.disciplina.findUnique({ where: { id: disciplinaId } }),
    db.pessoa.findUnique({ where: { id: professorId }, select: { id: true, nome: true } }),
  ]);
  if (!disciplina || !professor) throw new NotFoundError('Formulário não encontrado.');

  const elegiveis = await vinculosElegiveis(db, ciclo, { professorId, disciplinaId, anoSerie });
  const ativos = apenasAtivos(elegiveis);
  if (!entrega && elegiveis.length === 0) throw new NotFoundError('Formulário não encontrado para este Professor.');

  const respostaPorSemana = new Map((entrega?.respostas ?? []).map((r) => [r.semanaId, r.texto]));
  const agora = new Date();
  const prazoAberto = ciclo.status === 'ATIVA' && cicloEditavelAgora(ciclo, janelasDe(ciclo), agora);
  return {
    ciclo: formatarCiclo(ciclo),
    professorId: professor.id,
    professorNome: professor.nome,
    anoSerie,
    disciplinaId,
    disciplinaNome: disciplina.nome,
    rotulo: `${anoSerie}º ano — ${disciplina.nome}`,
    entregaId: entrega?.id ?? null,
    status: entrega ? (entrega.status === 'CONCLUIDA' ? 'concluida' : 'em_andamento') : 'nao_iniciado',
    iniciadaEm: iso(entrega?.iniciadaEm ?? null),
    concluidaEm: iso(entrega?.concluidaEm ?? null),
    updatedAt: iso(entrega?.updatedAt ?? null),
    // Pode editar = prazo/reabertura aberto E ainda leciona (vínculo ativo equivalente).
    editavelAgora: opcoes.podeEditar && prazoAberto && ativos.length > 0,
    semanas: ciclo.semanas.map((s) => ({
      id: s.id, numero: s.numero, rotulo: `Semana ${s.numero}`, dataInicio: dataIso(s.dataInicio), dataFim: dataIso(s.dataFim),
      texto: respostaPorSemana.get(s.id) ?? '',
    })),
    validoPara: ativos.map(descreverVinculo),
    coberturaHistorica: (entrega?.cobertura ?? []).map((c) => ({
      turmaId: c.turmaId, turmaNome: c.turma.nome, escolaId: c.escolaId, escolaNome: c.turma.escola.nome, desde: iso(c.desde), ate: iso(c.ate),
    })),
    historico: (entrega?.historico ?? []).map((h) => ({ id: h.id, tipo: h.tipo, pessoaId: h.pessoaId, quando: iso(h.quando), detalhe: h.detalhe })),
  };
}

const paramsFormulario = (req: { params: Record<string, string | string[] | undefined> }) => ({
  cicloId: lerId(req.params.cicloId, 'Ciclo'),
  anoSerie: lerId(req.params.anoSerie, 'Ano/série'),
  disciplinaId: lerId(req.params.disciplinaId, 'Disciplina'),
});

// Professor só enxerga/edita o que é dele: precisa ter vínculo elegível OU entrega já existente.
async function carregarParaProfessor(actor: Actor, cicloId: number, anoSerie: number, disciplinaId: number) {
  exigirProfessor(actor);
  const ciclo = await buscarCiclo(prisma, cicloId);
  const detalhe = await montarDetalhe(prisma, ciclo, actor.id, anoSerie, disciplinaId, { podeEditar: true });
  return { ciclo, detalhe };
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
    if (dataLocalSp(valido.abreEm) !== dataLocalSp(atual.abreEm)) exigirAberturaNaoPassada(valido.abreEm);
    // Escolas: sem o campo, mantém as que o ciclo já tem (cliente antigo da API não apaga a escolha).
    const escolha = dados.todasEscolas === undefined
      ? { todasEscolas: atual.todasEscolas, escolaIds: atual.escolas.map((e) => e.escolaId) }
      : await validarEscolas(tx, dados, atual.escolas.map((e) => e.escolaId));
    // Escola com preenchimento iniciado neste ciclo não pode sair (o texto escrito ficaria órfão).
    if (!escolha.todasEscolas) {
      const emUso = await tx.coberturaEntregaUmTerco.findMany({
        where: { entrega: { cicloId: id }, escolaId: { notIn: escolha.escolaIds } },
        select: { escola: { select: { nome: true } } }, distinct: ['escolaId'],
      });
      if (emUso.length) throw new ConflictError(`Não é possível retirar ${emUso.map((e) => `"${e.escola.nome}"`).join(', ')}: já há Professor preenchendo este Formulário 1/3 nessa escola.`);
    }
    if (atual.status === 'ATIVA') await exigirJanelaLivre(tx, { ...valido, todasEscolas: escolha.todasEscolas, escolas: escolha.escolaIds.map((escolaId) => ({ escolaId })) }, id);

    await tx.cicloUmTerco.update({ where: { id }, data: { anoLetivo: valido.anoLetivo, trimestre: valido.trimestre, titulo: valido.titulo, abreEm: valido.abreEm, prazoEm: valido.prazoEm, todasEscolas: escolha.todasEscolas, updatedBy: String(actor.id) } });
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
  if (await prisma.entregaUmTerco.count({ where: { cicloId: id } }) > 0) throw new ConflictError('Este ciclo já tem preenchimentos e não pode ser inativado.');
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

// Cálculo do painel (esperado/concluído/andamento/não iniciado, por entrega e por escola) com os
// filtros da tela. Compartilhado pelo painel e pela exportação para Excel — mesmos números.
async function montarPainel(cicloId: number, q: Record<string, unknown>) {
  const ciclo = await buscarCiclo(prisma, cicloId);
  const filtroEscola = q.escolaId ? lerId(q.escolaId, 'Escola') : null;
  const filtroSerie = q.anoSerie ? lerId(q.anoSerie, 'Ano/série') : null;
  const filtroDisciplina = q.disciplinaId ? lerId(q.disciplinaId, 'Disciplina') : null;
  const filtroProfessor = q.professorId ? lerId(q.professorId, 'Professor') : null;
  const filtroStatus = typeof q.status === 'string' && ['nao_iniciado', 'em_andamento', 'concluida'].includes(q.status) ? q.status : null;

  const [elegiveis, entregas] = await Promise.all([
    vinculosElegiveis(prisma, ciclo),
    prisma.entregaUmTerco.findMany({
      where: { cicloId: ciclo.id },
      include: { respostas: true, professor: { select: { id: true, nome: true } }, disciplina: true, cobertura: { include: { turma: { include: { escola: true } } } } },
    }),
  ]);

  // Unidade = professor+anoSerie+disciplina. Esperado vem dos vínculos; entregas já existentes
  // entram sempre (histórico), mesmo que o vínculo tenha acabado depois.
  type Linha = {
    chave: string; professorId: number; professorNome: string; anoSerie: number; disciplinaId: number; disciplinaNome: string;
    turmas: Map<number, { turmaId: number; turmaNome: string; escolaId: number; escolaNome: string }>;
    entrega: (typeof entregas)[number] | null;
  };
  const linhas = new Map<string, Linha>();
  for (const v of elegiveis) {
    const k = chave(v.professorId, v.turma.anoSerie!, v.disciplinaId);
    const linha = linhas.get(k) ?? { chave: k, professorId: v.professorId, professorNome: v.professor.nome, anoSerie: v.turma.anoSerie!, disciplinaId: v.disciplinaId, disciplinaNome: v.disciplina.nome, turmas: new Map(), entrega: null };
    linha.turmas.set(v.turmaId, { turmaId: v.turmaId, turmaNome: v.turma.nome, escolaId: v.turma.escolaId, escolaNome: v.turma.escola.nome });
    linhas.set(k, linha);
  }
  for (const e of entregas) {
    const k = chave(e.professorId, e.anoSerie, e.disciplinaId);
    const linha = linhas.get(k) ?? { chave: k, professorId: e.professorId, professorNome: e.professor.nome, anoSerie: e.anoSerie, disciplinaId: e.disciplinaId, disciplinaNome: e.disciplina.nome, turmas: new Map(), entrega: null };
    linha.entrega = e;
    for (const c of e.cobertura) {
      if (!linha.turmas.has(c.turmaId)) linha.turmas.set(c.turmaId, { turmaId: c.turmaId, turmaNome: c.turma.nome, escolaId: c.escolaId, escolaNome: c.turma.escola.nome });
    }
    linhas.set(k, linha);
  }

  const totalSemanas = ciclo.semanas.length;
  const todas = [...linhas.values()].map((l) => {
    const status = l.entrega ? (l.entrega.status === 'CONCLUIDA' ? 'concluida' : 'em_andamento') : 'nao_iniciado';
    const preenchidas = l.entrega ? l.entrega.respostas.filter((r) => r.texto.trim().length > 0).length : 0;
    const turmas = [...l.turmas.values()].sort((a, b) => a.escolaNome.localeCompare(b.escolaNome) || a.turmaNome.localeCompare(b.turmaNome));
    return {
      professorId: l.professorId, professorNome: l.professorNome, anoSerie: l.anoSerie, disciplinaId: l.disciplinaId, disciplinaNome: l.disciplinaNome,
      entregaId: l.entrega?.id ?? null, status, semanasPreenchidas: preenchidas, totalSemanas,
      concluidaEm: iso(l.entrega?.concluidaEm ?? null), atualizadoEm: iso(l.entrega?.updatedAt ?? null),
      turmas,
    };
  }).filter((l) => (!filtroEscola || l.turmas.some((t) => t.escolaId === filtroEscola))
    && (!filtroSerie || l.anoSerie === filtroSerie)
    && (!filtroDisciplina || l.disciplinaId === filtroDisciplina)
    && (!filtroProfessor || l.professorId === filtroProfessor)
    && (!filtroStatus || l.status === filtroStatus))
    .sort((a, b) => a.professorNome.localeCompare(b.professorNome) || a.anoSerie - b.anoSerie || a.disciplinaNome.localeCompare(b.disciplinaNome));

  // Total é por entrega ÚNICA (nunca multiplica por escola/turma).
  const esperado = todas.length;
  const concluidas = todas.filter((l) => l.status === 'concluida').length;
  const emAndamento = todas.filter((l) => l.status === 'em_andamento').length;
  const naoIniciadas = todas.filter((l) => l.status === 'nao_iniciado').length;

  // Cobertura por escola: uma mesma entrega aparece em cada escola que ela atinge — é visão de
  // cobertura, NÃO soma ao total acima.
  const porEscola = new Map<number, { escolaId: number; escolaNome: string; esperado: number; concluidas: number }>();
  for (const l of todas) {
    for (const escola of new Map(l.turmas.map((t) => [t.escolaId, t.escolaNome])).entries()) {
      const item = porEscola.get(escola[0]) ?? { escolaId: escola[0], escolaNome: escola[1], esperado: 0, concluidas: 0 };
      item.esperado += 1;
      if (l.status === 'concluida') item.concluidas += 1;
      porEscola.set(escola[0], item);
    }
  }

  return {
    ciclo: formatarCiclo(ciclo),
    resumo: { esperado, concluidas, emAndamento, naoIniciadas, percentualEntrega: esperado ? Math.round((concluidas / esperado) * 100) : 0 },
    porEscola: [...porEscola.values()].sort((a, b) => a.escolaNome.localeCompare(b.escolaNome)),
    linhas: todas,
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
      entregaId: r.entregaId, professorNome: l.professorNome, anoSerie: l.anoSerie, disciplinaNome: l.disciplinaNome,
      semanaNumero: r.semana.numero, semanaInicio: dataIso(r.semana.dataInicio), semanaFim: dataIso(r.semana.dataFim), texto: r.texto,
    };
  });
  res.json({ ...painel, conteudos });
});

// Secretaria consulta um preenchimento específico (somente leitura, com histórico).
formularioUmTercoRouter.get('/ciclos/:cicloId/entregas/:professorId/:anoSerie/:disciplinaId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const { cicloId, anoSerie, disciplinaId } = paramsFormulario(req);
  const ciclo = await buscarCiclo(prisma, cicloId);
  res.json(await montarDetalhe(prisma, ciclo, lerId(req.params.professorId, 'Professor'), anoSerie, disciplinaId, { podeEditar: false }));
});

// ===== Professor ===============================================================================

// Lista os formulários do Professor logado: um por ciclo + anoSerie + disciplina (nunca por turma).
formularioUmTercoRouter.get('/minhas', async (_req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirProfessor(actor);
  const ciclos = await prisma.cicloUmTerco.findMany({ where: { status: 'ATIVA' }, include: cicloInclude, orderBy: [{ anoLetivo: 'desc' }, { trimestre: 'desc' }] });
  const itens: unknown[] = [];
  for (const ciclo of ciclos) {
    const [elegiveis, entregas] = await Promise.all([
      vinculosElegiveis(prisma, ciclo, { professorId: actor.id }),
      prisma.entregaUmTerco.findMany({ where: { cicloId: ciclo.id, professorId: actor.id }, include: { respostas: true, disciplina: true } }),
    ]);
    const ativos = apenasAtivos(elegiveis);
    const grupos = new Map<string, { anoSerie: number; disciplinaId: number; disciplinaNome: string; turmas: ReturnType<typeof descreverVinculo>[] }>();
    for (const v of ativos) {
      const k = chave(actor.id, v.turma.anoSerie!, v.disciplinaId);
      const g = grupos.get(k) ?? { anoSerie: v.turma.anoSerie!, disciplinaId: v.disciplinaId, disciplinaNome: v.disciplina.nome, turmas: [] };
      g.turmas.push(descreverVinculo(v));
      grupos.set(k, g);
    }
    for (const e of entregas) {
      const k = chave(actor.id, e.anoSerie, e.disciplinaId);
      if (!grupos.has(k)) grupos.set(k, { anoSerie: e.anoSerie, disciplinaId: e.disciplinaId, disciplinaNome: e.disciplina.nome, turmas: [] });
    }
    const resumoCiclo = formatarCiclo(ciclo);
    for (const [k, g] of grupos) {
      const e = entregas.find((x) => chave(actor.id, x.anoSerie, x.disciplinaId) === k);
      itens.push({
        ciclo: { id: ciclo.id, titulo: ciclo.titulo, anoLetivo: ciclo.anoLetivo, trimestre: ciclo.trimestre, abreEm: resumoCiclo.abreEm, prazoEm: resumoCiclo.prazoEm, statusPrazo: resumoCiclo.statusPrazo, editavelAgora: resumoCiclo.editavelAgora },
        anoSerie: g.anoSerie, disciplinaId: g.disciplinaId, disciplinaNome: g.disciplinaNome, rotulo: `${g.anoSerie}º ano — ${g.disciplinaNome}`,
        status: e ? (e.status === 'CONCLUIDA' ? 'concluida' : 'em_andamento') : 'nao_iniciado',
        semanasPreenchidas: e ? e.respostas.filter((r) => r.texto.trim().length > 0).length : 0,
        totalSemanas: ciclo.semanas.length,
        validoPara: g.turmas,
        editavelAgora: resumoCiclo.editavelAgora && g.turmas.length > 0,
      });
    }
  }
  res.json(itens);
});

formularioUmTercoRouter.get('/ciclos/:cicloId/formularios/:anoSerie/:disciplinaId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const { cicloId, anoSerie, disciplinaId } = paramsFormulario(req);
  const { detalhe } = await carregarParaProfessor(actor, cicloId, anoSerie, disciplinaId);
  res.json(detalhe);
});

const respostasSchema = z.object({
  // updatedAt que o cliente tinha da entrega (null = ainda não existia). Se mudou, 409.
  baseUpdatedAt: z.string().nullish(),
  respostas: z.array(z.object({ semanaId: z.number().int(), texto: z.string().max(TEXTO_SEMANA_MAX, `Cada semana aceita no máximo ${TEXTO_SEMANA_MAX} caracteres.`) })).min(1),
});

async function exigirEditavel(tx: Db, ciclo: CicloCompleto, professorId: number, anoSerie: number, disciplinaId: number) {
  if (ciclo.status !== 'ATIVA') throw new ValidationError('Este Formulário 1/3 foi inativado.');
  if (!cicloEditavelAgora(ciclo, janelasDe(ciclo), new Date())) throw new ValidationError('O prazo deste Formulário 1/3 terminou — ele está somente para leitura. Peça à Secretaria uma reabertura.');
  const ativos = apenasAtivos(await vinculosElegiveis(tx, ciclo, { professorId, disciplinaId, anoSerie }));
  if (ativos.length === 0) throw new ForbiddenError('Você não tem vínculo ativo com esta disciplina neste ano/série.');
}

const tokenIgual = (base: string | null | undefined, atual: Date | null) => (base ? new Date(base).getTime() === (atual?.getTime() ?? -1) : atual === null);

formularioUmTercoRouter.put('/ciclos/:cicloId/formularios/:anoSerie/:disciplinaId/respostas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirProfessor(actor);
  const { cicloId, anoSerie, disciplinaId } = paramsFormulario(req);
  const dados = respostasSchema.parse(req.body);

  const conflito = async () => {
    const ciclo = await buscarCiclo(prisma, cicloId);
    return montarDetalhe(prisma, ciclo, actor.id, anoSerie, disciplinaId, { podeEditar: true });
  };

  try {
    await prisma.$transaction(async (tx) => {
      const ciclo = await buscarCiclo(tx, cicloId);
      await exigirEditavel(tx, ciclo, actor.id, anoSerie, disciplinaId);
      const semanasValidas = new Set(ciclo.semanas.map((s) => s.id));
      if (dados.respostas.some((r) => !semanasValidas.has(r.semanaId))) throw new ValidationError('Semana não pertence a este ciclo.');

      // Serializa gravações da mesma entrega (duas abas / duplo clique) sem depender de timing.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`um-terco-entrega:${cicloId}:${actor.id}:${anoSerie}:${disciplinaId}`}::text))`;
      let entrega = await tx.entregaUmTerco.findUnique({ where: { cicloId_professorId_anoSerie_disciplinaId: { cicloId, professorId: actor.id, anoSerie, disciplinaId } } });
      if (entrega) {
        if (!tokenIgual(dados.baseUpdatedAt, entrega.updatedAt)) throw new ConflitoVersaoError('Este formulário foi alterado em outra aba ou dispositivo. Suas alterações foram guardadas.', null);
      } else {
        if (dados.baseUpdatedAt) throw new ConflitoVersaoError('Este formulário foi alterado em outra aba ou dispositivo. Suas alterações foram guardadas.', null);
        entrega = await tx.entregaUmTerco.create({ data: { cicloId, professorId: actor.id, anoSerie, disciplinaId } });
        await registrarEvento(tx, entrega.id, 'INICIADA', actor.id);
      }

      for (const r of dados.respostas) {
        await tx.respostaSemanaUmTerco.upsert({
          where: { entregaId_semanaId: { entregaId: entrega.id, semanaId: r.semanaId } },
          create: { entregaId: entrega.id, semanaId: r.semanaId, texto: r.texto },
          update: { texto: r.texto },
        });
      }
      await sincronizarCobertura(tx, entrega, ciclo, actor.id);
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
    // Duas abas criando a MESMA entrega ao mesmo tempo: o índice único segura; o perdedor recebe 409.
    if (ehConflitoUnico(error)) throw new ConflitoVersaoError('Este formulário acabou de ser iniciado em outra aba. Suas alterações foram guardadas.', await conflito());
    throw error;
  }
  res.json((await carregarParaProfessor(actor, cicloId, anoSerie, disciplinaId)).detalhe);
});

const concluirSchema = z.object({ baseUpdatedAt: z.string().nullish() });

formularioUmTercoRouter.post('/ciclos/:cicloId/formularios/:anoSerie/:disciplinaId/concluir', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirProfessor(actor);
  const { cicloId, anoSerie, disciplinaId } = paramsFormulario(req);
  const dados = concluirSchema.parse(req.body ?? {});

  await prisma.$transaction(async (tx) => {
    const ciclo = await buscarCiclo(tx, cicloId);
    await exigirEditavel(tx, ciclo, actor.id, anoSerie, disciplinaId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`um-terco-entrega:${cicloId}:${actor.id}:${anoSerie}:${disciplinaId}`}::text))`;
    const entrega = await tx.entregaUmTerco.findUnique({
      where: { cicloId_professorId_anoSerie_disciplinaId: { cicloId, professorId: actor.id, anoSerie, disciplinaId } },
      include: { respostas: true },
    });
    if (!entrega) throw new ValidationError('Preencha as semanas antes de concluir.');
    // Duplo clique: já concluída -> resposta idempotente, sem novo evento.
    if (entrega.status === 'CONCLUIDA') return;
    if (dados.baseUpdatedAt !== undefined && dados.baseUpdatedAt !== null && !tokenIgual(dados.baseUpdatedAt, entrega.updatedAt)) {
      throw new ConflitoVersaoError('Este formulário foi alterado em outra aba ou dispositivo.', null);
    }
    const textos = new Map(entrega.respostas.map((r) => [r.semanaId, r.texto.trim()]));
    const faltando = ciclo.semanas.filter((s) => !textos.get(s.id));
    if (faltando.length > 0) {
      throw new ValidationError(`Preencha todas as semanas antes de concluir. Faltam: ${faltando.map((s) => `Semana ${s.numero}`).join(', ')}.`);
    }
    await sincronizarCobertura(tx, entrega, ciclo, actor.id);
    const { count } = await tx.entregaUmTerco.updateMany({ where: { id: entrega.id, status: 'EM_ANDAMENTO' }, data: { status: 'CONCLUIDA', concluidaEm: new Date(), updatedAt: new Date() } });
    if (count === 1) await registrarEvento(tx, entrega.id, 'CONCLUIDA', actor.id);
  }, { timeout: 15000 }).catch(async (error) => {
    if (error instanceof ConflitoVersaoError) {
      const ciclo = await buscarCiclo(prisma, cicloId);
      throw new ConflitoVersaoError(error.message, await montarDetalhe(prisma, ciclo, actor.id, anoSerie, disciplinaId, { podeEditar: true }));
    }
    throw error;
  });
  res.json((await carregarParaProfessor(actor, cicloId, anoSerie, disciplinaId)).detalhe);
});
