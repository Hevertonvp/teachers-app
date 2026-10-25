import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { ValidationError } from '../../domain/errors.js';
import { resolverAcessoAluno } from './pdiFichaAnual.js';
import type { Actor } from './pessoas.js';

export const pdiIndicadoresRouter = Router();

// Indicadores de desenvolvimento de UM aluno (perfil do aluno) — só leitura, só dados reais já
// salvos nas Fichas e nos blocos comuns, nada é materializado. Mesma autorização da Ficha Anual
// (resolverAcessoAluno): o Professor só enxergaria as próprias disciplinas.
//
// Regras de leitura (decididas com o usuário):
// - Perguntas comuns de SELEÇÃO viram escala: a 1ª alternativa é o nível mais alto (n) e a última
//   o nível 1 — é assim que as alternativas estão escritas (mais autonomia -> mais suporte).
// - O bloco comum é por PROFESSOR: na visão geral, a média entre os professores do aluno naquela
//   Aplicação; em cada disciplina, a resposta do professor responsável por ela.
// - Nota = a pergunta NUMERO da Ficha; CRMG = quantidade de habilidades marcadas em cada pergunta
//   HABILIDADE_CRMG (ou "todas"); registros = respostas de TEXTO (inclui a pergunta do trimestre).

type ValorResposta = { resposta?: unknown; todas?: boolean; habilidades?: unknown[] } | null;

const nivelDaOpcao = (opcoes: unknown, resposta: unknown): number | null => {
  if (!Array.isArray(opcoes) || typeof resposta !== 'string') return null;
  const indice = opcoes.indexOf(resposta);
  return indice === -1 ? null : opcoes.length - indice;
};

