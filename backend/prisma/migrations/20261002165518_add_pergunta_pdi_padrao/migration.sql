-- CreateTable
CREATE TABLE "perguntas_pdi_padrao" (
    "id" SERIAL NOT NULL,
    "secao" VARCHAR(100) NOT NULL,
    "subsecao" VARCHAR(100),
    "codigo" VARCHAR(20),
    "texto" TEXT NOT NULL,
    "indicador" VARCHAR(100),
    "origem" "OrigemPerguntaPdi" NOT NULL,
    "tipoResposta" "TipoRespostaPdi" NOT NULL,
    "opcoes" JSONB,
    "complementar" JSONB,
    "ordem" INTEGER NOT NULL,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "perguntas_pdi_padrao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "perguntas_pdi_padrao_ordem_idx" ON "perguntas_pdi_padrao"("ordem");
