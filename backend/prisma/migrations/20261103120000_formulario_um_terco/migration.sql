-- CreateEnum
CREATE TYPE "StatusEntregaUmTerco" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "TipoEventoEntregaUmTerco" AS ENUM ('INICIADA', 'SALVA', 'CONCLUIDA', 'COBERTURA_ADICIONADA', 'COBERTURA_ENCERRADA');

-- CreateTable
CREATE TABLE "ciclos_um_terco" (
    "id" SERIAL NOT NULL,
    "anoLetivo" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "titulo" VARCHAR(200) NOT NULL DEFAULT 'Formulário 1/3',
    "abreEm" TIMESTAMP(3) NOT NULL,
    "prazoEm" TIMESTAMP(3) NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "ciclos_um_terco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semanas_um_terco" (
    "id" SERIAL NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,

    CONSTRAINT "semanas_um_terco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas_um_terco" (
    "id" SERIAL NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "professorId" INTEGER NOT NULL,
    "anoSerie" INTEGER NOT NULL,
    "disciplinaId" INTEGER NOT NULL,
    "status" "StatusEntregaUmTerco" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entregas_um_terco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_semana_um_terco" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "semanaId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "respostas_semana_um_terco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobertura_entrega_um_terco" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "vinculoId" INTEGER NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "escolaId" INTEGER NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ate" TIMESTAMP(3),

    CONSTRAINT "cobertura_entrega_um_terco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reaberturas_um_terco" (
    "id" SERIAL NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3) NOT NULL,
    "motivo" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),

    CONSTRAINT "reaberturas_um_terco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_entrega_um_terco" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "tipo" "TipoEventoEntregaUmTerco" NOT NULL,
    "pessoaId" INTEGER,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalhe" JSONB,

    CONSTRAINT "historico_entrega_um_terco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ciclos_um_terco_anoLetivo_trimestre_idx" ON "ciclos_um_terco"("anoLetivo", "trimestre");

-- CreateIndex
CREATE UNIQUE INDEX "semanas_um_terco_cicloId_numero_key" ON "semanas_um_terco"("cicloId", "numero");

-- CreateIndex
CREATE INDEX "entregas_um_terco_professorId_idx" ON "entregas_um_terco"("professorId");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_um_terco_cicloId_professorId_anoSerie_disciplinaId_key" ON "entregas_um_terco"("cicloId", "professorId", "anoSerie", "disciplinaId");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_semana_um_terco_entregaId_semanaId_key" ON "respostas_semana_um_terco"("entregaId", "semanaId");

-- CreateIndex
CREATE INDEX "cobertura_entrega_um_terco_escolaId_idx" ON "cobertura_entrega_um_terco"("escolaId");

-- CreateIndex
CREATE INDEX "cobertura_entrega_um_terco_turmaId_idx" ON "cobertura_entrega_um_terco"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "cobertura_entrega_um_terco_entregaId_vinculoId_key" ON "cobertura_entrega_um_terco"("entregaId", "vinculoId");

-- CreateIndex
CREATE INDEX "reaberturas_um_terco_cicloId_idx" ON "reaberturas_um_terco"("cicloId");

-- CreateIndex
CREATE INDEX "historico_entrega_um_terco_entregaId_quando_idx" ON "historico_entrega_um_terco"("entregaId", "quando");

-- AddForeignKey
ALTER TABLE "semanas_um_terco" ADD CONSTRAINT "semanas_um_terco_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "ciclos_um_terco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_um_terco" ADD CONSTRAINT "entregas_um_terco_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "ciclos_um_terco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_um_terco" ADD CONSTRAINT "entregas_um_terco_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_um_terco" ADD CONSTRAINT "entregas_um_terco_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_semana_um_terco" ADD CONSTRAINT "respostas_semana_um_terco_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "entregas_um_terco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_semana_um_terco" ADD CONSTRAINT "respostas_semana_um_terco_semanaId_fkey" FOREIGN KEY ("semanaId") REFERENCES "semanas_um_terco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura_entrega_um_terco" ADD CONSTRAINT "cobertura_entrega_um_terco_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "entregas_um_terco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura_entrega_um_terco" ADD CONSTRAINT "cobertura_entrega_um_terco_vinculoId_fkey" FOREIGN KEY ("vinculoId") REFERENCES "professor_turma_disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura_entrega_um_terco" ADD CONSTRAINT "cobertura_entrega_um_terco_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura_entrega_um_terco" ADD CONSTRAINT "cobertura_entrega_um_terco_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaberturas_um_terco" ADD CONSTRAINT "reaberturas_um_terco_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "ciclos_um_terco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_entrega_um_terco" ADD CONSTRAINT "historico_entrega_um_terco_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "entregas_um_terco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

