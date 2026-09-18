// Calendário de trimestres do ano letivo. Não é exclusivo do PDI — outros módulos podem
// usar os mesmos períodos no futuro. Configurado pela Secretaria em Configurações.
export const trimestres = ['1º trimestre', '2º trimestre', '3º trimestre'];

// Determina qual trimestre está em andamento a partir das datas configuradas. Retorna null
// quando nenhum período cadastrado contém a data atual.
export const getTrimestreAtual = (trimestrePeriods, currentDate) => {
  const current = new Date(`${currentDate}T12:00:00`);
  const periodo = trimestrePeriods.find(item => {
    const start = new Date(`${item.startDate}T12:00:00`);
    const end = new Date(`${item.endDate}T12:00:00`);
    return current >= start && current <= end;
  });
  return periodo?.trimestre || null;
};
