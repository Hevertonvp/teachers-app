-- Atuação pedagógica do cargo (decisão do usuário, 12/11/2026). Migration COMPLEMENTAR e só aditiva: cria o
-- catálogo atuacoes_pedagogicas com a lista inicial. Nenhuma tabela ou coluna existente muda; cargos, versões,
-- entregas e respostas já gravados ficam exatamente como estão (composição sem atuacaoIds = nenhuma atuação).

-- CreateTable
CREATE TABLE "atuacoes_pedagogicas" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "atuacoes_pedagogicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "atuacoes_pedagogicas_nome_key" ON "atuacoes_pedagogicas"("nome");


-- Lista inicial (não definitiva; a Secretaria cadastra outras em Configurações).
INSERT INTO "atuacoes_pedagogicas" ("nome", "status", "createdBy", "updatedAt") VALUES
  ('Professor Regente', 'ATIVA', 'migration', CURRENT_TIMESTAMP),
  ('Oficina do Brincar', 'ATIVA', 'migration', CURRENT_TIMESTAMP),
  ('Professor de Intervenção', 'ATIVA', 'migration', CURRENT_TIMESTAMP)
ON CONFLICT ("nome") DO NOTHING;
