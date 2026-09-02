import { MainLayout } from '../layouts/Layouts';
import { Card } from '../components/Common';
import { useAuth } from '../context/AuthContext';

export const PerfilPage = () => {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Perfil</h1>
          <p className="mt-2 text-slate-600">Área simulada com os dados do usuário logado.</p>
        </div>
        <Card>
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="grid h-24 w-24 place-items-center rounded-2xl bg-teal-100 text-2xl font-bold text-teal-800">{user?.avatar || user?.initials}</div>
            <div>
              <h2 className="text-2xl font-bold text-slate-950">{user?.nome}</h2>
              <p className="mt-1 text-slate-600">{user?.email}</p>
              <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold capitalize text-slate-700">{user?.tipo}</p>
            </div>
          </div>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Card><p className="text-sm text-slate-500">Unidade</p><p className="mt-1 font-semibold text-slate-900">Escola Municipal Modelo</p></Card>
          <Card><p className="text-sm text-slate-500">Vínculo</p><p className="mt-1 font-semibold text-slate-900">Rede Municipal de Ensino</p></Card>
          <Card><p className="text-sm text-slate-500">Ambiente</p><p className="mt-1 font-semibold text-slate-900">Protótipo frontend</p></Card>
        </div>
      </div>
    </MainLayout>
  );
};