import type { EtapaEnsino, NivelInfantil, SegmentoInfantil, Turno } from '@prisma/client';
import { ValidationError } from './errors.js';

const SERIE_MINIMA = 1;
const SERIE_MAXIMA = 9;
const ANO_LETIVO_MINIMO = 2000;
const ANO_LETIVO_MAXIMO = 2100;

const NIVEIS_POR_SEGMENTO: Record<SegmentoInfantil, NivelInfantil[]> = {
  CRECHE: ['BERCARIO_I', 'BERCARIO_II', 'MATERNAL_I', 'MATERNAL_II'],
  PRE_ESCOLA: ['PRE_I', 'PRE_II'],
};

const ROTULO_NIVEL: Record<NivelInfantil, string> = {
  BERCARIO_I: 'Berçário I',
  BERCARIO_II: 'Berçário II',
  MATERNAL_I: 'Maternal I',
  MATERNAL_II: 'Maternal II',
  // 16/11/2026: em SJN, Pré I/Pré II passaram a se chamar 1º/2º Período (o código do enum não mudou).
  PRE_I: '1º Período',
  PRE_II: '2º Período',
};

export interface DadosTurmaFundamental {
  etapa: 'FUNDAMENTAL';
  escolaId: number;
  anoLetivo: number;
  anoSerie: number;
  turno: Turno;
  identificador: number;
}

export interface DadosTurmaInfantil {
  etapa: 'EDUCACAO_INFANTIL';
  escolaId: number;
  anoLetivo: number;
  segmento: SegmentoInfantil;
  nivel: NivelInfantil;
  turno: Turno;
  identificador: number;
}

export type DadosTurma = DadosTurmaFundamental | DadosTurmaInfantil;

function validarComum(dados: DadosTurma) {
  if (dados.anoLetivo < ANO_LETIVO_MINIMO || dados.anoLetivo > ANO_LETIVO_MAXIMO) {
    throw new ValidationError('Ano letivo fora do intervalo esperado.');
  }
  if (dados.identificador < 1) {
    throw new ValidationError('Identificador da turma deve ser 1 ou mais.');
  }
}

/**
 * Valida os dados de uma turma (Fundamental ou Educação Infantil) e calcula `nome` e
 * `identidadeChave`. Espelha exatamente a lógica que existia em Turma.cs na tentativa anterior
 * em C#/EF Core — mesma regra de negócio, agora em TypeScript.
 *
 * ESTRATÉGIA DE UNICIDADE (documentada aqui porque não é óbvia): a identidade combina campos
 * que só existem numa das duas etapas (anoSerie só no Fundamental; segmento/nivel só na
 * Educação Infantil — os outros ficam null). Um índice único direto sobre colunas nullable não
 * garante unicidade de forma confiável (NULL nunca é igual a outro NULL em comparações de
 * unicidade), então calculamos aqui uma `identidadeChave` string NÃO NULA que já embute todos
 * os campos relevantes (com um prefixo por etapa para nunca colidir entre Fundamental e
 * Infantil) — o banco só precisa de um índice único simples sobre essa coluna.
 */
export function validarECalcularTurma(dados: DadosTurma): { nome: string; identidadeChave: string } {
  validarComum(dados);

  if (dados.etapa === 'FUNDAMENTAL') {
    if (dados.anoSerie < SERIE_MINIMA || dados.anoSerie > SERIE_MAXIMA) {
      throw new ValidationError('Ano/série do Fundamental deve ser entre 1 e 9.');
    }
    const turnoLetra = dados.turno === 'MANHA' ? 'M' : 'T';
    return {
      nome: `${dados.anoSerie}${turnoLetra}${dados.identificador}`,
      identidadeChave: `F|${dados.escolaId}|${dados.anoLetivo}|${dados.anoSerie}|${dados.turno}|${dados.identificador}`,
    };
  }

  const niveisValidos = NIVEIS_POR_SEGMENTO[dados.segmento];
  if (!niveisValidos.includes(dados.nivel)) {
    throw new ValidationError(`Nível '${dados.nivel}' não pertence ao segmento '${dados.segmento}'.`);
  }
  const sufixo = dados.identificador > 1 ? ` ${dados.identificador}` : '';
  const turnoLabel = dados.turno === 'MANHA' ? 'Manhã' : 'Tarde';
  return {
    nome: `${ROTULO_NIVEL[dados.nivel]}${sufixo} — ${turnoLabel}`,
    identidadeChave: `I|${dados.escolaId}|${dados.anoLetivo}|${dados.segmento}|${dados.nivel}|${dados.turno}|${dados.identificador}`,
  };
}

// Turma da Educação Infantil com nível LOCAL (catálogo NivelInfantilLocal, 16/11/2026): nome "<nível> <letra> —
// <turno>" (ex.: "Maternal 1 A — Manhã"; letra = identificador: 1→A, 2→B…). Chave com prefixo próprio ("IL|") —
// nunca colide com as turmas antigas ("I|", nível enum), que continuam como estão.
export interface DadosTurmaInfantilLocal {
  escolaId: number;
  anoLetivo: number;
  nivelLocal: { id: number; nome: string };
  turno: Turno;
  identificador: number;
}

export const letraDaTurma = (identificador: number) => {
  let n = identificador, s = '';
  while (n > 0) { n -= 1; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
};

export function validarECalcularTurmaInfantilLocal(dados: DadosTurmaInfantilLocal): { nome: string; identidadeChave: string } {
  if (dados.anoLetivo < ANO_LETIVO_MINIMO || dados.anoLetivo > ANO_LETIVO_MAXIMO) throw new ValidationError('Ano letivo fora do intervalo esperado.');
  if (dados.identificador < 1) throw new ValidationError('Identificador da turma deve ser 1 ou mais.');
  const turnoLabel = dados.turno === 'MANHA' ? 'Manhã' : 'Tarde';
  return {
    nome: `${dados.nivelLocal.nome} ${letraDaTurma(dados.identificador)} — ${turnoLabel}`,
    identidadeChave: `IL|${dados.escolaId}|${dados.anoLetivo}|${dados.nivelLocal.id}|${dados.turno}|${dados.identificador}`,
  };
}

// Estrutura da escola (16/11/2026). Fund. I = 1º ao 5º; Fund. II = 6º ao 9º.
// Nível antigo (enum) → nome do nível no catálogo (16/11/2026: Pré I/II = 1º/2º Período). Só os que têm equivalente.
export const NIVEL_ANTIGO_NO_CATALOGO: Partial<Record<NivelInfantil, string>> = { PRE_I: '1º Período', PRE_II: '2º Período' };

export const anoDaEtapa = (ano: number) => (ano <= 5 ? 'FUNDAMENTAL_I' : 'FUNDAMENTAL_II');
