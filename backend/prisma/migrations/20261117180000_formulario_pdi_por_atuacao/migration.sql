-- 17/11/2026: Ficha/snapshot PDI de ATUAÇÃO pedagógica (Professor TAE), além de disciplina. Só acrescenta colunas
-- nulas e afrouxa NOT NULL (todas as linhas existentes continuam com disciplina/modelo preenchidos).

-- AlterTable
ALTER TABLE "aplicacao_modelos_pdi" ADD COLUMN     "atuacaoId" INTEGER,
ALTER COLUMN "modeloIdOriginal" DROP NOT NULL,
ALTER COLUMN "disciplinaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "fichas_pdi" ADD COLUMN     "atuacaoId" INTEGER,
ALTER COLUMN "disciplinaId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "fichas_pdi_aplicacaoId_alunoId_atuacaoId_key" ON "fichas_pdi"("aplicacaoId", "alunoId", "atuacaoId");

-- AddForeignKey
ALTER TABLE "aplicacao_modelos_pdi" ADD CONSTRAINT "aplicacao_modelos_pdi_atuacaoId_fkey" FOREIGN KEY ("atuacaoId") REFERENCES "atuacoes_pedagogicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pdi" ADD CONSTRAINT "fichas_pdi_atuacaoId_fkey" FOREIGN KEY ("atuacaoId") REFERENCES "atuacoes_pedagogicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Snapshot: disciplina (com Modelo) OU atuação (sem Modelo) — nunca os dois, nunca nenhum.
ALTER TABLE "aplicacao_modelos_pdi" ADD CONSTRAINT "aplicacao_modelos_pdi_disciplina_ou_atuacao_chk"
  CHECK (("disciplinaId" IS NOT NULL AND "modeloIdOriginal" IS NOT NULL AND "atuacaoId" IS NULL)
      OR ("disciplinaId" IS NULL AND "modeloIdOriginal" IS NULL AND "atuacaoId" IS NOT NULL));
-- Ficha: disciplina OU atuação.
ALTER TABLE "fichas_pdi" ADD CONSTRAINT "fichas_pdi_disciplina_ou_atuacao_chk"
  CHECK (num_nonnulls("disciplinaId", "atuacaoId") = 1);
