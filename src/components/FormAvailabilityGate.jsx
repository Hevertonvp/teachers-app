import { Button, Card } from './Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { formatFullDate, formDefinitions, getFormStatus, isFormAvailableForTeacher } from '../utils/formAvailability';

export const FormAvailabilityGate = ({ formId, children }) => {
  const { user } = useAuth();
  const { formPeriods } = useData();
  const period = formPeriods.find(item => item.id === formId);
  const form = formDefinitions[formId];

  if (user?.tipo !== 'professor' || !period || isFormAvailableForTeacher(period)) {
    return children;
  }

  const status = getFormStatus(period.startDate, period.endDate);
  const message = status === 'scheduled'
    ? `Este formulário estará disponível a partir de ${formatFullDate(period.startDate)}.`
    : `O prazo para preenchimento terminou em ${formatFullDate(period.endDate)}.`;

  return (
    <MainLayout>
      <Card className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{form?.title}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Formulário indisponível</h1>
        <p className="mt-3 text-slate-600">{message}</p>
        <p className="mt-2 text-sm text-slate-500">A disponibilidade é definida pelos gestores.</p>
        <Button className="mt-6" variant="outline" onClick={() => history.back()}>Voltar</Button>
      </Card>
    </MainLayout>
  );
};