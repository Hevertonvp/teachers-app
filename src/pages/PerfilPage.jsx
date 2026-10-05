import { MainLayout } from '../layouts/Layouts';
import { Button, Card } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useEscola } from '../context/EscolaContext';
import { isSecretaria } from '../utils/roles';

const TIPO_LABEL = {
  professor: 'Professor(a)',
  gestor: 'Gestor(a)/Supervisor(a)',
  diretora: 'Diretor(a)',
  secretaria: 'Secretaria',
  auxiliar: 'Auxiliar',
};

export const PerfilPage = () => {
  const { user } = useAuth();
  const { userEscolas, vinculosLoading, vinculosError, reloadVinculos } = useEscola();
  const souSecretaria = isSecretaria(user);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Perfil</h1>
          <p className="mt-2 text-slate-600">Dados da sua conta e das escolas vinculadas.</p>
        </div>
        <Card>
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="grid h-24 w-24 place-items-center rounded-2xl bg-teal-100 text-2xl font-bold text-teal-800">{user?.avatar || user?.initials}</div>
            <div>
              <h2 className="text-2xl font-bold text-slate-950">{user?.nome}</h2>
              <p className="mt-1 text-slate-600">{user?.email}</p>
              <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{TIPO_LABEL[user?.tipo] || user?.tipo}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-950">Escolas vinculadas</h2>

          {souSecretaria ? (
            <p className="mt-3 text-slate-600">
              Secretaria acompanha toda a rede — <strong className="font-semibold text-slate-900">{userEscolas.length} {userEscolas.length === 1 ? 'escola' : 'escolas'}</strong>, sem vínculo individual a uma escola específica.
            </p>
          ) : vinculosLoading ? (
            <p className="mt-3 text-sm text-slate-500">Carregando...</p>
          ) : vinculosError ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              <span>Não foi possível carregar suas escolas: {vinculosError}</span>
              <Button size="sm" variant="outline" onClick={reloadVinculos}>Tentar novamente</Button>
            </div>
          ) : userEscolas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nenhuma escola vinculada no momento. Procure a Secretaria de Educação.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {userEscolas.map(escola => (
                <div key={escola.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{escola.nome}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
};
