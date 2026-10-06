-- CreateEnum
CREATE TYPE "StatusFichaAnualPdi" AS ENUM ('EM_ANDAMENTO', 'FECHADA');

-- CreateEnum
CREATE TYPE "StatusCorrecaoFichaPdi" AS ENUM ('ABERTA', 'RESOLVIDA');

-- CreateEnum
CREATE TYPE "OrigemHistoricoCorrecao" AS ENUM ('SECRETARIA_DIRETA', 'PROFESSOR_POS_DEVOLUCAO');

-- CreateTable
CREATE TABLE "movimentacoes_aluno_pdi" (
    "id" SERIAL NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "registradoPor" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_aluno_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichas_anuais_pdi" (
    "id" SERIAL NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "status" "StatusFichaAnualPdi" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadaEm" TIMESTAMP(3),
    "fechadaPor" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "fichas_anuais_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ciclos_anuais_pdi" (
    "ano" INTEGER NOT NULL,
    "dataEncerramento" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "ciclos_anuais_pdi_pkey" PRIMARY KEY ("ano")
);

-- CreateTable
CREATE TABLE "correcoes_ficha_pdi" (
    "id" SERIAL NOT NULL,
    "fichaId" INTEGER NOT NULL,
    "observacao" VARCHAR(500) NOT NULL,
    "status" "StatusCorrecaoFichaPdi" NOT NULL DEFAULT 'ABERTA',
    "criadaPor" VARCHAR(200) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prazoAte" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3),
    "concluidaPor" VARCHAR(200),

    CONSTRAINT "correcoes_ficha_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_correcao_resposta" (
    "id" SERIAL NOT NULL,
    "fichaId" INTEGER NOT NULL,
    "aplicacaoPerguntaId" INTEGER NOT NULL,
    "valorAnterior" JSONB,
    "valorNovo" JSONB NOT NULL,
    "alteradoPor" VARCHAR(200) NOT NULL,
    "alteradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" "OrigemHistoricoCorrecao" NOT NULL,

    CONSTRAINT "historico_correcao_resposta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimentacoes_aluno_pdi_alunoId_dataInicio_idx" ON "movimentacoes_aluno_pdi"("alunoId", "dataInicio");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_anuais_pdi_alunoId_ano_key" ON "fichas_anuais_pdi"("alunoId", "ano");

-- CreateIndex
CREATE INDEX "correcoes_ficha_pdi_fichaId_idx" ON "correcoes_ficha_pdi"("fichaId");

-- CreateIndex
CREATE INDEX "historico_correcao_resposta_fichaId_idx" ON "historico_correcao_resposta"("fichaId");

-- AddForeignKey
ALTER TABLE "movimentacoes_aluno_pdi" ADD CONSTRAINT "movimentacoes_aluno_pdi_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_aluno_pdi" ADD CONSTRAINT "movimentacoes_aluno_pdi_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_anuais_pdi" ADD CONSTRAINT "fichas_anuais_pdi_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcoes_ficha_pdi" ADD CONSTRAINT "correcoes_ficha_pdi_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_correcao_resposta" ADD CONSTRAINT "historico_correcao_resposta_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: garante que todo AlunoPdi já existente tem pelo menos uma MovimentacaoAlunoPdi aberta
-- (dataFim NULL) refletindo a turma atual dele, com dataInicio = criação do cadastro. Sem isso,
-- alunos cadastrados antes desta tabela existir ficariam sem nenhum histórico de movimentação.
-- Nunca sobrescreve nada: é só um INSERT aditivo, roda uma única vez nesta migration.
INSERT INTO "movimentacoes_aluno_pdi" ("alunoId", "turmaId", "dataInicio", "dataFim", "registradoPor", "createdAt")
SELECT "id", "turmaId", "createdAt", NULL, 'backfill_migration', CURRENT_TIMESTAMP
FROM "alunos_pdi";
