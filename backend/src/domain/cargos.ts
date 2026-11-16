// Cargo do Professor e o Formulário 1/3 por cargo — regras PURAS (sem I/O). Decisões do usuário de
// 12/11/2026 (ver CLAUDE_CONTEXT.md, "1/3 POR CARGO"):
// - Professor → Cargo(s) → Escola(s) → Disciplina(s) e/ou Atuação(ões) pedagógica(s); no máximo 2 ATIVOS.
// - Sem escola repetida no cargo; sem disciplina repetida na mesma escola do cargo; disciplina é
//   OPCIONAL por escola (Educação Infantil não tem disciplina no cadastro).
// - O 1/3 usa a composição que valia na ABERTURA do ciclo. Cargo cadastrado depois da abertura não
//   entra (vale o momento do cadastro, não a data de início informada). Cargo encerrado com data até
//   o prazo do ciclo deixa de ser esperado (o que já foi escrito fica como histórico).
// - Ciclo de algumas escolas: só a parte do cargo nessas escolas. Cargos com a MESMA parte no ciclo
//   viram uma folha só (comparação do que aparece no ciclo, decisão do usuário).
import { ValidationError } from './errors.js';
import { dataLocalSp } from './umTerco.js';

export const MAX_CARGOS_ATIVOS = 2;

// Composição de uma escola no cargo: disciplinas e/ou ATUAÇÕES PEDAGÓGICAS (12/11/2026: Professor Regente,
// Oficina do Brincar…). Composição gravada antes das atuações não tem `atuacaoIds` e vale como "nenhuma".
export type ItemComposicao = { escolaId: number; disciplinaIds: number[]; atuacaoIds: number[] };
export type Composicao = ItemComposicao[];

// Ordena escolas, disciplinas e atuações para que duas composições iguais tenham sempre o mesmo texto
// (equivalência de cargos = mesmas escolas, mesmas disciplinas e mesmas atuações em cada escola).
export function canonica(composicao: Composicao): Composicao {
  return [...composicao]
    .map((item) => ({ escolaId: item.escolaId, disciplinaIds: [...(item.disciplinaIds ?? [])].sort((a, b) => a - b), atuacaoIds: [...(item.atuacaoIds ?? [])].sort((a, b) => a - b) }))
    .sort((a, b) => a.escolaId - b.escolaId);
}

export const chaveComposicao = (composicao: Composicao) => JSON.stringify(canonica(composicao));

type Nomes = { escola: (id: number) => string | undefined; disciplina: (id: number) => string | undefined; atuacao: (id: number) => string | undefined };

// Lista de ids sem repetição, com mensagens simples (a Secretaria lê).
function lerIds(valor: unknown, nomeDe: (id: number) => string | undefined, textos: { vazia: string; inexistente: string; repetida: (nome: string) => string }): number[] {
  const lista = Array.isArray(valor) ? valor.map(Number) : [];
  const vistos = new Set<number>();
  for (const id of lista) {
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError(textos.vazia);
    const nome = nomeDe(id);
    if (!nome) throw new ValidationError(textos.inexistente);
    if (vistos.has(id)) throw new ValidationError(textos.repetida(nome));
    vistos.add(id);
  }
  return [...vistos];
}

// Valida o que veio da tela. Cada escola precisa de pelo menos uma disciplina OU uma atuação (decisão do
// usuário, 12/11/2026); cargos e folhas já gravados antes disso continuam válidos como estão.
export function validarComposicao(entrada: unknown, nomes: Nomes): Composicao {
  if (!Array.isArray(entrada) || entrada.length === 0) throw new ValidationError('Escolha ao menos uma escola para o cargo.');
  const escolas = new Set<number>();
  const composicao: Composicao = [];
  for (const bruto of entrada) {
    const item = bruto as { escolaId?: unknown; disciplinaIds?: unknown; atuacaoIds?: unknown };
    const escolaId = Number(item?.escolaId);
    if (!Number.isInteger(escolaId) || escolaId <= 0) throw new ValidationError('Escolha a escola em cada bloco do cargo.');
    const nomeEscola = nomes.escola(escolaId);
    if (!nomeEscola) throw new ValidationError('Uma das escolas escolhidas não existe ou está inativa.');
    if (escolas.has(escolaId)) throw new ValidationError(`A escola "${nomeEscola}" aparece duas vezes no mesmo cargo.`);
    escolas.add(escolaId);
    const disciplinaIds = lerIds(item.disciplinaIds, nomes.disciplina, {
      vazia: `Escolha a disciplina em "${nomeEscola}" ou remova a linha vazia.`,
      inexistente: 'Uma das disciplinas escolhidas não existe.',
      repetida: (n) => `A disciplina "${n}" aparece duas vezes em "${nomeEscola}" no mesmo cargo.`,
    });
    const atuacaoIds = lerIds(item.atuacaoIds, nomes.atuacao, {
      vazia: `Escolha a atuação em "${nomeEscola}" ou remova a linha vazia.`,
      inexistente: 'Uma das atuações escolhidas não existe ou está inativa.',
      repetida: (n) => `A atuação "${n}" aparece duas vezes em "${nomeEscola}" no mesmo cargo.`,
    });
    if (disciplinaIds.length === 0 && atuacaoIds.length === 0) throw new ValidationError(`Escolha ao menos uma disciplina ou uma atuação pedagógica em "${nomeEscola}".`);
    composicao.push({ escolaId, disciplinaIds, atuacaoIds });
  }
  return canonica(composicao);
}

