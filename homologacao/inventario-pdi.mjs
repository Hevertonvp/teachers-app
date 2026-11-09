// Inventário (somente leitura) do PDI no banco LOCAL de homologação.
import { prisma } from './db.mjs';
const esc = await prisma.escola.findMany({ where: { nome: { contains: 'ZZ-HOMOLOG' } }, select: { id: true, nome: true } });
console.log('ESCOLAS', JSON.stringify(esc));
console.log('APLICACOES', JSON.stringify(await prisma.aplicacaoPdi.findMany({ select: { id: true, escolaId: true, nome: true, dataInicio: true, dataFim: true, status: true, modelos: { select: { disciplinaNome: true, disciplinaId: true } } } })));
console.log('ALUNOS', JSON.stringify(await prisma.alunoPdi.findMany({ select: { id: true, nome: true, status: true, turma: { select: { id: true, nome: true, escolaId: true } } } })));
console.log('FICHAS', JSON.stringify((await prisma.fichaPdi.findMany({ include: { respostas: true } })).map(f => ({ id: f.id, ap: f.aplicacaoId, alunoId: f.alunoId, aluno: f.alunoNomeSnapshot, disc: f.disciplinaNomeSnapshot, turmaId: f.turmaId, turma: f.turmaNomeSnapshot, esc: f.escolaNomeSnapshot, profId: f.professorResponsavelId, prof: f.professorNomeSnapshot, status: f.status, nresp: f.respostas.length }))));
console.log('BLOCOS', JSON.stringify((await prisma.blocoRespostasPadraoPdi.findMany({ include: { respostas: true } })).map(b => ({ id: b.id, ap: b.aplicacaoId, aluno: b.alunoId, turma: b.turmaId, prof: b.professorId, nresp: b.respostas.length, version: b.version }))));
const ptds = await prisma.professorTurmaDisciplina.findMany({ where: { status: 'ATIVO', turma: { escola: { nome: { contains: 'ZZ-HOMOLOG' } } } }, include: { turma: true, professor: true, disciplina: true } });
console.log('PTDS', ptds.map(p => `${p.turma.escolaId}:${p.turma.nome}(${p.turmaId}):${p.disciplina.nome}:${p.professor.email}`).join(' | '));
console.log('MOV', JSON.stringify(await prisma.movimentacaoAlunoPdi.findMany()));
const pessoas = await prisma.pessoa.findMany({ where: { email: { contains: 'homolog' } }, select: { id: true, email: true, perfil: true, status: true, senhaTemporaria: true } });
console.log('PESSOAS', JSON.stringify(pessoas));
await prisma.$disconnect();
