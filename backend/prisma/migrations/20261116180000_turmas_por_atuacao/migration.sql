-- 16/11/2026: turma ligada ao professor por ATUAÇÃO pedagógica (Professor Regente, Oficina do Brincar, TAE...),
-- sem disciplina. SÓ ADITIVA: cria uma tabela nova; nenhuma tabela existente é alterada.

-- CreateTable
CREATE TABLE "professor_turma_atuacoes" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "professorId" INTEGER NOT NULL,
    "atuacaoId" INTEGER NOT NULL,
    "status" "StatusVinculo" NOT NULL DEFAULT 'ATIVO',
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),

    CONSTRAINT "professor_turma_atuacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professor_turma_atuacoes_turmaId_idx" ON "professor_turma_atuacoes"("turmaId");

-- CreateIndex
CREATE INDEX "professor_turma_atuacoes_professorId_idx" ON "professor_turma_atuacoes"("professorId");

-- No máximo um vínculo ATIVO por (professor, turma, atuação).
CREATE UNIQUE INDEX "professor_turma_atuacoes_ativo_unico" ON "professor_turma_atuacoes"("professorId", "turmaId", "atuacaoId") WHERE "status" = 'ATIVO';

-- AddForeignKey
ALTER TABLE "professor_turma_atuacoes" ADD CONSTRAINT "professor_turma_atuacoes_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_turma_atuacoes" ADD CONSTRAINT "professor_turma_atuacoes_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_turma_atuacoes" ADD CONSTRAINT "professor_turma_atuacoes_atuacaoId_fkey" FOREIGN KEY ("atuacaoId") REFERENCES "atuacoes_pedagogicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
