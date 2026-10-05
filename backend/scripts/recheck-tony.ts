import { prisma } from '../src/lib/prisma.js';

async function main() {
  const tony = await prisma.pessoa.findUniqueOrThrow({ where: { email: 'hevertonvp@gmail.com' } });
  console.log('Tony id:', tony.id);

  console.log('\n--- VinculoEscolar atual ---');
  const vinculos = await prisma.vinculoEscolar.findMany({ where: { pessoaId: tony.id }, include: { escola: true } });
  console.table(vinculos.map(v => ({ escolaId: v.escolaId, escola: v.escola.nome, status: v.status })));

  console.log('\n--- ProfessorTurmaDisciplina atual (TODOS, inclusive encerrados) ---');
  const ptds = await prisma.professorTurmaDisciplina.findMany({
    where: { professorId: tony.id },
    include: { turma: { include: { escola: true } }, disciplina: true },
    orderBy: { id: 'desc' },
  });
  console.table(ptds.map(p => ({
    id: p.id, turmaId: p.turmaId, turma: p.turma.nome, turmaStatus: p.turma.status,
    escolaId: p.turma.escolaId, escola: p.turma.escola.nome, disciplina: p.disciplina.nome, status: p.status,
  })));

  const inglesVinculos = ptds.filter(p => p.disciplina.nome === 'Inglês' && p.status === 'ATIVO');
  if (inglesVinculos.length === 0) {
    console.log('\n[RESULTADO] Tony NÃO tem nenhum vínculo ATIVO de Inglês no momento.');
  } else {
    for (const v of inglesVinculos) {
      console.log(`\n--- Checando turma ${v.turmaId} (${v.turma.nome}) na escola ${v.turma.escolaId} (${v.turma.escola.nome}) pra Inglês ---`);

      const alunos = await prisma.alunoPdi.findMany({ where: { turmaId: v.turmaId, status: 'ATIVO' } });
      console.log('Alunos PDI ativos nessa turma:', alunos.length, alunos.map(a => a.nome));

      const aplicacoes = await prisma.aplicacaoPdi.findMany({
        where: { escolaId: v.turma.escolaId },
        include: { modelos: { select: { disciplinaNome: true } } },
      });
      console.log('Aplicações PDI dessa escola:');
      for (const a of aplicacoes) {
        console.log(` - id=${a.id} status=${a.status} ${a.dataInicio.toISOString().slice(0,10)} a ${a.dataFim.toISOString().slice(0,10)} | disciplinas: ${a.modelos.map(m=>m.disciplinaNome).join(', ')}`);
      }
      const temAplicacaoComIngles = aplicacoes.some(a => a.status === 'ATIVA' && a.modelos.some(m => m.disciplinaNome === 'Inglês'));
      console.log('Alguma Aplicação ATIVA dessa escola inclui Inglês?', temAplicacaoComIngles);
    }
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
