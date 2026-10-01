import { Link, Navigate } from 'react-router-dom';
import { Button, Card } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { MainLayout } from '../layouts/Layouts';
import { isSecretaria } from '../utils/roles';

// Hub de administração do PDI — separa conceitualmente duas configurações diferentes que antes
// ficavam juntas na mesma tela (FormularioPdiPage.jsx): Modelos PDI (por disciplina) e Modelo de
// Anamnese (geral, não pertence a nenhuma disciplina). Nenhuma das duas telas de destino mudou de
// regra — só o caminho até elas. A Anamnese PREENCHIDA de um aluno continua no perfil dele
// (PdiAlunoPerfil.jsx → Anamnese), nunca aqui.
export const PdiConfiguracoesPage = () => {
  const { user } = useAuth();

  if (!isSecretaria(user)) return <Navigate to="/dashboard" replace />;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to="/pdi" className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para o PDI</Link>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-teal-700">Módulo PDI</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Configurações do PDI</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Duas configurações administrativas separadas: os Modelos PDI são específicos de cada disciplina; o Modelo de Anamnese é único e geral, não pertence a nenhuma disciplina.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-teal-700">Por disciplina</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Modelos PDI</h2>
                <p className="mt-2 text-sm text-slate-600">Crie e gerencie os modelos e perguntas de cada disciplina, suas versões/status, e as Aplicações PDI por escola.</p>
              </div>
              <Link to="/pdi/formulario"><Button>Abrir Modelos PDI</Button></Link>
            </div>
          </Card>

          <Card>
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-teal-700">Configuração geral</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Modelo de Anamnese</h2>
                <p className="mt-2 text-sm text-slate-600">Define a estrutura e as perguntas configuráveis da Anamnese — única para toda a rede, não específica de disciplina. A Anamnese preenchida de cada aluno fica no perfil dele.</p>
              </div>
              <Link to="/pdi/anamnese-modelo"><Button variant="outline">Abrir Modelo de Anamnese</Button></Link>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};