// Lê uma composição gravada (JSON do banco). Tolerante: ignora o que não tiver forma válida; sem
// `atuacaoIds` (composições antigas) = nenhuma atuação.
export function lerComposicao(json: unknown): Composicao {
  if (!Array.isArray(json)) return [];
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : []);
  return canonica(json
    .map((i) => ({ escolaId: Number((i as ItemComposicao)?.escolaId), disciplinaIds: ids((i as ItemComposicao)?.disciplinaIds), atuacaoIds: ids((i as ItemComposicao)?.atuacaoIds) }))
    .filter((i) => Number.isInteger(i.escolaId) && i.escolaId > 0));
}

// Parte do cargo que entra num ciclo: só as escolas do ciclo (`null` = todas as escolas).
// Disciplinas que NÃO entram no Formulário 1/3 "por enquanto" (decisão do usuário, 15/11/2026): somem da folha;
// escola que fica sem disciplina e sem atuação sai da folha; cargo que fica vazio não gera folha. Lista fixa no
// código (sem migration): para a disciplina passar a preencher, basta tirar daqui.
export const DISCIPLINAS_FORA_DO_UM_TERCO = ['Informática'];

// Atuações pedagógicas que NÃO se ligam a turmas (decisão do usuário, 16/11/2026). Todas as outras (Professor
// Regente, Oficina do Brincar, TAE e as criadas depois) podem ter turmas, mesmo sem disciplina. Lista fixa pelo
// nome (sem migration): renomear uma destas na tela faz ela passar a ter turmas até a lista ser atualizada.
export const ATUACOES_SEM_TURMA = ['Biblioteca', 'Professor de Intervenção', 'Eventual'];
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
export const atuacaoTemTurmas = (nome: string) => !ATUACOES_SEM_TURMA.some((n) => semAcento(n) === semAcento(nome));

export const restringirAoCiclo = (composicao: Composicao, escolasDoCiclo: number[] | null, disciplinasFora: number[] = []): Composicao =>
  (escolasDoCiclo ? composicao.filter((i) => escolasDoCiclo.includes(i.escolaId)) : composicao)
    .map((i) => (disciplinasFora.length ? { ...i, disciplinaIds: i.disciplinaIds.filter((d) => !disciplinasFora.includes(d)) } : i))
    .filter((i) => i.disciplinaIds.length > 0 || (i.atuacaoIds ?? []).length > 0);

export type CargoParaCiclo = {
  id: number;
  professorId: number;
  createdAt: Date;
  dataInicio: Date; // @db.Date (meia-noite UTC)
  dataFim: Date | null; // @db.Date
  versoes: { criadaEm: Date; composicao: unknown }[];
};

const diaDe = (dataBanco: Date) => dataBanco.toISOString().slice(0, 10);

