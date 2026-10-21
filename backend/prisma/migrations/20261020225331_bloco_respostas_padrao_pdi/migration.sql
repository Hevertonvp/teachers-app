-- AlterTable
ALTER TABLE "perguntas_pdi" ADD COLUMN     "padraoOriginalId" INTEGER;

-- CreateTable
CREATE TABLE "aplicacao_perguntas_padrao_pdi" (
    "id" SERIAL NOT NULL,
    "aplicacaoId" INTEGER NOT NULL,
    "padraoOriginalId" INTEGER NOT NULL,
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

    CONSTRAINT "aplicacao_perguntas_padrao_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicacao_modelo_perguntas_padrao_pdi" (
    "id" SERIAL NOT NULL,
    "aplicacaoModeloId" INTEGER NOT NULL,
    "aplicacaoPerguntaPadraoId" INTEGER NOT NULL,

    CONSTRAINT "aplicacao_modelo_perguntas_padrao_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocos_respostas_padrao_pdi" (
    "id" SERIAL NOT NULL,
    "aplicacaoId" INTEGER NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "professorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "blocos_respostas_padrao_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_padrao_pdi" (
    "id" SERIAL NOT NULL,
    "blocoId" INTEGER NOT NULL,
    "aplicacaoPerguntaPadraoId" INTEGER NOT NULL,
    "valor" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(200),
    "updatedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(200),

    CONSTRAINT "respostas_padrao_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correcoes_bloco_padrao_pdi" (
    "id" SERIAL NOT NULL,
    "blocoId" INTEGER NOT NULL,
    "observacao" VARCHAR(500) NOT NULL,
    "status" "StatusCorrecaoFichaPdi" NOT NULL DEFAULT 'ABERTA',
    "criadaPor" VARCHAR(200) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prazoAte" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3),
    "concluidaPor" VARCHAR(200),

    CONSTRAINT "correcoes_bloco_padrao_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_correcao_resposta_padrao" (
    "id" SERIAL NOT NULL,
    "blocoId" INTEGER NOT NULL,
    "aplicacaoPerguntaPadraoId" INTEGER NOT NULL,
    "valorAnterior" JSONB,
    "valorNovo" JSONB NOT NULL,
    "alteradoPor" VARCHAR(200) NOT NULL,
    "alteradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" "OrigemHistoricoCorrecao" NOT NULL,

    CONSTRAINT "historico_correcao_resposta_padrao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aplicacao_perguntas_padrao_pdi_aplicacaoId_padraoOriginalId_key" ON "aplicacao_perguntas_padrao_pdi"("aplicacaoId", "padraoOriginalId");

-- CreateIndex
CREATE INDEX "aplicacao_modelo_perguntas_padrao_pdi_aplicacaoModeloId_idx" ON "aplicacao_modelo_perguntas_padrao_pdi"("aplicacaoModeloId");

-- CreateIndex
CREATE UNIQUE INDEX "aplicacao_modelo_perguntas_padrao_pdi_aplicacaoModeloId_apl_key" ON "aplicacao_modelo_perguntas_padrao_pdi"("aplicacaoModeloId", "aplicacaoPerguntaPadraoId");

-- CreateIndex
CREATE UNIQUE INDEX "blocos_respostas_padrao_pdi_aplicacaoId_alunoId_turmaId_pro_key" ON "blocos_respostas_padrao_pdi"("aplicacaoId", "alunoId", "turmaId", "professorId");

-- CreateIndex
CREATE INDEX "respostas_padrao_pdi_blocoId_idx" ON "respostas_padrao_pdi"("blocoId");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_padrao_pdi_blocoId_aplicacaoPerguntaPadraoId_key" ON "respostas_padrao_pdi"("blocoId", "aplicacaoPerguntaPadraoId");

-- CreateIndex
CREATE INDEX "correcoes_bloco_padrao_pdi_blocoId_idx" ON "correcoes_bloco_padrao_pdi"("blocoId");

-- CreateIndex
CREATE INDEX "historico_correcao_resposta_padrao_blocoId_idx" ON "historico_correcao_resposta_padrao"("blocoId");

-- CreateIndex
CREATE INDEX "perguntas_pdi_padraoOriginalId_idx" ON "perguntas_pdi"("padraoOriginalId");

-- AddForeignKey
ALTER TABLE "perguntas_pdi" ADD CONSTRAINT "perguntas_pdi_padraoOriginalId_fkey" FOREIGN KEY ("padraoOriginalId") REFERENCES "perguntas_pdi_padrao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_perguntas_padrao_pdi" ADD CONSTRAINT "aplicacao_perguntas_padrao_pdi_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "aplicacoes_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_perguntas_padrao_pdi" ADD CONSTRAINT "aplicacao_perguntas_padrao_pdi_padraoOriginalId_fkey" FOREIGN KEY ("padraoOriginalId") REFERENCES "perguntas_pdi_padrao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_modelo_perguntas_padrao_pdi" ADD CONSTRAINT "aplicacao_modelo_perguntas_padrao_pdi_aplicacaoModeloId_fkey" FOREIGN KEY ("aplicacaoModeloId") REFERENCES "aplicacao_modelos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_modelo_perguntas_padrao_pdi" ADD CONSTRAINT "aplicacao_modelo_perguntas_padrao_pdi_aplicacaoPerguntaPad_fkey" FOREIGN KEY ("aplicacaoPerguntaPadraoId") REFERENCES "aplicacao_perguntas_padrao_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocos_respostas_padrao_pdi" ADD CONSTRAINT "blocos_respostas_padrao_pdi_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "aplicacoes_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocos_respostas_padrao_pdi" ADD CONSTRAINT "blocos_respostas_padrao_pdi_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocos_respostas_padrao_pdi" ADD CONSTRAINT "blocos_respostas_padrao_pdi_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocos_respostas_padrao_pdi" ADD CONSTRAINT "blocos_respostas_padrao_pdi_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_padrao_pdi" ADD CONSTRAINT "respostas_padrao_pdi_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "blocos_respostas_padrao_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_padrao_pdi" ADD CONSTRAINT "respostas_padrao_pdi_aplicacaoPerguntaPadraoId_fkey" FOREIGN KEY ("aplicacaoPerguntaPadraoId") REFERENCES "aplicacao_perguntas_padrao_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcoes_bloco_padrao_pdi" ADD CONSTRAINT "correcoes_bloco_padrao_pdi_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "blocos_respostas_padrao_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_correcao_resposta_padrao" ADD CONSTRAINT "historico_correcao_resposta_padrao_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "blocos_respostas_padrao_pdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
