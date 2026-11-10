-- Acompanhamento Escolar: "foto" do PDI no prazo (decisão do usuário, 10/11/2026).
-- Aditiva: só cria uma tabela nova; nada existente muda.

-- CreateTable
CREATE TABLE "fotografias_aplicacao_pdi" (
    "aplicacaoId" INTEGER NOT NULL,
    "escolaId" INTEGER NOT NULL,
    "esperado" INTEGER NOT NULL,
    "concluidas" INTEGER NOT NULL,
    "emAndamento" INTEGER NOT NULL,
    "tiradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotografias_aplicacao_pdi_pkey" PRIMARY KEY ("aplicacaoId")
);

-- CreateIndex
CREATE INDEX "fotografias_aplicacao_pdi_escolaId_idx" ON "fotografias_aplicacao_pdi"("escolaId");

-- AddForeignKey
ALTER TABLE "fotografias_aplicacao_pdi" ADD CONSTRAINT "fotografias_aplicacao_pdi_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "aplicacoes_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
