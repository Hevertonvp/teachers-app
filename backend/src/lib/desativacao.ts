// Data e autor da desativação (decisão do usuário, 15/11/2026): todo caminho que desativa, inativa ou
// arquiva grava quando e quem; reativar limpa. Ordena as telas de desativados ("mais recentes primeiro").
export const marcarDesativacao = (ativo: boolean, autorId: number | string) =>
  (ativo ? { desativadoEm: null, desativadoPor: null } : { desativadoEm: new Date(), desativadoPor: String(autorId) });
