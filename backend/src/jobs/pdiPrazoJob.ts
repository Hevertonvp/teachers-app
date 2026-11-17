import type { PrismaClient } from '@prisma/client';
import {
  dataCivilSP,
  dataCivilDeColunaDate,
  marcoPrazoPdi,
  textoPrazoProfessor,
  textoPrazoGestor,
  chaveIdempotenciaPrazoProfessor,
  chaveIdempotenciaPrazoGestor,
} from '../domain/notificacoes.js';
import { criarNotificacao } from '../lib/notificacoes.js';
import { responsaveisPorAtuacao } from '../domain/pdiAtuacao.js';

// Para UMA Aplicação, recalcula ao vivo quantas Fichas pendentes cada Professor atualmente
// responsável possui — mesma lógica de candidatos de GET /pdi-fichas/meus-pdis
// (api/routes/pdiFichas.ts), só que agregada para TODOS os professores da escola/disciplinas da
// aplicação de uma vez, não para um único ator. "Pendente" = ainda não CONCLUIDA (exista ou não
// uma FichaPdi criada) — nunca a partir de professorResponsavelId/snapshots da Ficha (seção 28 do
// pedido: responsabilidade atual vem sempre do ProfessorTurmaDisciplina ATIVO vigente, nunca de
// histórico congelado).
async function calcularPendentesPorProfessor(
  prisma: PrismaClient,
  aplicacao: { id: number; escolaId: number },
  disciplinaIds: number[],
  atuacaoIds: number[] = [],
): Promise<Map<number, number>> {
  const ptds = await prisma.professorTurmaDisciplina.findMany({
    where: {
      status: 'ATIVO',
      disciplinaId: { in: disciplinaIds },
      turma: { escolaId: aplicacao.escolaId, status: 'ATIVA' },
    },
    select: { professorId: true, turmaId: true, disciplinaId: true },
  });
  // Professor TAE (17/11/2026): o responsável de cada turma (o ligado primeiro) também é avisado.
  const taes = atuacaoIds.length ? await responsaveisPorAtuacao(prisma, { escolaIds: [aplicacao.escolaId], atuacaoIds }) : [];
  if (ptds.length === 0 && taes.length === 0) return new Map();

  const turmaIds = [...new Set([...ptds.map((p) => p.turmaId), ...taes.map((t) => t.turmaId)])];
  const alunos = await prisma.alunoPdi.findMany({ where: { turmaId: { in: turmaIds }, status: 'ATIVO' }, select: { id: true, turmaId: true } });
  if (alunos.length === 0) return new Map();

  const candidatos: { professorId: number; alunoId: number; disciplinaId: number | null; atuacaoId: number | null }[] = [];
  for (const ptd of ptds) {
    for (const aluno of alunos.filter((a) => a.turmaId === ptd.turmaId)) {
      candidatos.push({ professorId: ptd.professorId, alunoId: aluno.id, disciplinaId: ptd.disciplinaId, atuacaoId: null });
    }
  }
  for (const tae of taes) {
    for (const aluno of alunos.filter((a) => a.turmaId === tae.turmaId)) {
      candidatos.push({ professorId: tae.professorId, alunoId: aluno.id, disciplinaId: null, atuacaoId: tae.atuacaoId });
    }
  }
  if (candidatos.length === 0) return new Map();

  const chave = (c: { alunoId: number; disciplinaId: number | null; atuacaoId: number | null }) => (c.disciplinaId !== null ? `${c.alunoId}-${c.disciplinaId}` : `${c.alunoId}-a${c.atuacaoId}`);
  const fichas = await prisma.fichaPdi.findMany({
    where: { aplicacaoId: aplicacao.id, OR: candidatos.map((c) => (c.disciplinaId !== null ? { alunoId: c.alunoId, disciplinaId: c.disciplinaId } : { alunoId: c.alunoId, atuacaoId: c.atuacaoId })) },
    select: { alunoId: true, disciplinaId: true, atuacaoId: true, status: true },
  });
  const fichaPorChave = new Map(fichas.map((f) => [chave(f), f]));

  const pendentesPorProfessor = new Map<number, number>();
  for (const c of candidatos) {
    const ficha = fichaPorChave.get(chave(c));
    const concluida = ficha?.status === 'CONCLUIDA';
    if (concluida) continue;
    pendentesPorProfessor.set(c.professorId, (pendentesPorProfessor.get(c.professorId) ?? 0) + 1);
  }
  return pendentesPorProfessor;
}

