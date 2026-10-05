-- CreateTable
CREATE TABLE "conversas_mensagem" (
    "id" SERIAL NOT NULL,
    "escolaId" INTEGER NOT NULL,
    "assunto" VARCHAR(200) NOT NULL,
    "loteId" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "conversas_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participantes_conversa" (
    "id" SERIAL NOT NULL,
    "conversaId" INTEGER NOT NULL,
    "pessoaId" INTEGER NOT NULL,
    "ocultaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participantes_conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" SERIAL NOT NULL,
    "conversaId" INTEGER NOT NULL,
    "remetenteId" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "lidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversas_mensagem_escolaId_idx" ON "conversas_mensagem"("escolaId");

-- CreateIndex
CREATE INDEX "conversas_mensagem_loteId_idx" ON "conversas_mensagem"("loteId");

-- CreateIndex
CREATE INDEX "participantes_conversa_pessoaId_idx" ON "participantes_conversa"("pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "participantes_conversa_conversaId_pessoaId_key" ON "participantes_conversa"("conversaId", "pessoaId");

-- CreateIndex
CREATE INDEX "mensagens_conversaId_createdAt_idx" ON "mensagens"("conversaId", "createdAt");

-- AddForeignKey
ALTER TABLE "conversas_mensagem" ADD CONSTRAINT "conversas_mensagem_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes_conversa" ADD CONSTRAINT "participantes_conversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas_mensagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes_conversa" ADD CONSTRAINT "participantes_conversa_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas_mensagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
