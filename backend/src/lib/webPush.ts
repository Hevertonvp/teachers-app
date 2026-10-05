import webpush from 'web-push';
import type { PrismaClient } from '@prisma/client';

// Lido uma vez no boot. Se as chaves não estiverem configuradas (ambiente de dev sem .env
// preenchido, por exemplo), Push fica desligado sem derrubar o resto do app — ver uso de
// `vapidConfigurado` abaixo. Nunca expor VAPID_PRIVATE_KEY fora do servidor.
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

export const vapidConfigurado = Boolean(publicKey && privateKey && subject);

if (vapidConfigurado) {
  webpush.setVapidDetails(subject!, publicKey!, privateKey!);
} else {
  console.warn('[webPush] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT não configuradas — Push desativado (Notificações internas continuam funcionando normalmente).');
}

export function obterChavePublicaVapid(): string | null {
  return vapidConfigurado ? publicKey! : null;
}

export type PayloadPush = {
  titulo: string;
  corpo: string;
  url: string | null;
};

// Envia Push para TODAS as assinaturas ATIVAS da pessoa. Nunca lança — falha de Push é sempre
// best-effort e não pode derrubar o fluxo principal (seção 16/41 do pedido: enviar uma Mensagem
// ou salvar um PDI nunca pode falhar por causa disso). Uma assinatura inválida não impede as
// outras (seção 50) e é inativada (nunca apagada) quando o serviço de push reporta 404/410.
export async function enviarPushParaPessoa(prisma: PrismaClient, pessoaId: number, payload: PayloadPush): Promise<void> {
  if (!vapidConfigurado) return;

  let assinaturas: { id: number; endpoint: string; p256dh: string; auth: string }[] = [];
  try {
    assinaturas = await prisma.assinaturaPush.findMany({
      where: { pessoaId, status: 'ATIVA' },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
  } catch (err) {
    console.error('[webPush] falha ao buscar assinaturas da pessoa', pessoaId, err);
    return;
  }

  const corpoJson = JSON.stringify({ title: payload.titulo, body: payload.corpo, url: payload.url });

  await Promise.all(
    assinaturas.map(async (assinatura) => {
      try {
        await webpush.sendNotification(
          { endpoint: assinatura.endpoint, keys: { p256dh: assinatura.p256dh, auth: assinatura.auth } },
          corpoJson,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          try {
            await prisma.assinaturaPush.update({ where: { id: assinatura.id }, data: { status: 'INATIVA' } });
          } catch {
            // Best-effort: se nem isso for possível, segue sem travar o envio aos outros dispositivos.
          }
        } else {
          console.error('[webPush] falha ao enviar push', { pessoaId, endpoint: assinatura.endpoint, statusCode }, err);
        }
      }
    }),
  );
}
