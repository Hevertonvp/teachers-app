-- Separa "pergunta padrão" (entra automaticamente em todo Modelo novo) de "resposta compartilhada"
-- (uma resposta só no bloco comum do Professor). Default true = comportamento de sempre para todas
-- as perguntas padrão existentes; nenhuma é reclassificada aqui, exceto HABILIDADE_CRMG, que já
-- nunca era compartilhada na prática (pdiModelos.ts sempre a copiou sem vínculo) — só alinha o dado.

-- AlterTable
ALTER TABLE "perguntas_pdi_padrao" ADD COLUMN "compartilhada" BOOLEAN NOT NULL DEFAULT true;

UPDATE "perguntas_pdi_padrao" SET "compartilhada" = false WHERE "tipoResposta" = 'HABILIDADE_CRMG';

-- CRMG é sempre isolado por disciplina: nunca pode ir pro bloco compartilhado.
ALTER TABLE "perguntas_pdi_padrao" ADD CONSTRAINT "perguntas_pdi_padrao_crmg_nao_compartilhada_check"
  CHECK (NOT ("compartilhada" AND "tipoResposta" = 'HABILIDADE_CRMG'));
