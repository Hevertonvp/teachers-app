// Formulário 1/3 — regras puras (sem I/O): datas/fuso, validação do ciclo contra o calendário
// global de trimestres, janela de edição e reabertura. A identidade do preenchimento é
// ciclo + professor + anoSerie + disciplina (ver EntregaUmTerco no schema).
import { ValidationError } from './errors.js';

// Fuso operacional fixo (mesmo de domain/notificacoes.ts). Sem horário de verão desde 2019.
const OFFSET_SP_MS = -3 * 60 * 60 * 1000;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const DATA_HORA_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export const paraDataIsoUtc = (data: Date) => data.toISOString().slice(0, 10);
export const dataLocalSp = (instante: Date) => new Date(instante.getTime() + OFFSET_SP_MS).toISOString().slice(0, 10);

export function dataIsoValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !DATA_ISO.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

// Aceita "YYYY-MM-DDTHH:mm" (hora de Brasília, vindo do <input type="datetime-local">) ou ISO
// completo com "Z"/offset. Devolve o instante real.
export function lerInstante(valor: unknown, rotulo: string): Date {
  if (typeof valor !== 'string' || !valor) throw new ValidationError(`${rotulo}: informe data e hora.`);
  let instante: Date;
  if (DATA_HORA_LOCAL.test(valor)) {
    const [dia, hora] = valor.split('T');
    if (!dataIsoValida(dia)) throw new ValidationError(`${rotulo}: data inválida.`);
    instante = new Date(`${dia}T${hora.length === 5 ? `${hora}:00` : hora}-03:00`);
  } else {
    instante = new Date(valor);
  }
  if (Number.isNaN(instante.getTime())) throw new ValidationError(`${rotulo}: data/hora inválida.`);
  return instante;
}

const formatarDataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export type SemanaEntrada = { dataInicio?: unknown; dataFim?: unknown };
export type CicloEntrada = {
  anoLetivo: number;
  trimestre: number;
  titulo?: string;
  abreEm: unknown;
  prazoEm: unknown;
  semanas: SemanaEntrada[];
};
export type JanelaTrimestre = { dataInicio: string; dataFim: string }; // YYYY-MM-DD
export type CicloValido = {
  anoLetivo: number;
  trimestre: number;
  titulo: string;
  abreEm: Date;
  prazoEm: Date;
  semanas: { numero: number; dataInicio: string; dataFim: string }[];
};

// Todas as datas do ciclo precisam estar dentro da janela GLOBAL do trimestre (PeriodoTrimestre);
// nunca existe um calendário paralelo. Lança na primeira violação, com mensagem clara.
export function validarCiclo(entrada: CicloEntrada, janela: JanelaTrimestre | null): CicloValido {
  const { anoLetivo, trimestre } = entrada;
  if (!Number.isInteger(anoLetivo) || anoLetivo < 2000 || anoLetivo > 2100) throw new ValidationError('Ano letivo inválido.');
  if (![1, 2, 3].includes(trimestre)) throw new ValidationError('Trimestre inválido — use 1, 2 ou 3.');
  if (!janela) {
    throw new ValidationError(`O ${trimestre}º trimestre de ${anoLetivo} não está configurado no calendário. Configure em Configurações › Trimestres antes de criar o Formulário 1/3.`);
  }
  const rotuloTri = `${trimestre}º trimestre (${formatarDataBr(janela.dataInicio)} a ${formatarDataBr(janela.dataFim)})`;
  const dentro = (iso: string) => iso >= janela.dataInicio && iso <= janela.dataFim;

  const abreEm = lerInstante(entrada.abreEm, 'Abertura');
  const prazoEm = lerInstante(entrada.prazoEm, 'Prazo de entrega');
  if (prazoEm.getTime() <= abreEm.getTime()) throw new ValidationError('O prazo de entrega precisa ser depois da abertura.');
  if (!dentro(dataLocalSp(abreEm))) throw new ValidationError(`A abertura (${formatarDataBr(dataLocalSp(abreEm))}) está fora do ${rotuloTri}.`);
  if (!dentro(dataLocalSp(prazoEm))) throw new ValidationError(`O prazo de entrega (${formatarDataBr(dataLocalSp(prazoEm))}) está fora do ${rotuloTri}.`);

  if (!Array.isArray(entrada.semanas) || entrada.semanas.length === 0) throw new ValidationError('Informe ao menos uma semana.');
  if (entrada.semanas.length > 30) throw new ValidationError('No máximo 30 semanas por ciclo.');
  const semanas = entrada.semanas.map((semana, indice) => {
    const numero = indice + 1;
    const rotulo = `Semana ${numero}`;
    if (!dataIsoValida(semana.dataInicio)) throw new ValidationError(`${rotulo}: data de início inválida.`);
    if (!dataIsoValida(semana.dataFim)) throw new ValidationError(`${rotulo}: data de fim inválida.`);
    if (semana.dataInicio > semana.dataFim) throw new ValidationError(`${rotulo}: o início não pode ser depois do fim.`);
    if (!dentro(semana.dataInicio) || !dentro(semana.dataFim)) {
      throw new ValidationError(`${rotulo} (${formatarDataBr(semana.dataInicio)} a ${formatarDataBr(semana.dataFim)}) está fora do ${rotuloTri}.`);
    }
    return { numero, dataInicio: semana.dataInicio, dataFim: semana.dataFim };
  });

  // Regras de 10/11/2026 (decisão do usuário): semanas em ordem e sem sobreposição (buracos entre
  // elas são permitidos — feriado, recesso; tamanho livre) e nenhuma termina depois do prazo de entrega.
  const diaPrazo = dataLocalSp(prazoEm);
  semanas.forEach((semana, i) => {
    const anterior = semanas[i - 1];
    if (anterior && semana.dataInicio <= anterior.dataFim) {
      throw new ValidationError(`Semana ${semana.numero} (início ${formatarDataBr(semana.dataInicio)}) precisa começar depois do fim da Semana ${anterior.numero} (${formatarDataBr(anterior.dataFim)}): as semanas ficam em ordem e não podem se sobrepor.`);
    }
    if (semana.dataFim > diaPrazo) {
      throw new ValidationError(`Semana ${semana.numero} termina em ${formatarDataBr(semana.dataFim)}, depois do prazo de entrega (${formatarDataBr(diaPrazo)}).`);
    }
  });

  const titulo = (entrada.titulo ?? '').trim() || 'Formulário 1/3';
  if (titulo.length > 200) throw new ValidationError('Título muito longo.');
  return { anoLetivo, trimestre, titulo, abreEm, prazoEm, semanas };
}

