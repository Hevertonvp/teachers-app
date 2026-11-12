import { obterExportacaoUmTerco } from '../services/exportacoes';
import { exportarExcel } from './exportarExcel';
import { STATUS_ENTREGA } from './umTerco';
import { descreverParteCargo } from '../services/cargos';

// Exportação do Formulário 1/3 de um ciclo: mesmos números e mesmos filtros do Painel de entregas
// (o backend reaproveita o cálculo do painel), mais o conteúdo de cada semana.
// `filtros` = ids da tela; `rotulos` = [['Escola','Nome'], ...] para a aba "Filtros" da planilha.
export const exportarUmTerco = async ({ cicloId, filtros = {}, rotulos = [], usuario }) => {
  const dados = await obterExportacaoUmTerco(cicloId, filtros);
  const { ciclo, resumo } = dados;
  const ident = [
    { titulo: 'Professor', valor: l => l.professorNome, largura: 32 },
    { titulo: 'Cargo', valor: l => l.rotulo, largura: 14 },
  ];
  // Escolas com disciplinas e atuações pedagógicas do cargo, sempre associadas (12/11/2026). Sem turmas e sem séries.
  // Escolas separadas por " | " (dentro de uma escola, ";" separa disciplinas de atuações).
  const cobertura = (l) => l.composicao.map(descreverParteCargo).join(' | ');
  await exportarExcel({
    arquivo: `educa-sao-joao-formulario-1-3-${ciclo.anoLetivo}-${ciclo.trimestre}tri`,
    usuario,
    filtros: [['Ciclo', `${ciclo.titulo} — ${ciclo.trimestre}º trimestre de ${ciclo.anoLetivo}`], ...rotulos],
    abas: [
      { nome: 'Entregas', linhas: dados.linhas, colunas: [
        ...ident,
        { titulo: 'Escolas e atuação', valor: cobertura, largura: 50 },
        { titulo: 'Status', valor: l => STATUS_ENTREGA[l.status]?.label ?? l.status, largura: 14 },
        { titulo: 'Semanas preenchidas', valor: l => l.semanasPreenchidas, tipo: 'numero' },
        { titulo: 'Total de semanas', valor: l => l.totalSemanas, tipo: 'numero' },
        { titulo: 'Concluída em', valor: l => l.concluidaEm, tipo: 'dataHora', largura: 18 },
        { titulo: 'Última alteração', valor: l => l.atualizadoEm, tipo: 'dataHora', largura: 18 },
      ] },
      { nome: 'Conteúdos', linhas: dados.conteudos, colunas: [
        ...ident,
        { titulo: 'Escolas e atuação', valor: c => c.cobertura, largura: 50 },
        { titulo: 'Semana', valor: c => c.semanaNumero, tipo: 'numero' },
        { titulo: 'Início', valor: c => c.semanaInicio, tipo: 'data' },
        { titulo: 'Fim', valor: c => c.semanaFim, tipo: 'data' },
        { titulo: 'Conteúdo', valor: c => c.texto, largura: 80 },
      ] },
      { nome: 'Cobertura por escola', linhas: dados.porEscola, colunas: [
        { titulo: 'Escola', valor: e => e.escolaNome, largura: 34 },
        { titulo: 'Esperadas', valor: e => e.esperado, tipo: 'numero' },
        { titulo: 'Concluídas', valor: e => e.concluidas, tipo: 'numero' },
      ] },
      { nome: 'Resumo', linhas: [resumo], colunas: [
        { titulo: 'Esperadas', valor: r => r.esperado, tipo: 'numero' },
        { titulo: 'Concluídas', valor: r => r.concluidas, tipo: 'numero' },
        { titulo: 'Em andamento', valor: r => r.emAndamento, tipo: 'numero' },
        { titulo: 'Não iniciadas', valor: r => r.naoIniciadas, tipo: 'numero' },
        { titulo: 'Entrega (%)', valor: r => r.percentualEntrega, tipo: 'numero' },
      ] },
    ],
  });
};
