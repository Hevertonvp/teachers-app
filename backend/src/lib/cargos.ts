// Cargos do Professor — acesso ao banco (decisão do usuário, 12/11/2026). Regras puras em
// domain/cargos.ts. Usado pelas rotas de cargo (routes/cargos.ts) e pelo cadastro de Professor
// (routes/pessoas.ts), sempre dentro de uma transação.
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.js';
import { dataIsoValida, dataLocalSp } from '../domain/umTerco.js';
import { canonica, chaveComposicao, lerComposicao, MAX_CARGOS_ATIVOS, rotulosDosCargos, validarComposicao, type Composicao } from '../domain/cargos.js';

type Db = Prisma.TransactionClient | typeof prisma;

const hojeSp = () => dataLocalSp(new Date());
const dataUtc = (s: string) => new Date(`${s}T00:00:00Z`);
const formatarDataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// Serializa as gravações de cargo do mesmo Professor (duas abas criando o 3º cargo ao mesmo tempo).
// Vínculos escolares de uma pessoa são criados/reativados em fila (bateria do 1/3, 12/11/2026): duas requisições
// simultâneas (clique duplo, duas abas, cargo + janela Escolas) nunca criam dois vínculos ATIVOS na mesma escola.
export const travarVinculosEscolares = (tx: Db, pessoaId: number) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`vinculos-escolares:${pessoaId}`}::text))`;

export const travarCargosDoProfessor = (tx: Db, professorId: number) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cargos-professor:${professorId}`}::text))`;

export function lerData(valor: unknown, rotulo: string): string {
  if (!dataIsoValida(valor)) throw new ValidationError(`${rotulo}: informe uma data válida.`);
  return valor;
}

// Escolas ATIVAS, disciplinas e atuações pedagógicas ATIVAS, para validar e para mostrar nomes. Escola ou
// atuação inativa que o cargo JÁ tem continua aceita (`incluir…`): desativar no catálogo não invalida cargos.
export async function nomesParaComposicao(db: Db, incluirEscolaIds: number[] = [], incluirAtuacaoIds: number[] = []) {
  const [escolas, disciplinas, atuacoes] = await Promise.all([
    db.escola.findMany({ where: { OR: [{ status: 'ATIVA' }, { id: { in: incluirEscolaIds } }] }, select: { id: true, nome: true } }),
    db.disciplina.findMany({ select: { id: true, nome: true } }),
    db.atuacaoPedagogica.findMany({ where: { OR: [{ status: 'ATIVA' }, { id: { in: incluirAtuacaoIds } }] }, select: { id: true, nome: true } }),
  ]);
  const escola = new Map(escolas.map((e) => [e.id, e.nome]));
  const disciplina = new Map(disciplinas.map((d) => [d.id, d.nome]));
  const atuacao = new Map(atuacoes.map((a) => [a.id, a.nome]));
  return { escola: (id: number) => escola.get(id), disciplina: (id: number) => disciplina.get(id), atuacao: (id: number) => atuacao.get(id) };
}

export async function validarComposicaoNoBanco(db: Db, entrada: unknown, jaNoCargo: Composicao = []): Promise<Composicao> {
  return validarComposicao(entrada, await nomesParaComposicao(db, jaNoCargo.map((i) => i.escolaId), jaNoCargo.flatMap((i) => i.atuacaoIds)));
}

// Escola adicionada a um cargo garante VinculoEscolar ATIVO (reusa o existente; nunca duplica).
// MUDOU em 13/11/2026 (decisão do usuário): a escola do Professor vem do cargo. Tirar a escola do cargo ou
// encerrar o cargo tira o Professor da escola (e das turmas lá) — ver `saidasDoCargo`/`encerrarSaidas`.
export async function garantirVinculosEscolares(tx: Db, professorId: number, escolaIds: number[], autorId: number) {
  await travarVinculosEscolares(tx, professorId);
  const ativos = await tx.vinculoEscolar.findMany({ where: { pessoaId: professorId, status: 'ATIVO', escolaId: { in: escolaIds } }, select: { escolaId: true } });
  const jaTem = new Set(ativos.map((v) => v.escolaId));
  for (const escolaId of new Set(escolaIds)) {
    if (jaTem.has(escolaId)) continue;
    await tx.vinculoEscolar.create({ data: { escolaId, pessoaId: professorId, status: 'ATIVO', dataInicio: diaDeHojeSp(), createdBy: String(autorId) } });
    await tx.pessoaEvento.create({ data: { pessoaId: professorId, tipo: 'VINCULO_CRIADO', autorId, detalhe: `Escola #${escolaId} (cargo)` } });
  }
}

