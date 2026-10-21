-- CreateEnum
CREATE TYPE "ComponenteCurricular" AS ENUM ('ARTE', 'CIENCIAS', 'EDUCACAO_FISICA', 'ENSINO_RELIGIOSO', 'GEOGRAFIA', 'HISTORIA', 'LINGUA_INGLESA', 'LINGUA_PORTUGUESA', 'MATEMATICA');

-- AlterEnum
ALTER TYPE "TipoRespostaPdi" ADD VALUE 'HABILIDADE_CRMG';

-- AlterTable
ALTER TABLE "aplicacao_perguntas_pdi" ADD COLUMN     "habilidadeIdOriginal" INTEGER,
ADD COLUMN     "habilidadeSnapshot" JSONB;

-- AlterTable
ALTER TABLE "perguntas_pdi" ADD COLUMN     "habilidadeCurricularId" INTEGER;

-- CreateTable
CREATE TABLE "habilidades_curriculares" (
    "id" SERIAL NOT NULL,
    "versaoCurriculo" VARCHAR(40) NOT NULL,
    "chaveImportacao" VARCHAR(80) NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "descricaoOficial" TEXT NOT NULL,
    "componente" "ComponenteCurricular" NOT NULL,
    "anoOuBloco" VARCHAR(10),
    "anosEscolares" INTEGER[],
    "origem" VARCHAR(20) NOT NULL,
    "codigoBusca" VARCHAR(20) NOT NULL,
    "descricaoBusca" TEXT NOT NULL,
    "fonteUrl" VARCHAR(500) NOT NULL,
    "fonteSha256" VARCHAR(64) NOT NULL,
    "fontePaginas" INTEGER[],
    "requerRevisao" BOOLEAN NOT NULL DEFAULT false,
    "observacaoRevisao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "habilidades_curriculares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplina_componentes_curriculares" (
    "disciplinaId" INTEGER NOT NULL,
    "componente" "ComponenteCurricular" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplina_componentes_curriculares_pkey" PRIMARY KEY ("disciplinaId")
);

-- CreateIndex
CREATE INDEX "habilidades_curriculares_componente_ativa_idx" ON "habilidades_curriculares"("componente", "ativa");

-- CreateIndex
CREATE INDEX "habilidades_curriculares_codigo_idx" ON "habilidades_curriculares"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "habilidades_curriculares_versaoCurriculo_chaveImportacao_key" ON "habilidades_curriculares"("versaoCurriculo", "chaveImportacao");

-- AddForeignKey
ALTER TABLE "perguntas_pdi" ADD CONSTRAINT "perguntas_pdi_habilidadeCurricularId_fkey" FOREIGN KEY ("habilidadeCurricularId") REFERENCES "habilidades_curriculares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacao_perguntas_pdi" ADD CONSTRAINT "aplicacao_perguntas_pdi_habilidadeIdOriginal_fkey" FOREIGN KEY ("habilidadeIdOriginal") REFERENCES "habilidades_curriculares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplina_componentes_curriculares" ADD CONSTRAINT "disciplina_componentes_curriculares_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Mapeamento explícito Disciplina -> componente CRMG (decisão da tarefa CRMG; resolvido aqui pelo
-- NOME uma única vez — em runtime só a FK importa). Redação usa Língua Portuguesa, continuando uma
-- Disciplina independente. ON CONFLICT: reexecução/ambiente que já tenha a linha não falha. Em banco
-- novo (sem disciplinas ainda) não insere nada — prisma/seed.ts garante o mesmo mapeamento.
INSERT INTO "disciplina_componentes_curriculares" ("disciplinaId", "componente")
SELECT d."id", m."componente"::"ComponenteCurricular"
FROM "disciplinas" d
JOIN (VALUES
  ('Língua Portuguesa', 'LINGUA_PORTUGUESA'),
  ('Redação', 'LINGUA_PORTUGUESA'),
  ('Arte', 'ARTE'),
  ('Educação Física', 'EDUCACAO_FISICA'),
  ('Matemática', 'MATEMATICA'),
  ('Ciências', 'CIENCIAS'),
  ('Geografia', 'GEOGRAFIA'),
  ('História', 'HISTORIA'),
  ('Inglês', 'LINGUA_INGLESA'),
  ('Ensino Religioso', 'ENSINO_RELIGIOSO')
) AS m("nome", "componente") ON m."nome" = d."nome"
ON CONFLICT ("disciplinaId") DO NOTHING;