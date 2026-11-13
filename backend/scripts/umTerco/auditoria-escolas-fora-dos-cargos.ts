// Auditoria SÓ DE LEITURA (13/11/2026): Professores com vínculo escolar ativo em escola que não está na
// versão atual de nenhum cargo ativo; ciclos do 1/3; turmas desses professores nessas escolas.
// Nada é gravado. Uso: npx tsx scripts/umTerco/auditoria-escolas-fora-dos-cargos.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  console.log('Banco:', new URL(process.env.DATABASE_URL ?? 'postgres://x/x').hostname);
  const ciclos = await prisma.cicloUmTerco.findMany({ select: { id: true, trimestre: true, anoLetivo: true, abreEm: true, prazoEm: true, status: true, todasEscolas: true } });
  console.log('Ciclos 1/3:', JSON.stringify(ciclos));
  console.log('Agora:', new Date().toISOString());

  const profs = await prisma.pessoa.findMany({
    where: { perfil: 'PROFESSOR' },
    select: {
      id: true, nome: true, status: true,
      vinculosEscolares: { where: { status: 'ATIVO' }, select: { id: true, escolaId: true, escola: { select: { nome: true } }, createdAt: true, createdBy: true, dataInicio: true } },
      cargos: { where: { status: 'ATIVO' }, select: { id: true, dataInicio: true, versoes: { orderBy: { criadaEm: 'desc' }, take: 1, select: { composicao: true, criadaEm: true } } } },
    },
  });
  console.log('Professores:', profs.length);
  for (const p of profs) {
    const noCargo = new Set<number>();
    for (const c of p.cargos) for (const parte of (c.versoes[0]?.composicao as any[] ?? [])) noCargo.add(Number(parte.escolaId));
    const fora = p.vinculosEscolares.filter(v => !noCargo.has(v.escolaId));
    const linha = `#${p.id} ${p.nome} (${p.status}) cargos=${p.cargos.length} escolas=${p.vinculosEscolares.map(v => v.escola.nome).join(' | ')}`;
    if (!fora.length) { console.log('  ok  ', linha); continue; }
    console.log('  FORA', linha);
    for (const c of p.cargos) console.log('       cargo', c.id, 'início', c.dataInicio.toISOString().slice(0, 10), JSON.stringify(c.versoes[0]?.composicao));
    for (const v of fora) {
      const ptd = await prisma.professorTurmaDisciplina.findMany({ where: { professorId: p.id, status: 'ATIVO', turma: { escolaId: v.escolaId } }, select: { turma: { select: { nome: true } }, disciplina: { select: { id: true, nome: true } } } });
      console.log(`       fora: ${v.escola.nome} (escola ${v.escolaId}) vínculo ${v.id} criado ${v.createdAt.toISOString()} por ${v.createdBy}; turmas lá: ${JSON.stringify(ptd.map(x => `${x.turma.nome}/${x.disciplina.nome}#${x.disciplina.id}`))}`);
    }
  }
} finally {
  await prisma.$disconnect();
}
