-- CreateEnum
CREATE TYPE "TipoRespostaAnamnese" AS ENUM ('TEXTO', 'SELECAO', 'MARCACAO', 'NUMERO', 'ORIENTACAO', 'SELECAO_MULTIPLA');

-- CreateEnum
CREATE TYPE "StatusAnamnese" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "PossuiLaudo" AS ENUM ('SIM', 'NAO', 'EM_INVESTIGACAO');

-- AlterTable
ALTER TABLE "alunos_pdi" ADD COLUMN     "dataNascimento" DATE,
ADD COLUMN     "responsavelTelefoneSecundario" VARCHAR(30);

-- CreateTable
CREATE TABLE "modelos_anamnese" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "modelos_anamnese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perguntas_anamnese" (
    "id" SERIAL NOT NULL,
    "modeloAnamneseId" INTEGER NOT NULL,
    "secao" VARCHAR(100) NOT NULL,
    "subsecao" VARCHAR(100),
    "texto" TEXT NOT NULL,
    "explicacao" TEXT,
    "tipoResposta" "TipoRespostaAnamnese" NOT NULL,
    "opcoes" JSONB,
    "complementar" JSONB,
    "ordem" INTEGER NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "perguntas_anamnese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamneses" (
    "id" SERIAL NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "modeloAnamneseId" INTEGER NOT NULL,
    "numeroVersao" INTEGER NOT NULL,
    "status" "StatusAnamnese" NOT NULL DEFAULT 'PENDENTE',
    "anoEscolaridade" VARCHAR(50),
    "possuiLaudo" "PossuiLaudo",
    "cid" VARCHAR(50),
    "responsaveisPdi" JSONB NOT NULL,
    "acompanhadoForaDaEscola" BOOLEAN,
    "especialidadesAcompanhamento" JSONB,
    "especialidadeOutroTexto" VARCHAR(200),
    "usoContinuoMedicamento" BOOLEAN,
    "medicamentoQual" VARCHAR(200),
    "medicamentoPrescritoPor" VARCHAR(200),
    "medicamentoQuando" VARCHAR(200),
    "medicamentoParaQue" VARCHAR(200),
    "medicamentoEfeitosColaterais" BOOLEAN,
    "medicamentoEfeitosQuais" TEXT,
    "comoGostaDeSeDivertir" TEXT,
    "idadeInicioEscola" VARCHAR(50),
    "ondeComecou" VARCHAR(200),
    "percursoEscolar" TEXT,
    "frequentaSalaRecursos" BOOLEAN,
    "frequenciaAtendimento" VARCHAR(200),
    "alunoNomeSnapshot" VARCHAR(200) NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "turmaNomeSnapshot" VARCHAR(60) NOT NULL,
    "escolaId" INTEGER NOT NULL,
    "escolaNomeSnapshot" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "concluidaEm" TIMESTAMP(3),
    "concluidaPor" VARCHAR(200),

    CONSTRAINT "anamneses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_anamnese" (
    "id" SERIAL NOT NULL,
    "anamneseId" INTEGER NOT NULL,
    "perguntaAnamneseId" INTEGER NOT NULL,
    "valor" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "respostas_anamnese_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "perguntas_anamnese_modeloAnamneseId_ordem_idx" ON "perguntas_anamnese"("modeloAnamneseId", "ordem");

-- CreateIndex
CREATE INDEX "anamneses_alunoId_idx" ON "anamneses"("alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "anamneses_alunoId_numeroVersao_key" ON "anamneses"("alunoId", "numeroVersao");

-- CreateIndex
CREATE INDEX "respostas_anamnese_anamneseId_idx" ON "respostas_anamnese"("anamneseId");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_anamnese_anamneseId_perguntaAnamneseId_key" ON "respostas_anamnese"("anamneseId", "perguntaAnamneseId");

-- AddForeignKey
ALTER TABLE "perguntas_anamnese" ADD CONSTRAINT "perguntas_anamnese_modeloAnamneseId_fkey" FOREIGN KEY ("modeloAnamneseId") REFERENCES "modelos_anamnese"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_modeloAnamneseId_fkey" FOREIGN KEY ("modeloAnamneseId") REFERENCES "modelos_anamnese"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_anamnese" ADD CONSTRAINT "respostas_anamnese_anamneseId_fkey" FOREIGN KEY ("anamneseId") REFERENCES "anamneses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_anamnese" ADD CONSTRAINT "respostas_anamnese_perguntaAnamneseId_fkey" FOREIGN KEY ("perguntaAnamneseId") REFERENCES "perguntas_anamnese"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
