import type { PrismaClient } from '@prisma/client';
import { hojeComoData } from '../domain/pdiAplicacoes.js';
import { LIMITES } from '../domain/acompanhamento.js';
import { contarFichasPdi } from '../lib/contagemFichasPdi.js';

// "Foto" do PDI no prazo (Acompanhamento Escolar, 10/11/2026). Congela esperado, concluídas e em
// preenchimento de cada Aplicação logo depois do fim, para o percentual de períodos passados não
// mudar com transferências e trocas de professor.
//
// Só fotografa Aplicações ATIVAS cujo fim foi de 1 a LIMITES.diasParaFotografia dias atrás. Uma
// encerrada há mais tempo nunca ganha foto, porque o esperado de hoje já não seria o do prazo.
// A janela de 3 dias cobre dias em que o servidor estava dormindo. Idempotente: quem já tem foto é
// ignorado e a chave primária impede duas. Nunca altera nada além da própria tabela de fotos.
export async function executarFotografiaPdi(prisma: PrismaClient, agora: Date = new Date()): Promise<number> {
  const hoje = hojeComoData(agora);
  const DIA = 86400000;
  const desde = new Date(hoje.getTime() - LIMITES.diasParaFotografia * DIA);
  const aplicacoes = await prisma.aplicacaoPdi.findMany({
    where: { status: 'ATIVA', dataFim: { gte: desde, lt: hoje }, fotografia: null },
    select: { id: true, escolaId: true, modelos: { select: { disciplinaId: true } } },
  });
  if (aplicacoes.length === 0) return 0;
  const contagens = await contarFichasPdi(prisma, aplicacoes.map((a) => ({ id: a.id, escolaId: a.escolaId, disciplinaIds: a.modelos.map((m) => m.disciplinaId) })));
  const { count } = await prisma.fotografiaAplicacaoPdi.createMany({
    data: aplicacoes.map((a) => {
      const c = contagens.get(a.id)!;
      return { aplicacaoId: a.id, escolaId: a.escolaId, esperado: c.esperado, concluidas: c.concluidas, emAndamento: c.emAndamento };
    }),
    skipDuplicates: true,
  });
  return count;
}
