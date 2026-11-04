import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, LoadingBlock } from '../components/Common';
import { MainLayout } from '../layouts/Layouts';
import { listarMeusFormulariosUmTerco } from '../services/formularioUmTerco';
import { agruparPorEscola, formatarDataHora, STATUS_ENTREGA, STATUS_PRAZO } from '../utils/umTerco';

// Lista do Professor: UM card por ciclo + ano/série + disciplina — nunca por turma ou escola.
// As turmas/escolas aparecem só como "Válido para" (informativo, não editável).
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
          <p className="mt-2 text-slate-600">Registre, semana a semana, os conteúdos que você ensinou. Você preenche uma vez por ano/série e disciplina, e vale para todas as suas turmas.</p>
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
          <EmptyState title="Nenhum Formulário 1/3 para você agora" description="Quando um ciclo for aberto para as suas disciplinas, ele aparece aqui." />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {(itens || []).map(item => {
            const entrega = STATUS_ENTREGA[item.status];
            const prazo = STATUS_PRAZO[item.ciclo.statusPrazo];
            const escolas = agruparPorEscola(item.validoPara);
            return (
              <Card key={`${item.ciclo.id}-${item.anoSerie}-${item.disciplinaId}`} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={entrega.variant}>{entrega.label}</Badge>
                  <Badge variant={prazo.variant}>{prazo.label}</Badge>
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-950">{item.rotulo}</h2>
                <p className="mt-1 text-sm text-slate-600">{item.ciclo.titulo} · {item.ciclo.trimestre}º trimestre · prazo {formatarDataHora(item.ciclo.prazoEm)}</p>

                <div className="mt-3 flex-1 text-sm text-slate-700">
                  <p className="font-semibold text-slate-800">Válido para:</p>
                  {escolas.length === 0 ? (
                    <p className="text-slate-500">Nenhuma turma ativa no momento (histórico preservado).</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {escolas.map(e => <li key={e.escolaId}><span className="font-semibold">{e.escolaNome}</span> — {e.turmas.join(', ')}</li>)}
                    </ul>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-600">{item.semanasPreenchidas}/{item.totalSemanas} semanas</span>
                  <Button onClick={() => navigate(`/formulario-um-terco/${item.ciclo.id}/${item.anoSerie}/${item.disciplinaId}`)}>
                    {item.editavelAgora ? (item.status === 'nao_iniciado' ? 'Preencher' : 'Continuar') : 'Ver'}
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
