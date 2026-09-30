-- Índice único PARCIAL (só sobre linhas com status = 'ATIVA') — mesma estratégia já usada em
-- professor_turma_disciplinas_ativo_unico/auxiliar_turmas_ativo_unico (ver migration
-- 20260922213312). Garante, no nível do banco, no máximo um ModeloPdi ATIVO por disciplina.
-- Linhas INATIVA nunca colidem entre si, preservando o histórico de modelos substituídos.

CREATE UNIQUE INDEX "modelos_pdi_ativo_unico"
  ON "modelos_pdi" ("disciplinaId")
  WHERE "status" = 'ATIVA';
