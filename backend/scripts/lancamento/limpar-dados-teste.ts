// Limpeza dos dados de teste da PRODUÇÃO antes do lançamento "Educa São João" (decisão do usuário, 11/11/2026).
//
// Apaga: TODOS os professores (e o que depende deles), TODOS os alunos do PDI, TODAS as Aplicações do PDI
// (com Fichas, respostas, correções, anamneses), TODOS os ciclos do Formulário 1/3 (com entregas) e a escola
// "escola teste" (id 60, com turmas e vínculos).
// Mantém: Secretaria, Diretora, Suporte, as escolas reais e suas turmas, disciplinas, Modelos PDI e perguntas,
// CRMG, calendário/trimestres, Modelos de Anamnese.
//
// Uso:
//   npx tsx scripts/lancamento/limpar-dados-teste.ts                         → ENSAIO: executa tudo numa transação e DESFAZ no fim.
//   CONFIRMO=APAGAR-PRODUCAO npx tsx scripts/lancamento/limpar-dados-teste.ts --executar → grava de verdade.
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const EXECUTAR = process.argv.includes('--executar');
const ESCOLA_TESTE = 60;
const NOME_ESCOLA_TESTE = 'escola teste';

class Ensaio extends Error {}

const host = (process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '');

async function contagens(tx: Prisma.TransactionClient) {
  return {
    escolas: await tx.escola.count(),
    turmas: await tx.turma.count(),
    professores: await tx.pessoa.count({ where: { perfil: 'PROFESSOR' } }),
    outrasPessoas: await tx.pessoa.count({ where: { perfil: { not: 'PROFESSOR' } } }),
    alunosPdi: await tx.alunoPdi.count(),
    aplicacoesPdi: await tx.aplicacaoPdi.count(),
    fichasPdi: await tx.fichaPdi.count(),
    ciclosUmTerco: await tx.cicloUmTerco.count(),
    entregasUmTerco: await tx.entregaUmTerco.count(),
    modelosPdi: await tx.modeloPdi.count(),
    disciplinas: await tx.disciplina.count(),
    conversas: await tx.conversaMensagem.count(),
    feedbacks: await tx.feedbackSistema.count(),
  };
}

