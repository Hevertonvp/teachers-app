// Extrai as habilidades do PDF oficial do CRMG e gera, de forma reproduzível:
//   prisma/data/crmg/<VERSAO>.json            — dataset que o importador grava no banco
//   prisma/data/crmg/<VERSAO>.auditoria.md    — relatório de auditoria/inconsistências
//
// Uso: npm run crmg:extrair [-- caminho/local.pdf]
// Sem caminho, baixa o PDF da URL oficial. Em qualquer caso o SHA-256 precisa bater com
// config.FONTE.sha256 — arquivo diferente = interrompe (nunca extrai de uma fonte não verificada).
//
// Regras (decisões da tarefa CRMG):
// - Código e descrição preservados exatamente como publicados (só normalização Unicode NFC e
//   espaços), nunca corrigidos. Inconsistências da fonte viram `requerRevisao` + observação.
// - Componente vem da SEÇÃO do documento (Organizador Curricular), nunca de "includes('EF')".
// - Mesmo código repetido (ex.: em vários anos): textos que diferem só em pontuação/espaços/
//   maiúsculas são consolidados num registro (1ª ocorrência), com as variantes no relatório;
//   textos com diferença real de conteúdo viram registros distintos, marcados para revisão.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { AUDITORIA_ARQUIVO, DATASET_ARQUIVO, DATASET_DIR, FAIXAS, FONTE, ORIGEM, SEGMENTO_CODIGO, VERSAO, type ComponenteChave } from './config.js';

type Item = { x: number; y: number; w: number; str: string };
type Linha = { y: number; items: Item[] };
type Ocorrencia = { codigo: string; descricao: string; pagina: number; ano: string | null; componente: ComponenteChave };

