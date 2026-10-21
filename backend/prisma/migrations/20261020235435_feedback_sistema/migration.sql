-- CreateEnum
CREATE TYPE "CategoriaFeedbackSistema" AS ENUM ('ERRO_BUG', 'SUGESTAO_MELHORIA', 'DIFICULDADE_USO', 'LENTIDAO_TECNICO', 'OUTRO_PROBLEMA');

-- CreateEnum
CREATE TYPE "StatusFeedbackSistema" AS ENUM ('NOVO', 'EM_ANALISE', 'RESOLVIDO', 'NAO_E_PROBLEMA_DO_SISTEMA');

-- CreateEnum
CREATE TYPE "TipoEventoFeedbackSistema" AS ENUM ('CRIACAO', 'MUDANCA_STATUS', 'REABERTURA_AUTOMATICA');

-- AlterEnum
ALTER TYPE "PerfilPessoa" ADD VALUE 'SUPORTE_SISTEMA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacao" ADD VALUE 'NOVO_FEEDBACK_SISTEMA';
ALTER TYPE "TipoNotificacao" ADD VALUE 'RESPOSTA_FEEDBACK_SISTEMA';

-- CreateTable
CREATE TABLE "feedbacks_sistema" (
    "id" SERIAL NOT NULL,
    "autorId" INTEGER NOT NULL,
    "autorPerfilSnapshot" "PerfilPessoa" NOT NULL,
    "escolaId" INTEGER,
    "categoria" "CategoriaFeedbackSistema" NOT NULL,
    "assunto" VARCHAR(200) NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "StatusFeedbackSistema" NOT NULL DEFAULT 'NOVO',
    "rotaOrigem" VARCHAR(200),
    "userAgentResumo" VARCHAR(200),
    "tipoDispositivo" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "feedbacks_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_feedback_sistema" (
    "id" SERIAL NOT NULL,
    "feedbackId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_feedback_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_sistema_eventos" (
    "id" SERIAL NOT NULL,
    "feedbackId" INTEGER NOT NULL,
    "tipo" "TipoEventoFeedbackSistema" NOT NULL,
    "statusAnterior" "StatusFeedbackSistema",
    "statusNovo" "StatusFeedbackSistema",
    "autorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_sistema_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedbacks_sistema_status_createdAt_idx" ON "feedbacks_sistema"("status", "createdAt");

-- CreateIndex
CREATE INDEX "feedbacks_sistema_autorId_idx" ON "feedbacks_sistema"("autorId");

-- CreateIndex
CREATE INDEX "feedbacks_sistema_categoria_idx" ON "feedbacks_sistema"("categoria");

-- CreateIndex
CREATE INDEX "mensagens_feedback_sistema_feedbackId_createdAt_idx" ON "mensagens_feedback_sistema"("feedbackId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_sistema_eventos_feedbackId_createdAt_idx" ON "feedback_sistema_eventos"("feedbackId", "createdAt");

-- AddForeignKey
ALTER TABLE "feedbacks_sistema" ADD CONSTRAINT "feedbacks_sistema_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks_sistema" ADD CONSTRAINT "feedbacks_sistema_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_feedback_sistema" ADD CONSTRAINT "mensagens_feedback_sistema_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedbacks_sistema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_feedback_sistema" ADD CONSTRAINT "mensagens_feedback_sistema_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_sistema_eventos" ADD CONSTRAINT "feedback_sistema_eventos_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedbacks_sistema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_sistema_eventos" ADD CONSTRAINT "feedback_sistema_eventos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
