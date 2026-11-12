import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ConflitoVersaoError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { correcaoUmTercoVigente, formatarCorrecaoUmTerco, idsDePessoasDasCorrecoes, situacaoCorrecaoUmTerco, textoMensagemCorrecaoDireta, type SituacaoCorrecaoUmTerco } from '../../domain/correcoes.js';
import { rotuloDaFolha, rotulosDosCargos } from '../../domain/cargos.js';
import { paraDataIsoUtc, TEXTO_SEMANA_MAX } from '../../domain/umTerco.js';
import { criarMensagensDeCorrecao, nomesDePessoas, notificarMensagensDeCorrecao } from '../../lib/mensagemCorrecao.js';
import { AVISO_FOLHA_COMPARTILHADA, descreverParte, lerFoto, MSG_CARGO_ENCERRADO, travarFolhas } from './formularioUmTerco.js';

// Correções → Formulário 1/3 (decisões do usuário, 12/11/2026), no padrão de Correções → PDI. SÓ a
// Secretaria. Só folhas CONCLUÍDAS entram (como o PDI). A Secretaria corrige diretamente (histórico com
// valor anterior/novo + mensagem ao Professor, sem abrir prazo nem pedir aceite) ou devolve para correção
// (rotas /api/formulario-um-terco/entregas/:id/devolver|aceitar, já existentes). Folha de cargo encerrado
// = só consulta. A correção é da FOLHA (cargos iguais dividem uma folha: nunca correção duplicada).
export const correcoesUmTercoRouter = Router();

type Actor = { id: number; perfil: string };
const exigirSecretaria = (actor: Actor) => {
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria pode acessar Correções > Formulário 1/3.');
};
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const entregaInclude = {
  professor: { select: { id: true, nome: true, status: true } },
  ciclo: { select: { id: true, titulo: true, trimestre: true, anoLetivo: true, abreEm: true, prazoEm: true, status: true } },
  cargos: { select: { cargoId: true, cargo: { select: { status: true } } } },
  correcoes: { orderBy: { criadaEm: 'desc' as const } },
} as const;

async function rotulosPorProfessor(professorIds: number[]) {
  const cargos = professorIds.length ? await prisma.cargoProfessor.findMany({ where: { professorId: { in: professorIds } }, select: { id: true, professorId: true, status: true, dataInicio: true } }) : [];
  const mapa = new Map<number, Map<number, string>>();
  for (const id of new Set(professorIds)) mapa.set(id, rotulosDosCargos(cargos.filter((c) => c.professorId === id)));
  return mapa;
}

const somenteConsulta = (e: { cargos: { cargo: { status: string } }[] }) => e.cargos.length > 0 && e.cargos.every((c) => c.cargo.status === 'ENCERRADO');

// ----- Lista ------------------------------------------------------------------------------------
const listaSchema = z.object({
  escolaId: z.coerce.number().int().optional(),
  professorId: z.coerce.number().int().optional(),
  cicloId: z.coerce.number().int().optional(),
  situacao: z.enum(['nenhuma', 'solicitada', 'recebida', 'aceita', 'expirada', 'devolvida', 'em_andamento']).optional(),
  busca: z.string().trim().min(1).optional(),
  limite: z.coerce.number().int().min(1).max(200).optional(),
});

correcoesUmTercoRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const filtros = listaSchema.parse(req.query);
  const entregas = await prisma.entregaUmTerco.findMany({
    where: { status: 'CONCLUIDA', chaveCargos: { not: null }, ...(filtros.cicloId ? { cicloId: filtros.cicloId } : {}) },
    include: entregaInclude,
  });
  const rotulos = await rotulosPorProfessor(entregas.map((e) => e.professorId));

  const todos = entregas.map((e) => {
    const composicao = lerFoto(e.composicao);
    const cargoIds = e.cargos.map((c) => c.cargoId).sort((a, b) => a - b);
    const ultima = e.correcoes[0] ?? null;
    const situacao: 'nenhuma' | SituacaoCorrecaoUmTerco = ultima ? situacaoCorrecaoUmTerco(ultima) : 'nenhuma';
    const movimentos = [e.updatedAt, e.concluidaEm, ...e.correcoes.flatMap((c) => [c.criadaEm, c.concluidaEm, c.conferidaEm])].filter((d): d is Date => !!d);
    return {
      entregaId: e.id,
      ciclo: { id: e.ciclo.id, titulo: e.ciclo.titulo, trimestre: e.ciclo.trimestre, anoLetivo: e.ciclo.anoLetivo },
      professorId: e.professorId, professorNome: e.professor.nome,
      rotulo: rotuloDaFolha(cargoIds, rotulos.get(e.professorId) ?? new Map()),
      compartilhada: cargoIds.length > 1,
      composicao,
      situacao,
      somenteConsulta: somenteConsulta(e),
      concluidaEm: iso(e.concluidaEm),
      ultimaMovimentacao: new Date(Math.max(...movimentos.map((d) => d.getTime()))).toISOString(),
    };
  });

  // Opções dos filtros (sem os próprios filtros aplicados): escolas e professores das folhas concluídas.
  const escolas = new Map<number, string>(); const professores = new Map<number, string>(); const ciclos = new Map<number, string>();
  for (const i of todos) { i.composicao.forEach((p) => escolas.set(p.escolaId, p.escolaNome)); professores.set(i.professorId, i.professorNome); ciclos.set(i.ciclo.id, `${i.ciclo.titulo} · ${i.ciclo.trimestre}º tri ${i.ciclo.anoLetivo}`); }
  const ordenar = (m: Map<number, string>) => [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // Busca por palavras (todas precisam aparecer, em qualquer ordem): "boa vista matem" acha "Boa Vista — Matemática".
  const busca = filtros.busca ? normalizar(filtros.busca).split(/\s+/).filter(Boolean) : null;
  const filtrados = todos.filter((i) => (!filtros.escolaId || i.composicao.some((p) => p.escolaId === filtros.escolaId))
    && (!filtros.professorId || i.professorId === filtros.professorId)
    && (!filtros.situacao || (filtros.situacao === 'em_andamento' ? ['solicitada', 'recebida'].includes(i.situacao) : i.situacao === filtros.situacao))
    && (!busca || busca.every((palavra) => normalizar([i.professorNome, i.rotulo, ...i.composicao.map(descreverParte)].join(' ')).includes(palavra))))
    .sort((a, b) => b.ultimaMovimentacao.localeCompare(a.ultimaMovimentacao));

  res.json({ total: filtrados.length, itens: filtrados.slice(0, filtros.limite ?? 50), opcoes: { escolas: ordenar(escolas), professores: ordenar(professores), ciclos: ordenar(ciclos) } });
});

// ----- Detalhe ----------------------------------------------------------------------------------
const ORIGEM_TEXTO = { SECRETARIA_DIRETA: 'Secretaria corrigiu diretamente', PROFESSOR_POS_DEVOLUCAO: 'Professor alterou durante a correção' } as const;

