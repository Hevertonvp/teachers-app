import { useEffect, useState } from 'react';
import { Button, Card, LoadingBlock } from './Common';
import { obterIndicadoresPdiReais } from '../services/pdiAplicacoes';
import { PainelEntrega, ordenarPorEntrega, textoPrazo } from './PainelEntrega';

// Entrega do PDI na visão de gestão (Secretaria/Gestor/Diretora): Fichas esperadas x concluídas x em
// preenchimento da Aplicação vigente de cada escola (GET /api/pdi-aplicacoes/indicadores, no escopo
// de quem consulta), filtrado pela escola do topo. Usado na página do PDI e no Dashboard (compacto).
export const EntregaPdiGestao = ({ activeEscolaId, compacto = false, link = null }) => {
  const [indicadores, setIndicadores] = useState(null);
  const [erro, setErro] = useState('');
  const carregar = () => { setErro(''); obterIndicadoresPdiReais().then(setIndicadores).catch(error => setErro(error.message)); };
  useEffect(carregar, []);

  if (erro) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50 text-sm font-semibold text-red-800">
        <span>Não foi possível carregar a entrega do PDI: {erro}</span>
        <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
      </Card>
    );
  }
  if (!indicadores) return <Card><LoadingBlock text="Carregando..." className="py-4" /></Card>;

  const escopo = activeEscolaId === null ? indicadores : indicadores.filter(item => item.escolaId === activeEscolaId);
  const comAplicacao = escopo.filter(item => item.aplicacaoId !== null);
  // Aplicação aberta mas nenhuma Ficha esperada (nenhum professor/aluno vinculado às disciplinas
  // dela) não é "0% entregue" — sai da lista e vira nota de rodapé, para não parecer atraso.
  const semFichasEsperadas = comAplicacao.filter(item => item.totalEsperado === 0).length;
  const grupos0 = comAplicacao
    .filter(item => item.totalEsperado > 0)
    .map(item => {
      const emAndamento = item.emAndamento ?? 0;
      return {
        id: item.escolaId,
        nome: item.escolaNome,
        concluidas: item.concluidas,
        emAndamento,
        naoIniciadas: Math.max(0, item.totalEsperado - item.concluidas - emAndamento),
        detalhe: item.aplicacaoDataFim ? textoPrazo(item.aplicacaoDataFim) : null,
      };
    });
  const grupos = ordenarPorEntrega(grupos0);
  const totais = grupos.reduce((acc, g) => ({ concluidas: acc.concluidas + g.concluidas, emAndamento: acc.emAndamento + g.emAndamento, naoIniciadas: acc.naoIniciadas + g.naoIniciadas }), { concluidas: 0, emAndamento: 0, naoIniciadas: 0 });
  const semAplicacao = escopo.length - comAplicacao.length;

  return (
    <PainelEntrega
      titulo="Entrega do PDI"
      descricao={grupos.length === 1
        ? `${grupos[0].nome}${grupos[0].detalhe ? ` · ${grupos[0].detalhe}` : ''}`
        : activeEscolaId === null ? 'Aplicações vigentes' : 'Aplicação vigente'}
      totais={totais}
      grupos={grupos.length > 1 ? grupos : []}
      compacto={compacto}
      link={link}
      vazio="Nenhuma Aplicação vigente."
      rodape={[
        semAplicacao > 0 ? `${semAplicacao} ${semAplicacao === 1 ? 'escola sem Aplicação vigente' : 'escolas sem Aplicação vigente'}.` : null,
        semFichasEsperadas > 0 ? `${semFichasEsperadas} ${semFichasEsperadas === 1 ? 'escola com Aplicação, sem professor/aluno vinculado' : 'escolas com Aplicação, sem professor/aluno vinculado'}.` : null,
      ].filter(Boolean).join(' ') || null}
    />
  );
};
