-- Fluxo de correções para professores (10/11/2026). ADITIVA: colunas novas anuláveis, observação
-- ampliada de 500 para 2000 caracteres (alargar não perde dado) e uma tabela nova para o 1/3.

-- AlterTable
ALTER TABLE "correcoes_bloco_padrao_pdi" ADD COLUMN     "conferencia" VARCHAR(20),
ADD COLUMN     "conferidaEm" TIMESTAMP(3),
ADD COLUMN     "conferidaPor" VARCHAR(200),
ALTER COLUMN "observacao" SET DATA TYPE VARCHAR(2000);

-- AlterTable
ALTER TABLE "correcoes_ficha_pdi" ADD COLUMN     "conferencia" VARCHAR(20),
ADD COLUMN     "conferidaEm" TIMESTAMP(3),
ADD COLUMN     "conferidaPor" VARCHAR(200),
ALTER COLUMN "observacao" SET DATA TYPE VARCHAR(2000);

-- AlterTable
ALTER TABLE "mensagens" ADD COLUMN     "linkFormulario" VARCHAR(300);

-- CreateTable
CREATE TABLE "correcoes_entrega_um_terco" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "observacao" VARCHAR(2000) NOT NULL,
    "status" "StatusCorrecaoFichaPdi" NOT NULL DEFAULT 'ABERTA',
    "criadaPor" VARCHAR(200) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prazoAte" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3),
    "concluidaPor" VARCHAR(200),
    "conferidaEm" TIMESTAMP(3),
    "conferidaPor" VARCHAR(200),
    "conferencia" VARCHAR(20),

    CONSTRAINT "correcoes_entrega_um_terco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "correcoes_entrega_um_terco_entregaId_idx" ON "correcoes_entrega_um_terco"("entregaId");

-- AddForeignKey
ALTER TABLE "correcoes_entrega_um_terco" ADD CONSTRAINT "correcoes_entrega_um_terco_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "entregas_um_terco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

