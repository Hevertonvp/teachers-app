-- 17/11/2026: formulário PDI de DISCIPLINA sem Modelo (Informática: só perguntas de Computação, decisão do usuário).
-- Só afrouxa a regra do snapshot: disciplina pode vir com ou sem Modelo; atuação continua sempre sem Modelo.
-- Nenhuma linha existente muda (todas já satisfazem a regra nova).
ALTER TABLE "aplicacao_modelos_pdi" DROP CONSTRAINT "aplicacao_modelos_pdi_disciplina_ou_atuacao_chk";
ALTER TABLE "aplicacao_modelos_pdi" ADD CONSTRAINT "aplicacao_modelos_pdi_disciplina_ou_atuacao_chk"
  CHECK (("disciplinaId" IS NOT NULL AND "atuacaoId" IS NULL)
      OR ("disciplinaId" IS NULL AND "modeloIdOriginal" IS NULL AND "atuacaoId" IS NOT NULL));
