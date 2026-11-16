-- 16/11/2026: estrutura da escola (etapas oferecidas, anos do Fundamental, níveis da Educação Infantil) e nível LOCAL
-- na turma. SÓ ADITIVA: tipos, colunas e tabelas novas. Nenhuma escola ou turma existente é alterada (as colunas
-- novas começam vazias = "etapas não informadas"; turmas antigas continuam com o nível antigo e nivelLocalId nulo).

-- CreateEnum
CREATE TYPE "EtapaOferecida" AS ENUM ('EDUCACAO_INFANTIL', 'FUNDAMENTAL_I', 'FUNDAMENTAL_II');

-- AlterTable
ALTER TABLE "escolas" ADD COLUMN     "anosFundamental" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "etapasOferecidas" "EtapaOferecida"[] DEFAULT ARRAY[]::"EtapaOferecida"[];

-- AlterTable
ALTER TABLE "turmas" ADD COLUMN     "nivelLocalId" INTEGER;

-- CreateTable
CREATE TABLE "niveis_infantil" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "faixa" "SegmentoInfantil" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "niveis_infantil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escola_niveis_infantil" (
    "escolaId" INTEGER NOT NULL,
    "nivelId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escola_niveis_infantil_pkey" PRIMARY KEY ("escolaId","nivelId")
);

-- CreateIndex
CREATE UNIQUE INDEX "niveis_infantil_nome_key" ON "niveis_infantil"("nome");

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_nivelLocalId_fkey" FOREIGN KEY ("nivelLocalId") REFERENCES "niveis_infantil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escola_niveis_infantil" ADD CONSTRAINT "escola_niveis_infantil_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escola_niveis_infantil" ADD CONSTRAINT "escola_niveis_infantil_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "niveis_infantil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Níveis iniciais (padrão de Minas; cada escola marca só os que oferece). Nomes conforme a Secretaria; os antigos
-- "Pré I/Pré II" das turmas existentes NÃO são ligados a estes (nomenclatura de SJN a confirmar).
INSERT INTO "niveis_infantil" ("nome", "faixa", "ordem") VALUES
  ('Berçário I', 'CRECHE', 1),
  ('Berçário II', 'CRECHE', 2),
  ('Maternal 1', 'CRECHE', 3),
  ('Maternal 2', 'CRECHE', 4),
  ('Maternal 3', 'CRECHE', 5),
  ('1º Período', 'PRE_ESCOLA', 6),
  ('2º Período', 'PRE_ESCOLA', 7);
