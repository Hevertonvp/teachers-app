import { ConflitoVersaoError } from './errors.js';

// Token de conflito único para toda a infraestrutura offline (seção "Conflitos" do pedido):
// reaproveita `updatedAt`, que já existe em toda tabela, em vez de criar uma coluna `version` nova
// por entidade (decisão confirmada com o usuário). O cliente manda o `updatedAt` que tinha quando
// começou a editar (lido de FichaPdi/Anamnese/etc, nunca da própria RespostaPdi/RespostaAnamnese,
// que não carregam esse controle); se o valor atual no banco já é outro, alguém salvou por cima
// enquanto o cliente estava offline/editando — NUNCA sobrescreve, lança 409 com os dados atuais
// pro frontend mostrar o conflito e preservar o rascunho local.
// `montarDadosAtuais` é lazy (só roda no caminho de conflito) — o caminho feliz nunca paga o
// custo de montar o payload completo que só serve para o frontend mostrar o conflito.
export async function exigirSemConflitoDeVersao(baseUpdatedAt: string, atual: Date | null, montarDadosAtuais: () => Promise<unknown>, mensagem: string) {
  const baseTime = new Date(baseUpdatedAt).getTime();
  const atualTime = (atual ?? new Date(0)).getTime();
  if (baseTime !== atualTime) {
    throw new ConflitoVersaoError(mensagem, await montarDadosAtuais());
  }
}
