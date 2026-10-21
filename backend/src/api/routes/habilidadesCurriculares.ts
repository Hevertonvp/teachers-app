import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../domain/errors.js';
import { COMPONENTE_NOME, componenteDaDisciplina, formatarHabilidade, normalizarBusca } from '../../domain/habilidadesCurriculares.js';

export const habilidadesCurricularesRouter = Router();

const LIMITE_RESULTADOS = 20;

// Leitura do catálogo (currículo público) liberada a qualquer perfil autenticado: o Professor busca
// habilidades ao responder uma pergunta HABILIDADE_CRMG na Ficha. Não existe rota de administração/
// importação — o catálogo só muda pelo script versionado (scripts/crmg/importar.ts).

const buscaSchema = z.object({
  disciplinaId: z.coerce.number().int(),
  q: z.string().trim().default(''),
});

// GET /api/habilidades-curriculares?disciplinaId=X&q=termo
// 1) disciplinaId -> componente (mapeamento explícito); 2) filtra pelo componente; 3) aplica os
// termos (todos precisam bater, em código OU descrição, sem acento/maiúscula); 4) ranqueia e limita.
habilidadesCurricularesRouter.get('/', async (req, res) => {
  const { disciplinaId, q } = buscaSchema.parse(req.query);

  const disciplina = await prisma.disciplina.findUnique({ where: { id: disciplinaId } });
  if (!disciplina) throw new NotFoundError('Disciplina não encontrada.');
  const componente = await componenteDaDisciplina(prisma, disciplinaId);
  if (!componente) {
    return res.json({ componente: null, componenteNome: null, mensagem: 'Nenhum componente CRMG configurado para esta disciplina.', resultados: [] });
  }

  const consulta = normalizarBusca(q);
  if (consulta.length < 2) {
    return res.json({ componente, componenteNome: COMPONENTE_NOME[componente], resultados: [] });
  }
  const termos = consulta.split(' ').filter(Boolean);

  const candidatos = await prisma.habilidadeCurricular.findMany({
    where: {
      componente,
      ativa: true,
      AND: termos.map((termo) => ({ OR: [{ codigoBusca: { contains: termo } }, { descricaoBusca: { contains: termo } }] })),
    },
    take: 400, // um componente inteiro tem no máximo ~420 habilidades — o corte é só proteção
  });

  const consultaSemEspaco = consulta.replace(/\s+/g, '');
  const pontuar = (h: (typeof candidatos)[number]) => {
    let pontos = 0;
    if (h.codigoBusca === consultaSemEspaco) pontos += 1000;
    else if (h.codigoBusca.startsWith(consultaSemEspaco)) pontos += 500;
    if (termos.length > 1 && h.descricaoBusca.includes(consulta)) pontos += 200; // frase exata
    for (const termo of termos) {
      if (new RegExp(`(^|[^a-z0-9])${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(h.descricaoBusca)) pontos += 20; // início de palavra
    }
    return pontos;
  };

  const resultados = candidatos
    .map((h) => ({ h, pontos: pontuar(h) }))
    .sort((a, b) => b.pontos - a.pontos || a.h.codigo.localeCompare(b.h.codigo) || a.h.id - b.h.id)
    .slice(0, LIMITE_RESULTADOS)
    .map(({ h }) => formatarHabilidade(h));

  res.json({ componente, componenteNome: COMPONENTE_NOME[componente], resultados });
});
