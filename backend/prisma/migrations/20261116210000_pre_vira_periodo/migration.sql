-- 16/11/2026 (decisão do usuário): em SJN, "Pré I"/"Pré II" passam a se chamar "1º Período"/"2º Período".
-- Só DADOS, nas turmas que usam o nível antigo PRE_I/PRE_II: troca o começo do nome e liga a turma ao nível do
-- catálogo (niveis_infantil, criado na migration anterior). NÃO muda id, chave (identidadeChave), etapa, nível antigo,
-- turno, status nem nada ligado à turma (vínculos/alunos apontam para o id).
UPDATE "turmas"
SET "nome" = regexp_replace("nome", '^Pré II', '2º Período'),
    "nivelLocalId" = (SELECT "id" FROM "niveis_infantil" WHERE "nome" = '2º Período')
WHERE "nivel" = 'PRE_II';

UPDATE "turmas"
SET "nome" = regexp_replace("nome", '^Pré I', '1º Período'),
    "nivelLocalId" = (SELECT "id" FROM "niveis_infantil" WHERE "nome" = '1º Período')
WHERE "nivel" = 'PRE_I';
