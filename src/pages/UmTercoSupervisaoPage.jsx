import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, LoadingBlock } from '../components/Common';
import { MainLayout } from '../layouts/Layouts';
import { listarCiclosUmTerco } from '../services/formularioUmTerco';
import { formatarDataHora, STATUS_PRAZO } from '../utils/umTerco';

// Formulário 1/3 da Supervisora (perfil GESTOR), 18/11/2026: só CONSULTA. Lista os ciclos ativos que atendem
// as escolas dela (o backend filtra) e leva ao painel de entregas, também só leitura.
export const UmTercoSupervisaoPage = () => {
  const [ciclos, setCiclos] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarCiclosUmTerco().then(setCiclos).catch((e) => setErro(e.message));
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-950">Formulário 1/3</h1>
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {!ciclos && !erro && <LoadingBlock text="Carregando..." />}
        {ciclos && ciclos.length === 0 && <EmptyState title="Nenhum Formulário 1/3 aberto" />}
        <div className="grid gap-4 lg:grid-cols-2">
          {(ciclos ?? []).map((ciclo) => {
            const prazo = STATUS_PRAZO[ciclo.statusPrazo];
            return (
              <Card key={ciclo.id}>
                <div className="flex flex-wrap items-center gap-2">
                  {prazo && <Badge variant={prazo.variant}>{prazo.label}</Badge>}
                  {ciclo.editavelAgora && ciclo.statusPrazo === 'encerrado' && <Badge variant="blue">Reaberto</Badge>}
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-950">{ciclo.titulo}</h2>
                <p className="mt-1 text-sm text-slate-600">{ciclo.trimestre}º trimestre de {ciclo.anoLetivo} · prazo {formatarDataHora(ciclo.prazoEm)}</p>
                <div className="mt-4">
                  <Link to={`/formulario-um-terco/ciclos/${ciclo.id}`}><Button size="sm">Painel de entregas</Button></Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
};
