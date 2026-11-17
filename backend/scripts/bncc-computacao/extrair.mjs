// Extrai as habilidades do Ensino Fundamental (1º ao 9º ano) da BNCC Computação a partir do PDF OFICIAL
// (Anexo ao Parecer CNE/CEB nº 2/2022, publicado pelo MEC/CNE) e grava o dataset versionado usado por
// importar.ts. Nunca inventa texto: cada habilidade é a linha "(EFnnCOnn) texto" exatamente como o
// pdftotext devolve (UTF-8, sem -layout). Só os códigos por ano (EF01–EF09); os blocos EF15/EF69, a
// Educação Infantil (EI) e o Ensino Médio (EM) ficam de fora por decisão do usuário (17/11/2026).
//
// Uso (precisa do pdftotext / poppler):
//   pdftotext -enc UTF-8 anexo.pdf anexo.txt
//   node scripts/bncc-computacao/extrair.mjs <anexo.pdf> <anexo.txt>
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSAO = 'BNCC-COMPUTACAO-2022';
export const FONTE_URL = 'https://www.gov.br/mec/pt-br/cne/pdf/normas-classificadas-por-assunto/base-nacional-comum-curricular-bncc/anexo-ao-parecer-cneceb-no-2-2022-bncc-computacao.pdf';
const SAIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../prisma/data/bncc-computacao/BNCC-COMPUTACAO-2022.json');
// Quantidade por ano conferida no próprio documento (tabelas "COMPUTAÇÃO - Nº ANO").
const ESPERADO = { 1: 7, 2: 6, 3: 9, 4: 8, 5: 10, 6: 10, 7: 11, 8: 11, 9: 10 };

const normalizarBusca = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const [pdf, txt] = process.argv.slice(2);
if (!pdf || !txt) throw new Error('Uso: node extrair.mjs <anexo.pdf> <anexo.txt>');
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(pdf)).digest('hex');
const paginas = fs.readFileSync(txt, 'utf8').split('\f');

const habilidades = [];
paginas.forEach((pagina, i) => {
  for (const linha of pagina.split('\n')) {
    const m = linha.match(/^\((EF0([1-9])CO\d{2})\)\s+(.+?)\s*$/);
    if (!m) continue;
    const [, codigo, ano, texto] = m;
    const descricaoOficial = texto.normalize('NFC');
    habilidades.push({
      chaveImportacao: codigo, codigo, descricaoOficial, componente: 'COMPUTACAO',
      anoOuBloco: `0${ano}`, anosEscolares: [Number(ano)], origem: 'BNCC',
      codigoBusca: normalizarBusca(codigo), descricaoBusca: normalizarBusca(descricaoOficial),
      fontePaginas: [i + 1], requerRevisao: false, observacaoRevisao: null,
    });
  }
});

const codigos = habilidades.map((h) => h.codigo);
if (new Set(codigos).size !== codigos.length) throw new Error('Código repetido no documento — revisar à mão.');
for (const [ano, n] of Object.entries(ESPERADO)) {
  const achadas = habilidades.filter((h) => h.anosEscolares[0] === Number(ano)).length;
  if (achadas !== n) throw new Error(`${ano}º ano: esperava ${n}, achei ${achadas}.`);
}
habilidades.sort((a, b) => a.codigo.localeCompare(b.codigo));
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, JSON.stringify({ versaoCurriculo: VERSAO, fonte: { url: FONTE_URL, sha256 }, habilidades }, null, 2) + '\n');
console.log(`${habilidades.length} habilidades gravadas em ${SAIDA}`);
