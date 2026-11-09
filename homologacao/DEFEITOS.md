# Defeitos e achados (homologação NEXO — PDI e Formulário 1/3)

Modo diagnóstico: nenhum código de produção foi alterado. Banco de teste: PostgreSQL local descartável.

| ID | Sev. | Módulo | Resumo | Evidência |
|---|---|---|---|---|
| DEF-01 | MÉDIO | Formulário 1/3 | "Próximo" só troca de semana depois que o salvamento termina e a tela segue editável na semana antiga, sem indicador. Com rede lenta, o texto digitado logo após tocar em "Próximo" entra na semana ANTERIOR e a semana seguinte fica vazia. | evidencias/05-defeito-troca-semana-durante-espera.png; UT-DEF-01 |
| DEF-02 | BAIXO | Login (transversal) | Rótulos "E-mail" e "Senha" em `LoginPage.jsx` sem `htmlFor`/`id`: leitor de tela não associa rótulo ao campo. | código `src/pages/LoginPage.jsx` linhas 49–72 |
| DEF-03 | MELHORIA | Gestão de vínculos | A tela de vínculo professor×turma×disciplina não permite informar data de início: todo vínculo nasce com a data de hoje. Vínculos históricos (professor que entrou durante a janela etc.) só podem ser criados por intervenção direta no banco. | 19 vínculos criados pela interface, todos com início 04/11/2026 |
| DEF-04 | TÉCNICO | Repositório | 3.331 arquivos de `node_modules/` estão versionados no Git desde o "first commit"; `.gitignore` só ignora `perguntas*.txt` e `.env`. Não corrigido por orientação. | `git ls-files node_modules` |
| DEF-05 | MELHORIA | Marca | A interface ainda exibe "Gestão Pedagógica"; o nome definido é "Nexo" (provisório). | todas as telas |

## Observações de regra não especificada (decisão da Secretaria)
- Ciclo com janela inteira no passado (retroativo) é aceito (S10, S12, L02).
- Reabertura é aceita mesmo quando cai dentro da janela de outro ciclo ativo (UT-REA-03) ou em outro ano (UT-REA-05).
- Não existe exclusão de ciclo, só inativação (UT-ED-05).

## Achados da fase offline
| ID | Sev. | Módulo | Resumo | Evidência |
|---|---|---|---|---|
| DEF-06 | MÉDIO | Formulário 1/3 / PWA | Sem rede, o aviso fixo "Sem conexão com a internet… Reconectando em Ns / Tentar agora" (`z-40`) fica por cima da barra de ações do formulário (`z-30`): "Próximo", "Salvar progresso" e "Concluir" ficam inclicáveis (Playwright: "intercepts pointer events"), no desktop e no celular. Alternativa existente: abas de semana no topo e salvamento automático. | evidencias/11-offline-banner-celular.png, 11-offline-banner-desktop.png; UT-OFF-UX-* |
| LIM-01 | LIMITAÇÃO | PWA | O Service Worker não cacheia HTML/JS/CSS por desenho: abrir o app do zero sem rede não funciona; só dá para continuar na página já aberta. Não é defeito; é decisão de produto a confirmar. | `public/sw.js`; UT-OFF-05 |
| DEF-07 | MÉDIO (ALTO perto do prazo) | Formulário 1/3 / offline | A fila offline só é enviada ao enfileirar com rede ou ao detectar reconexão (`syncQueue.js:32` e `:111`). Quem edita offline, fecha o navegador e volta com rede NÃO tem a fila enviada ao abrir o app (30 s observados); a alteração fica só no aparelho até o professor reabrir aquele mesmo formulário. Aviso global "1 alteração aguardando sincronização" aparece, mas nada é enviado. | evidencias/12-fila-pendente-online.png; UT-OFF-11/12/13 |
| DEF-08 | MÉDIO | Formulário 1/3 / offline | Conflito detectado pela FILA (edição offline vs. outro dispositivo): o item fica parado como `conflict`; a tela do formulário não oferece "Usar a versão salva / Manter o meu texto" (essas opções só existem no salvamento direto), mostra "Salvo" e "Recuperamos o que você tinha digitado…", e o servidor mantém outro texto. Há apenas o aviso genérico "Não foi possível sincronizar algumas alterações". Sem sobrescrita silenciosa, mas sem caminho de resolução. | evidencias/10-offline-conflito-reaberto.png; UT-OFF-10/10b |

## Achados de vínculos e estados administrativos
| ID | Sev. | Módulo | Resumo | Evidência |
|---|---|---|---|---|
| DEF-09 | ALTO | Formulário 1/3 (painel × professor) | Professor cujo vínculo ENCERROU dentro da janela do ciclo (P08, encerrado em 10/11, janela 02–20/11) é contado como obrigação "esperada" no painel da Secretaria (21 batem com a conta manual), mas ele vê "Nenhum Formulário 1/3 para você agora" e a API exige vínculo ativo para editar. A obrigação fica eternamente "Não iniciada" e infla o esperado/derruba o % de entrega. Regra 67/68 do contexto ("vínculo encerrado preserva histórico" / "esperado = teve vínculo na janela") não diz se esse professor deve poder preencher. **Decisão da Secretaria necessária.** | evidencias/13-P08-lista.png, 13-painel-antes.png; UT-VIN-P08 |
| QUE-01 | CONCEITUAL | Formulário 1/3 | Desativar turma/professor durante o ciclo faz sumir a obrigação NÃO iniciada (P15: 21→20) e some o formulário da lista do professor, enquanto a obrigação já iniciada/concluída permanece (P11). É o documentado (seção 68), mas é decisão de negócio confirmar. | UT-EST-03/04/06 |

## Achados menores e de usabilidade
| ID | Sev. | Módulo | Resumo |
|---|---|---|---|
| DEF-10 | BAIXO | PDI (Alunos) | Filtro "Turma" com "Todas as escolas" lista nomes repetidos ("6M1 6M1 … 7M1 7M1") sem a escola; ambíguo porque os nomes se repetem entre escolas. |
| DEF-11 | BAIXO | PDI (Aplicação) | Data de início anterior a hoje é barrada só pelo balão nativo do navegador, sem mensagem própria na tela; o botão Salvar não responde. |
| DEF-12 | BAIXO | PDI (Alunos) | "Novo aluno PDI" parece ativo, mas com "Todas as escolas" só mostra o aviso verde no topo. |
| DEF-13 | MÉDIO | PDI offline | O mesmo aviso offline que cobre os botões do 1/3 (DEF-06) cobre o "Salvar" do PDI; a alternativa é salvar por teclado (Tab+Enter), que enfileira corretamente. A fila do PDI também não é enviada ao abrir o app (DEF-07). |
