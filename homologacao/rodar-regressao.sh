#!/bin/sh
# Suíte de regressão em navegador real contra o banco LOCAL (rodar com os servidores de homologação no ar).
cd "$(dirname "$0")"
F=${1:-final}
for s in "33-regressao.mjs" "30-def14-bloco-comum.mjs $F" "30b-def14-complementos.mjs" "31-def17-perfil-aluno.mjs $F" "32-def07-def08-offline.mjs $F" "34-def19-pdi-sobrescrita.mjs $F" "34b-def19-gestor.mjs $F" "35-def01-def06-ui.mjs $F" "36-integridade.mjs depois-suite"; do
  echo "===== $s"
  node $s 2>&1 | grep -E "^\[|integridade|Error|fim"
done