export type ResultadoJobPrazoPdi = {
  aplicacoesAvaliadas: number;
  // "Tentadas", não "criadas": criarNotificacao ignora silenciosamente quando a chaveIdempotencia
  // já existe (reexecução no mesmo dia) — este número conta tentativas, não linhas novas no banco.
  notificacoesProfessorTentadas: number;
  notificacoesGestorTentadas: number;
};

// Executa a verificação diária de prazos de PDI (3 dias / 1 dia antes do fim de cada Aplicação).
// Aceita `agora` para permitir testes determinísticos (mesmo padrão de `statusVigencia(periodo,
// agora?)` em domain/pdiAplicacoes.ts) — em produção é chamado sem argumento pelo scheduler.
// Idempotente: cada Notificacao carrega uma chaveIdempotencia única; rodar isto 2x no mesmo dia
// não duplica nada (criarNotificacao ignora silenciosamente o conflito).
export async function executarVerificacaoPrazosPdi(prisma: PrismaClient, opts: { agora?: Date } = {}): Promise<ResultadoJobPrazoPdi> {
  const agora = opts.agora ?? new Date();
  const hojeISO = dataCivilSP(agora);

  const aplicacoes = await prisma.aplicacaoPdi.findMany({
    where: { status: 'ATIVA', escola: { status: 'ATIVA' } }, // removida (INATIVA) nunca gera aviso de prazo
    include: { escola: { select: { id: true, nome: true } }, modelos: { select: { disciplinaId: true, atuacaoId: true } } },
  });

  let notificacoesProfessorTentadas = 0;
  let notificacoesGestorTentadas = 0;
  let aplicacoesAvaliadas = 0;

  for (const aplicacao of aplicacoes) {
    const dataFimISO = dataCivilDeColunaDate(aplicacao.dataFim);
    const marco = marcoPrazoPdi(hojeISO, dataFimISO);
    if (!marco) continue;
    aplicacoesAvaliadas++;

    const disciplinaIds = [...new Set(aplicacao.modelos.map((m) => m.disciplinaId).filter((id): id is number => id !== null))];
    const atuacaoIds = [...new Set(aplicacao.modelos.map((m) => m.atuacaoId).filter((id): id is number => id !== null))];
    if (disciplinaIds.length === 0 && atuacaoIds.length === 0) continue;

    const pendentesPorProfessor = await calcularPendentesPorProfessor(prisma, aplicacao, disciplinaIds, atuacaoIds);

    for (const [professorId, pendentes] of pendentesPorProfessor) {
      if (pendentes === 0) continue;
      await criarNotificacao(prisma, {
        destinatarioId: professorId,
        tipo: 'PDI_PRAZO_PROFESSOR',
        titulo: 'Prazo do PDI',
        corpo: textoPrazoProfessor(pendentes, marco),
        linkContexto: '/pdi/meus-pdis',
        metadata: { aplicacaoId: aplicacao.id, marco },
        chaveIdempotencia: chaveIdempotenciaPrazoProfessor(marco, professorId, aplicacao.id),
      });
      notificacoesProfessorTentadas++;
    }

    const professoresComPendencia = [...pendentesPorProfessor.values()].filter((n) => n > 0).length;
    if (professoresComPendencia > 0) {
      const gestores = await prisma.vinculoEscolar.findMany({
        where: { escolaId: aplicacao.escolaId, status: 'ATIVO', pessoa: { perfil: 'GESTOR', status: 'ATIVO' } },
        select: { pessoaId: true },
      });
      for (const g of gestores) {
        await criarNotificacao(prisma, {
          destinatarioId: g.pessoaId,
          tipo: 'PDI_PRAZO_GESTOR',
          titulo: 'Prazo do PDI',
          corpo: textoPrazoGestor(professoresComPendencia, aplicacao.escola.nome, marco),
          linkContexto: '/pdi/alunos',
          metadata: { aplicacaoId: aplicacao.id, escolaId: aplicacao.escolaId, marco },
          chaveIdempotencia: chaveIdempotenciaPrazoGestor(marco, g.pessoaId, aplicacao.id),
        });
        notificacoesGestorTentadas++;
      }
    }
  }

  return { aplicacoesAvaliadas, notificacoesProfessorTentadas, notificacoesGestorTentadas };
}
