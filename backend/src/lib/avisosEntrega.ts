import type { PrismaClient } from '@prisma/client';
import { criarNotificacao } from './notificacoes.js';
import { contarFichasPdi } from './contagemFichasPdi.js';

// Avisos de entrega por escola (decisão do usuário, 18/11/2026), no Formulário 1/3 e no PDI:
//   - escola chegou a 100%            → Secretaria + Diretora e Supervisora da escola (na hora);
//   - falta 1 dia para o prazo         → Secretaria (UM resumo) + Diretora e Supervisora (só a escola delas);
//   - prazo venceu sem 100%            → idem, no dia seguinte ao prazo.
// Só notificação (sino + celular). Cada aviso tem chave de idempotência: sai uma vez só, mesmo que o job
// rode de novo ou o servidor reinicie. Nunca lança — aviso nunca derruba quem o chamou.

export type Modulo = 'UM_TERCO' | 'PDI';
export type SituacaoEscola = { escolaId: number; escolaNome: string; esperado: number; concluidas: number };
export type Referencia = { modulo: Modulo; id: number; linkSecretaria: string; linkSupervisao: string };

const NOME: Record<Modulo, string> = { UM_TERCO: 'Formulário 1/3', PDI: 'PDI' };
const LINK_DIRETORA = '/acompanhamento-escolar';
const prefixo = (ref: Referencia) => `${ref.modulo === 'UM_TERCO' ? 'um-terco' : 'pdi'}:${ref.id}`;

async function secretarias(prisma: PrismaClient): Promise<number[]> {
  return (await prisma.pessoa.findMany({ where: { perfil: 'SECRETARIA', status: 'ATIVO' }, select: { id: true } })).map((p) => p.id);
}

// Diretora e Supervisora (GESTOR) com vínculo ATIVO na escola.
async function gestaoDaEscola(prisma: PrismaClient, escolaId: number): Promise<{ id: number; perfil: string }[]> {
  const vinculos = await prisma.vinculoEscolar.findMany({
    where: { escolaId, status: 'ATIVO', pessoa: { status: 'ATIVO', perfil: { in: ['DIRETORA', 'GESTOR'] } } },
    select: { pessoa: { select: { id: true, perfil: true } } },
  });
  const unicos = new Map(vinculos.map((v) => [v.pessoa.id, v.pessoa]));
  return [...unicos.values()];
}

const linkDe = (ref: Referencia, perfil: string) => (perfil === 'DIRETORA' ? LINK_DIRETORA : ref.linkSupervisao);
const faltam = (e: SituacaoEscola) => e.esperado - e.concluidas;

// --- 100% ------------------------------------------------------------------------------------------

export async function avisarEscolasCompletas(prisma: PrismaClient, ref: Referencia, escolas: SituacaoEscola[]): Promise<void> {
  try {
    const completas = escolas.filter((e) => e.esperado > 0 && e.concluidas >= e.esperado);
    if (completas.length === 0) return;
    const sec = await secretarias(prisma);
    for (const e of completas) {
      const titulo = `${NOME[ref.modulo]} completo`;
      const corpo = `${e.escolaNome}: todos os formulários foram entregues.`;
      const chave = (dest: number) => `entrega-completa:${prefixo(ref)}:${e.escolaId}:${dest}`;
      const gestao = await gestaoDaEscola(prisma, e.escolaId);
      await Promise.all([
        ...sec.map((id) => criarNotificacao(prisma, { destinatarioId: id, tipo: 'ENTREGA_ESCOLA_COMPLETA', titulo, corpo, linkContexto: ref.linkSecretaria, metadata: { ...ref, escolaId: e.escolaId }, chaveIdempotencia: chave(id) })),
        ...gestao.map((p) => criarNotificacao(prisma, { destinatarioId: p.id, tipo: 'ENTREGA_ESCOLA_COMPLETA', titulo, corpo, linkContexto: linkDe(ref, p.perfil), metadata: { ...ref, escolaId: e.escolaId }, chaveIdempotencia: chave(p.id) })),
      ]);
    }
  } catch (err) {
    console.error('[avisosEntrega] falha ao avisar escola completa', ref, err);
  }
}

// --- Prazo amanhã / prazo vencido --------------------------------------------------------------------

export type Marco = 'prazo_amanha' | 'atrasada';

const listar = (escolas: SituacaoEscola[], marco: Marco) => escolas
  .map((e) => (marco === 'prazo_amanha' ? `${e.escolaNome} (faltam ${faltam(e)} de ${e.esperado})` : `${e.escolaNome} (${faltam(e)} sem entregar)`))
  .join('; ');

