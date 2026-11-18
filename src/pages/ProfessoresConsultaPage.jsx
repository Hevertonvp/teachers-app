import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, EmptyState, LoadingBlock } from '../components/Common';
import { MainLayout } from '../layouts/Layouts';
import { apiFetch } from '../services/api';
import { inputClass } from '../utils/display';

// Professores(as) da Supervisora (perfil GESTOR), 18/11/2026: só CONSULTA (decisão do usuário: ela não
// cadastra nem edita professor). O backend devolve apenas quem tem vínculo ativo nas escolas dela.
export const ProfessoresConsultaPage = () => {
  const [professores, setProfessores] = useState(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    apiFetch('/api/pessoas/professores').then(setProfessores).catch((e) => setErro(e.message));
  }, []);

  const lista = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return (professores ?? []).filter((p) => !termo || p.nome.toLocaleLowerCase('pt-BR').includes(termo) || p.email.toLocaleLowerCase('pt-BR').includes(termo));
  }, [professores, busca]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-950">Professores(as)</h1>
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {!professores && !erro && <LoadingBlock text="Carregando..." />}
        {professores && (
          <>
            <input type="search" aria-label="Buscar professor" placeholder="Buscar por nome ou e-mail" className={`${inputClass} max-w-md`} value={busca} onChange={(e) => setBusca(e.target.value)} />
            {lista.length === 0 ? (
              <EmptyState title="Nenhum professor encontrado" />
            ) : (
              <div className="space-y-3">
                {lista.map((p) => (
                  <Card key={p.id}>
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{p.nome}</p>
                        <p className="break-all text-sm text-slate-600">{p.email}</p>
                        <p className="mt-1 text-xs text-slate-500">{p.escolas.map((e) => e.nome).join(' · ')}</p>
                      </div>
                      <Badge variant={p.status === 'ATIVO' ? 'green' : 'gray'}>{p.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};
