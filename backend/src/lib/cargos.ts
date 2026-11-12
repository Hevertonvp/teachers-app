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
export const travarCargosDoProfessor = (tx: Db, professorId: number) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cargos-professor:${professorId}`}::text))`;

export function lerData(valor: unknown, rotulo: string): string {
  if (!dataIsoValida(valor)) throw new ValidationError(`${rotulo}: informe uma data válida.`);
  return valor;
}

// Escolas ATIVAS e disciplinas existentes, para validar e para mostrar nomes.
export async function nomesParaComposicao(db: Db, incluirEscolaIds: number[] = []) {
  const [escolas, disciplinas] = await Promise.all([
    db.escola.findMany({ where: { OR: [{ status: 'ATIVA' }, { id: { in: incluirEscolaIds } }] }, select: { id: true, nome: true } }),
    db.disciplina.findMany({ select: { id: true, nome: true } }),
  ]);
  const escola = new Map(escolas.map((e) => [e.id, e.nome]));
  const disciplina = new Map(disciplinas.map((d) => [d.id, d.nome]));
  return { escola: (id: number) => escola.get(id), disciplina: (id: number) => disciplina.get(id) };
}

export async function validarComposicaoNoBanco(db: Db, entrada: unknown, jaNoCargo: number[] = []): Promise<Composicao> {
  return validarComposicao(entrada, await nomesParaComposicao(db, jaNoCargo));
}

// Escola adicionada a um cargo garante VinculoEscolar ATIVO (reusa o existente; nunca duplica).
// Remover escola de um cargo NUNCA encerra vínculo (decisão do usuário).
export async function garantirVinculosEscolares(tx: Db, professorId: number, escolaIds: number[], autorId: number) {
  const ativos = await tx.vinculoEscolar.findMany({ where: { pessoaId: professorId, status: 'ATIVO', escolaId: { in: escolaIds } }, select: { escolaId: true } });
  const jaTem = new Set(ativos.map((v) => v.escolaId));
  for (const escolaId of new Set(escolaIds)) {
    if (jaTem.has(escolaId)) continue;
    await tx.vinculoEscolar.create({ data: { escolaId, pessoaId: professorId, status: 'ATIVO', dataInicio: new Date(), createdBy: String(autorId) } });
    await tx.pessoaEvento.create({ data: { pessoaId: professorId, tipo: 'VINCULO_CRIADO', autorId, detalhe: `Escola #${escolaId} (cargo)` } });
  }
}

export async function criarCargo(tx: Db, professorId: number, dados: { dataInicio: string; composicao: Composicao }, autorId: number) {
  await travarCargosDoProfessor(tx, professorId);
  const ativos = await tx.cargoProfessor.count({ where: { professorId, status: 'ATIVO' } });
  if (ativos >= MAX_CARGOS_ATIVOS) throw new ConflictError(`Este Professor já tem ${MAX_CARGOS_ATIVOS} cargos ativos. Encerre um deles antes de cadastrar outro.`);
  const agora = new Date();
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
export async function alterarCargo(tx: Db, professorId: number, cargoId: number, dados: { dataInicio?: string; composicao?: unknown; baseUpdatedAt?: string | null }, autorId: number) {
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
    const nova = await validarComposicaoNoBanco(tx, dados.composicao, atual.map((i) => i.escolaId));
    if (chaveComposicao(nova) !== chaveComposicao(atual)) {
      await tx.cargoVersao.create({ data: { cargoId, criadaPor: String(autorId), composicao: nova as unknown as Prisma.InputJsonValue } });
      await garantirVinculosEscolares(tx, professorId, nova.map((i) => i.escolaId), autorId);
    }
  }
  return tx.cargoProfessor.update({ where: { id: cargoId }, data });
}

// Encerrar (nunca apagar). Data real informada pela Secretaria: entre o início e hoje.
export async function encerrarCargo(tx: Db, professorId: number, cargoId: number, dataFimTexto: string, autorId: number) {
  await travarCargosDoProfessor(tx, professorId);
  const cargo = await tx.cargoProfessor.findFirst({ where: { id: cargoId, professorId } });
  if (!cargo) throw new NotFoundError('Cargo não encontrado.');
  if (cargo.status !== 'ATIVO') throw new ConflictError('Este cargo já está encerrado.');
  const dataFim = lerData(dataFimTexto, 'Data de encerramento');
  const inicio = cargo.dataInicio.toISOString().slice(0, 10);
  if (dataFim < inicio) throw new ValidationError(`O encerramento não pode ser antes do início do cargo (${formatarDataBr(inicio)}).`);
  if (dataFim > hojeSp()) throw new ValidationError('O encerramento não pode ser numa data futura. Encerre no dia em que o Professor deixar o cargo.');
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
  const nomes = await nomesParaComposicao(db, composicoes.flatMap((c) => c.map((i) => i.escolaId)));
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
      })).sort((a, b) => a.escolaNome.localeCompare(b.escolaNome, 'pt-BR')),
    }))
    .filter((c) => opcoes.incluirEncerrados || c.status === 'ativo');
}

export { hojeSp };
