-- Formulário 1/3: escolas atendidas por ciclo (decisão do usuário, 10/11/2026).
-- Aditiva: ciclos existentes ficam com todasEscolas = true (mesmo comportamento de antes: todas as escolas).

-- AlterTable
ALTER TABLE "ciclos_um_terco" ADD COLUMN "todasEscolas" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ciclos_um_terco_escolas" (
    "cicloId" INTEGER NOT NULL,
    "escolaId" INTEGER NOT NULL,

    CONSTRAINT "ciclos_um_terco_escolas_pkey" PRIMARY KEY ("cicloId","escolaId")
);

-- CreateIndex
CREATE INDEX "ciclos_um_terco_escolas_escolaId_idx" ON "ciclos_um_terco_escolas"("escolaId");

-- AddForeignKey
ALTER TABLE "ciclos_um_terco_escolas" ADD CONSTRAINT "ciclos_um_terco_escolas_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "ciclos_um_terco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ciclos_um_terco_escolas" ADD CONSTRAINT "ciclos_um_terco_escolas_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
