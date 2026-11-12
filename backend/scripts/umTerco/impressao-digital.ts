// SÓ LEITURA (12/11/2026): retrato de TODAS as tabelas do banco — quantidade de linhas + hash md5 de todas as
// linhas (ordem estável). Serve para provar "dados existentes intactos" antes/depois de uma bateria de testes:
// qualquer linha criada, apagada ou alterada muda o hash da tabela. Também conta resíduos de um prefixo.
// Nunca grava nada (só SELECT). Não imprime conteúdo, só contagens e hashes.
// Uso: npx tsx scripts/umTerco/impressao-digital.ts [PREFIXO] > retrato.json
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const prefixo = process.argv[2] ?? 'ZZE2E-UMTERCO-';
try {
  const tabelas = (await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY 1`,
  )).map((x) => x.t);
  const retrato: Record<string, { linhas: number; md5: string | null }> = {};
  for (const t of tabelas) {
    const [r] = await prisma.$queryRawUnsafe<{ linhas: bigint; md5: string | null }[]>(
      `SELECT count(*) AS linhas, md5(string_agg(x::text, '|' ORDER BY x::text)) AS md5 FROM "${t}" x`,
    );
    retrato[t] = { linhas: Number(r.linhas), md5: r.md5 };
  }
  // Resíduos do prefixo nas tabelas com texto identificável.
  const p = prefixo.toLowerCase();
  const [res] = await prisma.$queryRawUnsafe<Record<string, bigint>[]>(
    `SELECT
      (SELECT count(*) FROM pessoas WHERE lower(email) LIKE $1 OR lower(nome) LIKE $1) AS pessoas,
      (SELECT count(*) FROM escolas WHERE lower(nome) LIKE $1) AS escolas,
      (SELECT count(*) FROM disciplinas WHERE lower(nome) LIKE $1) AS disciplinas,
      (SELECT count(*) FROM ciclos_um_terco WHERE lower(titulo) LIKE $1) AS ciclos,
      (SELECT count(*) FROM atuacoes_pedagogicas WHERE lower(nome) LIKE $1) AS atuacoes`,
    `${p}%`,
  );
  const migrations = await prisma.$queryRawUnsafe<{ m: string }[]>(`SELECT migration_name AS m FROM _prisma_migrations ORDER BY started_at DESC LIMIT 2`);
  console.log(JSON.stringify({
    banco: new URL(process.env.DATABASE_URL ?? 'postgres://x/x').hostname,
    quando: new Date().toISOString(),
    migrations: migrations.map((m) => m.m),
    residuos: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, Number(v)])),
    tabelas: retrato,
  }, null, 1));
} finally {
  await prisma.$disconnect();
}
