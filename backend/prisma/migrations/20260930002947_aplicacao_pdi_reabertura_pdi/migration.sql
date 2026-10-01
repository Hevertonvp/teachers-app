-- CreateTable
CREATE TABLE "aplicacoes_pdi" (
    "id" SERIAL NOT NULL,
    "escolaId" INTEGER NOT NULL,
    "nome" VARCHAR(200),
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "aplicacoes_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicacao_modelos_pdi" (
    "id" SERIAL NOT NULL,
    "aplicacaoId" INTEGER NOT NULL,
    "modeloIdOriginal" INTEGER NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "disciplinaId" INTEGER NOT NULL,
    "disciplinaNome" VARCHAR(100) NOT NULL,

    CONSTRAINT "aplicacao_modelos_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicacao_perguntas_pdi" (
    "id" SERIAL NOT NULL,
    "aplicacaoModeloId" INTEGER NOT NULL,
    "perguntaIdOriginal" INTEGER NOT NULL,
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

    CONSTRAINT "aplicacao_perguntas_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reaberturas_pdi" (
    "id" SERIAL NOT NULL,
    "aplicacaoId" INTEGER NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "solicitadoPorTipo" "PerfilPessoa" NOT NULL,
    "motivo" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),

    CONSTRAINT "reaberturas_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aplicacoes_pdi_escolaId_dataInicio_dataFim_idx" ON "aplicacoes_pdi"("escolaId", "dataInicio", "dataFim");

-- CreateIndex
CREATE INDEX "aplicacao_modelos_pdi_aplicacaoId_idx" ON "aplicacao_modelos_pdi"("aplicacaoId");

-- CreateIndex
CREATE INDEX "aplicacao_perguntas_pdi_aplicacaoModeloId_idx" ON "aplicacao_perguntas_pdi"("aplicacaoModeloId");

-- CreateIndex
CREATE INDEX "reaberturas_pdi_aplicacaoId_idx" ON "reaberturas_pdi"("aplicacaoId");

-- AddForeignKey
ALTER TABLE "aplicacoes_pdi" ADD CONSTRAINT "aplicacoes_pdi_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_modelos_pdi" ADD CONSTRAINT "aplicacao_modelos_pdi_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "aplicacoes_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_modelos_pdi" ADD CONSTRAINT "aplicacao_modelos_pdi_modeloIdOriginal_fkey" FOREIGN KEY ("modeloIdOriginal") REFERENCES "modelos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_modelos_pdi" ADD CONSTRAINT "aplicacao_modelos_pdi_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_perguntas_pdi" ADD CONSTRAINT "aplicacao_perguntas_pdi_aplicacaoModeloId_fkey" FOREIGN KEY ("aplicacaoModeloId") REFERENCES "aplicacao_modelos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_perguntas_pdi" ADD CONSTRAINT "aplicacao_perguntas_pdi_perguntaIdOriginal_fkey" FOREIGN KEY ("perguntaIdOriginal") REFERENCES "perguntas_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaberturas_pdi" ADD CONSTRAINT "reaberturas_pdi_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "aplicacoes_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
