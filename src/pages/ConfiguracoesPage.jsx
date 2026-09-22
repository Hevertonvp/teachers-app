import { useState } from 'react';
import { MainLayout } from '../layouts/Layouts';
import { Card, FormField, StatusBadge } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass } from '../utils/display';
import { formatDate } from '../utils/pdi';
import { isSecretaria } from '../utils/roles';

export const ConfiguracoesPage = () => {
  const { user } = useAuth();
  const { trimestrePeriods, updateTrimestrePeriod, pdiPreencherPerguntasPadrao, setPdiPreencherPerguntasPadrao } = useData();
  const [message, setMessage] = useState('');
  const podeConfigurar = isSecretaria(user);

  const salvarPeriodo = (trimestre, payload) => {
    updateTrimestrePeriod(trimestre, payload);
    setMessage('Período do trimestre atualizado com sucesso.');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Configurações</h1>
          <p className="mt-2 text-slate-600">Tela visual para demonstração. Nenhuma integração externa foi implementada.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <h2 className="font-bold text-slate-950">Ano letivo</h2>
            <p className="mt-2 text-sm text-slate-600">2026</p>
            <div className="mt-4"><StatusBadge status="em_andamento" /></div>
          </Card>
          <Card>
            <h2 className="font-bold text-slate-950">Instrumentos ativos</h2>
            <p className="mt-2 text-sm text-slate-600">Formulário 1/3, PDI e Correções dos simulados.</p>
          </Card>
          <Card>
            <h2 className="font-bold text-slate-950">Persistência</h2>
            <p className="mt-2 text-sm text-slate-600">Dados mantidos apenas em estado React durante a sessão.</p>
          </Card>
        </div>

        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Calendário letivo</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Trimestres</h2>
          <p className="mt-1 text-sm text-slate-600">
            {podeConfigurar
              ? 'Defina o período de início e encerramento de cada trimestre do ano letivo. Esse calendário é compartilhado entre os módulos do sistema — hoje, o PDI usa automaticamente o trimestre vigente na data atual.'
              : 'Período de cada trimestre do ano letivo, definido pela Secretaria de Educação. O PDI, por exemplo, usa automaticamente o trimestre vigente na data atual.'}
          </p>

          {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {trimestrePeriods.map(periodo => (
              <div key={periodo.trimestre} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">{periodo.trimestre}</p>
                {podeConfigurar ? (
                  <div className="mt-3 space-y-3">
                    <FormField label="Início">
                      <input className={inputClass} type="date" value={periodo.startDate} onChange={event => salvarPeriodo(periodo.trimestre, { startDate: event.target.value })} />
                    </FormField>
                    <FormField label="Encerramento">
                      <input className={inputClass} type="date" value={periodo.endDate} onChange={event => salvarPeriodo(periodo.trimestre, { endDate: event.target.value })} />
                    </FormField>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">{formatDate(periodo.startDate)} a {formatDate(periodo.endDate)}</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        {podeConfigurar && (
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">PDI</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Modelos PDI</h2>
            <label className="mt-4 flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pdiPreencherPerguntasPadrao}
                onChange={event => setPdiPreencherPerguntasPadrao(event.target.checked)}
              />
              <span>
                <span className="block font-semibold text-slate-900">Carregar perguntas padrão ao criar um novo modelo</span>
                <span className="mt-1 block text-slate-600">Quando ativado, todo novo modelo PDI já nasce com o conjunto comum de perguntas (estruturadas, Computação/BNCC e qualitativas). Desativado, o modelo nasce vazio.</span>
              </span>
            </label>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};
