// Hora do SERVIDOR na tela (bateria do 1/3, 12/11/2026). Toda resposta da API traz "X-Hora-Servidor"; guardamos a
// diferença para o relógio deste aparelho e usamos a hora do servidor em tudo que decide "hoje" (abertura de ciclo,
// início/encerramento de cargo, prazos). Assim um computador com data/hora errada não bloqueia nem adianta nada.
// Sem resposta ainda (primeira tela offline), vale o último valor conhecido ou o relógio do aparelho.
const CHAVE = 'diferencaHoraServidorMs';
const OFFSET_SP_MS = -3 * 60 * 60 * 1000;

let diferencaMs = 0;
try { diferencaMs = Number(localStorage.getItem(CHAVE)) || 0; } catch { diferencaMs = 0; }

export function registrarHoraServidor(iso) {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return;
  diferencaMs = t - Date.now();
  try { localStorage.setItem(CHAVE, String(diferencaMs)); } catch { /* sem armazenamento: só na memória */ }
}

export const agoraServidor = () => new Date(Date.now() + diferencaMs);
// Dia de hoje em São Paulo (YYYY-MM-DD), pela hora do servidor.
export const hojeSpServidor = () => new Date(agoraServidor().getTime() + OFFSET_SP_MS).toISOString().slice(0, 10);