pdiIndicadoresRouter.get('/alunos/:alunoId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const alunoId = Number(req.params.alunoId);
  if (!Number.isInteger(alunoId)) throw new ValidationError('Aluno inválido.');
  const { aluno, disciplinasPermitidas } = await resolverAcessoAluno(actor, alunoId);

  const [fichas, blocos] = await Promise.all([
    prisma.fichaPdi.findMany({
      where: { alunoId, ...(disciplinasPermitidas ? { disciplinaId: { in: disciplinasPermitidas } } : {}) },
      include: {
        aplicacao: { select: { id: true, nome: true, dataInicio: true, dataFim: true, trimestre: true } },
        aplicacaoModelo: { select: { perguntas: { select: { id: true, texto: true, tipoResposta: true, ordem: true } } } },
        respostas: { select: { aplicacaoPerguntaId: true, valor: true } },
      },
    }),
    prisma.blocoRespostasPadraoPdi.findMany({
      where: { alunoId },
      include: {
        professor: { select: { nome: true } },
        respostas: { select: { valor: true, aplicacaoPerguntaPadrao: { select: { padraoOriginalId: true, texto: true, tipoResposta: true, opcoes: true, ordem: true } } } },
      },
    }),
  ]);

  // Só os blocos que pertencem a alguma Ficha visível (mesma identidade: Aplicação + turma +
  // professor responsável) — nunca expõe a resposta de um professor de disciplina oculta.
  const chaveBloco = (aplicacaoId: number, turmaId: number, professorId: number) => `${aplicacaoId}-${turmaId}-${professorId}`;
  const blocoPorChave = new Map(blocos.map((b) => [chaveBloco(b.aplicacaoId, b.turmaId, b.professorId), b]));
  const blocosVisiveis = new Set(fichas.map((f) => blocoPorChave.get(chaveBloco(f.aplicacaoId, f.turmaId, f.professorResponsavelId))).filter((b): b is (typeof blocos)[number] => !!b));

  const aplicacoes = [...new Map(fichas.map((f) => [f.aplicacao.id, f.aplicacao])).values()]
    .sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime())
    .map((a) => ({ id: a.id, nome: a.nome, dataInicio: a.dataInicio, dataFim: a.dataFim, trimestre: a.trimestre }));

  // Perguntas comuns de seleção (as que viram escala), identificadas pela pergunta padrão de
  // origem — o texto/opções exibidos são os da Aplicação mais recente em que aparecem.
  const perguntasComuns = new Map<number, { id: number; texto: string; opcoes: string[]; ordem: number; dataRef: number }>();
  const ordemAplicacao = new Map(aplicacoes.map((a) => [a.id, a.dataInicio.getTime()]));
  for (const bloco of blocosVisiveis) {
    for (const r of bloco.respostas) {
      const p = r.aplicacaoPerguntaPadrao;
      if (p.tipoResposta !== 'SELECAO' || !Array.isArray(p.opcoes)) continue;
      const dataRef = ordemAplicacao.get(bloco.aplicacaoId) ?? 0;
      const atual = perguntasComuns.get(p.padraoOriginalId);
      if (!atual || dataRef >= atual.dataRef) perguntasComuns.set(p.padraoOriginalId, { id: p.padraoOriginalId, texto: p.texto, opcoes: p.opcoes as string[], ordem: p.ordem, dataRef });
    }
  }

  const comunsDoBloco = (bloco: (typeof blocos)[number] | undefined) => {
    const saida: Record<number, { nivel: number | null; opcao: string | null }> = {};
    for (const r of bloco?.respostas ?? []) {
      const p = r.aplicacaoPerguntaPadrao;
      if (!perguntasComuns.has(p.padraoOriginalId)) continue;
      const resposta = (r.valor as ValorResposta)?.resposta;
      saida[p.padraoOriginalId] = { nivel: nivelDaOpcao(p.opcoes, resposta), opcao: typeof resposta === 'string' ? resposta : null };
    }
    return saida;
  };

  // Visão geral das perguntas comuns: média entre os professores (blocos) de cada Aplicação.
  const visaoGeral = aplicacoes.map((a) => {
    const blocosDaAplicacao = [...blocosVisiveis].filter((b) => b.aplicacaoId === a.id);
    const valores: Record<number, { media: number; professores: number }> = {};
    for (const pergunta of perguntasComuns.values()) {
      const niveis = blocosDaAplicacao.map((b) => comunsDoBloco(b)[pergunta.id]?.nivel).filter((n): n is number => typeof n === 'number');
      if (niveis.length > 0) valores[pergunta.id] = { media: Math.round((niveis.reduce((s, n) => s + n, 0) / niveis.length) * 100) / 100, professores: niveis.length };
    }
    return { aplicacaoId: a.id, valores };
  });

  // Por disciplina: uma série por Aplicação.
  const disciplinas = new Map<number, { disciplinaId: number; nome: string; pontos: unknown[] }>();
  const fichasOrdenadas = [...fichas].sort((a, b) => a.aplicacao.dataInicio.getTime() - b.aplicacao.dataInicio.getTime());
  for (const f of fichasOrdenadas) {
    if (!disciplinas.has(f.disciplinaId)) disciplinas.set(f.disciplinaId, { disciplinaId: f.disciplinaId, nome: f.disciplinaNomeSnapshot, pontos: [] });
    const perguntas = [...f.aplicacaoModelo.perguntas].sort((a, b) => a.ordem - b.ordem);
    const valorDe = (perguntaId: number) => (f.respostas.find((r) => r.aplicacaoPerguntaId === perguntaId)?.valor ?? null) as ValorResposta;
    const perguntaNota = perguntas.find((p) => p.tipoResposta === 'NUMERO');
    const notaBruta = perguntaNota ? valorDe(perguntaNota.id)?.resposta : null;
    disciplinas.get(f.disciplinaId)!.pontos.push({
      aplicacaoId: f.aplicacaoId,
      fichaId: f.id,
      status: f.status,
      professorNome: f.professorNomeSnapshot,
      nota: typeof notaBruta === 'number' ? notaBruta : null,
      perguntaNota: perguntaNota?.texto ?? null,
      crmg: perguntas.filter((p) => p.tipoResposta === 'HABILIDADE_CRMG').map((p) => {
        const valor = valorDe(p.id);
        return { pergunta: p.texto, respondida: !!valor, todas: !!valor?.todas, quantidade: Array.isArray(valor?.habilidades) ? valor!.habilidades!.length : 0 };
      }),
      registros: perguntas.filter((p) => p.tipoResposta === 'TEXTO').map((p) => {
        const resposta = valorDe(p.id)?.resposta;
        return { pergunta: p.texto, texto: typeof resposta === 'string' && resposta.trim() ? resposta : null };
      }),
      comuns: comunsDoBloco(blocoPorChave.get(chaveBloco(f.aplicacaoId, f.turmaId, f.professorResponsavelId))),
    });
  }

  const contagem = { total: fichas.length, concluidas: 0, emAndamento: 0, pendentes: 0 };
  for (const f of fichas) {
    if (f.status === 'CONCLUIDA') contagem.concluidas++;
    else if (f.status === 'EM_ANDAMENTO') contagem.emAndamento++;
    else contagem.pendentes++;
  }

  res.json({
    aluno: { id: aluno.id, nome: aluno.nome },
    escalaMax: Math.max(0, ...[...perguntasComuns.values()].map((p) => p.opcoes.length)),
    aplicacoes,
    perguntasComuns: [...perguntasComuns.values()].sort((a, b) => a.ordem - b.ordem).map(({ id, texto, opcoes }) => ({ id, texto, opcoes })),
    visaoGeral,
    fichas: contagem,
    disciplinas: [...disciplinas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  });
});