// Escolas que o Professor PERDE se o cargo `cargoId` passar a ter `novaComposicao` (null = cargo encerrado):
// estavam neste cargo e não ficam em nenhum cargo ativo. Escola que continua no outro cargo não sai.
// Devolve nome e turmas ativas do Professor lá, para o aviso antes de confirmar (decisão do usuário, 13/11/2026).
export async function saidasDoCargo(db: Db, professorId: number, cargoId: number, novaComposicao: Composicao | null) {
  const ativos = await db.cargoProfessor.findMany({ where: { professorId, status: 'ATIVO' }, include: { versoes: { orderBy: { criadaEm: 'desc' }, take: 1 } } });
  const ficam = new Set<number>();
  let doCargo: number[] = [];
  for (const c of ativos) {
    const atual = lerComposicao(c.versoes[0]?.composicao);
    if (c.id === cargoId) doCargo = atual.map((i) => i.escolaId);
    for (const i of (c.id === cargoId ? (novaComposicao ?? []) : atual)) ficam.add(i.escolaId);
  }
  const saem = [...new Set(doCargo)].filter((id) => !ficam.has(id));
  if (saem.length === 0) return [];
  const [escolas, turmas] = await Promise.all([
    db.escola.findMany({ where: { id: { in: saem } }, select: { id: true, nome: true } }),
    db.professorTurmaDisciplina.findMany({
      where: { professorId, status: 'ATIVO', turma: { escolaId: { in: saem } } },
      select: { turma: { select: { escolaId: true, nome: true } }, disciplina: { select: { nome: true } } },
    }),
  ]);
  const nome = new Map(escolas.map((e) => [e.id, e.nome]));
  return saem
    .map((escolaId) => ({
      escolaId,
      escolaNome: nome.get(escolaId) ?? '—',
      turmas: turmas.filter((t) => t.turma.escolaId === escolaId).map((t) => ({ turma: t.turma.nome, disciplina: t.disciplina.nome })),
    }))
    .sort((a, b) => a.escolaNome.localeCompare(b.escolaNome, 'pt-BR'));
}

type Saidas = Awaited<ReturnType<typeof saidasDoCargo>>;

const descreverSaidas = (saidas: Saidas) => saidas
  .map((s) => `${s.escolaNome}${s.turmas.length ? ` (e ${s.turmas.length} ${s.turmas.length === 1 ? 'turma' : 'turmas'} lá)` : ''}`)
  .join('; ');

// Encerra os vínculos escolares e as turmas do Professor nas escolas que saíram. A data nunca fica antes do
// início de cada registro (cargo encerrado com data retroativa). Sem confirmação explícita, recusa (409):
// nada sai em silêncio — qualquer cliente da API precisa confirmar.
async function encerrarSaidas(tx: Db, professorId: number, saidas: Saidas, dataFim: Date, confirmado: boolean | undefined) {
  if (saidas.length === 0) return;
  if (!confirmado) throw new ConflictError(`Ao salvar, o Professor sai de: ${descreverSaidas(saidas)}. Confirme para continuar.`);
  await travarVinculosEscolares(tx, professorId);
  const escolaIds = saidas.map((s) => s.escolaId);
  const vinculos = await tx.vinculoEscolar.findMany({ where: { pessoaId: professorId, status: 'ATIVO', escolaId: { in: escolaIds } } });
  for (const v of vinculos) {
    await tx.vinculoEscolar.update({ where: { id: v.id }, data: { status: 'ENCERRADO', dataFim: v.dataInicio > dataFim ? v.dataInicio : dataFim } });
  }
  const turmas = await tx.professorTurmaDisciplina.findMany({ where: { professorId, status: 'ATIVO', turma: { escolaId: { in: escolaIds } } } });
  for (const t of turmas) {
    await tx.professorTurmaDisciplina.update({ where: { id: t.id }, data: { status: 'ENCERRADO', dataFim: t.dataInicio > dataFim ? t.dataInicio : dataFim } });
  }
}

