// Fonte oficial do catálogo CRMG importado (decisão da tarefa CRMG, após verificação documental).
//
// "CRMG – Infantil e Ensino Fundamental – Versão atualizada", publicado na biblioteca do Portal
// Pedagógico da SEE/MG (upload em 22/05/2026; o mesmo arquivo também está em "...-1.pdf"). O PDF
// não declara versão/data no texto; os metadados registram criação em 19/05/2023 e modificação em
// 23/05/2023 — daí o identificador técnico interno abaixo, que NUNCA é exibido como nome oficial.
// Conferência: 339 de 342 códigos citados nos Planos de Curso 2026 (anos finais) existem nesta
// versão, e os textos batem com ela (não com o documento de 2018 do MEC) — ver relatório de auditoria.

export const VERSAO = 'CRMG-EIEF-2023-05';
export const ORIGEM = 'CRMG';
export const FONTE = {
  titulo: 'CRMG – Infantil e Ensino Fundamental – Versão atualizada',
  url: 'https://portalpedagogico.educacao.mg.gov.br/wp-content/uploads/2026/05/CRMG-Infantil-e-Ensino-Fundamental-_Versao-atualizada.pdf',
  sha256: '792857369c0c80dd87fff092137053e7a5cbed1c61fcbbd6caa6efbc072154ea',
  paginas: 603,
};

// Faixas de página (numeração do PDF, não a impressa) dos "Organizadores Curriculares" do Ensino
// Fundamental, por componente. Fora delas os códigos são só exemplos de introdução (págs. 168, 400,
// 417) ou objetivos da Educação Infantil (EI..., fora do escopo).
export const FAIXAS: [ComponenteChave, number, number][] = [
  ['LINGUA_PORTUGUESA', 196, 306],
  ['ARTE', 320, 339],
  ['EDUCACAO_FISICA', 359, 384],
  ['LINGUA_INGLESA', 403, 410],
  ['MATEMATICA', 426, 468],
  ['CIENCIAS', 485, 512],
  ['GEOGRAFIA', 536, 547],
  ['HISTORIA', 560, 579],
  ['ENSINO_RELIGIOSO', 595, 603],
];

export type ComponenteChave =
  | 'ARTE' | 'CIENCIAS' | 'EDUCACAO_FISICA' | 'ENSINO_RELIGIOSO' | 'GEOGRAFIA'
  | 'HISTORIA' | 'LINGUA_INGLESA' | 'LINGUA_PORTUGUESA' | 'MATEMATICA';

// Trecho estrutural do código (posições 5-6) esperado para cada componente — usado só para
// AUDITAR (o componente de cada habilidade vem da seção do documento, nunca do código).
export const SEGMENTO_CODIGO: Record<ComponenteChave, string> = {
  ARTE: 'AR', CIENCIAS: 'CI', EDUCACAO_FISICA: 'EF', ENSINO_RELIGIOSO: 'ER', GEOGRAFIA: 'GE',
  HISTORIA: 'HI', LINGUA_INGLESA: 'LI', LINGUA_PORTUGUESA: 'LP', MATEMATICA: 'MA',
};

export const DATASET_DIR = 'prisma/data/crmg';
export const DATASET_ARQUIVO = `${DATASET_DIR}/${VERSAO}.json`;
export const AUDITORIA_ARQUIVO = `${DATASET_DIR}/${VERSAO}.auditoria.md`;
