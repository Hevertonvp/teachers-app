-- Formulário 1/3 por CARGO (decisão do usuário, 12/11/2026). Migration COMPLEMENTAR e só aditiva:
-- cria cargos_professor, cargo_versoes e entregas_um_terco_cargos; em entregas_um_terco acrescenta
-- chaveCargos/composicao e deixa anoSerie/disciplinaId opcionais (nada é apagado). Auditoria antes de
-- aplicar na produção: 0 ciclos, 0 entregas, 0 respostas do 1/3.

-- CreateEnum
CREATE TYPE "StatusCargo" AS ENUM ('ATIVO', 'ENCERRADO');

-- AlterTable
ALTER TABLE "entregas_um_terco" ADD COLUMN     "chaveCargos" VARCHAR(100),
ADD COLUMN     "composicao" JSONB,
ALTER COLUMN "anoSerie" DROP NOT NULL,
ALTER COLUMN "disciplinaId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "cargos_professor" (
    "id" SERIAL NOT NULL,
    "professorId" INTEGER NOT NULL,
    "status" "StatusCargo" NOT NULL DEFAULT 'ATIVO',
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(200),
    "encerradoEm" TIMESTAMP(3),
    "encerradoPor" VARCHAR(200),

    CONSTRAINT "cargos_professor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_versoes" (
    "id" SERIAL NOT NULL,
    "cargoId" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadaPor" VARCHAR(200),
    "composicao" JSONB NOT NULL,

    CONSTRAINT "cargo_versoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas_um_terco_cargos" (
    "entregaId" INTEGER NOT NULL,
    "cargoId" INTEGER NOT NULL,

    CONSTRAINT "entregas_um_terco_cargos_pkey" PRIMARY KEY ("entregaId","cargoId")
);

-- CreateIndex
CREATE INDEX "cargos_professor_professorId_status_idx" ON "cargos_professor"("professorId", "status");

-- CreateIndex
CREATE INDEX "cargo_versoes_cargoId_criadaEm_idx" ON "cargo_versoes"("cargoId", "criadaEm");

-- CreateIndex
CREATE INDEX "entregas_um_terco_cargos_cargoId_idx" ON "entregas_um_terco_cargos"("cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_um_terco_cicloId_professorId_chaveCargos_key" ON "entregas_um_terco"("cicloId", "professorId", "chaveCargos");

-- AddForeignKey
ALTER TABLE "cargos_professor" ADD CONSTRAINT "cargos_professor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_versoes" ADD CONSTRAINT "cargo_versoes_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos_professor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_um_terco_cargos" ADD CONSTRAINT "entregas_um_terco_cargos_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "entregas_um_terco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_um_terco_cargos" ADD CONSTRAINT "entregas_um_terco_cargos_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos_professor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

