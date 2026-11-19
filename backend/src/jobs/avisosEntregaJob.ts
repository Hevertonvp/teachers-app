import type { PrismaClient } from '@prisma/client';
import { dataCivilSP, dataCivilDeColunaDate, diasEntreDatasCivis } from '../domain/notificacoes.js';
import { avisarPendencias, refPdi, refUmTerco, situacaoPdiDasAplicacoes, type Marco } from '../lib/avisosEntrega.js';
import { montarPainel } from '../api/routes/formularioUmTerco.js';

// Avisos diários de entrega por escola (18/11/2026), no Formulário 1/3 e no PDI (ver lib/avisosEntrega.ts):
//   prazo amanhã  → o prazo cai no dia seguinte (data civil de São Paulo);
//   prazo vencido → o prazo foi de 1 a 3 dias atrás (a janela cobre um dia em que o servidor ficou fora;
//                   a chave de idempotência garante um aviso só).
// Roda às 08:45 e na subida do servidor. Idempotente. Aceita `agora` para testes.

export function marcoDoPrazo(hojeISO: string, prazoISO: string): Marco | null {
  const dias = diasEntreDatasCivis(hojeISO, prazoISO);
  if (dias === 1) return 'prazo_amanha';
  if (dias <= -1 && dias >= -3) return 'atrasada';
  return null;
}

export type ResultadoAvisosEntrega = { ciclosAvaliados: number; aplicacoesAvaliadas: number; notificacoesTentadas: number };

export async function executarAvisosDeEntrega(prisma: PrismaClient, opts: { agora?: Date } = {}): Promise<ResultadoAvisosEntrega> {
  const agora = opts.agora ?? new Date();
  const hojeISO = dataCivilSP(agora);
  let ciclosAvaliados = 0;
  let aplicacoesAvaliadas = 0;
  let notificacoesTentadas = 0;

  // --- Formulário 1/3: um resumo por ciclo para a Secretaria; um aviso por escola para a gestão dela.
  const ciclos = await prisma.cicloUmTerco.findMany({ where: { status: 'ATIVA' }, select: { id: true, prazoEm: true } });
  for (const ciclo of ciclos) {
    const marco = marcoDoPrazo(hojeISO, dataCivilSP(ciclo.prazoEm));
    if (!marco) continue;
    ciclosAvaliados++;
    try {
      const painel = await montarPainel(ciclo.id, {});
      const ref = refUmTerco(ciclo.id);
      notificacoesTentadas += await avisarPendencias(prisma, 'UM_TERCO', painel.porEscola.map((e) => ({ ...e, ref })), marco, `um-terco:${ciclo.id}`, ref.linkSecretaria);
    } catch (err) {
      console.error('[avisosEntrega] falha no ciclo do 1/3', ciclo.id, err);
    }
  }

  // --- PDI: cada Aplicação é de uma escola; o resumo da Secretaria junta as Aplicações do mesmo prazo.
  const aplicacoes = await prisma.aplicacaoPdi.findMany({ where: { status: 'ATIVA', escola: { status: 'ATIVA' } }, select: { id: true, dataFim: true } });
  const porPrazo = new Map<string, { marco: Marco; ids: number[] }>();
  for (const a of aplicacoes) {
    const prazoISO = dataCivilDeColunaDate(a.dataFim);
    const marco = marcoDoPrazo(hojeISO, prazoISO);
    if (!marco) continue;
    const grupo = porPrazo.get(prazoISO) ?? { marco, ids: [] };
    grupo.ids.push(a.id);
    porPrazo.set(prazoISO, grupo);
  }
  for (const [prazoISO, grupo] of porPrazo) {
    aplicacoesAvaliadas += grupo.ids.length;
    try {
      const situacoes = await situacaoPdiDasAplicacoes(prisma, grupo.ids);
      // A gestão recebe por escola (chave por Aplicação); a Secretaria, um resumo do dia do prazo.
      const itens = grupo.ids.flatMap((id) => { const s = situacoes.get(id); return s ? [{ ...s, ref: refPdi(id) }] : []; });
      notificacoesTentadas += await avisarPendencias(prisma, 'PDI', itens, grupo.marco, `pdi:${prazoISO}`, refPdi(0).linkSecretaria);
    } catch (err) {
      console.error('[avisosEntrega] falha nas Aplicações do PDI', prazoISO, err);
    }
  }

  return { ciclosAvaliados, aplicacoesAvaliadas, notificacoesTentadas };
}
