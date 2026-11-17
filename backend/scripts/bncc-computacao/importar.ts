// Grava no banco o catálogo da BNCC Computação (1º ao 9º ano) gerado por extrair.mjs — mesmo modelo do
// importador do CRMG: idempotente por (versaoCurriculo, chaveImportacao); texto/código oficiais de uma
// habilidade já importada NUNCA são reescritos (se o dataset divergir, para e avisa); nada é apagado.
//
// Uso: npm run computacao:importar            (banco do .env / DATABASE_URL)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const VERSAO = 'BNCC-COMPUTACAO-2022';
const ARQUIVO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../prisma/data/bncc-computacao/BNCC-COMPUTACAO-2022.json');

type Registro = {
  chaveImportacao: string; codigo: string; descricaoOficial: string; componente: 'COMPUTACAO';
  anoOuBloco: string; anosEscolares: number[]; origem: string; codigoBusca: string; descricaoBusca: string;
  fontePaginas: number[]; requerRevisao: boolean; observacaoRevisao: string | null;
};

const prisma = new PrismaClient();

async function main() {
  const dataset = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')) as { versaoCurriculo: string; fonte: { url: string; sha256: string }; habilidades: Registro[] };
  if (dataset.versaoCurriculo !== VERSAO) throw new Error(`Dataset é da versão ${dataset.versaoCurriculo}, esperado ${VERSAO}.`);
  for (const h of dataset.habilidades) {
    if (h.componente !== 'COMPUTACAO') throw new Error(`Componente inesperado: ${h.chaveImportacao}`);
    if (!h.descricaoOficial || h.descricaoOficial !== h.descricaoOficial.normalize('NFC') || /Ã.|�/.test(h.descricaoOficial)) throw new Error(`Descrição inválida: ${h.chaveImportacao}`);
    if (h.anosEscolares.length !== 1 || h.anosEscolares[0] < 1 || h.anosEscolares[0] > 9) throw new Error(`Ano inválido: ${h.chaveImportacao}`);
  }

  const existentes = new Map((await prisma.habilidadeCurricular.findMany({ where: { versaoCurriculo: VERSAO } })).map((h) => [h.chaveImportacao, h]));
  const divergentes = dataset.habilidades.filter((h) => {
    const e = existentes.get(h.chaveImportacao);
    return e && (e.descricaoOficial !== h.descricaoOficial || e.codigo !== h.codigo || e.componente !== h.componente || JSON.stringify(e.anosEscolares) !== JSON.stringify(h.anosEscolares));
  });
  if (divergentes.length) throw new Error(`Dataset diverge do que já foi importado (não reescrevo): ${divergentes.map((h) => h.chaveImportacao).join(', ')}`);

  const novos = dataset.habilidades.filter((h) => !existentes.has(h.chaveImportacao));
  if (novos.length) {
    await prisma.habilidadeCurricular.createMany({
      data: novos.map((h) => ({
        versaoCurriculo: VERSAO, chaveImportacao: h.chaveImportacao, codigo: h.codigo, descricaoOficial: h.descricaoOficial,
        componente: h.componente, anoOuBloco: h.anoOuBloco, anosEscolares: h.anosEscolares, origem: h.origem,
        codigoBusca: h.codigoBusca, descricaoBusca: h.descricaoBusca, fonteUrl: dataset.fonte.url, fonteSha256: dataset.fonte.sha256,
        fontePaginas: h.fontePaginas, requerRevisao: h.requerRevisao, observacaoRevisao: h.observacaoRevisao,
      })),
      skipDuplicates: true,
    });
  }
  const total = await prisma.habilidadeCurricular.count({ where: { versaoCurriculo: VERSAO } });
  const outrasVersoes = await prisma.habilidadeCurricular.count({ where: { versaoCurriculo: { not: VERSAO } } });
  console.log(JSON.stringify({ versao: VERSAO, noDataset: dataset.habilidades.length, criadas: novos.length, totalNoBanco: total, outrasVersoesIntactas: outrasVersoes }));
  if (total !== dataset.habilidades.length) throw new Error(`Total no banco (${total}) difere do dataset (${dataset.habilidades.length}).`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
