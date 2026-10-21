// Fotografia SOMENTE LEITURA dos dados existentes — contagem + hash do conteúdo de cada tabela
// (ignorando apenas as colunas ADICIONADAS pela migration do CRMG), mais os números de controle
// pedidos na tarefa (perguntas de Computação/BNCC, snapshots e respostas). Rodar antes e depois da
// migration/importação: as saídas precisam ser idênticas.
//
// Uso: npx tsx scripts/crmg/integridade.ts [arquivo-saida.json]
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Colunas novas (migrations 20261015*) — fora do hash para comparar antes/depois.
const COLUNAS_NOVAS: Record<string, string[]> = {
  perguntas_pdi: ['habilidadeCurricularId', 'trimestre'],
  aplicacao_perguntas_pdi: ['habilidadeIdOriginal', 'habilidadeSnapshot'],
  aplicacoes_pdi: ['trimestre'],
  // Perguntas padrão: a troca para o Modelo 2027 só INATIVA as antigas (status/updatedBy/updatedAt)
  // e cria novas (createdBy = script) — o conteúdo das antigas precisa continuar idêntico.
  perguntas_pdi_padrao: ['trimestre', 'status', 'updatedBy', 'updatedAt'],
};
const FILTRO: Record<string, string> = {
  perguntas_pdi_padrao: `WHERE t."createdBy" IS DISTINCT FROM 'script:perguntas-padrao-2027'`,
};
const TABELAS_NOVAS = new Set(['habilidades_curriculares', 'disciplina_componentes_curriculares', 'periodos_trimestre', '_prisma_migrations']);

async function main() {
  const tabelas = (await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  )).map((t) => t.table_name).filter((t) => !TABELAS_NOVAS.has(t));

  const resultado: Record<string, unknown> = {};
  for (const tabela of tabelas) {
    const remover = (COLUNAS_NOVAS[tabela] ?? []).map((c) => `'${c}'`).join(',');
    const expr = remover ? `(to_jsonb(t) - ARRAY[${remover}]::text[])` : 'to_jsonb(t)';
    const [linha] = await prisma.$queryRawUnsafe<{ n: bigint; h: string | null }[]>(
      `SELECT count(*) AS n, md5(string_agg(${expr}::text, '|' ORDER BY ${expr}::text)) AS h FROM "${tabela}" t ${FILTRO[tabela] ?? ''}`,
    );
    resultado[tabela] = { linhas: Number(linha.n), hash: linha.h };
  }

  const controle = {
    perguntasComputacaoBncc: await prisma.perguntaPdi.count({ where: { origem: 'HABILIDADE', codigo: { startsWith: 'EF06CO' } } }),
    perguntasPadraoComputacao: await prisma.perguntaPdiPadrao.count({ where: { origem: 'HABILIDADE', codigo: { startsWith: 'EF06CO' } } }),
    snapshotsHabilidade: await prisma.aplicacaoPerguntaPdi.count({ where: { origem: 'HABILIDADE', codigo: { startsWith: 'EF06CO' } } }),
    respostasEmHabilidade: await prisma.respostaPdi.count({ where: { aplicacaoPergunta: { origem: 'HABILIDADE', codigo: { startsWith: 'EF06CO' } } } }),
  };

  const saida = { controle, tabelas: resultado };
  const json = JSON.stringify(saida, null, 1);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], json, 'utf8');
  console.log(JSON.stringify(controle));
  console.log(`${tabelas.length} tabelas fotografadas${process.argv[2] ? ` -> ${process.argv[2]}` : ''}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