// Janela do "envio duplicado": o mesmo autor cadastrando o MESMO cargo (mesma composição e início) no mesmo
// Professor em poucos segundos é clique duplo/duas abas, não um segundo cargo (bateria do 1/3, 12/11/2026).
const JANELA_ENVIO_DUPLICADO_MS = 15_000;

export async function criarCargo(tx: Db, professorId: number, dados: { dataInicio: string; composicao: Composicao }, autorId: number, opcoes: { recusarEnvioDuplicado?: boolean } = {}) {
  await travarCargosDoProfessor(tx, professorId);
  const ativos = await tx.cargoProfessor.findMany({ where: { professorId, status: 'ATIVO' }, include: { versoes: { orderBy: { criadaEm: 'desc' }, take: 1 } } });
  if (ativos.length >= MAX_CARGOS_ATIVOS) throw new ConflictError(`Este Professor já tem ${MAX_CARGOS_ATIVOS} cargos ativos. Encerre um deles antes de cadastrar outro.`);
  const agora = new Date();
  if (opcoes.recusarEnvioDuplicado) {
    const chave = chaveComposicao(dados.composicao);
    const duplicado = ativos.find((c) => c.createdBy === String(autorId) && agora.getTime() - c.createdAt.getTime() < JANELA_ENVIO_DUPLICADO_MS
      && c.dataInicio.toISOString().slice(0, 10) === dados.dataInicio && chaveComposicao(lerComposicao(c.versoes[0]?.composicao)) === chave);
    if (duplicado) throw new ConflictError('Este cargo acabou de ser cadastrado (o envio chegou duas vezes). Atualize a tela. Para cadastrar um segundo cargo igual de propósito, aguarde alguns segundos e cadastre de novo.');
  }
  const cargo = await tx.cargoProfessor.create({
    data: {
      professorId, status: 'ATIVO', dataInicio: dataUtc(dados.dataInicio), createdAt: agora, createdBy: String(autorId),
      // A primeira versão vale desde o cadastro (mesmo instante), nunca antes.
      versoes: { create: { criadaEm: agora, criadaPor: String(autorId), composicao: canonica(dados.composicao) as unknown as Prisma.InputJsonValue } },
    },
  });
  await garantirVinculosEscolares(tx, professorId, dados.composicao.map((i) => i.escolaId), autorId);
  return cargo;
}

// Altera um cargo ATIVO. Composição diferente da atual = nova versão (vale para os próximos ciclos;
// ciclo já aberto continua com a versão da abertura). Início pode ser corrigido.
export async function alterarCargo(tx: Db, professorId: number, cargoId: number, dados: { dataInicio?: string; composicao?: unknown; baseUpdatedAt?: string | null; confirmarSaida?: boolean }, autorId: number) {
  await travarCargosDoProfessor(tx, professorId);
  const cargo = await tx.cargoProfessor.findFirst({ where: { id: cargoId, professorId }, include: { versoes: { orderBy: { criadaEm: 'desc' }, take: 1 } } });
  if (!cargo) throw new NotFoundError('Cargo não encontrado.');
  if (cargo.status !== 'ATIVO') throw new ConflictError('Cargo encerrado não pode ser alterado.');
  if (dados.baseUpdatedAt && new Date(dados.baseUpdatedAt).getTime() !== cargo.updatedAt.getTime()) {
    throw new ConflictError('Este cargo foi alterado por outra pessoa enquanto você editava. Feche e abra de novo para ver a versão atual.');
  }
  const atual = lerComposicao(cargo.versoes[0]?.composicao);
  const data: Prisma.CargoProfessorUpdateInput = { updatedBy: String(autorId), updatedAt: new Date() };
  if (dados.dataInicio !== undefined) {
    const inicio = lerData(dados.dataInicio, 'Início do cargo');
    if (cargo.dataFim && inicio > cargo.dataFim.toISOString().slice(0, 10)) throw new ValidationError('O início não pode ser depois do encerramento.');
    data.dataInicio = dataUtc(inicio);
  }
  if (dados.composicao !== undefined) {
    const nova = await validarComposicaoNoBanco(tx, dados.composicao, atual);
    if (chaveComposicao(nova) !== chaveComposicao(atual)) {
      await encerrarSaidas(tx, professorId, await saidasDoCargo(tx, professorId, cargoId, nova), diaDeHojeSp(), dados.confirmarSaida);
      await tx.cargoVersao.create({ data: { cargoId, criadaPor: String(autorId), composicao: nova as unknown as Prisma.InputJsonValue } });
      await garantirVinculosEscolares(tx, professorId, nova.map((i) => i.escolaId), autorId);
    }
  }
  return tx.cargoProfessor.update({ where: { id: cargoId }, data });
}

