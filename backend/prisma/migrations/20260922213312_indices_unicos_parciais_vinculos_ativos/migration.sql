-- Índices únicos PARCIAIS (só sobre linhas com status = 'ATIVO') — o Prisma ainda não tem
-- sintaxe declarativa para isso no schema.prisma, então esta migration foi escrita à mão
-- (gerada vazia via `prisma migrate dev --create-only` e completada aqui).
--
-- Garantem, no nível do banco (não só na aplicação):
--   * no máximo um professor ativo por (turmaId, disciplinaId);
--   * no máximo um Auxiliar ativo por turma.
-- Linhas com status = 'ENCERRADO' nunca colidem entre si, preservando o histórico de trocas.

CREATE UNIQUE INDEX "professor_turma_disciplinas_ativo_unico"
  ON "professor_turma_disciplinas" ("turmaId", "disciplinaId")
  WHERE "status" = 'ATIVO';

CREATE UNIQUE INDEX "auxiliar_turmas_ativo_unico"
  ON "auxiliar_turmas" ("turmaId")
  WHERE "status" = 'ATIVO';
