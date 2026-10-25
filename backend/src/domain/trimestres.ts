// Calendário de trimestres por ano letivo (PeriodoTrimestre, editado em Configurações > Trimestres).
import type { Prisma, PrismaClient } from '@prisma/client';
import { CalendarioTrimestresError, ValidationError } from './errors.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const TRIMESTRES = [1, 2, 3] as const;

export const MENSAGEM_CALENDARIO_INCOMPLETO = 'Calendário de trimestres incompleto. Configure o 1º, 2º e 3º trimestre antes de criar uma Aplicação PDI.';

export type PeriodoEntrada = { trimestre: number; dataInicio?: string | null; dataFim?: string | null };
export type PeriodoValido = { trimestre: number; dataInicio: string; dataFim: string };

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// "YYYY-MM-DD" que existe de verdade no calendário — `new Date('2026-02-30')` não falha, rola pro
// mês seguinte; comparar de volta com a string original pega esse caso.
function dataIsoValida(valor: string): boolean {
  if (!DATA_ISO.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export const paraDataIso = (data: Date) => data.toISOString().slice(0, 10);

const formatarDataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// Regras de um calendário (parcial ou completo) de UM ano — puras, sem I/O. Lança na primeira
// violação, com mensagem que diz qual trimestre e qual o problema. Gaps entre trimestres são
// permitidos (nenhuma regra definida sobre isso — comportamento de sempre); ordem entre
// trimestres (ex.: 2º antes do 1º) também não é imposta, só sobreposição.
export function validarPeriodosDoAno(ano: number, periodos: PeriodoEntrada[]): PeriodoValido[] {
  const vistos = new Set<number>();
  const validos: PeriodoValido[] = [];
  for (const p of periodos) {
    if (!TRIMESTRES.includes(p.trimestre as 1 | 2 | 3)) throw new ValidationError('Trimestre inválido — use 1, 2 ou 3.');
    if (vistos.has(p.trimestre)) throw new ValidationError(`O ${p.trimestre}º trimestre foi informado mais de uma vez para ${ano}.`);
    vistos.add(p.trimestre);

    const rotulo = `${p.trimestre}º trimestre de ${ano}`;
    if (!p.dataInicio) throw new ValidationError(`${rotulo}: informe a data de início.`);
    if (!p.dataFim) throw new ValidationError(`${rotulo}: informe a data de encerramento.`);
    if (!dataIsoValida(p.dataInicio)) throw new ValidationError(`${rotulo}: data de início inválida.`);
    if (!dataIsoValida(p.dataFim)) throw new ValidationError(`${rotulo}: data de encerramento inválida.`);
    if (p.dataFim < p.dataInicio) throw new ValidationError(`${rotulo}: a data de encerramento não pode ser anterior à data de início.`);
    if (Number(p.dataInicio.slice(0, 4)) !== ano || Number(p.dataFim.slice(0, 4)) !== ano) {
      throw new ValidationError(`${rotulo}: as datas precisam estar dentro de ${ano}.`);
    }
    validos.push({ trimestre: p.trimestre, dataInicio: p.dataInicio, dataFim: p.dataFim });
  }

  const ordenados = [...validos].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  for (let i = 1; i < ordenados.length; i += 1) {
    const anterior = ordenados[i - 1];
    const atual = ordenados[i];
    // Fronteiras iguais contam como sobreposição (mesmo critério de vigenciasSobrepoem).
    if (atual.dataInicio <= anterior.dataFim) {
      throw new ValidationError(`O ${anterior.trimestre}º e o ${atual.trimestre}º trimestre de ${ano} têm datas sobrepostas.`);
    }
  }
  return validos.sort((a, b) => a.trimestre - b.trimestre);
}

// Lock transacional por ano (pg_advisory_xact_lock, liberado sozinho no commit/rollback):
// exclusivo para quem ALTERA o calendário daquele ano, compartilhado para quem só LÊ para resolver
// o trimestre de uma Aplicação — duas edições simultâneas nunca validam sobreposição uma contra o
// estado antigo da outra, e uma Aplicação nunca é criada no meio de uma edição do calendário.
// Funciona sob pgbouncer em modo transaction (o lock vive dentro da transação).
const NAMESPACE_LOCK_CALENDARIO = 7301;

export async function travarCalendarioDoAno(tx: Prisma.TransactionClient, ano: number, modo: 'exclusivo' | 'compartilhado') {
  if (modo === 'exclusivo') await tx.$executeRaw`SELECT pg_advisory_xact_lock(${NAMESPACE_LOCK_CALENDARIO}::int, ${ano}::int)`;
  else await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${NAMESPACE_LOCK_CALENDARIO}::int, ${ano}::int)`;
}

// Trimestre de uma Aplicação NOVA, a partir do calendário do ano da data de início (decisão do
// usuário: vale o trimestre do início, mesmo que o fim avance sobre o seguinte). Nunca devolve
// null: calendário do ano incompleto/inválido, ou data fora de todo trimestre configurado, sempre
// bloqueia a criação — nunca mais o fallback antigo de "entram as três perguntas trimestrais".
export async function resolverTrimestreObrigatorio(db: Db, dataInicio: Date): Promise<number> {
  const ano = dataInicio.getUTCFullYear();
  const linhas = await db.periodoTrimestre.findMany({ where: { ano }, orderBy: { trimestre: 'asc' } });

  if (TRIMESTRES.some((t) => !linhas.some((l) => l.trimestre === t))) {
    throw new CalendarioTrimestresError(`${MENSAGEM_CALENDARIO_INCOMPLETO} (Ano ${ano}.)`, 'CALENDARIO_TRIMESTRES_INCOMPLETO');
  }

  let periodos: PeriodoValido[];
  try {
    periodos = validarPeriodosDoAno(ano, linhas.map((l) => ({ trimestre: l.trimestre, dataInicio: paraDataIso(l.dataInicio), dataFim: paraDataIso(l.dataFim) })));
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new CalendarioTrimestresError(`Calendário de trimestres de ${ano} inválido: ${err.message}`, 'CALENDARIO_TRIMESTRES_INVALIDO');
    }
    throw err;
  }

  const dia = paraDataIso(dataInicio);
  const periodo = periodos.find((p) => p.dataInicio <= dia && dia <= p.dataFim);
  if (!periodo) {
    throw new CalendarioTrimestresError(
      `A data de início (${formatarDataBr(dia)}) não está em nenhum trimestre de ${ano}.`,
      'DATA_FORA_DO_CALENDARIO',
    );
  }
  return periodo.trimestre;
}

// Pergunta sem trimestre (null) entra em qualquer Aplicação; pergunta de um trimestre só entra na
// Aplicação daquele trimestre. Toda Aplicação nova tem trimestre resolvido (nunca null — ver
// resolverTrimestreObrigatorio), então não existe mais o caso "entram todas".
export function perguntaValeParaTrimestre(perguntaTrimestre: number | null, aplicacaoTrimestre: number): boolean {
  return perguntaTrimestre === null || perguntaTrimestre === aplicacaoTrimestre;
}
