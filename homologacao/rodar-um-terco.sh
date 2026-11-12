#!/bin/sh
# Suíte do Formulário 1/3 POR CARGO (12/11/2026) em navegador real contra o banco LOCAL.
# Rodar com os servidores de homologação no ar (iniciar-servidores.sh). Cada teste prepara os cargos de teste
# (cargos-homolog.mjs) e limpa o que cria. Resumo no fim: aprovados / reprovados / outros por arquivo.
cd "$(dirname "$0")"
TESTES="04-um-terco-p04.mjs 05-defeito-troca-semana.mjs 07-servidor-e-concorrencia.mjs 08-invasao-gravacao.mjs
10-offline.mjs 12-offline-fila-ao-abrir.mjs 13-vinculos-historicos.mjs 14-estados-administrativos.mjs
15-prazo-e-reabertura.mjs 24-cartoes-p01-p06.mjs 32-def07-def08-offline.mjs 33-regressao.mjs 35-def01-def06-ui.mjs
44-modal-novo-ciclo-um-terco.mjs 45-dashboard-entregas.mjs 46-um-terco-escolas-do-ciclo.mjs 47-um-terco-inativos-separados.mjs
48-reabrir-so-apos-prazo.mjs 50-acompanhamento-escolar.mjs 52-inativar-um-terco-com-preenchimentos.mjs
55-pdi-em-desenvolvimento.mjs 56-escola-do-topo-nos-modais.mjs 57-filtros-seguem-o-topo.mjs 58-cargos-e-um-terco-por-cargo.mjs
59-correcao-um-terco-por-cargo.mjs 60-educacao-infantil-um-terco.mjs 61-excel-um-terco-por-cargo.mjs 36-integridade.mjs"
for t in $TESTES; do
  saida=$(node "$t" cargo 2>&1)
  ok=$(echo "$saida" | grep -c '^\[APROVADO\]')
  rep=$(echo "$saida" | grep -c '^\[REPROVADO\]')
  outros=$(echo "$saida" | grep '^\[' | grep -vc '^\[APROVADO\]\|^\[REPROVADO\]')
  erro=$(echo "$saida" | grep -m1 'Error' | cut -c1-120)
  echo "$t: $ok aprovados, $rep reprovados, $outros outros${erro:+ | ERRO: $erro}"
  echo "$saida" | grep '^\[REPROVADO\]' | cut -c1-200 | sed 's/^/    /'
done