// Avisa as escolas ainda abaixo de 100%. Cada item traz a escola e a referência dela (1/3: todas do mesmo
// ciclo; PDI: uma Aplicação por escola). A Secretaria recebe UM resumo por `chaveResumo` (1/3: o ciclo;
// PDI: o dia do prazo); Diretora e Supervisora recebem só a escola delas.
export type ItemPendencia = SituacaoEscola & { ref: Referencia };
export async function avisarPendencias(prisma: PrismaClient, modulo: Modulo, itens: ItemPendencia[], marco: Marco, chaveResumo: string, linkResumo: string): Promise<number> {
  try {
    const pendentes = itens.filter((e) => e.esperado > 0 && e.concluidas < e.esperado);
    if (pendentes.length === 0) return 0;
    const tipo = marco === 'prazo_amanha' ? 'ENTREGA_PRAZO_AMANHA' as const : 'ENTREGA_ATRASADA' as const;
    const titulo = marco === 'prazo_amanha' ? `${NOME[modulo]}: prazo amanhã` : `${NOME[modulo]}: prazo encerrado`;
    let tentadas = 0;

    const corpoResumo = marco === 'prazo_amanha'
      ? `${pendentes.length === 1 ? '1 escola pendente' : `${pendentes.length} escolas pendentes`}: ${listar(pendentes, marco)}.`
      : `${pendentes.length === 1 ? '1 escola não completou' : `${pendentes.length} escolas não completaram`}: ${listar(pendentes, marco)}.`;
    for (const id of await secretarias(prisma)) {
      await criarNotificacao(prisma, { destinatarioId: id, tipo, titulo, corpo: corpoResumo, linkContexto: linkResumo, metadata: { modulo, marco, escolas: pendentes.map((e) => e.escolaId) }, chaveIdempotencia: `entrega-${marco}:${chaveResumo}:secretaria:${id}` });
      tentadas++;
    }

    for (const e of pendentes) {
      const corpo = marco === 'prazo_amanha'
        ? `${e.escolaNome}: faltam ${faltam(e)} de ${e.esperado}. Prazo: amanhã.`
        : `${e.escolaNome}: ficaram ${faltam(e)} de ${e.esperado} sem entregar.`;
      for (const p of await gestaoDaEscola(prisma, e.escolaId)) {
        await criarNotificacao(prisma, { destinatarioId: p.id, tipo, titulo, corpo, linkContexto: linkDe(e.ref, p.perfil), metadata: { ...e.ref, marco, escolaId: e.escolaId }, chaveIdempotencia: `entrega-${marco}:${prefixo(e.ref)}:${e.escolaId}:${p.id}` });
        tentadas++;
      }
    }
    return tentadas;
  } catch (err) {
    console.error('[avisosEntrega] falha ao avisar pendências', modulo, marco, err);
    return 0;
  }
}

// --- PDI: situação de uma Aplicação (cada Aplicação é de UMA escola) ------------------------------------

export const refPdi = (aplicacaoId: number): Referencia => ({ modulo: 'PDI', id: aplicacaoId, linkSecretaria: LINK_DIRETORA, linkSupervisao: LINK_DIRETORA });
export const refUmTerco = (cicloId: number): Referencia => ({ modulo: 'UM_TERCO', id: cicloId, linkSecretaria: `/formulario-um-terco/ciclos/${cicloId}`, linkSupervisao: `/formulario-um-terco/ciclos/${cicloId}` });

export async function situacaoPdiDasAplicacoes(prisma: PrismaClient, aplicacaoIds: number[]): Promise<Map<number, SituacaoEscola>> {
  const aplicacoes = await prisma.aplicacaoPdi.findMany({
    where: { id: { in: aplicacaoIds } },
    include: { escola: { select: { nome: true } }, modelos: { select: { disciplinaId: true, atuacaoId: true } } },
  });
  const contagens = await contarFichasPdi(prisma, aplicacoes.map((a) => ({
    id: a.id, escolaId: a.escolaId,
    disciplinaIds: a.modelos.map((m) => m.disciplinaId).filter((id): id is number => id !== null),
    atuacaoIds: a.modelos.map((m) => m.atuacaoId).filter((id): id is number => id !== null),
  })));
  const resultado = new Map<number, SituacaoEscola>();
  for (const a of aplicacoes) {
    const c = contagens.get(a.id);
    resultado.set(a.id, { escolaId: a.escolaId, escolaNome: a.escola.nome, esperado: c?.esperado ?? 0, concluidas: c?.concluidas ?? 0 });
  }
  return resultado;
}

// Chamado depois que uma Ficha PDI é concluída. Nunca lança.
export async function verificarPdiCompleto(prisma: PrismaClient, aplicacaoId: number): Promise<void> {
  try {
    const situacao = (await situacaoPdiDasAplicacoes(prisma, [aplicacaoId])).get(aplicacaoId);
    if (situacao) await avisarEscolasCompletas(prisma, refPdi(aplicacaoId), [situacao]);
  } catch (err) {
    console.error('[avisosEntrega] falha ao verificar PDI completo', aplicacaoId, err);
  }
}
