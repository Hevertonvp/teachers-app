import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../layouts/Layouts';
import { Card, Badge, Button } from '../components/Common';
import { ProfessorName } from '../components/ProfessorName';
import { notificacoesAtraso, professores } from '../data/mockData';

export const NotificacoesAtraso = () => {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-700">Notificações de Atraso</h1>
            <p className="text-gray-600 mt-2">Professores com pendência no preenchimento de formulários</p>
          </div>
          <Button onClick={() => navigate(-1)} variant="ghost">
            ← Voltar
          </Button>
        </div>

        {/* Lista de notificações */}
        <div className="space-y-4">
          {notificacoesAtraso.map(notificacao => {
            const professor = professores.find(p => p.id === notificacao.professorId);

            return (
              <Card key={notificacao.id}>
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center font-semibold text-primary-700 shrink-0">
                      {professor?.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ProfessorName professor={professor} />
                        <Badge variant="red">Atrasado</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notificacao.descricao}</p>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>{notificacao.formulario}</span>
                        <span>•</span>
                        <span>Prazo: {notificacao.prazo}</span>
                        <span>•</span>
                        <span>{notificacao.diasAtraso} dias de atraso</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
};
