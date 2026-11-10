// Exportação para Excel (.xlsx) — utilitário único usado por todas as telas.
// - ExcelJS é carregado só no clique (import dinâmico), para não pesar o carregamento do app.
// - Cada valor é gravado como TEXTO, NÚMERO ou DATA — nunca como fórmula: um texto que comece
//   com "=", "+", "-" ou "@" fica como texto puro na célula (tipo String do xlsx), não é calculado.
// - Datas só-dia ('YYYY-MM-DD' ou ISO à meia-noite UTC do Postgres @db.Date) usam as partes UTC,
//   para não "voltar um dia" (lição do DEF-16). Data+hora é convertida para o horário de São Paulo.
// - Abas de dados primeiro (o arquivo abre na lista); última aba "Filtros": quem exportou, quando, filtros.
// - Cada aba: cabeçalho em negrito, primeira linha congelada, filtro automático, larguras ajustadas.

const FUSO = 'America/Sao_Paulo';

const partesSaoPaulo = (data) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(data).map(x => [x.type, x.value]));
  return { ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, minuto: +p.minute };
};

// Só-dia: 'YYYY-MM-DD' ou ISO à meia-noite UTC → Date em UTC com o mesmo dia (Excel lê o serial em UTC).
const dataSoDia = (valor) => {
  if (!valor) return null;
  const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
};

// Data e hora (instante real) → horário de São Paulo, gravado como "relógio de parede".
const dataHora = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  const p = partesSaoPaulo(d);
  return new Date(Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto));
};

const hojeSaoPaulo = () => {
  const p = partesSaoPaulo(new Date());
  const z = (n) => String(n).padStart(2, '0');
  return { iso: `${p.ano}-${z(p.mes)}-${z(p.dia)}`, texto: `${z(p.dia)}/${z(p.mes)}/${p.ano} ${z(p.hora)}:${z(p.minuto)}` };
};

const valorCelula = (tipo, valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  if (tipo === 'data') return dataSoDia(valor);
  if (tipo === 'dataHora') return dataHora(valor);
  if (tipo === 'numero') return typeof valor === 'number' ? valor : (Number.isFinite(Number(valor)) ? Number(valor) : String(valor));
  return String(valor);
};

const FORMATO = { data: 'dd/mm/yyyy', dataHora: 'dd/mm/yyyy hh:mm' };

const nomeAba = (nome) => String(nome).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

/**
 * @param {object} cfg
 * @param {string} cfg.arquivo  base do nome do arquivo (sem data nem extensão), ex.: 'nexo-pdi'
 * @param {Array<[string,string]>} [cfg.filtros]  filtros aplicados na tela: [['Escola','Todas'], ...]
 * @param {string} [cfg.usuario]  nome de quem exportou
 * @param {Array<{nome:string, colunas:Array<{titulo:string, valor:(linha)=>any, tipo?:'texto'|'numero'|'data'|'dataHora', largura?:number}>, linhas:any[]}>} cfg.abas
 */
export async function exportarExcel({ arquivo, filtros = [], usuario, abas }) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NEXO';
  wb.created = new Date();
  const hoje = hojeSaoPaulo();

  for (const aba of abas) {
    const ws = wb.addWorksheet(nomeAba(aba.nome), { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = aba.colunas.map(c => ({ header: c.titulo, width: c.largura ?? Math.max(12, Math.min(50, c.titulo.length + 4)) }));
    for (const linha of aba.linhas) {
      const row = ws.addRow(aba.colunas.map(c => valorCelula(c.tipo ?? 'texto', c.valor(linha))));
      aba.colunas.forEach((c, i) => {
        if (FORMATO[c.tipo]) row.getCell(i + 1).numFmt = FORMATO[c.tipo];
        if ((c.tipo ?? 'texto') === 'texto') row.getCell(i + 1).alignment = { vertical: 'top', wrapText: (c.largura ?? 0) >= 50 };
      });
    }
    const cab = ws.getRow(1);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    cab.alignment = { vertical: 'middle' };
    if (aba.colunas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.colunas.length } };
  }

  // Aba 'Filtros' por ÚLTIMO: o arquivo abre direto na lista (antes abria nos filtros e a pessoa
  // achava que a planilha estava vazia — os dados ficavam escondidos na segunda aba).
  const info = wb.addWorksheet('Filtros');
  info.columns = [{ width: 28 }, { width: 60 }];
  info.addRow(['Exportado em', hoje.texto]);
  if (usuario) info.addRow(['Exportado por', String(usuario)]);
  filtros.forEach(([rotulo, valor]) => info.addRow([String(rotulo), valor === null || valor === undefined || valor === '' ? 'Todos' : String(valor)]));
  abas.forEach(aba => info.addRow([`Linhas em "${aba.nome}"`, String(aba.linhas.length)]));
  info.getColumn(1).font = { bold: true };
  wb.views = [{ activeTab: 0, firstSheet: 0, visibility: 'visible' }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${arquivo}-${hoje.iso}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
