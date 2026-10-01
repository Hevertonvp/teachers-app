-- CreateEnum
CREATE TYPE "StatusFichaPdi" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA');

-- CreateTable
CREATE TABLE "fichas_pdi" (
    "id" SERIAL NOT NULL,
    "aplicacaoId" INTEGER NOT NULL,
    "aplicacaoModeloId" INTEGER NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "disciplinaId" INTEGER NOT NULL,
    "professorResponsavelId" INTEGER NOT NULL,
    "alunoNomeSnapshot" VARCHAR(200) NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "turmaNomeSnapshot" VARCHAR(60) NOT NULL,
    "escolaId" INTEGER NOT NULL,
    "escolaNomeSnapshot" VARCHAR(200) NOT NULL,
    "disciplinaNomeSnapshot" VARCHAR(100) NOT NULL,
    "professorNomeSnapshot" VARCHAR(200) NOT NULL,
    "aplicacaoDataInicioSnapshot" DATE NOT NULL,
    "aplicacaoDataFimSnapshot" DATE NOT NULL,
    "status" "StatusFichaPdi" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "concluidaEm" TIMESTAMP(3),
    "concluidaPor" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "fichas_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_pdi" (
    "id" SERIAL NOT NULL,
    "fichaId" INTEGER NOT NULL,
    "aplicacaoPerguntaId" INTEGER NOT NULL,
    "valor" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "respostas_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fichas_pdi_alunoId_idx" ON "fichas_pdi"("alunoId");

-- CreateIndex
CREATE INDEX "fichas_pdi_professorResponsavelId_idx" ON "fichas_pdi"("professorResponsavelId");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_pdi_aplicacaoId_alunoId_disciplinaId_key" ON "fichas_pdi"("aplicacaoId", "alunoId", "disciplinaId");

-- CreateIndex
CREATE INDEX "respostas_pdi_fichaId_idx" ON "respostas_pdi"("fichaId");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_pdi_fichaId_aplicacaoPerguntaId_key" ON "respostas_pdi"("fichaId", "aplicacaoPerguntaId");

-- AddForeignKey
ALTER TABLE "fichas_pdi" ADD CONSTRAINT "fichas_pdi_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "aplicacoes_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pdi" ADD CONSTRAINT "fichas_pdi_aplicacaoModeloId_fkey" FOREIGN KEY ("aplicacaoModeloId") REFERENCES "aplicacao_modelos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pdi" ADD CONSTRAINT "fichas_pdi_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pdi" ADD CONSTRAINT "fichas_pdi_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pdi" ADD CONSTRAINT "fichas_pdi_professorResponsavelId_fkey" FOREIGN KEY ("professorResponsavelId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pdi" ADD CONSTRAINT "fichas_pdi_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pdi" ADD CONSTRAINT "fichas_pdi_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_pdi" ADD CONSTRAINT "respostas_pdi_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_pdi" ADD CONSTRAINT "respostas_pdi_aplicacaoPerguntaId_fkey" FOREIGN KEY ("aplicacaoPerguntaId") REFERENCES "aplicacao_perguntas_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
