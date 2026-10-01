-- No máximo um ModeloAnamnese ATIVO por vez. Sem dimensão de partição (diferente de ModeloPdi,
-- que particiona por disciplina): todas as linhas que satisfazem o filtro têm o mesmo valor
-- 'ATIVA' na coluna, então a unicidade da própria coluna já garante no máximo uma linha ativa.
CREATE UNIQUE INDEX "modelos_anamnese_ativo_unico" ON "modelos_anamnese" ("status") WHERE "status" = 'ATIVA';
