-- Correções do Formulário 1/3 (decisões do usuário, 12/11/2026). Migration COMPLEMENTAR e só aditiva:
-- histórico de texto por semana (valor anterior/novo, quem, quando, origem) e a conversa da devolução.

-- AlterTable
ALTER TABLE "correcoes_entrega_um_terco" ADD COLUMN     "conversaId" INTEGER;

-- CreateTable
CREATE TABLE "historico_correcao_semana_um_terco" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "semanaId" INTEGER NOT NULL,
    "valorAnterior" TEXT,
    "valorNovo" TEXT NOT NULL,
    "alteradoPor" VARCHAR(200) NOT NULL,
    "alteradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" "OrigemHistoricoCorrecao" NOT NULL,

    CONSTRAINT "historico_correcao_semana_um_terco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historico_correcao_semana_um_terco_entregaId_alteradoEm_idx" ON "historico_correcao_semana_um_terco"("entregaId", "alteradoEm");

-- AddForeignKey
ALTER TABLE "historico_correcao_semana_um_terco" ADD CONSTRAINT "historico_correcao_semana_um_terco_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "entregas_um_terco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_correcao_semana_um_terco" ADD CONSTRAINT "historico_correcao_semana_um_terco_semanaId_fkey" FOREIGN KEY ("semanaId") REFERENCES "semanas_um_terco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

