-- Segurança: as 3 colunas removidas abaixo foram criadas na migration anterior (formato antigo do
-- tipo HABILIDADE_CRMG, uma habilidade + escala por pergunta) e nunca foram usadas. Se houver
-- qualquer dado nelas, a migration ABORTA em vez de apagar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "perguntas_pdi" WHERE "habilidadeCurricularId" IS NOT NULL OR "tipoResposta" = 'HABILIDADE_CRMG')
     OR EXISTS (SELECT 1 FROM "aplicacao_perguntas_pdi" WHERE "habilidadeIdOriginal" IS NOT NULL OR "habilidadeSnapshot" IS NOT NULL OR "tipoResposta" = 'HABILIDADE_CRMG') THEN
    RAISE EXCEPTION 'Existem dados no formato antigo de HABILIDADE_CRMG — migration interrompida.';
  END IF;
END $$;
-- DropForeignKey
ALTER TABLE "aplicacao_perguntas_pdi" DROP CONSTRAINT "aplicacao_perguntas_pdi_habilidadeIdOriginal_fkey";

-- DropForeignKey
ALTER TABLE "perguntas_pdi" DROP CONSTRAINT "perguntas_pdi_habilidadeCurricularId_fkey";

-- AlterTable
ALTER TABLE "aplicacao_perguntas_pdi" DROP COLUMN "habilidadeIdOriginal",
DROP COLUMN "habilidadeSnapshot";

-- AlterTable
ALTER TABLE "aplicacoes_pdi" ADD COLUMN     "trimestre" INTEGER;

-- AlterTable
ALTER TABLE "perguntas_pdi" DROP COLUMN "habilidadeCurricularId",
ADD COLUMN     "trimestre" INTEGER;

-- AlterTable
ALTER TABLE "perguntas_pdi_padrao" ADD COLUMN     "trimestre" INTEGER;

-- CreateTable
CREATE TABLE "periodos_trimestre" (
    "trimestre" INTEGER NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "periodos_trimestre_pkey" PRIMARY KEY ("trimestre")
);


ALTER TABLE "periodos_trimestre" ADD CONSTRAINT "periodos_trimestre_trimestre_check" CHECK ("trimestre" BETWEEN 1 AND 3);
ALTER TABLE "perguntas_pdi" ADD CONSTRAINT "perguntas_pdi_trimestre_check" CHECK ("trimestre" IS NULL OR "trimestre" BETWEEN 1 AND 3);
ALTER TABLE "perguntas_pdi_padrao" ADD CONSTRAINT "perguntas_pdi_padrao_trimestre_check" CHECK ("trimestre" IS NULL OR "trimestre" BETWEEN 1 AND 3);

-- Calendário inicial = os mesmos períodos que a tela Configurações > Trimestres já exibia
-- (trimestrePeriodsIniciais no frontend). A Secretaria continua alterando pela mesma tela.
INSERT INTO "periodos_trimestre" ("trimestre", "dataInicio", "dataFim") VALUES
  (1, '2026-02-02', '2026-04-30'),
  (2, '2026-05-01', '2026-08-15'),
  (3, '2026-08-16', '2026-12-18')
ON CONFLICT ("trimestre") DO NOTHING;