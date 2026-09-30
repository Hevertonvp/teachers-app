-- CreateEnum
CREATE TYPE "OrigemPerguntaPdi" AS ENUM ('ESTRUTURADA', 'HABILIDADE', 'ORIENTACAO', 'QUALITATIVA', 'PERSONALIZADA');

-- CreateEnum
CREATE TYPE "TipoRespostaPdi" AS ENUM ('TEXTO', 'SELECAO', 'MARCACAO', 'NUMERO', 'ORIENTACAO');

-- CreateTable
CREATE TABLE "modelos_pdi" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "disciplinaId" INTEGER NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "modelos_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perguntas_pdi" (
    "id" SERIAL NOT NULL,
    "modeloId" INTEGER NOT NULL,
    "secao" VARCHAR(100) NOT NULL,
    "subsecao" VARCHAR(100),
    "codigo" VARCHAR(20),
    "texto" TEXT NOT NULL,
    "indicador" VARCHAR(100),
    "origem" "OrigemPerguntaPdi" NOT NULL,
    "tipoResposta" "TipoRespostaPdi" NOT NULL,
    "opcoes" JSONB,
    "complementar" JSONB,
    "ordem" INTEGER NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "perguntas_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modelos_pdi_disciplinaId_status_idx" ON "modelos_pdi"("disciplinaId", "status");

-- CreateIndex
CREATE INDEX "perguntas_pdi_modeloId_ordem_idx" ON "perguntas_pdi"("modeloId", "ordem");

-- AddForeignKey
ALTER TABLE "modelos_pdi" ADD CONSTRAINT "modelos_pdi_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas_pdi" ADD CONSTRAINT "perguntas_pdi_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "modelos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