// Abertura nunca no passado (Decisão 3 / UT-06, aprovada pelo usuário em 10/11/2026): o DIA da
// abertura (São Paulo) precisa ser hoje ou depois. Na criação, sempre; na edição, só quando o dia
// da abertura muda (um ciclo já aberto naturalmente tem abertura no passado).
export function exigirAberturaNaoPassada(abreEm: Date, agora: Date = new Date()) {
  if (dataLocalSp(abreEm) < dataLocalSp(agora)) {
    throw new ValidationError(`A abertura (${formatarDataBr(dataLocalSp(abreEm))}) não pode ser no passado: escolha hoje ou uma data futura.`);
  }
}

export type JanelaInstantes = { inicioEm: Date; fimEm: Date };

export const reaberturasSobrepoem = (a: JanelaInstantes, b: JanelaInstantes) => a.inicioEm.getTime() <= b.fimEm.getTime() && b.inicioEm.getTime() <= a.fimEm.getTime();

export function validarReabertura(entrada: { inicioEm: unknown; fimEm: unknown }, existentes: JanelaInstantes[]): JanelaInstantes {
  const inicioEm = lerInstante(entrada.inicioEm, 'Início da reabertura');
  const fimEm = lerInstante(entrada.fimEm, 'Fim da reabertura');
  if (fimEm.getTime() <= inicioEm.getTime()) throw new ValidationError('O fim da reabertura precisa ser depois do início.');
  if (existentes.some((outra) => reaberturasSobrepoem({ inicioEm, fimEm }, outra))) {
    throw new ValidationError('Já existe uma reabertura deste ciclo com período sobreposto.');
  }
  return { inicioEm, fimEm };
}

export type StatusCiclo = 'agendado' | 'aberto' | 'encerrado';

export function statusDoCiclo(ciclo: { abreEm: Date; prazoEm: Date }, agora: Date = new Date()): StatusCiclo {
  if (agora.getTime() < ciclo.abreEm.getTime()) return 'agendado';
  if (agora.getTime() > ciclo.prazoEm.getTime()) return 'encerrado';
  return 'aberto';
}

// Editável agora = dentro do prazo original OU dentro de alguma reabertura (nunca altera o prazo
// original — a reabertura é uma janela à parte).
export function cicloEditavelAgora(ciclo: { abreEm: Date; prazoEm: Date }, reaberturas: JanelaInstantes[], agora: Date = new Date()): boolean {
  if (statusDoCiclo(ciclo, agora) === 'aberto') return true;
  return reaberturas.some((r) => agora.getTime() >= r.inicioEm.getTime() && agora.getTime() <= r.fimEm.getTime());
}

export const TEXTO_SEMANA_MAX = 10000;
