import type { Prisma, PrismaClient } from '@prisma/client';
import { criarNotificacao } from './notificacoes.js';
import { textoNovaMensagem } from '../domain/notificacoes.js';

// Mensagem automática de correção na caixa de mensagens EXISTENTE (ConversaMensagem/Mensagem), sem
// módulo paralelo e sem depender de push. Uma conversa nova por devolução e por destinatário, com a
// Secretaria que devolveu como remetente; o Professor pode responder nela normalmente.
//
// Chamada DENTRO da transação que grava a devolução: ou a correção e a mensagem existem juntas, ou
// nenhuma das duas (sem mensagem duplicada nem correção sem aviso). A notificação interna (sininho)
// vai depois, com chave de idempotência por devolução.

type Tx = Prisma.TransactionClient;

// Escola da conversa: precisa ser uma em que o Professor tem vínculo ATIVO, senão a caixa de
// mensagens não deixa ele abrir (mesma regra de acesso de mensagens.ts). Preferência: a escola do
// próprio formulário.
async function escolaDaConversa(tx: Tx, pessoaId: number, preferidas: number[]): Promise<number | null> {
  const vinculos = await tx.vinculoEscolar.findMany({ where: { pessoaId, status: 'ATIVO' }, select: { escolaId: true } });
  const ids = vinculos.map((v) => v.escolaId);
  return preferidas.find((id) => ids.includes(id)) ?? ids[0] ?? null;
}

export async function criarMensagensDeCorrecao(tx: Tx, dados: {
  remetenteId: number; destinatarioIds: number[]; escolasPreferidas: number[]; assunto: string; conteudo: string; link: string;
}): Promise<{ conversaId: number; destinatarioId: number }[]> {
  const criadas: { conversaId: number; destinatarioId: number }[] = [];
  for (const destinatarioId of [...new Set(dados.destinatarioIds)]) {
    if (destinatarioId === dados.remetenteId) continue;
    const escolaId = await escolaDaConversa(tx, destinatarioId, dados.escolasPreferidas);
    if (escolaId === null) continue; // sem vínculo escolar ativo: não teria como ler a mensagem
    const conversa = await tx.conversaMensagem.create({ data: { escolaId, assunto: dados.assunto, createdBy: String(dados.remetenteId) } });
    await tx.participanteConversa.createMany({ data: [{ conversaId: conversa.id, pessoaId: dados.remetenteId }, { conversaId: conversa.id, pessoaId: destinatarioId }] });
    await tx.mensagem.create({ data: { conversaId: conversa.id, remetenteId: dados.remetenteId, conteudo: dados.conteudo, linkFormulario: dados.link } });
    criadas.push({ conversaId: conversa.id, destinatarioId });
  }
  return criadas;
}

export async function notificarMensagensDeCorrecao(prisma: PrismaClient, remetenteId: number, criadas: { conversaId: number; destinatarioId: number }[], chave: string) {
  if (criadas.length === 0) return;
  const remetente = await prisma.pessoa.findUnique({ where: { id: remetenteId }, select: { nome: true } });
  const { titulo, corpo } = textoNovaMensagem(remetente?.nome ?? 'a Secretaria');
  await Promise.all(criadas.map((c) => criarNotificacao(prisma, {
    destinatarioId: c.destinatarioId,
    tipo: 'NOVA_MENSAGEM',
    titulo,
    corpo,
    linkContexto: `/mensagens?conversa=${c.conversaId}`,
    metadata: { conversaId: c.conversaId },
    chaveIdempotencia: `${chave}:${c.destinatarioId}`,
  })));
}

export async function nomesDePessoas(db: PrismaClient | Tx, ids: number[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const pessoas = await db.pessoa.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } });
  return new Map(pessoas.map((p) => [String(p.id), p.nome]));
}
