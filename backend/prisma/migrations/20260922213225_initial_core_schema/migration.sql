-- CreateEnum
CREATE TYPE "StatusRegistro" AS ENUM ('ATIVA', 'INATIVA');

-- CreateEnum
CREATE TYPE "StatusVinculo" AS ENUM ('ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "StatusPessoa" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusAluno" AS ENUM ('ATIVO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "EtapaEnsino" AS ENUM ('FUNDAMENTAL', 'EDUCACAO_INFANTIL');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE');

-- CreateEnum
CREATE TYPE "SegmentoInfantil" AS ENUM ('CRECHE', 'PRE_ESCOLA');

-- CreateEnum
CREATE TYPE "NivelInfantil" AS ENUM ('BERCARIO_I', 'BERCARIO_II', 'MATERNAL_I', 'MATERNAL_II', 'PRE_I', 'PRE_II');

-- CreateEnum
CREATE TYPE "PerfilPessoa" AS ENUM ('SECRETARIA', 'GESTOR', 'DIRETORA', 'PROFESSOR', 'AUXILIAR');

-- CreateEnum
CREATE TYPE "ModuloSistema" AS ENUM ('PDI', 'MENSAGENS', 'FORMULARIO_UM_TERCO', 'CORRECOES');

-- CreateTable
CREATE TABLE "escolas" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "escolas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escola_modulos" (
    "id" SERIAL NOT NULL,
    "escolaId" INTEGER NOT NULL,
    "modulo" "ModuloSistema" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "escola_modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinas" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,

    CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" SERIAL NOT NULL,
    "escolaId" INTEGER NOT NULL,
    "anoLetivo" INTEGER NOT NULL,
    "etapa" "EtapaEnsino" NOT NULL,
    "anoSerie" INTEGER,
    "segmento" "SegmentoInfantil",
    "nivel" "NivelInfantil",
    "turno" "Turno" NOT NULL,
    "identificador" INTEGER NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "identidadeChave" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoas" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "cargo" VARCHAR(100),
    "perfil" "PerfilPessoa" NOT NULL,
    "status" "StatusPessoa" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculos_escolares" (
    "id" SERIAL NOT NULL,
    "escolaId" INTEGER NOT NULL,
    "pessoaId" INTEGER NOT NULL,
    "status" "StatusVinculo" NOT NULL DEFAULT 'ATIVO',
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),

    CONSTRAINT "vinculos_escolares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professor_turma_disciplinas" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "professorId" INTEGER NOT NULL,
    "disciplinaId" INTEGER NOT NULL,
    "status" "StatusVinculo" NOT NULL DEFAULT 'ATIVO',
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE,

    CONSTRAINT "professor_turma_disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxiliar_turmas" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "auxiliarId" INTEGER NOT NULL,
    "status" "StatusVinculo" NOT NULL DEFAULT 'ATIVO',
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE,

    CONSTRAINT "auxiliar_turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alunos_pdi" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "responsavelNome" VARCHAR(200) NOT NULL,
    "responsavelParentesco" VARCHAR(50) NOT NULL,
    "responsavelTelefone" VARCHAR(30) NOT NULL,
    "status" "StatusAluno" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "alunos_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escola_modulos_escolaId_modulo_key" ON "escola_modulos"("escolaId", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "disciplinas_nome_key" ON "disciplinas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "turmas_identidadeChave_key" ON "turmas"("identidadeChave");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_email_key" ON "pessoas"("email");

-- CreateIndex
CREATE INDEX "vinculos_escolares_escolaId_pessoaId_status_idx" ON "vinculos_escolares"("escolaId", "pessoaId", "status");

-- CreateIndex
CREATE INDEX "professor_turma_disciplinas_turmaId_disciplinaId_idx" ON "professor_turma_disciplinas"("turmaId", "disciplinaId");

-- CreateIndex
CREATE INDEX "professor_turma_disciplinas_professorId_idx" ON "professor_turma_disciplinas"("professorId");

-- CreateIndex
CREATE INDEX "auxiliar_turmas_turmaId_idx" ON "auxiliar_turmas"("turmaId");

-- CreateIndex
CREATE INDEX "auxiliar_turmas_auxiliarId_idx" ON "auxiliar_turmas"("auxiliarId");

-- CreateIndex
CREATE INDEX "alunos_pdi_turmaId_idx" ON "alunos_pdi"("turmaId");

-- AddForeignKey
ALTER TABLE "escola_modulos" ADD CONSTRAINT "escola_modulos_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos_escolares" ADD CONSTRAINT "vinculos_escolares_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos_escolares" ADD CONSTRAINT "vinculos_escolares_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_turma_disciplinas" ADD CONSTRAINT "professor_turma_disciplinas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_turma_disciplinas" ADD CONSTRAINT "professor_turma_disciplinas_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_turma_disciplinas" ADD CONSTRAINT "professor_turma_disciplinas_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auxiliar_turmas" ADD CONSTRAINT "auxiliar_turmas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auxiliar_turmas" ADD CONSTRAINT "auxiliar_turmas_auxiliarId_fkey" FOREIGN KEY ("auxiliarId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alunos_pdi" ADD CONSTRAINT "alunos_pdi_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
