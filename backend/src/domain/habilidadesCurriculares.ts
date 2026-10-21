// Regras do tipo de pergunta HABILIDADE_CRMG e do catálogo HabilidadeCurricular.
//
// - A pergunta é escrita normalmente pela Secretaria (como Texto/Seleção). A RESPOSTA é a escolha
//   de uma ou várias habilidades — ou "todas" — do componente curricular mapeado da Disciplina da
//   Ficha (DisciplinaComponenteCurricular). Nunca filtra por série/ano.
// - O servidor monta o valor salvo a partir do catálogo (ids enviados pelo cliente -> código e
//   descrição oficiais); código/descrição vindos do cliente nunca são usados.
// - O valor salvo congela código/descrição das escolhidas: Fichas antigas nunca releem o catálogo.
import type { ComponenteCurricular, HabilidadeCurricular, Prisma, PrismaClient } from '@prisma/client';
import { ValidationError } from './errors.js';

type Db = PrismaClient | Prisma.TransactionClient;

// Identificador técnico interno da versão importada (metadados do PDF oficial: criado em 05/2023).
// Na interface o nome exibido é VERSOES_CURRICULO[versao] — nunca o identificador.
export const VERSAO_CRMG_ATUAL = 'CRMG-EIEF-2023-05';
export const VERSOES_CURRICULO: Record<string, string> = {
  [VERSAO_CRMG_ATUAL]: 'CRMG – Versão atualizada',
};

export const COMPONENTE_NOME: Record<ComponenteCurricular, string> = {
  ARTE: 'Arte',
  CIENCIAS: 'Ciências',
  EDUCACAO_FISICA: 'Educação Física',
  ENSINO_RELIGIOSO: 'Ensino Religioso',
  GEOGRAFIA: 'Geografia',
  HISTORIA: 'História',
  LINGUA_INGLESA: 'Língua Inglesa',
  LINGUA_PORTUGUESA: 'Língua Portuguesa',
  MATEMATICA: 'Matemática',
};

const MAX_HABILIDADES_POR_RESPOSTA = 500;

// Normalização SÓ para busca (minúsculas, sem acento, espaços colapsados) — a descrição oficial
// armazenada nunca passa por isso.
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export async function componenteDaDisciplina(db: Db, disciplinaId: number): Promise<ComponenteCurricular | null> {
  const mapa = await db.disciplinaComponenteCurricular.findUnique({ where: { disciplinaId } });
  return mapa?.componente ?? null;
}

// Forma pública de uma habilidade do catálogo (busca). Nunca expõe os campos auxiliares de busca
// nem anos escolares (ano não aparece na UI).
export function formatarHabilidade(h: HabilidadeCurricular) {
  return {
    id: h.id,
    codigo: h.codigo,
    descricaoOficial: h.descricaoOficial,
    componente: h.componente,
    componenteNome: COMPONENTE_NOME[h.componente],
    versaoCurriculo: h.versaoCurriculo,
    versaoNome: VERSOES_CURRICULO[h.versaoCurriculo] ?? h.versaoCurriculo,
  };
}

export type EntradaHabilidades = { habilidadeIds?: number[] | null; todas?: boolean | null };

type ItemResposta = {
  aplicacaoPerguntaId: number;
  valor: { resposta?: string | number | boolean | null; complementarTexto?: string | null } & EntradaHabilidades;
};

// Valor efetivamente gravado em RespostaPdi para cada item. Tipos de sempre: EXATAMENTE o que era
// gravado antes ({ resposta, complementarTexto }, só as chaves enviadas) — os campos novos da
// entrada nunca vazam para eles. HABILIDADE_CRMG: valor montado no servidor a partir do catálogo.
export async function prepararValoresResposta(
  db: Db,
  itens: ItemResposta[],
  tipoPorPergunta: Map<number, string>,
  disciplinaId: number,
): Promise<{ aplicacaoPerguntaId: number; valor: Prisma.InputJsonValue }[]> {
  const saida = [];
  for (const item of itens) {
    if (tipoPorPergunta.get(item.aplicacaoPerguntaId) === 'HABILIDADE_CRMG') {
      saida.push({ aplicacaoPerguntaId: item.aplicacaoPerguntaId, valor: await montarValorHabilidades(db, item.valor, disciplinaId) as unknown as Prisma.InputJsonValue });
    } else {
      const { resposta, complementarTexto } = item.valor;
      const valor: Record<string, unknown> = {};
      if (resposta !== undefined) valor.resposta = resposta;
      if (complementarTexto !== undefined) valor.complementarTexto = complementarTexto;
      saida.push({ aplicacaoPerguntaId: item.aplicacaoPerguntaId, valor: valor as Prisma.InputJsonValue });
    }
  }
  return saida;
}

export type ValorHabilidades = {
  todas: boolean;
  habilidades: { id: number; codigo: string; descricaoOficial: string }[];
  componente: ComponenteCurricular;
  componenteNome: string;
  versaoCurriculo: string;
  versaoNome: string;
};

// Monta (no servidor) o valor congelado de uma resposta HABILIDADE_CRMG. Toda habilidade enviada
// precisa existir, estar ativa e pertencer ao componente da disciplina da Ficha — requisição
// manipulada (ex.: Ficha de Inglês + habilidade de Matemática) é rejeitada aqui.
export async function montarValorHabilidades(db: Db, entrada: EntradaHabilidades, disciplinaId: number): Promise<ValorHabilidades> {
  const componente = await componenteDaDisciplina(db, disciplinaId);
  if (!componente) throw new ValidationError('Nenhum componente CRMG configurado para esta disciplina.');
  const base = { componente, componenteNome: COMPONENTE_NOME[componente] };

  if (entrada.todas) {
    return { todas: true, habilidades: [], ...base, versaoCurriculo: VERSAO_CRMG_ATUAL, versaoNome: VERSOES_CURRICULO[VERSAO_CRMG_ATUAL] };
  }

  const ids = [...new Set(entrada.habilidadeIds ?? [])];
  if (ids.length > MAX_HABILIDADES_POR_RESPOSTA) throw new ValidationError('Habilidades demais selecionadas — use "Todas as habilidades".');
  const encontradas = ids.length ? await db.habilidadeCurricular.findMany({ where: { id: { in: ids } } }) : [];
  if (encontradas.length !== ids.length || encontradas.some((h) => !h.ativa)) {
    throw new ValidationError('Uma ou mais habilidades selecionadas não existem no catálogo do CRMG.');
  }
  const deOutroComponente = encontradas.find((h) => h.componente !== componente);
  if (deOutroComponente) {
    throw new ValidationError(`A habilidade ${deOutroComponente.codigo} pertence a ${COMPONENTE_NOME[deOutroComponente.componente]} e não pode ser usada em ${COMPONENTE_NOME[componente]}.`);
  }
  const versao = encontradas[0]?.versaoCurriculo ?? VERSAO_CRMG_ATUAL;
  return {
    todas: false,
    habilidades: encontradas
      .sort((a, b) => a.codigo.localeCompare(b.codigo) || a.id - b.id)
      .map((h) => ({ id: h.id, codigo: h.codigo, descricaoOficial: h.descricaoOficial })),
    ...base,
    versaoCurriculo: versao,
    versaoNome: VERSOES_CURRICULO[versao] ?? versao,
  };
}