async function montarDetalhe(entregaId: number) {
  const e = await prisma.entregaUmTerco.findUnique({
    where: { id: entregaId },
    include: { ...entregaInclude, respostas: true, historico: { orderBy: { quando: 'asc' } }, historicoCorrecao: { include: { semana: { select: { numero: true } } }, orderBy: { alteradoEm: 'desc' } } },
  });
  if (!e || !e.chaveCargos) throw new NotFoundError('Folha do Formulário 1/3 não encontrada.');
  if (e.status !== 'CONCLUIDA') throw new ValidationError('Esta folha ainda não foi concluída — não aparece em Correções.');
  const semanas = await prisma.semanaUmTerco.findMany({ where: { cicloId: e.cicloId }, orderBy: { numero: 'asc' } });
  const cargoIds = e.cargos.map((c) => c.cargoId).sort((a, b) => a - b);
  const rotulos = await rotulosPorProfessor([e.professorId]);
  const idsPessoas = [...idsDePessoasDasCorrecoes(e.correcoes), ...e.historicoCorrecao.map((h) => Number(h.alteradoPor)).filter(Number.isInteger), ...e.historico.map((h) => h.pessoaId).filter((x): x is number => !!x)];
  const nomes = await nomesDePessoas(prisma, [...new Set(idsPessoas)]);
  const textoPorSemana = new Map(e.respostas.map((r) => [r.semanaId, r.texto]));
  const correcoes = e.correcoes.map((c) => formatarCorrecaoUmTerco(c, nomes));
  const ultima = e.correcoes[0] ?? null;
  const vigente = e.correcoes.some((c) => correcaoUmTercoVigente(c));
  const consulta = somenteConsulta(e);

  // Linha do tempo (mais recente primeiro): conclusão, devoluções, reenvios, conferências, expirações e
  // alterações de texto (com quem e a origem).
  type Evento = { quando: string; texto: string; detalhe?: string | null };
  const eventos: Evento[] = [];
  const nome = (id: string | number | null | undefined) => (id ? nomes.get(String(id)) ?? null : null);
  for (const h of e.historico) if (h.tipo === 'CONCLUIDA') eventos.push({ quando: h.quando.toISOString(), texto: `Professor concluiu a folha${nome(h.pessoaId) ? ` (${nome(h.pessoaId)})` : ''}` });
  for (const c of e.correcoes) {
    eventos.push({ quando: c.criadaEm.toISOString(), texto: `Secretaria solicitou correção${nome(c.criadaPor) ? ` (${nome(c.criadaPor)})` : ''} · prazo até ${c.prazoAte.toISOString()}`, detalhe: c.observacao });
    if (c.concluidaEm) eventos.push({ quando: c.concluidaEm.toISOString(), texto: 'Professor reenviou a correção' });
    if (c.conferidaEm) eventos.push({ quando: c.conferidaEm.toISOString(), texto: c.conferencia === 'ACEITA' ? `Secretaria considerou resolvida${nome(c.conferidaPor) ? ` (${nome(c.conferidaPor)})` : ''}` : `Secretaria devolveu novamente${nome(c.conferidaPor) ? ` (${nome(c.conferidaPor)})` : ''}` });
    if (situacaoCorrecaoUmTerco(c) === 'expirada') eventos.push({ quando: c.prazoAte.toISOString(), texto: 'Correção expirou (3 dias sem reenvio)' });
  }
  for (const h of e.historicoCorrecao) eventos.push({ quando: h.alteradoEm.toISOString(), texto: `${ORIGEM_TEXTO[h.origem]} · Semana ${h.semana.numero}${nome(h.alteradoPor) ? ` (${nome(h.alteradoPor)})` : ''}` });
  eventos.sort((a, b) => b.quando.localeCompare(a.quando));

  return {
    entregaId: e.id,
    ciclo: { id: e.ciclo.id, titulo: e.ciclo.titulo, trimestre: e.ciclo.trimestre, anoLetivo: e.ciclo.anoLetivo, abreEm: iso(e.ciclo.abreEm), prazoEm: iso(e.ciclo.prazoEm) },
    professor: { id: e.professor.id, nome: e.professor.nome, ativo: e.professor.status === 'ATIVO' },
    rotulo: rotuloDaFolha(cargoIds, rotulos.get(e.professorId) ?? new Map()),
    cargoIds,
    compartilhada: cargoIds.length > 1,
    avisoCompartilhada: cargoIds.length > 1 ? AVISO_FOLHA_COMPARTILHADA : null,
    composicao: lerFoto(e.composicao),
    concluidaEm: iso(e.concluidaEm),
    updatedAt: iso(e.updatedAt),
    situacao: ultima ? situacaoCorrecaoUmTerco(ultima) : 'nenhuma',
    somenteConsulta: consulta,
    motivoSomenteConsulta: consulta ? MSG_CARGO_ENCERRADO : null,
    podeCorrigir: !consulta,
    podeDevolver: !consulta && e.professor.status === 'ATIVO' && !vigente,
    podeConsiderarResolvida: !!ultima && situacaoCorrecaoUmTerco(ultima) === 'recebida',
    linkProfessor: `/formulario-um-terco/${e.cicloId}/cargo/${cargoIds[0]}`,
    semanas: semanas.map((s) => ({ id: s.id, numero: s.numero, rotulo: `Semana ${s.numero}`, dataInicio: paraDataIsoUtc(s.dataInicio), dataFim: paraDataIsoUtc(s.dataFim), texto: textoPorSemana.get(s.id) ?? '' })),
    correcoes,
    historicoValores: e.historicoCorrecao.map((h) => ({ id: h.id, semanaNumero: h.semana.numero, valorAnterior: h.valorAnterior, valorNovo: h.valorNovo, alteradoPor: h.alteradoPor, alteradoPorNome: nome(h.alteradoPor), alteradoEm: iso(h.alteradoEm), origem: h.origem })),
    linhaDoTempo: eventos,
  };
}

correcoesUmTercoRouter.get('/:entregaId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.entregaId);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Folha inválida.');
  res.json(await montarDetalhe(id));
});

// ----- Correção direta pela Secretaria ------------------------------------------------------------
// Não abre prazo, não coloca o Professor em modo de correção, não pede aceite. Valor real anterior lido
// antes de gravar (histórico SECRETARIA_DIRETA), mesma trava das gravações do Professor e o mesmo 409 por
// versão (updatedAt da folha). Depois, mensagem ao Professor (caixa de mensagens + sininho).
const corrigirSchema = z.object({
  baseUpdatedAt: z.string(),
  respostas: z.array(z.object({ semanaId: z.number().int(), texto: z.string().max(TEXTO_SEMANA_MAX, `Cada semana aceita no máximo ${TEXTO_SEMANA_MAX} caracteres.`) })).min(1),
});

