// Limpa os professores de teste criados pelos roteiros 40/42 (e-mail ui-* / assist-*). Rodado direto, também
// restaura o prazo do ciclo local #1 (20/11 18:00). Banco LOCAL. Criado em 15/11/2026: com a regra nova, professor
// criado com o ciclo aberto entra no ciclo, e as sobras desses roteiros mudavam as contas dos outros.
import { prisma } from './db.mjs';
export async function limparProfessoresDeTeste(prefixos = ['ui-', 'assist-']) {
  const pessoas = (await prisma.pessoa.findMany({ where: { OR: prefixos.map(p => ({ email: { startsWith: p }, perfil: 'PROFESSOR' })) }, select: { id: true } })).map(p => p.id);
  if (!pessoas.length) return 0;
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: pessoas } }, select: { id: true } })).map(c => c.id);
  const entregas = (await prisma.entregaUmTerco.findMany({ where: { professorId: { in: pessoas } }, select: { id: true } })).map(e => e.id);
  await prisma.correcaoEntregaUmTerco.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.entregaUmTerco.deleteMany({ where: { id: { in: entregas } } });
  await prisma.entregaUmTercoCargo.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoVersao.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoProfessor.deleteMany({ where: { id: { in: cargos } } });
  await prisma.professorTurmaDisciplina.deleteMany({ where: { professorId: { in: pessoas } } });
  await prisma.professorTurmaAtuacao.deleteMany({ where: { professorId: { in: pessoas } } }); // 16/11/2026: turmas por atuação
  await prisma.vinculoEscolar.deleteMany({ where: { pessoaId: { in: pessoas } } });
  await prisma.pessoaEvento.deleteMany({ where: { OR: [{ pessoaId: { in: pessoas } }, { autorId: { in: pessoas } }] } });
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
  return pessoas.length;
}
if (process.argv[1]?.endsWith('limpar-professores-teste.mjs')) {
  console.log('professores de teste apagados:', await limparProfessoresDeTeste());
  await prisma.cicloUmTerco.update({ where: { id: 1 }, data: { prazoEm: new Date('2026-11-20T21:00:00Z') } });
  console.log('ciclo 1 prazo restaurado');
  await prisma.$disconnect();
}
