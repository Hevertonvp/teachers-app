-- CreateEnum
CREATE TYPE "TipoEventoPessoa" AS ENUM ('CRIACAO', 'VINCULO_CRIADO', 'RESET_SENHA', 'PRIMEIRO_ACESSO_CONCLUIDO', 'INATIVACAO', 'REATIVACAO');

-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "senhaTemporaria" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "senhaTemporariaExpiraEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "pessoa_eventos" (
    "id" SERIAL NOT NULL,
    "pessoaId" INTEGER NOT NULL,
    "tipo" "TipoEventoPessoa" NOT NULL,
    "autorId" INTEGER NOT NULL,
    "detalhe" VARCHAR(200),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pessoa_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pessoa_eventos_pessoaId_criadoEm_idx" ON "pessoa_eventos"("pessoaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "pessoa_eventos" ADD CONSTRAINT "pessoa_eventos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
