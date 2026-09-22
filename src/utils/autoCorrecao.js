// Auto-corretor simples de português, sem nenhuma biblioteca externa. Não é um corretor
// ortográfico de verdade (isso exigiria um dicionário completo, tipo Hunspell) — é só um mapa de
// erros/abreviações comuns (acentos que caem ao digitar rápido, gírias de chat) trocados palavra
// por palavra. O complemento real de correção continua sendo o corretor nativo do navegador
// (ver `spellCheck`/`lang="pt-BR"` nos campos de texto), que sublinha e sugere qualquer erro.
export const CORRECOES_COMUNS = {
  nao: 'não',
  voce: 'você',
  voces: 'vocês',
  ate: 'até',
  tambem: 'também',
  atraves: 'através',
  pedagogico: 'pedagógico',
  pedagogica: 'pedagógica',
  pedagogicas: 'pedagógicas',
  pedagogicos: 'pedagógicos',
  metodo: 'método',
  metodos: 'métodos',
  facil: 'fácil',
  dificil: 'difícil',
  medio: 'médio',
  rapido: 'rápido',
  otimo: 'ótimo',
  otima: 'ótima',
  proprio: 'próprio',
  propria: 'própria',
  pratico: 'prático',
  pratica: 'prática',
  basico: 'básico',
  basica: 'básica',
  historico: 'histórico',
  possivel: 'possível',
  necessario: 'necessário',
  necessaria: 'necessária',
  familia: 'família',
  area: 'área',
  pq: 'porque',
  tb: 'também',
  tbm: 'também',
  vc: 'você',
  vcs: 'vocês',
};

// Mantém a capitalização original da palavra digitada (maiúscula no início de frase, tudo
// maiúsculo, etc.) na palavra corrigida.
const preservarCapitalizacao = (original, correcao) => {
  if (original === original.toUpperCase() && original !== original.toLowerCase()) return correcao.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) return correcao[0].toUpperCase() + correcao.slice(1);
  return correcao;
};

// Aplica as correções conhecidas em cada palavra do texto, preservando o resto (pontuação,
// espaçamento, palavras não mapeadas) exatamente como está.
export const aplicarAutoCorrecao = (texto) => {
  if (!texto) return texto;
  return texto.replace(/\p{L}+/gu, (palavra) => {
    const correcao = CORRECOES_COMUNS[palavra.toLowerCase()];
    return correcao ? preservarCapitalizacao(palavra, correcao) : palavra;
  });
};
