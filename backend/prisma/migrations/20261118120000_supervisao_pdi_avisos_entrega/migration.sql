-- 18/11/2026: Supervisora corrige Ficha PDI (origem própria no histórico) e avisos de entrega por escola.
-- Só acrescenta valores a enums existentes; nada é alterado nem apagado.
ALTER TYPE "OrigemHistoricoCorrecao" ADD VALUE 'SUPERVISAO_DIRETA';
ALTER TYPE "TipoNotificacao" ADD VALUE 'CORRECAO_FORMULARIO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'ENTREGA_ESCOLA_COMPLETA';
ALTER TYPE "TipoNotificacao" ADD VALUE 'ENTREGA_PRAZO_AMANHA';
ALTER TYPE "TipoNotificacao" ADD VALUE 'ENTREGA_ATRASADA';
