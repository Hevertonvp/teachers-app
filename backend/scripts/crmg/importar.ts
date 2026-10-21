// Grava no banco o dataset gerado por extrair.ts — idempotente: a identidade de cada habilidade é
// (versaoCurriculo, chaveImportacao), então rodar de novo nunca duplica.
//
// Uso: npm run crmg:importar
//
// - Registro novo -> criado.
// - Registro já existente -> só metadados auxiliares podem ser atualizados (busca, páginas, anos,
//   revisão). A descrição oficial e o código de uma chave existente NUNCA são reescritos: se o
//   dataset trouxer outro texto para a mesma chave, o importador interrompe e reporta (a chave já
//   embute o conteúdo, então isso só aconteceria com uma mudança de pontuação — decisão humana).
// - Nada é apagado. Habilidade ausente do dataset não é tocada (snapshots já protegem o histórico).
import fs from 'node:fs';
import { PrismaClient, type ComponenteCurricular } from '@prisma/client';
import { DATASET_ARQUIVO, VERSAO } from './config.js';

type Registro = {
  chaveImportacao: string; codigo: string; descricaoOficial: string; componente: ComponenteCurricular;
  anoOuBloco: string | null; anosEscolares: number[]; origem: string; codigoBusca: string; descricaoBusca: string;
  fontePaginas: number[]; requerRevisao: boolean; observacaoRevisao: string | null;
};

const prisma = new PrismaClient();

async function main() {
  const dataset = JSON.parse(fs.readFileSync(DATASET_ARQUIVO, 'utf8')) as {
    versaoCurriculo: string; fonte: { url: string; sha256: string }; habilidades: Registro[];
  };
  if (dataset.versaoCurriculo !== VERSAO) throw new Error(`Dataset é da versão ${dataset.versaoCurriculo}, esperado ${VERSAO}.`);
  for (const h of dataset.habilidades) {
    if (!h.descricaoOficial || h.descricaoOficial !== h.descricaoOficial.normalize('NFC')) throw new Error(`Descrição inválida/não-NFC: ${h.chaveImportacao}`);
    if (/Ã.|�/.test(h.descricaoOficial)) throw new Error(`Codificação corrompida: ${h.chaveImportacao}`);
  }

  const existentes = new Map((await prisma.habilidadeCurricular.findMany({ where: { versaoCurriculo: VERSAO } })).map((h) => [h.chaveImportacao, h]));

  const divergentes = dataset.habilidades.filter((h) => {
    const e = existentes.get(h.chaveImportacao);
    return e && (e.descricaoOficial !== h.descricaoOficial || e.codigo !== h.codigo || e.componente !== h.componente);
  });
  if (divergentes.length) {
    throw new Error(`Dataset diverge de habilidades já importadas (texto/código/componente não são reescritos): ${divergentes.map((h) => h.chaveImportacao).join(', ')}`);
  }

  const novos = dataset.habilidades.filter((h) => !existentes.has(h.chaveImportacao));
  const comMudanca = dataset.habilidades.filter((h) => {
    const e = existentes.get(h.chaveImportacao);
    if (!e) return false;
    return e.codigoBusca !== h.codigoBusca || e.descricaoBusca !== h.descricaoBusca || e.anoOuBloco !== h.anoOuBloco
      || e.requerRevisao !== h.requerRevisao || e.observacaoRevisao !== h.observacaoRevisao || e.origem !== h.origem
      || e.fonteUrl !== dataset.fonte.url || e.fonteSha256 !== dataset.fonte.sha256
      || JSON.stringify(e.anosEscolares) !== JSON.stringify(h.anosEscolares) || JSON.stringify(e.fontePaginas) !== JSON.stringify(h.fontePaginas);
  });

  const comum = (h: Registro) => ({
    anoOuBloco: h.anoOuBloco, anosEscolares: h.anosEscolares, origem: h.origem, codigoBusca: h.codigoBusca,
    descricaoBusca: h.descricaoBusca, fonteUrl: dataset.fonte.url, fonteSha256: dataset.fonte.sha256,
    fontePaginas: h.fontePaginas, requerRevisao: h.requerRevisao, observacaoRevisao: h.observacaoRevisao,
  });

  if (novos.length) {
    await prisma.habilidadeCurricular.createMany({
      data: novos.map((h) => ({ versaoCurriculo: VERSAO, chaveImportacao: h.chaveImportacao, codigo: h.codigo, descricaoOficial: h.descricaoOficial, componente: h.componente, ...comum(h) })),
      skipDuplicates: true,
    });
  }
  for (const h of comMudanca) {
    await prisma.habilidadeCurricular.update({ where: { versaoCurriculo_chaveImportacao: { versaoCurriculo: VERSAO, chaveImportacao: h.chaveImportacao } }, data: comum(h) });
  }

  const total = await prisma.habilidadeCurricular.count({ where: { versaoCurriculo: VERSAO } });
  const porComponente = await prisma.habilidadeCurricular.groupBy({ by: ['componente'], where: { versaoCurriculo: VERSAO }, _count: true });
  console.log(JSON.stringify({
    versao: VERSAO,
    noDataset: dataset.habilidades.length,
    criadas: novos.length,
    metadadosAtualizados: comMudanca.length,
    inalteradas: dataset.habilidades.length - novos.length - comMudanca.length,
    totalNoBanco: total,
    porComponente: Object.fromEntries(porComponente.map((g) => [g.componente, g._count])),
  }, null, 1));
  if (total !== dataset.habilidades.length) throw new Error(`Total no banco (${total}) difere do dataset (${dataset.habilidades.length}).`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
