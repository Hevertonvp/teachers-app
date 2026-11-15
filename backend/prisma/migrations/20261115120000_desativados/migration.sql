-- Desativados em tela própria por área (decisão do usuário, 15/11/2026). SÓ ADITIVA:
-- colunas novas e opcionais; nada é apagado. Só preenche a data dos registros que JÁ estão inativos.
ALTER TABLE "escolas" ADD COLUMN "desativadoEm" TIMESTAMP(3), ADD COLUMN "desativadoPor" TEXT;
ALTER TABLE "turmas" ADD COLUMN "desativadoEm" TIMESTAMP(3), ADD COLUMN "desativadoPor" TEXT;
ALTER TABLE "pessoas" ADD COLUMN "desativadoEm" TIMESTAMP(3), ADD COLUMN "desativadoPor" TEXT;
ALTER TABLE "atuacoes_pedagogicas" ADD COLUMN "desativadoEm" TIMESTAMP(3), ADD COLUMN "desativadoPor" TEXT;
ALTER TABLE "ciclos_um_terco" ADD COLUMN "desativadoEm" TIMESTAMP(3), ADD COLUMN "desativadoPor" TEXT;
ALTER TABLE "modelos_pdi" ADD COLUMN "desativadoEm" TIMESTAMP(3), ADD COLUMN "desativadoPor" TEXT;
ALTER TABLE "aplicacoes_pdi" ADD COLUMN "desativadoEm" TIMESTAMP(3), ADD COLUMN "desativadoPor" TEXT;
ALTER TABLE "alunos_pdi" ADD COLUMN "desativadoEm" TIMESTAMP(3), ADD COLUMN "desativadoPor" TEXT;
ALTER TABLE "perguntas_pdi_padrao" ADD COLUMN "desativadoEm" TIMESTAMP(3), ADD COLUMN "desativadoPor" TEXT;

-- Já inativos: data aproximada = última alteração (ou criação). Pessoas: data e autor exatos do
-- último evento INATIVACAO, quando existe.
UPDATE "escolas" SET "desativadoEm" = COALESCE("updatedAt", "createdAt") WHERE "status" = 'INATIVA';
UPDATE "turmas" SET "desativadoEm" = COALESCE("updatedAt", "createdAt") WHERE "status" = 'INATIVA';
UPDATE "atuacoes_pedagogicas" SET "desativadoEm" = COALESCE("updatedAt", "createdAt") WHERE "status" = 'INATIVA';
UPDATE "ciclos_um_terco" SET "desativadoEm" = COALESCE("updatedAt", "createdAt") WHERE "status" = 'INATIVA';
UPDATE "modelos_pdi" SET "desativadoEm" = COALESCE("updatedAt", "createdAt") WHERE "status" = 'INATIVA';
UPDATE "aplicacoes_pdi" SET "desativadoEm" = COALESCE("updatedAt", "createdAt") WHERE "status" = 'INATIVA';
UPDATE "alunos_pdi" SET "desativadoEm" = COALESCE("updatedAt", "createdAt") WHERE "status" = 'ARQUIVADO';
UPDATE "perguntas_pdi_padrao" SET "desativadoEm" = COALESCE("updatedAt", "createdAt") WHERE "status" = 'INATIVA';
UPDATE "pessoas" p SET
  "desativadoEm" = COALESCE((SELECT MAX(e."criadoEm") FROM "pessoa_eventos" e WHERE e."pessoaId" = p."id" AND e."tipo" = 'INATIVACAO'), p."updatedAt", p."createdAt"),
  "desativadoPor" = (SELECT e."autorId"::text FROM "pessoa_eventos" e WHERE e."pessoaId" = p."id" AND e."tipo" = 'INATIVACAO' ORDER BY e."criadoEm" DESC LIMIT 1)
WHERE p."status" = 'INATIVO';