async function main() {
  console.log(`Banco: ${host}`);
  console.log(EXECUTAR ? 'MODO: EXECUTAR (grava de verdade)' : 'MODO: ENSAIO (tudo é desfeito no fim)');
  if (EXECUTAR && process.env.CONFIRMO !== 'APAGAR-PRODUCAO') {
    throw new Error('Para gravar de verdade, defina CONFIRMO=APAGAR-PRODUCAO.');
  }

  const escolaTeste = await prisma.escola.findUnique({ where: { id: ESCOLA_TESTE } });
  if (escolaTeste && escolaTeste.nome.trim().toLowerCase() !== NOME_ESCOLA_TESTE) {
    throw new Error(`A escola ${ESCOLA_TESTE} não é a "escola teste" (é "${escolaTeste.nome}"). Abortado.`);
  }

  const professores = await prisma.pessoa.findMany({ where: { perfil: 'PROFESSOR' }, select: { id: true, nome: true, email: true }, orderBy: { id: 'asc' } });
  const outras = await prisma.pessoa.findMany({ where: { perfil: { not: 'PROFESSOR' } }, select: { id: true, nome: true, perfil: true }, orderBy: { id: 'asc' } });
  const ciclos = await prisma.cicloUmTerco.findMany({ select: { id: true, titulo: true, status: true, abreEm: true, prazoEm: true } });
  const aplicacoes = await prisma.aplicacaoPdi.findMany({ select: { id: true, escolaId: true, nome: true } });

  console.log('\nProfessores que serão apagados:');
  professores.forEach((p) => console.log(`  #${p.id} ${p.nome} <${p.email}>`));
  console.log('\nPessoas que FICAM:');
  outras.forEach((p) => console.log(`  #${p.id} ${p.nome} (${p.perfil})`));
  console.log('\nCiclos do 1/3 que serão apagados:');
  ciclos.forEach((c) => console.log(`  #${c.id} ${c.titulo} [${c.status}] ${c.abreEm.toISOString().slice(0, 10)} → ${c.prazoEm.toISOString().slice(0, 10)}`));
  console.log('\nAplicações do PDI que serão apagadas:');
  aplicacoes.forEach((a) => console.log(`  #${a.id} escola ${a.escolaId} — ${a.nome}`));
  console.log(`\nEscola teste: ${escolaTeste ? `#${escolaTeste.id} ${escolaTeste.nome}` : 'não existe (nada a fazer)'}`);

  const profIds = professores.map((p) => p.id);
  const turmasTeste = (await prisma.turma.findMany({ where: { escolaId: ESCOLA_TESTE }, select: { id: true } })).map((t) => t.id);

  const apagados: Record<string, number> = {};
  const del = async (nome: string, p: Promise<{ count: number }>) => { apagados[nome] = (apagados[nome] ?? 0) + (await p).count; };

  try {
    await prisma.$transaction(async (tx) => {
      const antes = await contagens(tx);

      // PDI inteiro (operacional): Fichas, respostas, correções, blocos, Aplicações, anamneses, alunos.
      await del('HistoricoCorrecaoResposta', tx.historicoCorrecaoResposta.deleteMany({}));
      await del('CorrecaoFichaPdi', tx.correcaoFichaPdi.deleteMany({}));
      await del('RespostaPdi', tx.respostaPdi.deleteMany({}));
      await del('FichaPdi', tx.fichaPdi.deleteMany({}));
      await del('HistoricoCorrecaoRespostaPadrao', tx.historicoCorrecaoRespostaPadrao.deleteMany({}));
      await del('CorrecaoBlocoPadraoPdi', tx.correcaoBlocoPadraoPdi.deleteMany({}));
      await del('RespostaPadraoPdi', tx.respostaPadraoPdi.deleteMany({}));
      await del('BlocoRespostasPadraoPdi', tx.blocoRespostasPadraoPdi.deleteMany({}));
      await del('ReaberturaPdi', tx.reaberturaPdi.deleteMany({}));
      await del('FotografiaAplicacaoPdi', tx.fotografiaAplicacaoPdi.deleteMany({}));
      await del('AplicacaoModeloPerguntaPadraoPdi', tx.aplicacaoModeloPerguntaPadraoPdi.deleteMany({}));
      await del('AplicacaoPerguntaPadraoPdi', tx.aplicacaoPerguntaPadraoPdi.deleteMany({}));
      await del('AplicacaoPerguntaPdi', tx.aplicacaoPerguntaPdi.deleteMany({}));
      await del('AplicacaoModeloPdi', tx.aplicacaoModeloPdi.deleteMany({}));
      await del('AplicacaoPdi', tx.aplicacaoPdi.deleteMany({}));
      await del('RespostaAnamnese', tx.respostaAnamnese.deleteMany({}));
      await del('Anamnese', tx.anamnese.deleteMany({}));
      await del('FichaAnualPdi', tx.fichaAnualPdi.deleteMany({}));
      await del('MovimentacaoAlunoPdi', tx.movimentacaoAlunoPdi.deleteMany({}));
      await del('AlunoPdi', tx.alunoPdi.deleteMany({}));

      // Formulário 1/3 inteiro.
      await del('CorrecaoEntregaUmTerco', tx.correcaoEntregaUmTerco.deleteMany({}));
      await del('HistoricoEntregaUmTerco', tx.historicoEntregaUmTerco.deleteMany({}));
      await del('CoberturaEntregaUmTerco', tx.coberturaEntregaUmTerco.deleteMany({}));
      await del('RespostaSemanaUmTerco', tx.respostaSemanaUmTerco.deleteMany({}));
      await del('EntregaUmTerco', tx.entregaUmTerco.deleteMany({}));
      await del('ReaberturaUmTerco', tx.reaberturaUmTerco.deleteMany({}));
      await del('SemanaUmTerco', tx.semanaUmTerco.deleteMany({}));
      await del('CicloUmTercoEscola', tx.cicloUmTercoEscola.deleteMany({}));
      await del('CicloUmTerco', tx.cicloUmTerco.deleteMany({}));

      // Conversas com algum professor ou da escola teste (mensagens e participantes junto).
      const conversaIds = (await tx.conversaMensagem.findMany({
        where: { OR: [{ escolaId: ESCOLA_TESTE }, { participantes: { some: { pessoaId: { in: profIds } } } }] },
        select: { id: true },
      })).map((c) => c.id);
      await del('Mensagem', tx.mensagem.deleteMany({ where: { OR: [{ conversaId: { in: conversaIds } }, { remetenteId: { in: profIds } }] } }));
      await del('ParticipanteConversa', tx.participanteConversa.deleteMany({ where: { OR: [{ conversaId: { in: conversaIds } }, { pessoaId: { in: profIds } }] } }));
      await del('ConversaMensagem', tx.conversaMensagem.deleteMany({ where: { id: { in: conversaIds } } }));

      // Feedbacks de professores ou da escola teste; e mensagens/eventos de professores em outros feedbacks.
      const feedbackIds = (await tx.feedbackSistema.findMany({ where: { OR: [{ autorId: { in: profIds } }, { escolaId: ESCOLA_TESTE }] }, select: { id: true } })).map((f) => f.id);
      await del('FeedbackSistemaEvento', tx.feedbackSistemaEvento.deleteMany({ where: { OR: [{ feedbackId: { in: feedbackIds } }, { autorId: { in: profIds } }] } }));
      await del('MensagemFeedbackSistema', tx.mensagemFeedbackSistema.deleteMany({ where: { OR: [{ feedbackId: { in: feedbackIds } }, { autorId: { in: profIds } }] } }));
      await del('FeedbackSistema', tx.feedbackSistema.deleteMany({ where: { id: { in: feedbackIds } } }));

      // Professores.
      await del('Notificacao', tx.notificacao.deleteMany({ where: { destinatarioId: { in: profIds } } }));
      await del('AssinaturaPush', tx.assinaturaPush.deleteMany({ where: { pessoaId: { in: profIds } } }));
      await del('ProfessorTurmaDisciplina', tx.professorTurmaDisciplina.deleteMany({ where: { OR: [{ professorId: { in: profIds } }, { turmaId: { in: turmasTeste } }] } }));
      await del('AuxiliarTurma', tx.auxiliarTurma.deleteMany({ where: { turmaId: { in: turmasTeste } } }));
      await del('VinculoEscolar', tx.vinculoEscolar.deleteMany({ where: { OR: [{ pessoaId: { in: profIds } }, { escolaId: ESCOLA_TESTE }] } }));
      await del('PessoaEvento', tx.pessoaEvento.deleteMany({ where: { pessoaId: { in: profIds } } }));
      await del('Pessoa (professores)', tx.pessoa.deleteMany({ where: { id: { in: profIds }, perfil: 'PROFESSOR' } }));

      // Escola teste.
      if (escolaTeste) {
        await del('EscolaModulo', tx.escolaModulo.deleteMany({ where: { escolaId: ESCOLA_TESTE } }));
        await del('Turma (escola teste)', tx.turma.deleteMany({ where: { escolaId: ESCOLA_TESTE } }));
        await del('Escola (escola teste)', tx.escola.deleteMany({ where: { id: ESCOLA_TESTE } }));
      }

      const depois = await contagens(tx);
      console.log('\nLinhas apagadas por tabela:');
      Object.entries(apagados).filter(([, n]) => n > 0).forEach(([t, n]) => console.log(`  ${t}: ${n}`));
      console.log('\nContagens antes → depois:');
      for (const k of Object.keys(antes) as (keyof typeof antes)[]) console.log(`  ${k}: ${antes[k]} → ${depois[k]}`);

      // Travas: nada do que deve ficar pode ter mudado.
      const esperadoEscolas = antes.escolas - (escolaTeste ? 1 : 0);
      if (depois.escolas !== esperadoEscolas) throw new Error(`Escolas: esperado ${esperadoEscolas}, ficou ${depois.escolas}.`);
      if (depois.outrasPessoas !== antes.outrasPessoas) throw new Error('Alguma pessoa que deveria ficar foi apagada.');
      if (depois.modelosPdi !== antes.modelosPdi || depois.disciplinas !== antes.disciplinas) throw new Error('Modelos PDI ou disciplinas mudaram.');
      if (depois.professores || depois.alunosPdi || depois.aplicacoesPdi || depois.ciclosUmTerco) throw new Error('Sobrou algo que deveria ter sido apagado.');

      if (!EXECUTAR) throw new Ensaio();
    }, { timeout: 120_000, maxWait: 20_000 });
    console.log('\nCONCLUÍDO: alterações gravadas.');
  } catch (e) {
    if (e instanceof Ensaio) console.log('\nENSAIO concluído: tudo foi desfeito, nada mudou no banco.');
    else throw e;
  }
}

main().finally(() => prisma.$disconnect());
