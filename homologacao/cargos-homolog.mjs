// Cargos de TESTE dos professores da homologação (1/3 por cargo, 12/11/2026). Banco LOCAL.
// Dados declarados (não deduzidos do PTD): cada professor ganha os cargos abaixo, "cadastrados" em 01/11/2026,
// antes da abertura do ciclo local #1 (02/11/2026), para participarem dele.
// prepararCargosHomolog() é idempotente: apaga os cargos de teste (e as folhas por cargo ligadas a eles) e recria.
// Uso direto: node cargos-homolog.mjs
import { prisma } from './db.mjs';

export const CRIADO_POR = 'homolog-fixture';
export const CADASTRO = new Date('2026-11-01T12:00:00Z');

// [email, [cargo: [[escola, [disciplinas]] ...]] ...]. Escola sem disciplina = Educação Infantil.
export const CARGOS = [
  ['p01', [[['Aurora', ['Matemática']]]]],
  ['p02', [[['Aurora', ['Língua Portuguesa', 'Ciências', 'História']]]]],
  ['p03', [[['Aurora', ['Geografia']]]]],
  ['p04', [[['Aurora', ['Inglês', 'Arte', 'Ensino Religioso']]], [['Boa Vista', ['Inglês']]]]], // 2 cargos diferentes
  ['p05', [[['Aurora', ['Educação Física']], ['Boa Vista', ['Educação Física']]]]],               // 1 cargo, 2 escolas
  ['p06', [[['Aurora', ['Ciências']]]]],
  ['p07', [[['Aurora', ['Matemática']]], [['Aurora', ['Matemática']]]]],                       // 2 cargos IGUAIS → 1 folha
  ['p10', [[['Aurora', ['Arte']]]]],
  ['p11', [[['Aurora', ['História']]]]],
  ['p12', [[['Aurora', ['Ciências']]], [['Aurora', ['Ciências', 'Matemática']]]]],             // quase iguais → 2 folhas
  ['p14', [[['Aurora', []]]]],                                                                  // Educação Infantil, sem disciplina
  ['p15', [[['Boa Vista', ['Matemática']]]]],
];
// p08, p09 e p13 ficam SEM cargo (cadastro incompleto: não recebem o 1/3).

// Folhas esperadas no ciclo #1 (todas as escolas), contadas à mão: 1 por professor, p04 e p12 com 2.
export const FOLHAS_ESPERADAS_CICLO1 = 14;
export const SENHA = (cod) => `Nexo!Prof${cod.slice(1)}-2026`;

const email = (cod) => `${cod}@homolog.nexo`;

export async function apagarFolhasDosCargos(cargoIds) {
  const entregas = (await prisma.entregaUmTercoCargo.findMany({ where: { cargoId: { in: cargoIds } }, select: { entregaId: true } })).map(e => e.entregaId);
  await prisma.correcaoEntregaUmTerco.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.entregaUmTerco.deleteMany({ where: { id: { in: entregas } } }); // respostas, histórico e ligações vão em cascata
}

// Apaga as folhas por cargo de um professor (todas, ou só de um ciclo). Não toca nas entregas do modelo antigo.
export async function resetarFolhas(cod, cicloId = null) {
  const p = await prisma.pessoa.findUnique({ where: { email: email(cod) } });
  const entregas = (await prisma.entregaUmTerco.findMany({ where: { professorId: p.id, chaveCargos: { not: null }, ...(cicloId ? { cicloId } : {}) }, select: { id: true } })).map(e => e.id);
  await prisma.correcaoEntregaUmTerco.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.entregaUmTerco.deleteMany({ where: { id: { in: entregas } } });
}

// Ids dos cargos de teste de um professor, na ordem de cadastro (o 1º é o "Cargo 1").
export async function cargosDe(cod) {
  const p = await prisma.pessoa.findUnique({ where: { email: email(cod) } });
  return (await prisma.cargoProfessor.findMany({ where: { professorId: p.id }, orderBy: { id: 'asc' }, select: { id: true, status: true } })).map(c => c.id);
}

// Entrega (folha por cargo) de um professor que cobre o cargo dado, num ciclo.
export async function folhaDoCargo(cargoId, cicloId = 1) {
  const e = await prisma.entregaUmTerco.findFirst({
    where: { cicloId, chaveCargos: { not: null }, cargos: { some: { cargoId } } },
    include: { respostas: { include: { semana: true }, orderBy: { semana: { numero: 'asc' } } }, cargos: true },
  });
  if (e) e.respostas = e.respostas.filter(r => r.texto.trim() !== '');
  return e;
}

export async function prepararCargosHomolog() {
  const escolas = new Map((await prisma.escola.findMany({ where: { nome: { startsWith: 'ZZ-HOMOLOG' } } })).map(e => [e.nome.replace('ZZ-HOMOLOG Escola ', ''), e.id]));
  const disciplinas = new Map((await prisma.disciplina.findMany()).map(d => [d.nome, d.id]));
  const pessoas = await prisma.pessoa.findMany({ where: { email: { in: CARGOS.map(([c]) => email(c)) } }, select: { id: true, email: true } });
  const idDe = new Map(pessoas.map(p => [p.email, p.id]));

  // Recomeça do zero: cargos de teste e as folhas por cargo ligadas a eles (os testes mudam cargos).
  const antigos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: pessoas.map(p => p.id) } }, select: { id: true } })).map(c => c.id);
  await apagarFolhasDosCargos(antigos);
  await prisma.cargoVersao.deleteMany({ where: { cargoId: { in: antigos } } });
  await prisma.cargoProfessor.deleteMany({ where: { id: { in: antigos } } });

  for (const [cod, cargos] of CARGOS) {
    const professorId = idDe.get(email(cod));
    if (!professorId) throw new Error(`Professor ${cod} não existe no banco local.`);
    await prisma.pessoa.update({ where: { id: professorId }, data: { status: 'ATIVO' } });
    for (const partes of cargos) {
      const composicao = partes.map(([escola, discs]) => {
        if (!escolas.has(escola)) throw new Error(`Escola ${escola} não existe.`);
        return { escolaId: escolas.get(escola), disciplinaIds: discs.map(d => { if (!disciplinas.has(d)) throw new Error(`Disciplina ${d} não existe.`); return disciplinas.get(d); }).sort((a, b) => a - b) };
      }).sort((a, b) => a.escolaId - b.escolaId);
      await prisma.cargoProfessor.create({
        data: { professorId, status: 'ATIVO', dataInicio: new Date('2026-02-01T00:00:00Z'), createdAt: CADASTRO, createdBy: CRIADO_POR, versoes: { create: { criadaEm: CADASTRO, criadaPor: CRIADO_POR, composicao } } },
      });
      for (const { escolaId } of composicao) {
        const tem = await prisma.vinculoEscolar.count({ where: { pessoaId: professorId, escolaId, status: 'ATIVO' } });
        if (!tem) await prisma.vinculoEscolar.create({ data: { pessoaId: professorId, escolaId, status: 'ATIVO', dataInicio: new Date('2026-02-01T00:00:00Z') } });
      }
    }
  }
  return prisma.cargoProfessor.count({ where: { createdBy: CRIADO_POR } });
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('cargos-homolog.mjs')) {
  console.log('cargos de teste criados:', await prepararCargosHomolog());
  await prisma.$disconnect();
}