// Encerrar (nunca apagar). Data real informada pela Secretaria: entre o início e hoje.
export async function encerrarCargo(tx: Db, professorId: number, cargoId: number, dataFimTexto: string, autorId: number, confirmarSaida?: boolean) {
  await travarCargosDoProfessor(tx, professorId);
  const cargo = await tx.cargoProfessor.findFirst({ where: { id: cargoId, professorId } });
  if (!cargo) throw new NotFoundError('Cargo não encontrado.');
  if (cargo.status !== 'ATIVO') throw new ConflictError('Este cargo já está encerrado.');
  const dataFim = lerData(dataFimTexto, 'Data de encerramento');
  const inicio = cargo.dataInicio.toISOString().slice(0, 10);
  if (dataFim < inicio) throw new ValidationError(`O encerramento não pode ser antes do início do cargo (${formatarDataBr(inicio)}).`);
  if (dataFim > hojeSp()) throw new ValidationError('O encerramento não pode ser numa data futura. Encerre no dia em que o Professor deixar o cargo.');
  // Encerrar o cargo tira o Professor das escolas DESSE cargo (exceto as que continuam no outro), na data do encerramento.
  await encerrarSaidas(tx, professorId, await saidasDoCargo(tx, professorId, cargoId, null), dataUtc(dataFim), confirmarSaida);
  return tx.cargoProfessor.update({ where: { id: cargoId }, data: { status: 'ENCERRADO', dataFim: dataUtc(dataFim), encerradoEm: new Date(), encerradoPor: String(autorId), updatedBy: String(autorId) } });
}

// Formato de tela: rótulo "Cargo N" (só visual), datas e composição com nomes. Sem turmas, sem séries.
export async function listarCargosFormatados(db: Db, professorId: number, opcoes: { incluirEncerrados?: boolean } = {}) {
  const cargos = await db.cargoProfessor.findMany({
    where: { professorId },
    include: { versoes: { orderBy: { criadaEm: 'desc' }, take: 1 } },
    orderBy: [{ dataInicio: 'asc' }, { id: 'asc' }],
  });
  const rotulos = rotulosDosCargos(cargos);
  const composicoes = cargos.map((c) => lerComposicao(c.versoes[0]?.composicao));
  const nomes = await nomesParaComposicao(db, composicoes.flatMap((c) => c.map((i) => i.escolaId)), composicoes.flatMap((c) => c.flatMap((i) => i.atuacaoIds)));
  return cargos
    .map((c, i) => ({
      id: c.id,
      rotulo: rotulos.get(c.id),
      status: c.status === 'ATIVO' ? 'ativo' : 'encerrado',
      dataInicio: c.dataInicio.toISOString().slice(0, 10),
      dataFim: c.dataFim ? c.dataFim.toISOString().slice(0, 10) : null,
      updatedAt: c.updatedAt.toISOString(),
      composicao: composicoes[i].map((item) => ({
        escolaId: item.escolaId,
        escolaNome: nomes.escola(item.escolaId) ?? '—',
        disciplinas: item.disciplinaIds.map((id) => ({ id, nome: nomes.disciplina(id) ?? '—' })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        atuacoes: item.atuacaoIds.map((id) => ({ id, nome: nomes.atuacao(id) ?? '—' })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      })).sort((a, b) => a.escolaNome.localeCompare(b.escolaNome, 'pt-BR')),
    }))
    .filter((c) => opcoes.incluirEncerrados || c.status === 'ativo');
}

export { hojeSp };

// "Hoje" para colunas só-data (@db.Date), no dia de SÃO PAULO (bateria do 1/3, 12/11/2026): `new Date()` gravava o
// dia UTC, que entre 21:00 e 23:59 de Brasília já é o dia seguinte.
export const diaDeHojeSp = () => dataUtc(hojeSp());
