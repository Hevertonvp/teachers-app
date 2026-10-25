import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, ValidationError } from '../../domain/errors.js';
import { paraDataIso, travarCalendarioDoAno, validarPeriodosDoAno, type PeriodoEntrada } from '../../domain/trimestres.js';

export const trimestresRouter = Router();

type Actor = { id: number; perfil: string };

// Calendário de trimestres por ano letivo (Configurações > Trimestres). Leitura liberada a
// qualquer perfil autenticado (a tela mostra o calendário a todos); alteração só pela Secretaria.
const formatar = (p: { ano: number; trimestre: number; dataInicio: Date; dataFim: Date }) => ({
  ano: p.ano,
  trimestre: p.trimestre,
  dataInicio: paraDataIso(p.dataInicio),
  dataFim: paraDataIso(p.dataFim),
});

function lerAno(valor: unknown): number {
  const ano = Number(valor);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ValidationError('Ano inválido.');
  return ano;
}

// ?ano=2027 filtra um ano; sem filtro devolve todos os anos configurados.
trimestresRouter.get('/', async (req, res) => {
  const ano = req.query.ano !== undefined ? lerAno(req.query.ano) : undefined;
  const periodos = await prisma.periodoTrimestre.findMany({
    where: ano !== undefined ? { ano } : {},
    orderBy: [{ ano: 'asc' }, { trimestre: 'asc' }],
  });
  res.json(periodos.map(formatar));
});

// Datas ficam opcionais no schema de propósito: a ausência é validada em validarPeriodosDoAno,
// que devolve uma mensagem dizendo qual trimestre ficou sem qual data (em vez do genérico
// "Dados inválidos." do Zod).
const salvarSchema = z.object({
  periodos: z.array(z.object({
    trimestre: z.number().int(),
    dataInicio: z.string().nullish(),
    dataFim: z.string().nullish(),
  })).min(1, 'Informe ao menos um trimestre.').max(3),
});

// Salva um ou mais trimestres de UM ano de uma vez (criar ou editar — upsert por ano+trimestre).
// A validação roda sobre o calendário do ano JÁ MESCLADO (o que existe no banco + o que veio
// agora), dentro de uma transação com lock exclusivo daquele ano: duas gravações simultâneas nunca
// criam sobreposição uma "por trás" da outra, nem duplicam um trimestre (chave primária). Nunca
// mexe em Aplicações já criadas — o trimestre delas foi resolvido e congelado na criação.
trimestresRouter.put('/:ano', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria pode alterar o calendário de trimestres.');
  const ano = lerAno(req.params.ano);
  const { periodos } = salvarSchema.parse(req.body);

  const salvos = await prisma.$transaction(async (tx) => {
    await travarCalendarioDoAno(tx, ano, 'exclusivo');

    const existentes = await tx.periodoTrimestre.findMany({ where: { ano } });
    const recebidos = validarPeriodosDoAno(ano, periodos as PeriodoEntrada[]);
    const trimestresRecebidos = new Set(recebidos.map((p) => p.trimestre));
    validarPeriodosDoAno(ano, [
      ...existentes.filter((e) => !trimestresRecebidos.has(e.trimestre)).map((e) => ({ trimestre: e.trimestre, dataInicio: paraDataIso(e.dataInicio), dataFim: paraDataIso(e.dataFim) })),
      ...recebidos,
    ]);

    // Sequencial de propósito (uma transação interativa usa uma conexão só — ver pdiFichas.ts).
    for (const p of recebidos) {
      const dataInicio = new Date(`${p.dataInicio}T00:00:00Z`);
      const dataFim = new Date(`${p.dataFim}T00:00:00Z`);
      await tx.periodoTrimestre.upsert({
        where: { ano_trimestre: { ano, trimestre: p.trimestre } },
        create: { ano, trimestre: p.trimestre, dataInicio, dataFim, updatedBy: String(actor.id) },
        update: { dataInicio, dataFim, updatedBy: String(actor.id) },
      });
    }
    return tx.periodoTrimestre.findMany({ where: { ano }, orderBy: { trimestre: 'asc' } });
  }, { timeout: 15000 });

  res.json(salvos.map(formatar));
});
