-- 17/11/2026: perguntas de Computação no PDI (BNCC Computação), bloco adicional por ano do aluno.
-- Só ACRESCENTA: enums novos, tabela nova, colunas novas (nulas/vazias nas linhas existentes) e
-- perguntaIdOriginal passa a aceitar nulo (todas as linhas existentes continuam preenchidas).

-- AlterEnum
ALTER TYPE "ComponenteCurricular" ADD VALUE 'COMPUTACAO';

-- AlterEnum
ALTER TYPE "TipoRespostaPdi" ADD VALUE 'HABILIDADE_COMPUTACAO';

-- AlterTable
ALTER TABLE "aplicacao_perguntas_pdi" ADD COLUMN     "anos" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "perguntaComputacaoIdOriginal" INTEGER,
ALTER COLUMN "perguntaIdOriginal" DROP NOT NULL;

-- AlterTable
ALTER TABLE "fichas_pdi" ADD COLUMN     "anoSerieSnapshot" INTEGER;

-- CreateTable
CREATE TABLE "perguntas_computacao_pdi" (
    "id" SERIAL NOT NULL,
    "habilidadeId" INTEGER,
    "codigo" VARCHAR(20),
    "anos" INTEGER[],
    "secao" VARCHAR(100) NOT NULL,
    "texto" TEXT NOT NULL,
    "observacao" TEXT,
    "tipoResposta" "TipoRespostaPdi" NOT NULL,
    "opcoes" JSONB,
    "complementar" JSONB,
    "ordem" INTEGER NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "desativadoEm" TIMESTAMP(3),
    "desativadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "perguntas_computacao_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "perguntas_computacao_pdi_status_ordem_idx" ON "perguntas_computacao_pdi"("status", "ordem");

-- AddForeignKey
ALTER TABLE "perguntas_computacao_pdi" ADD CONSTRAINT "perguntas_computacao_pdi_habilidadeId_fkey" FOREIGN KEY ("habilidadeId") REFERENCES "habilidades_curriculares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_perguntas_pdi" ADD CONSTRAINT "aplicacao_perguntas_pdi_perguntaComputacaoIdOriginal_fkey" FOREIGN KEY ("perguntaComputacaoIdOriginal") REFERENCES "perguntas_computacao_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Toda pergunta congelada vem de um Modelo OU de uma pergunta de Computação (nunca nenhuma, nunca as duas).
ALTER TABLE "aplicacao_perguntas_pdi" ADD CONSTRAINT "aplicacao_perguntas_pdi_origem_unica_chk"
  CHECK (num_nonnulls("perguntaIdOriginal", "perguntaComputacaoIdOriginal") = 1);
-- Pergunta de Computação congelada sempre diz para quais anos vale.
ALTER TABLE "aplicacao_perguntas_pdi" ADD CONSTRAINT "aplicacao_perguntas_pdi_computacao_anos_chk"
  CHECK ("perguntaComputacaoIdOriginal" IS NULL OR cardinality("anos") > 0);
-- Pergunta de Computação: ao menos um ano, todos entre 1 e 9.
ALTER TABLE "perguntas_computacao_pdi" ADD CONSTRAINT "perguntas_computacao_pdi_anos_chk"
  CHECK (cardinality("anos") > 0 AND "anos" <@ ARRAY[1,2,3,4,5,6,7,8,9]);
