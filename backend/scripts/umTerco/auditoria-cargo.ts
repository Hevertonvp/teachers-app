// Auditoria SÓ DE LEITURA antes da migration do 1/3 por cargo (12/11/2026).
// Nada é gravado: só count/findMany. Uso: npx tsx scripts/umTerco/auditoria-cargo.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const host = new URL(process.env.DATABASE_URL ?? 'postgres://x/x').hostname;
  console.log('Banco:', host);

  const umTerco = {
    ciclos: await prisma.cicloUmTerco.count(),
    ciclosEscolas: await prisma.cicloUmTercoEscola.count(),
    semanas: await prisma.semanaUmTerco.count(),
    entregas: await prisma.entregaUmTerco.count(),
    respostas: await prisma.respostaSemanaUmTerco.count(),
    coberturas: await prisma.coberturaEntregaUmTerco.count(),
    reaberturas: await prisma.reaberturaUmTerco.count(),
    historico: await prisma.historicoEntregaUmTerco.count(),
    correcoes: await prisma.correcaoEntregaUmTerco.count(),
  };
  console.log('1/3:', JSON.stringify(umTerco));

  const porPerfil = await prisma.pessoa.groupBy({ by: ['perfil', 'status'], _count: true });
  console.log('Pessoas:', JSON.stringify(porPerfil.map(p => `${p.perfil}/${p.status}=${p._count}`)));
  console.log('Vínculos escolares:', await prisma.vinculoEscolar.count(), '| PTD:', await prisma.professorTurmaDisciplina.count());

  const disciplinas = await prisma.disciplina.findMany({ orderBy: { nome: 'asc' }, select: { nome: true } });
  console.log('Disciplinas:', disciplinas.map(d => d.nome).join(', '));

  const turmas = await prisma.turma.groupBy({ by: ['etapa', 'status'], _count: true });
  console.log('Turmas:', JSON.stringify(turmas.map(t => `${t.etapa}/${t.status}=${t._count}`)));
  const escolas = await prisma.escola.findMany({ select: { id: true, nome: true, status: true, turmas: { select: { etapa: true }, where: { status: 'ATIVA' } } }, orderBy: { nome: 'asc' } });
  for (const e of escolas) {
    const inf = e.turmas.filter(t => t.etapa === 'EDUCACAO_INFANTIL').length;
    const fun = e.turmas.length - inf;
    console.log(`  Escola #${e.id} ${e.nome} (${e.status}): infantil ${inf}, fundamental ${fun}`);
  }

  const ptdInfantil = await prisma.professorTurmaDisciplina.count({ where: { turma: { etapa: 'EDUCACAO_INFANTIL' } } });
  console.log('PTD em turmas da Educação Infantil:', ptdInfantil);

  const migs = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5`;
  console.log('Últimas migrations:', migs.map(m => `${m.migration_name}${m.finished_at ? '' : ' (NÃO concluída)'}`).join(' | '));
} finally {
  await prisma.$disconnect();
}
