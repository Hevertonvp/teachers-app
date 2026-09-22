import { Button, Card } from './Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { isProfessor } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';
import { formDefinitions, isFormAvailableForTeacher } from '../utils/formAvailability';

export const FormAvailabilityGate = ({ formId, children }) => {
  const { user } = useAuth();
  const { formPeriods } = useData();
  const { userEscolas } = useEscola();
  const form = formDefinitions[formId];

  // Professor não tem mais uma única escola ativa (vê tudo unificado) — não faz sentido
  // bloquear a página inteira pela vigência de UMA escola. Cada escola pode ter uma vigência
  // diferente; quem decide o que mostrar por escola é a própria página (ver
  // TeacherFormularioUmTerco em FormularioUmTerco.jsx). Só bloqueia aqui quando NENHUMA das
  // escolas do professor tem esse formulário vigente.
  if (isProfessor(user)) {
    const temAlgumaVigente = userEscolas.some(escola => {
      const period = formPeriods.find(item => item.id === formId && item.escolaId === escola.id);
      return period && isFormAvailableForTeacher(period);
    });
    if (temAlgumaVigente || userEscolas.length === 0) return children;

    return (
      <MainLayout>
        <Card className="mx-auto max-w-2xl py-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{form?.title}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Formulário indisponível</h1>
          <p className="mt-3 text-slate-600">Não há vigência aberta para este formulário em nenhuma das suas escolas no momento.</p>
          <p className="mt-2 text-sm text-slate-500">A disponibilidade é definida pelos gestores.</p>
          <Button className="mt-6" variant="outline" onClick={() => history.back()}>Voltar</Button>
        </Card>
      </MainLayout>
    );
  }

  // Gate só existe para Professor (Gestor/Secretaria administram a vigência, nunca ficam
  // bloqueados por ela) — preserva o comportamento original para esses perfis.
  return children;
};