// Título de ano da tabela: "6º Ano", "1º ao 5º Ano" — a fonte usa ora "º" (ordinal), ora "°" (grau).
const ANO_RE = /^(\d+)\s*[º°]\s*(?:ao\s*(\d+)\s*[º°]\s*)?ano$/i;
const CABECALHO_RE = /(H\s?abilidades|Direitos de Aprendizagem)\s*$/;
// Prefixo aceita qualquer par de letras só para DETECTAR erros da fonte como "(ER06ER10MG)";
// o "(" é opcional porque a fonte tem casos como "EF07LI19) Discriminar…".
const CODIGO_RE = /\(?\s*([A-Z]\s*[A-Z]\s*\d\s*\d\s*[A-Z]\s*[A-Z]\s*\d\s*\d(?:\s*[A-Za-z0-9])*)\s*\)/g;
// Trecho de texto que INICIA um código (define a coluna "Habilidades" da tabela). Precisa ter a
// forma de código — "(Integração dos…" na coluna de Objetos de Conhecimento não pode contar.
const INICIO_CODIGO_RE = /^\(?\s*[A-Z]{2}\s*\d/;
const CODIGO_ESPERADO = /^EF\d{2}(AR|CI|EF|ER|GE|HI|LI|LP|MA)\d{2}[A-Z0-9]*$/;

const nfc = (t: string) => t.normalize('NFC').replace(/\s+/g, ' ').trim();
// Chave de comparação "só conteúdo": sem acento, minúsculas, sem pontuação/espaços.
const soConteudo = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizarBusca = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex');

function juntarItens(items: Item[]) {
  // Espaço só onde há lacuna visual real — o PDF quebra palavras em vários trechos ("ambien"+"tes").
  let s = '';
  let fim: number | null = null;
  for (const it of items) {
    if (fim !== null && it.x - fim > 1.2 && !s.endsWith(' ') && !it.str.startsWith(' ')) s += ' ';
    s += it.str;
    fim = it.x + it.w;
  }
  return s.replace(/\s+/g, ' ').trim();
}

function agruparLinhas(items: Item[]): Linha[] {
  const linhas = new Map<number, Item[]>();
  for (const it of items) {
    const y = Math.round(it.y);
    let chave = [...linhas.keys()].find((k) => Math.abs(k - y) <= 2);
    if (chave === undefined) { chave = y; linhas.set(chave, []); }
    linhas.get(chave)!.push(it);
  }
  return [...linhas.entries()].sort((a, b) => b[0] - a[0]).map(([y, its]) => ({ y, items: its.sort((a, b) => a.x - b.x) }));
}

async function obterPdf(caminhoLocal?: string): Promise<Buffer> {
  let buf: Buffer;
  if (caminhoLocal) {
    buf = fs.readFileSync(caminhoLocal);
  } else {
    const cache = path.join(os.tmpdir(), `crmg-${FONTE.sha256}.pdf`);
    if (fs.existsSync(cache)) buf = fs.readFileSync(cache);
    else {
      console.log(`Baixando ${FONTE.url} ...`);
      const r = await fetch(FONTE.url);
      if (!r.ok) throw new Error(`Falha ao baixar a fonte oficial (HTTP ${r.status}).`);
      buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(cache, buf);
    }
  }
  const hash = sha256(buf);
  if (hash !== FONTE.sha256) {
    throw new Error(`SHA-256 do PDF (${hash}) difere do esperado (${FONTE.sha256}). A fonte mudou — revisar antes de extrair.`);
  }
  return buf;
}

async function extrairOcorrencias(buf: Buffer): Promise<Ocorrencia[]> {
  const doc = await getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  if (doc.numPages !== FONTE.paginas) throw new Error(`Esperadas ${FONTE.paginas} páginas, encontradas ${doc.numPages}.`);

  // Fluxo contínuo da coluna "Habilidades", página a página (uma habilidade pode atravessar a
  // quebra de página — o trecho sem código no topo da página seguinte é continuação).
  const fluxo: { pagina: number; ano: string | null; componente: ComponenteChave; x0: number; texto: string }[] = [];
  let ano: string | null = null;
  for (const [componente, inicio, fim] of FAIXAS) {
    for (let p = inicio; p <= fim; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items: Item[] = [];
      for (const it of tc.items) {
        if (!('str' in it) || !it.str.trim()) continue;
        const item = { x: it.transform[4], y: it.transform[5], w: it.width, str: it.str };
        // cabeçalho "Currículo Referência…"/nº de página (y ≥ 790) e nº de página isolado no rodapé
        if (item.y >= 790 || item.y <= 40 || (item.y < 60 && /^\s*\d+\s*$/.test(item.str))) continue;
        items.push(item);
      }
      const segmentos: { ano: string | null; linhas: Linha[]; cabecalhoYs: number[] }[] = [];
      let atual = { ano, linhas: [] as Linha[], cabecalhoYs: [] as number[] };
      for (const ln of agruparLinhas(items)) {
        const txt = juntarItens(ln.items);
        const m = txt.match(ANO_RE);
        if (m) {
          segmentos.push(atual);
          ano = m[2] ? `${m[1]}-${m[2]}` : m[1];
          atual = { ano, linhas: [], cabecalhoYs: [] };
          continue;
        }
        if (CABECALHO_RE.test(txt)) atual.cabecalhoYs.push(ln.y);
        atual.linhas.push(ln);
      }
      segmentos.push(atual);
      for (const seg of segmentos) {
        const corpo = seg.linhas.filter((ln) => !seg.cabecalhoYs.some((hy) => Math.abs(ln.y - hy) <= 14));
        const xsCodigo = corpo.flatMap((ln) => ln.items.filter((it) => INICIO_CODIGO_RE.test(it.str) && it.x > 150).map((it) => it.x));
        const x0 = xsCodigo.length ? Math.min(...xsCodigo) : fluxo.at(-1)?.x0;
        if (x0 === undefined) continue;
        let texto = '';
        for (const ln of corpo) {
          const t = juntarItens(ln.items.filter((it) => it.x >= x0 - 3));
          if (!t) continue;
          texto += texto.endsWith('-') ? t : (texto ? ' ' : '') + t;
        }
        if (texto) fluxo.push({ pagina: p, ano: seg.ano, componente, x0, texto });
      }
    }
  }

  const ocorrencias: Ocorrencia[] = [];
  let ultima: Ocorrencia | null = null;
  for (const trecho of fluxo) {
    const achados = [...trecho.texto.matchAll(CODIGO_RE)].map((m) => ({ ini: m.index!, fim: m.index! + m[0].length, codigo: m[1].replace(/\s+/g, '') }));
    const antes = trecho.texto.slice(0, achados[0]?.ini ?? trecho.texto.length).trim();
    if (antes) {
      if (!ultima || ultima.componente !== trecho.componente) throw new Error(`Texto órfão na pág. ${trecho.pagina}: "${antes.slice(0, 80)}"`);
      ultima.descricao += ' ' + antes;
    }
    for (const [i, a] of achados.entries()) {
      ultima = { codigo: a.codigo, descricao: trecho.texto.slice(a.fim, achados[i + 1]?.ini ?? trecho.texto.length).trim(), pagina: trecho.pagina, ano: trecho.ano, componente: trecho.componente };
      ocorrencias.push(ultima);
    }
  }
  for (const o of ocorrencias) o.descricao = nfc(o.descricao);
  return ocorrencias;
}

function anosDe(ano: string | null): number[] {
  if (!ano) return [];
  const [a, b] = ano.split('-').map(Number);
  if (!b) return [a];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const listaAnos = (ocs: Ocorrencia[]) => [...new Set(ocs.flatMap((o) => anosDe(o.ano)))].join('/') || '?';

async function main() {
  const buf = await obterPdf(process.argv[2]);
  const ocorrencias = await extrairOcorrencias(buf);

  // Validações que interrompem (nunca grava dataset com lixo).
  const vazias = ocorrencias.filter((o) => o.descricao.length < 15);
  if (vazias.length) throw new Error(`Descrições vazias/curtas: ${vazias.map((o) => `${o.codigo}@${o.pagina}`).join(', ')}`);
  const corrompidas = ocorrencias.filter((o) => /Ã.|�/.test(o.descricao));
  if (corrompidas.length) throw new Error(`Texto com codificação corrompida: ${corrompidas.map((o) => o.codigo).join(', ')}`);
  const comTituloDeAno = ocorrencias.filter((o) => /\d\s*[º°]\s*ano\b/i.test(o.descricao));
  if (comTituloDeAno.length) throw new Error(`Título de ano colado na descrição (coluna misturada): ${comTituloDeAno.map((o) => `${o.codigo}@${o.pagina}`).join(', ')}`);

  // Agrupa por código -> agrupa textos equivalentes (só pontuação/espaço/maiúscula) -> registro.
  const porCodigo = new Map<string, Ocorrencia[]>();
  for (const o of ocorrencias) (porCodigo.get(o.codigo) ?? porCodigo.set(o.codigo, []).get(o.codigo)!).push(o);

  const habilidades = [];
  const consolidacoes: { codigo: string; escolhido: string; variantes: { texto: string; paginas: number[] }[] }[] = [];
  const revisoes: { codigo: string; motivo: string }[] = [];
  for (const [codigo, ocs] of porCodigo) {
    const grupos = new Map<string, Ocorrencia[]>();
    for (const o of ocs) {
      const chave = soConteudo(o.descricao);
      (grupos.get(chave) ?? grupos.set(chave, []).get(chave)!).push(o);
    }

    const motivosCodigo: string[] = [];
    if (!CODIGO_ESPERADO.test(codigo)) motivosCodigo.push(`Código publicado fora do padrão esperado (EF + ano/bloco + componente + número): "${codigo}". Preservado como publicado.`);
    const componentes = new Set(ocs.map((o) => o.componente));
    if (componentes.size > 1) motivosCodigo.push(`Código aparece em mais de um componente: ${[...componentes].join(', ')}.`);
    const segmento = codigo.slice(4, 6);
    if (segmento !== SEGMENTO_CODIGO[ocs[0].componente]) motivosCodigo.push(`Trecho "${segmento}" do código não corresponde ao componente da seção (${ocs[0].componente}).`);

    for (const [chaveConteudo, gocs] of grupos) {
      const motivos = [...motivosCodigo];
      if (grupos.size > 1) {
        const outros = [...grupos.values()].filter((g) => g !== gocs).map((g) => `ano(s) ${listaAnos(g)} (pág. ${[...new Set(g.map((o) => o.pagina))].join(', ')})`);
        motivos.push(`Mesmo código publicado com ${grupos.size} textos de conteúdo distinto; este é o texto do(s) ano(s) ${listaAnos(gocs)}. Outros: ${outros.join('; ')}.`);
      }
      const escolhido = gocs[0];
      const exatos = [...new Set(gocs.map((o) => o.descricao))];
      if (exatos.length > 1) {
        consolidacoes.push({
          codigo,
          escolhido: escolhido.descricao,
          variantes: exatos.filter((t) => t !== escolhido.descricao).map((t) => ({ texto: t, paginas: [...new Set(gocs.filter((o) => o.descricao === t).map((o) => o.pagina))] })),
        });
      }
      if (motivos.length) revisoes.push({ codigo, motivo: motivos.join(' ') });
      habilidades.push({
        chaveImportacao: `${codigo}#${sha256(chaveConteudo).slice(0, 12)}`,
        codigo,
        descricaoOficial: escolhido.descricao,
        componente: escolhido.componente,
        anoOuBloco: /^[A-Z]{2}(\d{2})/.exec(codigo)?.[1] ?? null,
        anosEscolares: [...new Set(gocs.flatMap((o) => anosDe(o.ano)))].sort((a, b) => a - b),
        origem: ORIGEM,
        codigoBusca: normalizarBusca(codigo),
        descricaoBusca: normalizarBusca(escolhido.descricao),
        fontePaginas: [...new Set(gocs.map((o) => o.pagina))].sort((a, b) => a - b),
        requerRevisao: motivos.length > 0,
        observacaoRevisao: motivos.length ? motivos.join(' ') : null,
      });
    }
  }

  const chaves = new Set(habilidades.map((h) => h.chaveImportacao));
  if (chaves.size !== habilidades.length) throw new Error('chaveImportacao duplicada — revisar consolidação.');

  const porComponente: Record<string, number> = {};
  for (const h of habilidades) porComponente[h.componente] = (porComponente[h.componente] ?? 0) + 1;
  const codigosUnicos = new Set(habilidades.map((h) => h.codigo)).size;

  fs.mkdirSync(DATASET_DIR, { recursive: true });
  const dataset = {
    versaoCurriculo: VERSAO,
    fonte: FONTE,
    resumo: { ocorrencias: ocorrencias.length, habilidades: habilidades.length, codigosUnicos, porComponente, consolidacoes: consolidacoes.length, requerRevisao: revisoes.length },
    habilidades,
  };
  fs.writeFileSync(DATASET_ARQUIVO, JSON.stringify(dataset, null, 1) + '\n', 'utf8');

  const md: string[] = [];
  md.push(`# Auditoria da extração — ${VERSAO}`, '');
  md.push('Gerado por `scripts/crmg/extrair.ts`. Não editar à mão — rodar o extrator novamente.', '');
  md.push('## Fonte', '');
  md.push(`- Documento: ${FONTE.titulo}`, `- URL: ${FONTE.url}`, `- SHA-256: \`${FONTE.sha256}\``, `- Páginas: ${FONTE.paginas}`);
  md.push('- Metadados do PDF: criação 19/05/2023, modificação 23/05/2023 (o texto não declara versão/data). Identificador técnico interno, não é nome oficial.', '');
  md.push('## Totais', '');
  md.push(`- Ocorrências de código nos Organizadores Curriculares: ${ocorrencias.length}`);
  md.push(`- Habilidades (registros) gravados: ${habilidades.length}`);
  md.push(`- Códigos distintos: ${codigosUnicos}`);
  md.push(`- Consolidações (mesmo código, diferença só de pontuação/espaço/maiúscula): ${consolidacoes.length}`);
  md.push(`- Registros marcados para revisão: ${revisoes.length}`, '');
  md.push('| Componente | Habilidades |', '|---|---|');
  for (const [c, n] of Object.entries(porComponente).sort()) md.push(`| ${c} | ${n} |`);
  md.push('', '## Marcados para revisão (preservados como publicados)', '');
  for (const r of revisoes) md.push(`- **${r.codigo}** — ${r.motivo}`);
  md.push('', '## Consolidações (variantes só de pontuação, documentadas)', '');
  for (const c of consolidacoes) {
    md.push(`- **${c.codigo}** — texto gravado (1ª ocorrência): "${c.escolhido}"`);
    for (const v of c.variantes) md.push(`  - variante (pág. ${v.paginas.join(', ')}): "${v.texto}"`);
  }
  md.push('', '## Verificação documental (resumo da auditoria que escolheu esta fonte)', '');
  md.push('- Comparada com o CRMG 2018 (documento do MEC, 1.750 códigos) e com os Planos de Curso 2026 do 3º trimestre (Portal Pedagógico).');
  md.push('- Planos 2026 (anos finais): 339 de 342 códigos citados existem nesta versão; os textos batem com esta versão, não com a de 2018.');
  md.push('- O Plano 2026 de Ensino Religioso cita `EF06ER10MG`, que esta versão publica como `ER06ER10MG` (mesmo texto) — preservado como publicado e marcado acima.');
  md.push('');
  fs.writeFileSync(AUDITORIA_ARQUIVO, md.join('\n'), 'utf8');

  console.log(JSON.stringify(dataset.resumo, null, 1));
  console.log(`Dataset: ${DATASET_ARQUIVO}\nAuditoria: ${AUDITORIA_ARQUIVO}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
