-- 17/11/2026: turma INTEGRAL (registro administrativo + vínculo de Professor). Só acrescenta: todas as turmas
-- existentes viram REGULAR e continuam com etapa e identificador preenchidos (o CHECK garante para as regulares).
CREATE TYPE "TipoTurma" AS ENUM ('REGULAR', 'INTEGRAL');
ALTER TABLE "turmas" ADD COLUMN "tipo" "TipoTurma" NOT NULL DEFAULT 'REGULAR',
ALTER COLUMN "etapa" DROP NOT NULL,
ALTER COLUMN "identificador" DROP NOT NULL;

-- Regular: etapa e identificador obrigatórios (como sempre). Integral: sem etapa, ano/série, nível nem identificador.
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_tipo_campos_chk" CHECK (
  ("tipo" = 'REGULAR' AND "etapa" IS NOT NULL AND "identificador" IS NOT NULL)
  OR ("tipo" = 'INTEGRAL' AND "etapa" IS NULL AND "identificador" IS NULL AND "anoSerie" IS NULL
      AND "segmento" IS NULL AND "nivel" IS NULL AND "nivelLocalId" IS NULL)
);
