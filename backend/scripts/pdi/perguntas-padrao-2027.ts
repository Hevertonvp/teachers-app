// Aplica o "Modelo PDI 2027" (planilha enviada pela rede: abas 1º/2º/3º TRIMESTRE) como as
// perguntas padrão ATIVAS — as que entram automaticamente ao criar um Modelo com "carregar
// perguntas padrão".
//
// - NADA é apagado: as perguntas padrão ativas atuais viram INATIVAS (a Secretaria pode reativá-las
//   em Configurações a qualquer momento). Modelos/Aplicações/Fichas existentes não são tocados.
// - Idempotente: se as perguntas 2027 já existem, não faz nada.
// - Textos copiados da planilha (só sem a numeração "1.", "2." do início — o sistema já numera).
//   A pergunta discursiva e seu "Objetivo" mudam por trimestre (campo `trimestre`): cada Aplicação
//   recebe só a do trimestre em que começa (Configurações > Trimestres).
//
// Uso: npx tsx scripts/pdi/perguntas-padrao-2027.ts
import { PrismaClient, type OrigemPerguntaPdi, type TipoRespostaPdi } from '@prisma/client';

const prisma = new PrismaClient();
const AUTOR = 'script:perguntas-padrao-2027';

type Pergunta = { secao: string; texto: string; origem: OrigemPerguntaPdi; tipoResposta: TipoRespostaPdi; opcoes?: string[]; indicador?: string; trimestre?: number };

const ACOMPANHAMENTO = 'Acompanhamento do trimestre';
const HABILIDADES = 'Habilidades (CRMG)';
const REGISTRO = 'Registro pedagógico';

const PERGUNTAS_2027: Pergunta[] = [
  {
    secao: ACOMPANHAMENTO, origem: 'ESTRUTURADA', tipoResposta: 'SELECAO',
    texto: 'O aluno necessita de adaptações na metodologia, nas atividades e/ou avaliações propostas, considerando o nível de suporte necessário para sua participação e aprendizagem?',
    opcoes: ['Não necessita de adaptações ou suporte adicional', 'Necessita de pequenas adaptações e suporte ocasional', 'Necessita de adaptações frequentes e suporte regular', 'Necessita de adaptações significativas e suporte contínuo'],
  },
  {
    secao: ACOMPANHAMENTO, origem: 'ESTRUTURADA', tipoResposta: 'SELECAO',
    texto: 'Como você avalia a participação e o envolvimento do aluno nas atividades propostas em sala de aula, em casa e nas interações verbais durante o trimestre?',
    opcoes: ['Participa de forma autônoma e frequente', 'Participa na maioria das situações, com pouca mediação', 'Participa quando incentivado ou com mediação', 'Apresenta pouca participação, mesmo com incentivo e mediação'],
  },
  {
    secao: ACOMPANHAMENTO, origem: 'ESTRUTURADA', tipoResposta: 'SELECAO',
    texto: 'Como você avalia a interação e a comunicação do aluno com o professor e com os demais alunos durante as atividades e situações de convivência escolar?',
    opcoes: ['Interage e se comunica de forma espontânea e adequada', 'Interage adequadamente, necessitando de pouca mediação', 'Interage quando estimulado, necessitando de mediação frequente', 'Apresenta pouca interação e comunicação, necessitando de mediação constante'],
  },
  {
    secao: ACOMPANHAMENTO, origem: 'ESTRUTURADA', tipoResposta: 'NUMERO', indicador: 'rendimento_trimestral',
    texto: 'Qual o rendimento (nota alcançada) no trimestre?',
  },
  { secao: HABILIDADES, origem: 'HABILIDADE', tipoResposta: 'HABILIDADE_CRMG', texto: 'Quais habilidades foram consolidadas pela aluno(a) durante o trimestre?' },
  { secao: HABILIDADES, origem: 'HABILIDADE', tipoResposta: 'HABILIDADE_CRMG', texto: 'Quais habilidades ainda não foram consolidadas?' },
  {
    secao: REGISTRO, origem: 'ORIENTACAO', tipoResposta: 'ORIENTACAO', trimestre: 1,
    texto: 'Objetivo: construir um perfil inicial do aluno, identificando o que ele já consegue fazer, suas potencialidades e o que precisa de maior atenção.',
  },
  {
    secao: REGISTRO, origem: 'QUALITATIVA', tipoResposta: 'TEXTO', trimestre: 1,
    texto: 'Quais potencialidades, habilidades, interesses e necessidades foram identificados no desempenho do estudante neste período? Descreva os aspectos que se destacam, bem como as principais dificuldades observadas no processo de aprendizagem e participação escolar.',
  },
  {
    secao: REGISTRO, origem: 'ORIENTACAO', tipoResposta: 'ORIENTACAO', trimestre: 2,
    texto: 'Objetivo: comparar com o 1º trimestre e registrar o que funcionou, o que mudou e o que ainda precisa ser ajustado.',
  },
  {
    secao: REGISTRO, origem: 'QUALITATIVA', tipoResposta: 'TEXTO', trimestre: 2,
    texto: 'Quais avanços foram observados no desenvolvimento do estudante a partir das estratégias e intervenções realizadas? Quais dificuldades permanecem e quais metodologias, recursos ou adequações no planejamento pedagógico foram necessários ou precisam ser reformulados para favorecer sua aprendizagem?',
  },
  {
    secao: REGISTRO, origem: 'ORIENTACAO', tipoResposta: 'ORIENTACAO', trimestre: 3,
    texto: 'Objetivo: fazer uma síntese final do percurso, permitindo perceber a evolução desde o início do ano e registrar os aspectos que ainda demandam acompanhamento.',
  },
  {
    secao: REGISTRO, origem: 'QUALITATIVA', tipoResposta: 'TEXTO', trimestre: 3,
    texto: 'Considerando o trabalho desenvolvido ao longo do ano, quais aprendizagens e habilidades foram consolidadas pelo estudante? Quais avanços foram alcançados, quais dificuldades permanecem e quais estratégias e adequações se mostraram necessárias para favorecer seu desenvolvimento?',
  },
];

async function main() {
  const jaAplicado = await prisma.perguntaPdiPadrao.findFirst({ where: { texto: PERGUNTAS_2027[0].texto, createdBy: AUTOR } });
  if (jaAplicado) {
    console.log('Perguntas padrão 2027 já aplicadas — nada a fazer.');
    return;
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const ativasAntes = await tx.perguntaPdiPadrao.findMany({ where: { status: 'ATIVA' }, select: { id: true } });
    await tx.perguntaPdiPadrao.updateMany({ where: { id: { in: ativasAntes.map((p) => p.id) } }, data: { status: 'INATIVA', updatedBy: AUTOR } });
    const ultima = await tx.perguntaPdiPadrao.findFirst({ orderBy: { ordem: 'desc' } });
    const base = ultima?.ordem ?? 0;
    await tx.perguntaPdiPadrao.createMany({
      data: PERGUNTAS_2027.map((p, i) => ({
        secao: p.secao,
        subsecao: null,
        codigo: null,
        texto: p.texto,
        indicador: p.indicador ?? null,
        origem: p.origem,
        tipoResposta: p.tipoResposta,
        opcoes: p.opcoes ?? [],
        trimestre: p.trimestre ?? null,
        ordem: base + i + 1,
        status: 'ATIVA' as const,
        createdBy: AUTOR,
      })),
    });
    return { inativadas: ativasAntes.length, criadas: PERGUNTAS_2027.length };
  });
  console.log(JSON.stringify(resultado));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
