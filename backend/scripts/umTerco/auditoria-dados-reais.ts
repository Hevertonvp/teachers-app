// Auditoria SÓ DE LEITURA dos dados do 1/3 e dos cargos (12/11/2026), para comparar antes/depois de uma
// migration. Imprime só IDs, contagens, status e datas (sem nomes nem textos). Nada é gravado.
// Uso: npx tsx scripts/umTerco/auditoria-dados-reais.ts > retrato.json
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const hash = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 16);

try {
  const [ciclos, entregas, cargos, versoes, correcoes, historico, migrations] = await Promise.all([
    prisma.cicloUmTerco.findMany({ select: { id: true, status: true, abreEm: true, prazoEm: true, todasEscolas: true, _count: { select: { semanas: true, escolas: true } } }, orderBy: { id: 'asc' } }),
    prisma.entregaUmTerco.findMany({ select: { id: true, cicloId: true, professorId: true, status: true, chaveCargos: true, updatedAt: true, concluidaEm: true, composicao: true, cargos: { select: { cargoId: true } }, respostas: { select: { id: true, semanaId: true, texto: true }, orderBy: { semanaId: 'asc' } } }, orderBy: { id: 'asc' } }),
    prisma.cargoProfessor.findMany({ select: { id: true, professorId: true, status: true, dataInicio: true, dataFim: true, createdAt: true }, orderBy: { id: 'asc' } }),
    prisma.cargoVersao.findMany({ select: { id: true, cargoId: true, criadaEm: true, composicao: true }, orderBy: { id: 'asc' } }),
    prisma.correcaoEntregaUmTerco.findMany({ select: { id: true, entregaId: true, status: true, conferencia: true }, orderBy: { id: 'asc' } }),
    prisma.historicoEntregaUmTerco.count(),
    prisma.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3`,
  ]);
  const professores = await prisma.pessoa.groupBy({ by: ['perfil', 'status'], _count: true });
  console.log(JSON.stringify({
    banco: new URL(process.env.DATABASE_URL ?? 'postgres://x/x').hostname,
    quando: new Date().toISOString(),
    migrations: migrations.map((m) => m.migration_name),
    pessoas: professores.map((p) => `${p.perfil}/${p.status}=${p._count}`),
    ciclos,
    entregas: entregas.map((e) => ({ id: e.id, cicloId: e.cicloId, professorId: e.professorId, status: e.status, chaveCargos: e.chaveCargos, cargos: e.cargos.map((c) => c.cargoId), updatedAt: e.updatedAt, concluidaEm: e.concluidaEm, composicaoHash: hash(JSON.stringify(e.composicao)), respostas: e.respostas.map((r) => ({ id: r.id, semanaId: r.semanaId, tamanho: r.texto.length, hash: hash(r.texto) })) })),
    professoresComEntrega: [...new Set(entregas.map((e) => e.professorId))],
    cargos,
    versoes: versoes.map((v) => ({ id: v.id, cargoId: v.cargoId, criadaEm: v.criadaEm, composicaoHash: hash(JSON.stringify(v.composicao)) })),
    correcoes,
    historicoEntregas: historico,
  }, null, 1));
} finally {
  await prisma.$disconnect();
}
