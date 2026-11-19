import type { PrismaClient } from '@prisma/client';
import { criarNotificacao } from './notificacoes.js';
import { pdiSoSecretaria } from '../config/modulos.js';
// Janela de 30 min: vários "Salvar" seguidos da mesma correção viram um aviso só; uma nova correção depois avisa de novo.
const janela30min = () => Math.floor(Date.now() / (30 * 60 * 1000));

// Avisos de correção de Ficha PDI (decisão do usuário, 18/11/2026). Só notificação (sino + celular),
// nunca mensagem: pela hierarquia a Secretaria não conversa com a Supervisora.
//  - Secretaria corrige direto ou devolve → Supervisoras (GESTOR) com vínculo ATIVO na escola da Ficha.
//  - Supervisora corrige direto → Professor que preencheu a Ficha. (Quando ela DEVOLVE, o Professor já
//    recebe a mensagem automática da devolução; a Secretaria não é avisada em nenhum dos dois casos.)
// Nunca lança: o aviso não pode derrubar a correção, que já foi gravada.

type FichaDoAviso = {
  id: number; escolaId: number; aplicacaoId: number; alunoId: number; professorResponsavelId: number;
  professorNomeSnapshot: string; alunoNomeSnapshot: string; disciplinaNomeSnapshot: string;
};

export async function avisarCorrecaoPdi(
  prisma: PrismaClient,
  actor: { id: number; perfil: string },
  ficha: FichaDoAviso,
  acao: 'corrigida' | 'devolvida',
  chaveDaDevolucao?: string,
): Promise<void> {
  // PDI em desenvolvimento (19/11/2026): Supervisora e Professor ainda não têm acesso — sem aviso.
  if (pdiSoSecretaria()) return;
  try {
    const contexto = `${ficha.alunoNomeSnapshot} · ${ficha.disciplinaNomeSnapshot}`;
    if (actor.perfil === 'SECRETARIA') {
      const supervisoras = await prisma.vinculoEscolar.findMany({
        where: { escolaId: ficha.escolaId, status: 'ATIVO', pessoa: { perfil: 'GESTOR', status: 'ATIVO' } },
        select: { pessoaId: true },
      });
      // Correção direta: um aviso por Ficha e Supervisora a cada janela de 30 min.
      const sufixo = acao === 'corrigida' ? `pdi-corrigida-secretaria:${ficha.id}:${janela30min()}` : `${chaveDaDevolucao}:supervisao`;
      await Promise.all([...new Set(supervisoras.map((s) => s.pessoaId))].map((pessoaId) => criarNotificacao(prisma, {
        destinatarioId: pessoaId,
        tipo: 'CORRECAO_FORMULARIO',
        titulo: acao === 'corrigida' ? 'PDI corrigido pela Secretaria' : 'PDI devolvido pela Secretaria',
        corpo: `Formulário do professor ${ficha.professorNomeSnapshot} ${acao === 'corrigida' ? 'corrigido' : 'devolvido'} pela Secretaria. ${contexto}.`,
        linkContexto: `/correcoes/pdi/${ficha.id}`,
        metadata: { fichaId: ficha.id, acao },
        chaveIdempotencia: `${sufixo}:${pessoaId}`,
      })));
      return;
    }
    if (actor.perfil === 'GESTOR' && acao === 'corrigida') {
      const professor = await prisma.pessoa.findUnique({ where: { id: ficha.professorResponsavelId }, select: { id: true, status: true } });
      if (!professor || professor.status !== 'ATIVO') return;
      await criarNotificacao(prisma, {
        destinatarioId: professor.id,
        tipo: 'CORRECAO_FORMULARIO',
        titulo: 'PDI corrigido pela supervisão',
        corpo: `${contexto}.`,
        linkContexto: `/pdi/aluno/${ficha.aplicacaoId}/${ficha.alunoId}`,
        metadata: { fichaId: ficha.id, acao },
        chaveIdempotencia: `pdi-corrigida-supervisao:${ficha.id}:${janela30min()}:${professor.id}`,
      });
    }
  } catch (err) {
    console.error('[avisosCorrecaoPdi] falha ao avisar correção', { fichaId: ficha.id, acao }, err);
  }
}