// Corte do ciclo (decisão do usuário, 12/11/2026, depois do ciclo #14 da produção ficar sem nenhuma folha):
// vale o DIA da abertura, não o instante. Cargo cadastrado (e composição alterada) até o fim do dia da
// abertura, no horário de São Paulo, entra no ciclo com a composição daquele dia; do dia seguinte em diante,
// só no próximo ciclo. O instante devolvido é 23:59:59.999 do dia da abertura em São Paulo.
export function corteDoCiclo(abreEm: Date): Date {
  return new Date(new Date(`${dataLocalSp(abreEm)}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000 - 1);
}

// Cargo criado DURANTE o ciclo aberto (decisão do usuário, 15/11/2026): entra no ciclo atual, com o mesmo
// prazo; criado depois do prazo, só no próximo. Vale para ciclos com prazo a partir de 15/11/2026; ciclos
// que terminaram antes continuam com a regra antiga (só até o dia da abertura), para não mudar o passado.
export const ENTRADA_DURANTE_CICLO_DESDE = '2026-11-15';
export const aceitaCargoDuranteCiclo = (prazoEm: Date) => dataLocalSp(prazoEm) >= ENTRADA_DURANTE_CICLO_DESDE;

// Até quando um cargo pode ter sido cadastrado (e ter versões) para entrar no ciclo.
export const limiteDeCadastroDoCiclo = (ciclo: { abreEm: Date; prazoEm: Date }) =>
  (aceitaCargoDuranteCiclo(ciclo.prazoEm) ? new Date(Math.max(ciclo.prazoEm.getTime(), corteDoCiclo(ciclo.abreEm).getTime())) : corteDoCiclo(ciclo.abreEm));

// Composição que o cargo leva para o ciclo, ou null se o cargo não participa.
// - Cargo cadastrado até o fim do dia da abertura: composição daquele dia (alterar depois só vale no próximo ciclo).
// - Cargo cadastrado depois, ainda antes do prazo (ciclos com a regra de 15/11/2026): composição do fim do
//   dia em que foi cadastrado (mesma lógica do dia da abertura, aplicada ao dia do cadastro).
// - Fica de fora: cadastrado depois do prazo; início depois do limite; encerrado até o dia do corte.
export function composicaoNaAbertura(cargo: CargoParaCiclo, ciclo: { abreEm: Date; prazoEm: Date }): Composicao | null {
  const corteAbertura = corteDoCiclo(ciclo.abreEm);
  const duranteCiclo = aceitaCargoDuranteCiclo(ciclo.prazoEm);
  let corte: Date;
  if (cargo.createdAt.getTime() <= corteAbertura.getTime()) corte = corteAbertura;
  else if (duranteCiclo && cargo.createdAt.getTime() <= ciclo.prazoEm.getTime()) corte = corteDoCiclo(cargo.createdAt);
  else return null;
  const diaCorte = dataLocalSp(corte);
  // Início: até o dia da abertura (regra antiga) ou até o dia do prazo (regra de 15/11/2026).
  if (diaDe(cargo.dataInicio) > (duranteCiclo ? dataLocalSp(ciclo.prazoEm) : diaCorte)) return null;
  if (cargo.dataFim && diaDe(cargo.dataFim) <= diaCorte) return null;
  const vigente = cargo.versoes
    .filter((v) => v.criadaEm.getTime() <= corte.getTime())
    .sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime())[0];
  return vigente ? lerComposicao(vigente.composicao) : null;
}

// Cargo encerrado com data até o prazo do ciclo deixa de ser esperado nesse ciclo.
export const cargoEsperadoNoCiclo = (cargo: { dataFim: Date | null }, prazoEm: Date) =>
  !cargo.dataFim || diaDe(cargo.dataFim) > dataLocalSp(prazoEm);

export type FolhaCalculada = {
  professorId: number;
  cargoIds: number[]; // ordenados
  composicao: Composicao; // já restrita ao ciclo
  esperada: boolean; // algum dos cargos continua esperado
};

// Folhas de um ciclo: uma por cargo participante; cargos do MESMO Professor com a mesma parte no ciclo
// dividem uma folha. Cargo cuja parte no ciclo é vazia (nenhuma escola do ciclo) não gera folha.
export function calcularFolhas(cargos: CargoParaCiclo[], ciclo: { abreEm: Date; prazoEm: Date }, escolasDoCiclo: number[] | null, disciplinasFora: number[] = []): FolhaCalculada[] {
  const grupos = new Map<string, FolhaCalculada>();
  for (const cargo of [...cargos].sort((a, b) => a.id - b.id)) {
    const naAbertura = composicaoNaAbertura(cargo, ciclo);
    if (!naAbertura) continue;
    const parte = restringirAoCiclo(naAbertura, escolasDoCiclo, disciplinasFora);
    if (parte.length === 0) continue;
    const chave = `${cargo.professorId}|${chaveComposicao(parte)}`;
    const folha = grupos.get(chave) ?? { professorId: cargo.professorId, cargoIds: [], composicao: parte, esperada: false };
    folha.cargoIds.push(cargo.id);
    folha.esperada = folha.esperada || cargoEsperadoNoCiclo(cargo, ciclo.prazoEm);
    grupos.set(chave, folha);
  }
  return [...grupos.values()];
}

export const chaveDeCargos = (cargoIds: number[]) => [...cargoIds].sort((a, b) => a - b).join(',');
export const cargosDaChave = (chave: string | null) => (chave ? chave.split(',').map(Number).filter(Number.isInteger) : []);

// Rótulos de tela: os cargos ATIVOS do Professor, por data de início (e id), viram "Cargo 1", "Cargo 2".
// Encerrado = "Cargo encerrado". Nunca é identidade: o histórico usa o id.
export function rotulosDosCargos(cargos: { id: number; status: string; dataInicio: Date }[]): Map<number, string> {
  const ativos = cargos.filter((c) => c.status === 'ATIVO').sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime() || a.id - b.id);
  const rotulos = new Map<number, string>();
  ativos.forEach((c, i) => rotulos.set(c.id, `Cargo ${i + 1}`));
  for (const c of cargos) if (!rotulos.has(c.id)) rotulos.set(c.id, 'Cargo encerrado');
  return rotulos;
}

export function rotuloDaFolha(cargoIds: number[], rotulos: Map<number, string>): string {
  const nomes = cargoIds.map((id) => rotulos.get(id) ?? 'Cargo encerrado');
  const ativos = [...new Set(nomes.filter((n) => n !== 'Cargo encerrado'))].map((n) => n.replace('Cargo ', '')).sort();
  if (ativos.length === 0) return cargoIds.length > 1 ? 'Cargos encerrados' : 'Cargo encerrado';
  if (ativos.length === 1) return `Cargo ${ativos[0]}`;
  return `Cargos ${ativos.join(' e ')}`;
}
