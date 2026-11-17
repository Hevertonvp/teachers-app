// Cria o Modelo PDI de Literatura IDÊNTICO ao de Língua Portuguesa (pedido do usuário, 17/11/2026: "Literatura preenche
// os mesmos códigos BNCC de Língua Portuguesa. O formulário inclusive é idêntico").
// - Códigos: a Literatura já é mapeada ao componente LINGUA_PORTUGUESA desde 16/11 (adicionar-disciplina-literatura.ts),
//   então as perguntas "Habilidades do CRMG" mostram as habilidades de Língua Portuguesa.
// - Formulário: copia as perguntas ATIVAS do Modelo ativo de Língua Portuguesa, com todos os campos (inclusive o vínculo
//   com a pergunta padrão, para o bloco comum do Professor continuar único entre as disciplinas).
// - Vale para Aplicações criadas depois (snapshot). Idempotente: se a Literatura já tem Modelo ativo, não faz nada.
// Sem --aplicar: ENSAIO (desfeito). Usa a DATABASE_URL do ambiente (.env = produção; local: passe DATABASE_URL).
//   npx tsx scripts/lancamento/criar-modelo-pdi-literatura.ts            (ensaio)
//   npx tsx scripts/lancamento/criar-modelo-pdi-literatura.ts --aplicar
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';

const aplicar = process.argv.includes('--aplicar');
const alvo = /neon\.tech/.test(process.env.DATABASE_URL ?? '') ? 'PRODUÇÃO' : 'local';
class Ensaio extends Error {}

try {
  await prisma.$transaction(async (tx) => {
    const lit = await tx.disciplina.findFirst({ where: { nome: 'Literatura' }, include: { componenteCurricular: true } });
    const lp = await tx.disciplina.findFirst({ where: { nome: 'Língua Portuguesa' } });
    if (!lit || !lp) throw new Error('ABORTADO: disciplina Literatura ou Língua Portuguesa não existe.');
    console.log(`Banco: ${alvo}. Literatura #${lit.id}, componente ${lit.componenteCurricular?.componente ?? 'NENHUM'}.`);
    if (lit.componenteCurricular?.componente !== 'LINGUA_PORTUGUESA') throw new Error('ABORTADO: Literatura não está ligada aos códigos de Língua Portuguesa.');
    const jaTem = await tx.modeloPdi.findFirst({ where: { disciplinaId: lit.id, status: 'ATIVA' } });
    if (jaTem) { console.log(`Literatura já tem Modelo ativo (#${jaTem.id} "${jaTem.nome}"). Nada a fazer.`); throw new Ensaio(); }
    const modelosLp = await tx.modeloPdi.findMany({ where: { disciplinaId: lp.id, status: 'ATIVA' }, include: { perguntas: { where: { status: 'ATIVA' }, orderBy: { ordem: 'asc' } } } });
    if (modelosLp.length !== 1) throw new Error(`ABORTADO: esperava 1 Modelo ativo de Língua Portuguesa, achei ${modelosLp.length}.`);
    const base = modelosLp[0];
    const nome = base.nome.replace(/L[íi]ngua Portuguesa/i, 'Literatura');
    const novo = await tx.modeloPdi.create({ data: { nome: nome === base.nome ? 'PDI - Literatura' : nome, disciplinaId: lit.id, createdBy: 'script:criar-modelo-pdi-literatura' } });
    await tx.perguntaPdi.createMany({
      data: base.perguntas.map((p) => ({
        modeloId: novo.id, secao: p.secao, subsecao: p.subsecao, codigo: p.codigo, texto: p.texto, indicador: p.indicador,
        origem: p.origem, tipoResposta: p.tipoResposta, opcoes: p.opcoes ?? Prisma.JsonNull, complementar: p.complementar ?? Prisma.JsonNull,
        ordem: p.ordem, trimestre: p.trimestre, padraoOriginalId: p.padraoOriginalId, createdBy: 'script:criar-modelo-pdi-literatura',
      })),
    });
    const copiadas = await tx.perguntaPdi.findMany({ where: { modeloId: novo.id }, orderBy: { ordem: 'asc' } });
    const campos = (p: (typeof copiadas)[number]) => JSON.stringify([p.secao, p.subsecao, p.codigo, p.texto, p.indicador, p.origem, p.tipoResposta, p.opcoes, p.complementar, p.ordem, p.trimestre, p.padraoOriginalId]);
    if (copiadas.length !== base.perguntas.length || copiadas.some((p, i) => campos(p) !== campos(base.perguntas[i]))) throw new Error('ABORTADO: cópia diferente do original.');
    console.log(`Modelo base #${base.id} "${base.nome}" (${base.perguntas.length} perguntas ativas) → novo #${novo.id} "${novo.nome}" com ${copiadas.length} perguntas idênticas.`);
    if (!aplicar) throw new Ensaio();
  });
  console.log('CRIADO.');
} catch (e) {
  if (e instanceof Ensaio) console.log('ENSAIO/sem mudança: nada foi gravado.'); else throw e;
} finally { await prisma.$disconnect(); }
