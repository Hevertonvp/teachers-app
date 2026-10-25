-- Calendário de trimestres passa a ser POR ANO LETIVO: chave (ano, trimestre) em vez de só
-- (trimestre). Nada é apagado: as linhas existentes recebem o ano das próprias datas.
--
-- Segurança: se alguma linha existente tiver início e fim em anos diferentes, ou fim antes do
-- início, não há como deduzir o ano com segurança — a migration ABORTA em vez de adivinhar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "periodos_trimestre"
    WHERE EXTRACT(YEAR FROM "dataInicio") <> EXTRACT(YEAR FROM "dataFim") OR "dataFim" < "dataInicio"
  ) THEN
    RAISE EXCEPTION 'Existe período de trimestre com datas em anos diferentes ou fim antes do início — migration interrompida.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "periodos_trimestre" ADD COLUMN "ano" INTEGER;
UPDATE "periodos_trimestre" SET "ano" = EXTRACT(YEAR FROM "dataInicio")::INTEGER;
ALTER TABLE "periodos_trimestre" ALTER COLUMN "ano" SET NOT NULL;

ALTER TABLE "periodos_trimestre" DROP CONSTRAINT "periodos_trimestre_pkey";
ALTER TABLE "periodos_trimestre" ADD CONSTRAINT "periodos_trimestre_pkey" PRIMARY KEY ("ano", "trimestre");

-- Mesmas regras validadas no backend (routes/trimestres.ts), repetidas aqui como última barreira:
-- fim nunca antes do início, e as duas datas sempre dentro do próprio ano da configuração.
-- Sobreposição entre trimestres do mesmo ano é validada no backend (sob lock por ano).
ALTER TABLE "periodos_trimestre" ADD CONSTRAINT "periodos_trimestre_ano_check" CHECK ("ano" BETWEEN 2000 AND 2100);
ALTER TABLE "periodos_trimestre" ADD CONSTRAINT "periodos_trimestre_datas_check" CHECK ("dataFim" >= "dataInicio");
ALTER TABLE "periodos_trimestre" ADD CONSTRAINT "periodos_trimestre_datas_no_ano_check" CHECK (
  EXTRACT(YEAR FROM "dataInicio") = "ano" AND EXTRACT(YEAR FROM "dataFim") = "ano"
);
