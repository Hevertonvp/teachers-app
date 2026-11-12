import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, LoadingBlock } from '../components/Common';
import { MainLayout } from '../layouts/Layouts';
import { listarMeusFormulariosUmTerco } from '../services/formularioUmTerco';
import { formatarDataHora, STATUS_ENTREGA, STATUS_PRAZO } from '../utils/umTerco';
import { ComposicaoCargo } from '../components/ComposicaoCargo';

// Lista do Professor: UM card por ciclo + CARGO (12/11/2026) — nunca por disciplina, escola ou turma.
// O card mostra as escolas e disciplinas do cargo naquele ciclo (sem turmas).
export const UmTercoProfessorPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = () => {
    setErro('');
    listarMeusFormulariosUmTerco().then(setItens).catch(error => setErro(error.message));
  };
  useEffect(carregar, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Formulário 1/3 — Conteúdos</h1>
          <p className="mt-2 text-slate-600">Registre, semana a semana, os conteúdos que você ensinou. Você preenche um formulário por cargo, e ele vale para todas as escolas e disciplinas desse cargo.</p>
        </div>

        {location.state?.sucesso && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{location.state.sucesso}</div>
        )}

        {erro && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar: {erro}</span>
            <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
          </div>
        )}

        {itens === null && !erro && <LoadingBlock text="Carregando formulários..." />}
        {itens && itens.length === 0 && (
          <EmptyState title="Nenhum Formulário 1/3 para você agora" description="Quando um ciclo for aberto para os seus cargos, ele aparece aqui. Se você acha que deveria ter um formulário, fale com a Secretaria para conferir os seus cargos." />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {(itens || []).map(item => {
            const entrega = STATUS_ENTREGA[item.status];
            const prazo = STATUS_PRAZO[item.ciclo.statusPrazo];
            return (
              <Card key={`${item.ciclo.id}-${item.cargoId}`} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={entrega.variant}>{entrega.label}</Badge>
                  <Badge variant={prazo.variant}>{prazo.label}</Badge>
                  {item.correcaoSolicitada && <Badge variant="yellow">Correção solicitada</Badge>}
                  {item.correcaoSituacao === 'recebida' && <Badge variant="blue">Correção reenviada</Badge>}
                  {item.correcaoSituacao === 'expirada' && <Badge variant="gray">Correção expirada</Badge>}
                  {!item.esperada && <Badge variant="gray">Cargo encerrado · só consulta</Badge>}
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-950">{item.rotulo}</h2>
                <p className="mt-1 text-sm text-slate-600">{item.ciclo.titulo} · {item.ciclo.trimestre}º trimestre · prazo {formatarDataHora(item.ciclo.prazoEm)}</p>

                <div className="mt-3 flex-1">
                  <ComposicaoCargo composicao={item.composicao} />
                  {item.compartilhada && <p className="mt-2 text-xs text-slate-500">Um formulário para os dois cargos, que têm as mesmas escolas e disciplinas.</p>}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-600">{item.semanasPreenchidas}/{item.totalSemanas} semanas</span>
                  <Button onClick={() => navigate(`/formulario-um-terco/${item.ciclo.id}/cargo/${item.cargoId}`)}>
                    {item.correcaoSolicitada ? 'Corrigir' : item.editavelAgora ? (item.status === 'nao_iniciado' ? 'Preencher' : item.status === 'concluida' ? 'Editar' : 'Continuar') : 'Ver'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
};
