import { useEffect, useState } from 'react';
import { Button, Card, LoadingBlock } from './Common';
import { listarCiclosUmTerco, obterPainelUmTerco } from '../services/formularioUmTerco';
import { paraInputDataHora } from '../utils/umTerco';
import { PainelEntrega, ordenarPorEntrega, textoPrazo } from './PainelEntrega';

// Entrega do Formulário 1/3 no Dashboard da Secretaria (único perfil que acessa o painel do 1/3).
// Números = os do Painel de entregas do ciclo (GET /ciclos/:id/painel, mesmo cálculo), filtrados pela
// escola do topo. Qual ciclo: o aberto agora; senão um reaberto; senão o último encerrado; senão o
// próximo agendado. Por escola: uma entrega aparece em cada escola que ela atinge (a soma por escola
// pode passar do total da rede — mesma regra da "Cobertura por escola" do painel).
const diaLocal = (iso) => paraInputDataHora(iso).slice(0, 10);
const dataBr = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

const escolherCiclo = (ciclos) => {
  const ativos = ciclos.filter(c => c.statusRegistro === 'ativa');
  return ativos.find(c => c.statusPrazo === 'aberto')
    ?? ativos.find(c => c.editavelAgora)
    ?? [...ativos].filter(c => c.statusPrazo === 'encerrado').sort((a, b) => b.prazoEm.localeCompare(a.prazoEm))[0]
    ?? [...ativos].filter(c => c.statusPrazo === 'agendado').sort((a, b) => a.abreEm.localeCompare(b.abreEm))[0]
    ?? null;
};

const situacao = (ciclo) => {
  if (ciclo.statusPrazo === 'aberto') return textoPrazo(diaLocal(ciclo.prazoEm));
  if (ciclo.editavelAgora) return 'reaberto';
  if (ciclo.statusPrazo === 'encerrado') return `encerrado em ${dataBr(diaLocal(ciclo.prazoEm))}`;
  return `abre em ${dataBr(diaLocal(ciclo.abreEm))}`;
};

export const EntregaUmTercoGestao = ({ activeEscolaId, compacto = false, link = null }) => {
  const [estado, setEstado] = useState({ carregando: true, erro: '', ciclo: null, painel: null });

  const carregar = async () => {
    setEstado(prev => ({ ...prev, carregando: true, erro: '' }));
    try {
      const ciclo = escolherCiclo(await listarCiclosUmTerco());
      const painel = ciclo ? await obterPainelUmTerco(ciclo.id, activeEscolaId === null ? {} : { escolaId: activeEscolaId }) : null;
      setEstado({ carregando: false, erro: '', ciclo, painel });
    } catch (error) {
      setEstado({ carregando: false, erro: error.message, ciclo: null, painel: null });
    }
  };
  useEffect(() => { carregar(); }, [activeEscolaId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (estado.erro) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50 text-sm font-semibold text-red-800">
        <span>Não foi possível carregar a entrega do Formulário 1/3: {estado.erro}</span>
        <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
      </Card>
    );
  }
  if (estado.carregando) return <Card><LoadingBlock text="Carregando..." className="py-4" /></Card>;

  const { ciclo, painel } = estado;
  if (!ciclo) {
    return <PainelEntrega titulo="Entrega do Formulário 1/3" totais={{ concluidas: 0, emAndamento: 0, naoIniciadas: 0 }} grupos={[]} vazio="Nenhum Formulário 1/3 criado." compacto={compacto} link={link} unidade="entregas" />;
  }

  const { resumo } = painel;
  const porEscola = new Map();
  if (activeEscolaId === null) {
    for (const linha of painel.linhas) {
      for (const [escolaId, escolaNome] of new Map(linha.turmas.map(t => [t.escolaId, t.escolaNome]))) {
        const g = porEscola.get(escolaId) ?? { id: escolaId, nome: escolaNome, concluidas: 0, emAndamento: 0, naoIniciadas: 0 };
        if (linha.status === 'concluida') g.concluidas += 1;
        else if (linha.status === 'em_andamento') g.emAndamento += 1;
        else g.naoIniciadas += 1;
        porEscola.set(escolaId, g);
      }
    }
  }
  const grupos = ordenarPorEntrega([...porEscola.values()]);

  return (
    <PainelEntrega
      titulo="Entrega do Formulário 1/3"
      descricao={`${ciclo.titulo} · ${ciclo.trimestre}º trimestre de ${ciclo.anoLetivo} · ${situacao(ciclo)}`}
      totais={{ concluidas: resumo.concluidas, emAndamento: resumo.emAndamento, naoIniciadas: resumo.naoIniciadas }}
      grupos={grupos.length > 1 ? grupos : []}
      unidade="entregas"
      compacto={compacto}
      link={link}
      vazio="Nenhuma entrega esperada neste ciclo."
      rodape={grupos.length > 1 ? 'Uma entrega vale para todas as turmas do mesmo ano/série e disciplina do professor: ela aparece em cada escola que atinge.' : null}
    />
  );
};