correcoesUmTercoRouter.put('/:entregaId/respostas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const entregaId = Number(req.params.entregaId);
  if (!Number.isInteger(entregaId) || entregaId <= 0) throw new ValidationError('Folha inválida.');
  const dados = corrigirSchema.parse(req.body);

  let resultado: { criadas: { conversaId: number; destinatarioId: number }[]; historicoIds: number[] };
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const base = await tx.entregaUmTerco.findUnique({ where: { id: entregaId }, select: { cicloId: true, professorId: true } });
      if (!base) throw new NotFoundError('Folha do Formulário 1/3 não encontrada.');
      await travarFolhas(tx, base.cicloId, base.professorId);
      const e = await tx.entregaUmTerco.findUniqueOrThrow({ where: { id: entregaId }, include: { ...entregaInclude, respostas: true } });
      if (!e.chaveCargos) throw new ValidationError('Este preenchimento é do modelo antigo e não pode ser corrigido aqui.');
      if (e.status !== 'CONCLUIDA') throw new ValidationError('Só é possível corrigir uma folha já concluída.');
      if (somenteConsulta(e)) throw new ValidationError(MSG_CARGO_ENCERRADO);
      if (new Date(dados.baseUpdatedAt).getTime() !== e.updatedAt.getTime()) throw new ConflitoVersaoError('Esta folha foi alterada por outra pessoa (ou pelo Professor) enquanto você corrigia. Nada foi sobrescrito: confira a versão atual.', null);

      const semanas = await tx.semanaUmTerco.findMany({ where: { cicloId: e.cicloId }, orderBy: { numero: 'asc' } });
      const numeroDa = new Map(semanas.map((s) => [s.id, s.numero]));
      if (dados.respostas.some((r) => !numeroDa.has(r.semanaId))) throw new ValidationError('Semana não pertence a este ciclo.');
      if (dados.respostas.some((r) => !r.texto.trim())) throw new ValidationError('Uma folha concluída não pode ficar com semana em branco.');
      const antes = new Map(e.respostas.map((r) => [r.semanaId, r.texto]));
      const mudadas = dados.respostas.filter((r) => (antes.get(r.semanaId) ?? '') !== r.texto);
      if (mudadas.length === 0) throw new ValidationError('Nenhuma alteração para salvar.');

      for (const r of mudadas) {
        await tx.respostaSemanaUmTerco.upsert({
          where: { entregaId_semanaId: { entregaId, semanaId: r.semanaId } },
          create: { entregaId, semanaId: r.semanaId, texto: r.texto },
          update: { texto: r.texto },
        });
      }
      const historico = await Promise.all(mudadas.map((r) => tx.historicoCorrecaoSemanaUmTerco.create({ data: { entregaId, semanaId: r.semanaId, valorAnterior: antes.get(r.semanaId) ?? null, valorNovo: r.texto, alteradoPor: String(actor.id), origem: 'SECRETARIA_DIRETA' } })));
      await tx.entregaUmTerco.update({ where: { id: entregaId }, data: { updatedAt: new Date() } });

      // Mensagem ao Professor: Formulário 1/3, ciclo, folha (cargo + escola → disciplinas) e semanas alteradas.
      const cargoIds = e.cargos.map((c) => c.cargoId).sort((a, b) => a - b);
      const rotulos = rotulosDosCargos(await tx.cargoProfessor.findMany({ where: { professorId: e.professorId }, select: { id: true, status: true, dataInicio: true } }));
      const rotulo = rotuloDaFolha(cargoIds, rotulos);
      const partes = lerFoto(e.composicao);
      const criadas = e.professor.status === 'ATIVO' ? await criarMensagensDeCorrecao(tx, {
        remetenteId: actor.id, destinatarioIds: [e.professorId], escolasPreferidas: partes.map((p) => p.escolaId),
        assunto: `Correção feita pela Secretaria · Formulário 1/3 · ${rotulo}`,
        conteudo: textoMensagemCorrecaoDireta({ formulario: `Formulário 1/3 (${e.ciclo.titulo}, ${e.ciclo.trimestre}º trimestre)`, identificacao: [rotulo, ...partes.map(descreverParte)], semanas: mudadas.map((r) => `Semana ${numeroDa.get(r.semanaId)}`) }),
        link: `/formulario-um-terco/${e.cicloId}/cargo/${cargoIds[0]}`,
      }) : [];
      return { criadas, historicoIds: historico.map((h) => h.id) };
    }, { timeout: 15000 });
  } catch (error) {
    if (error instanceof ConflitoVersaoError) throw new ConflitoVersaoError(error.message, await montarDetalhe(entregaId));
    throw error;
  }
  await notificarMensagensDeCorrecao(prisma, actor.id, resultado.criadas, `correcao-direta-um-terco-${resultado.historicoIds[0]}`);
  res.json({ ...(await montarDetalhe(entregaId)), mensagensEnviadas: resultado.criadas.length });
});
