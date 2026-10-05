import { Prisma, type PrismaClient } from '@prisma/client';
import { enviarPushParaPessoa } from './webPush.js';

export type DadosNotificacao = {
  destinatarioId: number;
  tipo: 'NOVA_MENSAGEM' | 'PDI_PRAZO_PROFESSOR' | 'PDI_PRAZO_GESTOR';
  titulo: string;
  corpo: string;
  linkContexto?: string | null;
  metadata?: Prisma.InputJsonValue;
  chaveIdempotencia?: string | null;
};

// Base absoluta (origem + subcaminho) de onde o frontend está publicado, usada só pra montar o
// link ABSOLUTO que vai dentro do payload de Push (o clique na notificação do sistema operacional
// precisa abrir uma aba nova com a URL completa — diferente do clique dentro do app já aberto, que
// só usa `navigate()` com o linkContexto relativo). Em produção o app fica num subcaminho do
// GitHub Pages (ex.: https://usuario.github.io/teachers-app), não na raiz do domínio — por isso
// não dá pra montar isso só com a origem. Sem FRONTEND_URL configurada, cai pra string vazia
// (comportamento antigo, relativo à origem do clique — só correto se o app estiver na raiz).
function baseUrlFrontend(): string {
  return (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
}

// Único ponto de entrada para criar uma Notificação (usado por Mensagens e pelo job de prazo de
// PDI). Cria a linha e, se foi de fato criada agora (não um reaproveite de idempotência), dispara
// Push em best-effort. Nunca lança: criar uma notificação não pode derrubar o fluxo principal que
// a originou (enviar uma Mensagem, concluir uma Ficha, rodar o job noturno).
export async function criarNotificacao(prisma: PrismaClient, dados: DadosNotificacao): Promise<void> {
  let notificacao;
  try {
    notificacao = await prisma.notificacao.create({
      data: {
        destinatarioId: dados.destinatarioId,
        tipo: dados.tipo,
        titulo: dados.titulo,
        corpo: dados.corpo,
        linkContexto: dados.linkContexto ?? null,
        metadata: dados.metadata,
        chaveIdempotencia: dados.chaveIdempotencia ?? null,
      },
    });
  } catch (err) {
    // P2002 em chaveIdempotencia = notificação equivalente já existe (idempotência real — seção
    // 35 do pedido). Qualquer outro erro é só logado: notificação é importante, mas nunca ao
    // ponto de quebrar quem a está originando.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    console.error('[notificacoes] falha ao criar notificação', dados, err);
    return;
  }

  try {
    // O frontend usa HashRouter (tudo depois de "#" é só client-side) — o link precisa ir como
    // fragmento, nunca como path real (não existe rota de servidor pra "/mensagens"), prefixado
    // pela base real de onde o app está publicado (ver baseUrlFrontend acima).
    const url = notificacao.linkContexto ? `${baseUrlFrontend()}/#${notificacao.linkContexto}` : null;
    await enviarPushParaPessoa(prisma, dados.destinatarioId, {
      titulo: notificacao.titulo,
      corpo: notificacao.corpo,
      url,
    });
  } catch (err) {
    console.error('[notificacoes] falha ao disparar push (notificação interna já foi criada)', err);
  }
}
