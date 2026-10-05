-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('NOVA_MENSAGEM', 'PDI_PRAZO_PROFESSOR', 'PDI_PRAZO_GESTOR');

-- CreateEnum
CREATE TYPE "StatusAssinaturaPush" AS ENUM ('ATIVA', 'INATIVA');

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" SERIAL NOT NULL,
    "destinatarioId" INTEGER NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "corpo" TEXT NOT NULL,
    "linkContexto" VARCHAR(200),
    "metadata" JSONB,
    "chaveIdempotencia" VARCHAR(200),
    "lidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas_push" (
    "id" SERIAL NOT NULL,
    "pessoaId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" VARCHAR(300),
    "status" "StatusAssinaturaPush" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "assinaturas_push_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_chaveIdempotencia_key" ON "notificacoes"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "notificacoes_destinatarioId_lidaEm_idx" ON "notificacoes"("destinatarioId", "lidaEm");

-- CreateIndex
CREATE INDEX "notificacoes_destinatarioId_createdAt_idx" ON "notificacoes"("destinatarioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_push_endpoint_key" ON "assinaturas_push"("endpoint");

-- CreateIndex
CREATE INDEX "assinaturas_push_pessoaId_status_idx" ON "assinaturas_push"("pessoaId", "status");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_push" ADD CONSTRAINT "assinaturas_push_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
