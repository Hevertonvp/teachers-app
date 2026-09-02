import { MainLayout } from '../layouts/Layouts';
import { Card, Badge } from '../components/Common';
import { calendarioPedagogico } from '../data/mockData';
import { useState } from 'react';

export const CalendarioPedagogico = () => {
  const [filtroMes, setFiltroMes] = useState('');

  // Agrupar eventos por mês
  const eventosPorMes = calendarioPedagogico.reduce((acc, evento) => {
    const mes = evento.data.substring(0, 7); // YYYY-MM
    if (!acc[mes]) acc[mes] = [];
    acc[mes].push(evento);
    return acc;
  }, {});

  const mesesOrdenados = Object.keys(eventosPorMes).sort();

  const tiposCores = {
    evento: 'blue',
    recesso: 'purple',
    feriado: 'red',
  };

  const tiposIcones = {
    evento: '●',
    recesso: '●',
    feriado: '●',
  };

  const nomeMes = (mes) => {
    const meses = {
      '02': 'Fevereiro',
      '03': 'Março',
      '04': 'Abril',
      '06': 'Junho',
      '07': 'Julho',
      '09': 'Setembro',
      '10': 'Outubro',
      '11': 'Novembro',
      '12': 'Dezembro',
    };
    return meses[mes.split('-')[1]] || 'Mês desconhecido';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold text-slate-700">Calendário Pedagógico</h1>
          <p className="text-gray-600 mt-2">Visualize os eventos, recessos e feriados da escola</p>
        </div>

        {/* Legenda */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">●</span>
              <span className="text-gray-700"><strong>Eventos</strong> - Atividades programadas</span>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">●</span>
              <span className="text-gray-700"><strong>Recessos</strong> - Períodos sem aulas</span>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">●</span>
              <span className="text-gray-700"><strong>Feriados</strong> - Dias de feriado</span>
            </div>
          </Card>
        </div>

        {/* Calendário por Mês */}
        <div className="space-y-6">
          {mesesOrdenados.map(mes => (
            <div key={mes}>
              <h2 className="text-2xl font-bold text-slate-700 mb-4">
                {nomeMes(mes)} 2024
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {eventosPorMes[mes].map(evento => (
                  <Card key={evento.id} className="hover:shadow-md transition">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{tiposIcones[evento.tipo]}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-700">{evento.titulo}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={tiposCores[evento.tipo]}>
                            {evento.tipo === 'evento' ? 'Evento' :
                             evento.tipo === 'recesso' ? 'Recesso' :
                             'Feriado'}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {new Date(evento.data).toLocaleDateString('pt-BR', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Resumo */}
        <Card className="bg-blue-50 border border-blue-200">
          <h2 className="text-lg font-bold text-blue-900 mb-3">Resumo do Ano Letivo</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-blue-600 text-sm font-medium">Eventos Programados</p>
              <p className="text-3xl font-bold text-blue-900">
                {calendarioPedagogico.filter(e => e.tipo === 'evento').length}
              </p>
            </div>
            <div>
              <p className="text-purple-600 text-sm font-medium">Períodos de Recesso</p>
              <p className="text-3xl font-bold text-purple-900">
                {calendarioPedagogico.filter(e => e.tipo === 'recesso').length}
              </p>
            </div>
            <div>
              <p className="text-red-600 text-sm font-medium">Feriados</p>
              <p className="text-3xl font-bold text-red-900">
                {calendarioPedagogico.filter(e => e.tipo === 'feriado').length}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};
