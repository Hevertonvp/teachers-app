# CLAUDE_CONTEXT.md

# Sistema Pedagógico — Contexto Mestre do Projeto

> Atualizado em: 03/11/2026
>
> Este arquivo consolida as decisões de negócio, arquitetura, implementações, correções, testes relatados e pendências conhecidas do projeto.
>
> Ele deve ser lido antes de qualquer alteração relevante, junto com `CLAUDE.md`, `schema.prisma`, migrations, histórico Git recente e estado atual do banco.
>
> **REGRA MAIS IMPORTANTE:** se houver qualquer dúvida de regra de negócio, comportamento pedagógico, escopo, autorização, relacionamento entre entidades ou risco de tomar uma decisão de produto sozinho, **PARE E PERGUNTE ANTES DE IMPLEMENTAR**.
>
> Não invente regra pedagógica. Não reimplemente uma feature só porque o histórico conversacional sumiu. Antes de concluir que algo “não existe”, procure no Git, schema, migrations, scripts e banco.

---

# 1. Visão geral

Projeto: sistema pedagógico municipal.

Escopo principal já trabalhado:

- autenticação e usuários;
- escolas e vínculos;
- turmas;
- Professor × Turma × Disciplina;
- Auxiliar × Turma;
- alunos PDI;
- movimentação de alunos;
- Modelos PDI;
- perguntas padrão;
- CRMG;
- Aplicações PDI;
- Fichas PDI;
- bloco de respostas compartilhado;
- Correções;
- Ficha Anual;
- Indicadores do aluno;
- painel de entrega;
- Mensagens;
- Feedback do Sistema;
- offline / proteção contra perda de progresso;
- calendário de trimestres;
- formulário único multi-disciplina;
- Formulário 1/3;
- melhorias de loading/spinner;
- correções de primeiro acesso.

---

# 2. Stack

## Frontend
- React 19
- Vite 8
- React Router DOM 7
- Tailwind CSS 4
- Context API
- oxlint

## Backend
- Node 22
- TypeScript
- Express 5
- Prisma 6.19.3
- Zod
- cors
- dotenv
- tsx

## Banco
- PostgreSQL / Neon
- Prisma migrations
- banco remoto Neon usado no ambiente real
- evitar `db push`
- migrations devem ser aplicadas explicitamente

## Estrutura
Backend em `/backend`.

Pastas principais:
- `src/domain`
- `src/lib`
- `src/api`
- `prisma`

Frontend na raiz.

---

# 3. Fonte de verdade

Quando houver divergência entre memória/conversa e projeto:

1. banco atual;
2. migrations aplicadas;
3. código em `origin/main`;
4. schema;
5. este arquivo;
6. memória de conversa.

Nunca assumir que o repositório local está atualizado sem conferir.

---

# 4. Perfis

Perfis principais:
- Secretaria
- Diretora
- Gestor / Supervisora
- Professor / Professora
- Auxiliar
- SUPORTE_SISTEMA

Hierarquia pedagógica geral:

`Secretaria → Diretora → Gestor/Supervisora → Professor`

Auxiliar é separado.

`SUPORTE_SISTEMA` também é separado da hierarquia pedagógica.

---

# 5. Secretaria

Pode:
- administrar a rede;
- configurar trimestres;
- administrar Modelos PDI;
- criar Aplicações PDI;
- reabrir Aplicações;
- corrigir/devolver PDI;
- acompanhar entregas;
- administrar Professores conforme regras;
- configurar Formulário 1/3;
- reabrir Formulário 1/3.

---

# 6. Diretora

- vinculada a escolas específicas;
- atua somente nas próprias escolas;
- pode administrar Professores das próprias escolas;
- não cria Modelos PDI;
- não cria Aplicações;
- originalmente PDI é consulta, não preenchimento.

---

# 7. Gestor / Supervisora

- vinculado a escolas;
- pode preencher/editar Fichas PDI conforme regra atual;
- não administra Modelos;
- não cria Aplicações;
- não reabre globalmente.

---

# 8. Professor

Pode ter:
- várias escolas;
- várias turmas;
- várias disciplinas;
- várias disciplinas na mesma turma.

Permissões são baseadas em vínculos vivos.

---

# 9. Auxiliar

- ligado a Turma;
- pode ter várias turmas;
- consulta;
- não edita PDI.

---

# 10. SUPORTE_SISTEMA

Perfil separado.

Não precisa de vínculo escolar.

Acesso apenas à área global de Feedback.

Conta provisionada manualmente por script.

Não existe criação pública.

---

# 11. Autenticação

JWT real.

Professor criado com:
- senha temporária;
- validade de 48h;
- primeiro login obriga troca;
- senha definitiva mínima de 8 caracteres;
- `authVersion` pode invalidar sessões.

Duplicidade de e-mail:
- Professor com e-mail já existente pode reutilizar a mesma Pessoa e ganhar novo vínculo;
- colisão incompatível com outro perfil deve ser bloqueada.

---

# 12. Bug de primeiro acesso — corrigido

Bug:
- Professor logava com senha temporária;
- criava senha definitiva;
- backend salvava;
- frontend ficava preso na tela;
- segundo clique retornava `essa conta não está com senha temporaria pendente`.

Correção relatada:
- botão com spinner;
- texto `Salvando...`;
- botão desabilitado;
- evita duplo clique;
- após sucesso, redireciona ao painel;
- testado em Chrome real com atraso artificial de 2,5s.

Também foram criados componentes reutilizáveis:
- `Spinner`
- `Button` com `loading`
- `LoadingBlock`

Aplicados em Login, Primeiro acesso, Fichas PDI, formulário único do aluno, Modelos, Aplicações, Gestão de Pessoas, Turmas, Meus PDIs e página inicial PDI.

> Confirmar no Git/produção se esse commit já foi publicado antes de assumir que está online.

---

# 13. Escolas oficiais

Lista oficial atual:

1. CMEI PROF. UBI BARROSO
2. CRECHE URSINHO SABIDO
3. E. M. CORONEL JOSÉ BRÁS
4. E. M. D. PRUDENCIANA FAUSTINA DE SÃO JOSÉ
5. E. M. DR. AUGUSTO GLÓRIA
6. E. M. DR. JOÃO CAVALHEIRO
7. E. M. DR. PÉRICLES VIEIRA DE MENDONÇA
8. E. M. FRANCISCO SOUZA CASTRO
9. E. M. MARIA DOS ANJOS CAVALHEIRO MENDONÇA
10. E. M. OTÁVIO GONÇALVES
11. E. M. TRÊS MARIAS
12. E. M. VÂNIA MARIA FÁVERO BARBOSA

IDs relatados posteriormente:
- 2
- 6
- 10
- 11
- 12
- 13
- 16
- 19
- 25
- 34
- 50
- 51

Mapeamentos decididos:
- id 2 antigo `CMEI PROF UBI BARROSO SILVA` → `CMEI PROF. UBI BARROSO`
- id 6 antigo `EM CEL JOSE BRAS` → `E. M. CORONEL JOSÉ BRÁS` → ATIVA
- id 34 antigo `PEM URSINHO SABIDO` → `CRECHE URSINHO SABIDO`

Criadas:
- E. M. MARIA DOS ANJOS CAVALHEIRO MENDONÇA
- E. M. VÂNIA MARIA FÁVERO BARBOSA

---

# 14. Disciplinas

Disciplinas reais:
- Língua Portuguesa
- Redação
- Arte
- Educação Física
- Matemática
- Ciências
- Geografia
- História
- Inglês
- Ensino Religioso

Mapeamento CRMG:
- Língua Portuguesa → LÍNGUA_PORTUGUESA
- Redação → LÍNGUA_PORTUGUESA
- Arte → ARTE
- Educação Física → EDUCAÇÃO_FÍSICA
- Matemática → MATEMÁTICA
- Ciências → CIÊNCIAS
- Geografia → GEOGRAFIA
- História → HISTÓRIA
- Inglês → LÍNGUA_INGLESA
- Ensino Religioso → ENSINO_RELIGIOSO

---

# 15. VinculoEscolar

Existe `VinculoEscolar`.

Autorização deve usar vínculos atuais/vivos.

Nunca usar snapshot histórico como autorização atual.

---

# 16. Professor × Turma × Disciplina

Entidade: `ProfessorTurmaDisciplina`

Regras:
- no máximo um Professor ativo por turma + disciplina;
- substituição encerra vínculo anterior;
- Professor pode atuar em várias escolas/turmas/disciplinas.

---

# 17. Auxiliar × Turma

Entidade: `AuxiliarTurma`

Regras:
- no máximo um Auxiliar ativo por turma;
- mesmo Auxiliar pode ter várias turmas;
- substituição encerra vínculo anterior.

---

# 18. Aluno PDI

Entidade: `AlunoPdi`

Aluno tem identidade permanente.

Não duplicar por troca de turma, troca de escola, novo ano ou transferência.

---

# 19. Movimentação do aluno

Usa `MovimentacaoAlunoPdi`.

Objetivo: preservar trajetória.

Aluno pode mudar de turma/escola mantendo o mesmo `alunoId`.

---

# 20. Modelos PDI

Cada `ModeloPdi` pertence a uma disciplina.

Regra: no máximo um Modelo ativo por disciplina.

Aplicações usam snapshot congelado.

Modelo já usado não deve ser apagado de forma destrutiva.

---

# 21. Pergunta padrão — conceito definitivo

CRÍTICO.

Historicamente o sistema confundia:
- pergunta padrão;
- resposta compartilhada.

Isso foi corrigido.

**Pergunta padrão** significa: nasce automaticamente em Modelo novo.

Pode ser:
- compartilhada;
- por disciplina.

Existe `PerguntaPdiPadrao.compartilhada`.

Migration: `20261025190000_pergunta_padrao_compartilhada`

Interface mostra selo equivalente a:
- Compartilhada
- Por disciplina

---

# 22. Perguntas compartilhadas

Exemplos definitivos:
- adaptação;
- participação;
- interação/comunicação.

Mesma resposta para o mesmo Professor/aluno em suas disciplinas elegíveis.

---

# 23. Perguntas por disciplina

Incluem:
- nota;
- habilidades consolidadas;
- habilidades não consolidadas;
- HABILIDADE_CRMG;
- pergunta específica do trimestre;
- demais perguntas disciplinares.

---

# 24. CRMG nunca compartilhado

`HABILIDADE_CRMG`:
- pode ser pergunta padrão;
- deve nascer automaticamente;
- sempre `compartilhada=false`;
- backend bloqueia compartilhamento;
- banco possui CHECK.

Script: `backend/scripts/pdi/separar-respostas-compartilhadas.ts`

Foi relatado como aplicado no banco principal.

Resultado relatado:
- 12 perguntas padrão ativas;
- ids 53-55 compartilhadas;
- id 56 nota, por disciplina;
- ids 57-62 trimestrais, por disciplina;
- ids 63-64 CRMG, por disciplina.

---

# 25. Bloco compartilhado

Entidades:
- `AplicacaoPerguntaPadraoPdi`
- `AplicacaoModeloPerguntaPadraoPdi`
- `BlocoRespostasPadraoPdi`
- `RespostaPadraoPdi`
- `CorrecaoBlocoPadraoPdi`
- `HistoricoCorrecaoRespostaPadrao`

Identidade: `aplicacao + aluno + turma + professor`

Professores diferentes não compartilham.

Mesmo Professor em várias disciplinas da mesma turma reutiliza o bloco.

Lock otimista: `version`

Não substituir por `updatedAt`.

---

# 26. CRMG — catálogo

Entidades:
- `HabilidadeCurricular`
- `DisciplinaComponenteCurricular`

Dados relatados:
- 1.932 registros
- 1.929 códigos distintos

Versão: `CRMG-EIEF-2023-05`

Busca:
- backend;
- mínimo 2 caracteres;
- debounce 300 ms;
- limite 20;
- sem acento;
- case-insensitive.

Não restringir por ano/série.

Restringir por componente/disciplina da Ficha.

Resposta congela código e texto.

---

# 27. Aplicação PDI

`AplicacaoPdi` pertence a uma escola.

Não existe Aplicação por disciplina.

Uma Aplicação pode conter vários Modelos.

Ficha: `Aplicação + aluno + disciplina`

Unicidade para esse trio.

Aplicações da mesma escola não podem ter período sobreposto.

---

# 28. Calendário de trimestres

Evoluído para calendário por ano.

Entidade: `PeriodoTrimestre`

Chave: `ano + trimestre`

Migration: `20261025180000_calendario_trimestres_por_ano`

Somente Secretaria altera.

---

# 29. Regra de criação de Aplicação

Antes de criar Aplicação, o ano precisa ter:
- 1º trimestre completo;
- 2º trimestre completo;
- 3º trimestre completo.

Validar:
- datas obrigatórias;
- fim >= início;
- dentro do ano;
- sem sobreposição;
- sem trimestre duplicado.

Se inválido: bloquear.

Nunca criar nova Aplicação com `trimestre = null`.

Nunca mostrar as 3 perguntas trimestrais como fallback.

---

# 30. Calendário 2026 conhecido

Relatado:
- 1º: 02/02–30/04
- 2º: 01/05–15/08
- 3º: 16/08–18/12

ATENÇÃO: essas datas podem ter vindo de exemplo antigo.

Não tratar como oficiais sem confirmação da Secretaria.

---

# 31. Calendário 2027

Não inventar.

Aplicações 2027 devem ficar bloqueadas enquanto Secretaria não configurar os 3 trimestres.

---

# 32. Perguntas trimestrais do PDI

Pergunta pode ter:
- trimestre 1;
- trimestre 2;
- trimestre 3;
- sem trimestre.

Ao criar Aplicação:
- sem trimestre → entra;
- 1 → só no 1º;
- 2 → só no 2º;
- 3 → só no 3º.

Professor não escolhe.

Pergunta trimestral é por disciplina.

---

# 33. Formulário único do aluno — PDI

Implementado.

Arquivo relatado: `FormularioPdiAlunoPage.jsx`

Rota: `/pdi/aluno/:aplicacaoId/:alunoId`

Professor com várias disciplinas abre uma tela única para o aluno.

Tela:
- bloco compartilhado uma vez;
- bloco por disciplina.

Por baixo, Fichas continuam separadas.

---

# 34. Salvamento no formulário único

- bloco compartilhado salvo uma vez;
- cada Ficha salva separadamente;
- sem transação longa;
- falha em uma disciplina não apaga outras;
- rascunho da falha permanece.

---

# 35. Conclusão multi-disciplina

Cada Ficha tem status próprio.

Existe `Concluir todas as disciplinas`.

Isso orquestra conclusões individuais.

Uma falha não desfaz as concluídas.

---

# 36. Meus PDIs

Passou a agrupar por aluno.

Exemplo:
- Matemática
- Inglês
- História
- Português

Clicar no aluno abre formulário único.

---

# 37. Ficha PDI

Entidades:
- `FichaPdi`
- `RespostaPdi`

Status:
- PENDENTE
- EM_ANDAMENTO
- CONCLUIDA

Regras:
- get-or-create;
- sem side effect em GET;
- partial save;
- conclusão;
- edição após conclusão enquanto período editável;
- somente leitura após prazo;
- reabertura libera;
- autorização por vínculo vivo.

---

# 38. Correções

Dois fluxos.

## Específica da Ficha
`CorrecaoFichaPdi`

Afeta uma disciplina.

## Bloco compartilhado
`CorrecaoBlocoPadraoPdi`

Afeta bloco comum.

Secretaria pode corrigir diretamente ou devolver ao Professor.

Janela individual: 3 dias.

Status conhecidos:
- ABERTA
- RESOLVIDA
- EXPIRADA

---

# 39. Ficha Anual

Visão por `alunoId + ano`.

Fonte: Fichas e respostas originais.

Não duplica respostas.

Snapshots antigos preservados.

Movimentação de aluno não cria identidade nova.

Formulário único não altera arquitetura da Ficha Anual.

---

# 40. Indicadores do aluno

Foi implementada rota real de indicadores.

Commit: `cb0d5d9 — PDI: indicadores reais do aluno e painel de entrega`

Mock antigo removido: `DesempenhoPdiChartMock.jsx`

Existe rota relatada: `pdiIndicadores`

---

# 41. Direção futura dos indicadores

Desejo já definido:
- gráficos premium;
- modernos;
- fluidos;
- mobile;
- dentro da área do aluno;
- métricas de perguntas padrão;
- abas por disciplina;
- troca suave entre disciplinas;
- dados reais;
- sem inventar métrica.

Página principal PDI:
- percentual de entrega;
- concluídos;
- pendentes;
- em andamento;
- cards modernos;
- dashboard premium.

Não mexer no restante sem necessidade.

---

# 42. Mensagens

Entidades:
- `ConversaMensagem`
- `ParticipanteConversa`
- `Mensagem`

Matriz:
- Secretaria ↔ Diretora
- Diretora ↔ Secretaria / Gestor / Professor / Auxiliar da mesma escola
- Gestor ↔ Diretora / Professor / Auxiliar
- Gestor ↛ Gestor
- Professor ↔ Diretora / Gestor
- Auxiliar ↔ Diretora / Gestor

Bulk downward cria conversas individuais.

Funcionalidades:
- leitura;
- unread;
- badge;
- ocultar para mim;
- reaparecer com nova mensagem.

Sem anexo real.

Sem websocket.

---

# 43. Feedback do Sistema

Entidades:
- `FeedbackSistema`
- `MensagemFeedbackSistema`
- `FeedbackSistemaEvento`

Perfil: `SUPORTE_SISTEMA`

Categorias:
- Erro/bug
- Sugestão de melhoria
- Dificuldade para usar o sistema
- Lentidão/problema técnico
- Outro problema do sistema

Status:
- NOVO
- EM_ANALISE
- RESOLVIDO
- NAO_E_PROBLEMA_DO_SISTEMA

Qualquer perfil autenticado pode criar.

Usuário vê só próprios.

Suporte vê global.

Resposta do autor após RESOLVIDO → EM_ANALISE.

Script: `backend/scripts/provisionar-suporte-sistema.ts`

Anexos não implementados.

---

# 44. Offline

Infra em `src/offline/`.

Arquivos:
- `db.js`
- `networkStatus.js`
- `syncQueue.js`

IndexedDB:
- `drafts`
- `queue`

Retry:
- 5s
- 10s
- 20s
- 30s
- 60s

Sem polling online.

Reconexão confirmada por `/health`.

---

# 45. Fila offline

Idempotente por recurso/operação.

Remove apenas após 2xx.

Conflitos: `409 / CONFLITO_VERSAO`

Nunca last-write-wins silencioso.

Web Locks evita dois sync workers.

BroadcastChannel sincroniza abas.

---

# 46. Offline — telas integradas

Relatadas:
- Ficha PDI;
- bloco compartilhado;
- Anamnese;
- Correções;
- Feedback;
- Mensagens como rascunho.

Mensagens nunca auto-enviam após reconexão.

---

# 47. CRMG offline

Seleção já feita fica salva.

Nova busca exige conexão.

Não baixar catálogo inteiro.

---

# 48. Conclusão offline

Ação definitiva exige conexão.

Não simular conclusão local.

---

# 49. Concorrência

Já adotado:
- Ficha sem duplicação;
- bloco com `version`;
- stale write → 409;
- evitar paralelismo em Prisma interactive transaction com Neon/pgbouncer.

---

# 50. Teste E2E amplo antigo

Relatado: **81/81 verificações**.

Cobriu cenário base, Professor multi-disciplina, CRMG, bloco compartilhado, Professor diferente, permissões, Correções, Ficha Anual, movimentação, troca de Professor, Mensagens, Feedback e concorrência.

Não cobriu browser real offline/mobile.

---

# 51. Testes calendário e formulário único

Relatados em branch Neon:
- calendário: 93/93
- formulário único: 36/36

Esses resultados foram registrados na mensagem de commit, não como artefato de CI.

---

# 52. Histórico Git recuperado

Em 03/11/2026 foi descoberto que local estava desatualizado.

Nada foi perdido.

`origin/main` estava 8 commits à frente.

Commits:
- `00511ba` — calendário por ano e formulário único
- `2cdea9b` — Fichas unificadas para Professor multi-disciplina
- `e24150f` — remoção de Aplicação com snapshot do bloco
- `cb0d5d9` — indicadores reais e painel de entrega
- `075d027` — topo com disciplinas reais
- `76657ce` — textos mais curtos
- `c23d387` — CRMG limpa busca e fecha lista
- `078049b` — correção Anamnese

Depois:
`f9e4903 — DataContext: documenta por que loadTrimestres aceita lista vazia do backend`

Naquele momento o local estava 1 commit à frente e o push ainda não havia sido confirmado.

Sempre conferir HEAD atual.

> **Atualização (03/11/2026, Claude):** depois disso foram feitos mais 5 commits locais de frontend (`c160348`, `5aead33`, `0033586`, `5eac797`, `5a9d85c`; ver seção 102). Push não confirmado.

---

# 53. Prisma Client

Após pull, Prisma Client local estava desatualizado.

Não reconhecia `compartilhada`.

Correção segura:

```bash
cd backend
npx prisma generate
```

Não toca no banco.

---

# 54. Dados artificiais

Marcadores usados: `_criado_por_ia`

Nunca apagar por nome sem auditar dependências.

Em novembro/2026 foram criados 7 alunos de teste:
- otavio_criado_por_ia
- henrique_criado_por_ia
- livia_criado_por_ia
- marcos_criado_por_ia
- isabela_criado_por_ia
- davi_criado_por_ia
- sofia_criado_por_ia

Distribuídos em turmas 6M1 de escolas elegíveis.

Contagem relatada passou de 6 para 13 naquele momento.

Nunca assumir contagem atual sem consultar banco.

---

# 55. FORMULÁRIO 1/3 — VISÃO GERAL

Nova feature para registro de conteúdos ensinados.

Foi implementada em código em 03/11/2026.

Migration: `20261103120000_formulario_um_terco`

A migration cria 7 tabelas:
- ciclo;
- semanas;
- entregas;
- respostas;
- cobertura;
- reaberturas;
- histórico.

A migration foi aplicada no banco Neon antes de uma mensagem de correção de regras.

As tabelas foram relatadas como criadas sem alterar dados antigos.

---

# 56. Formulário 1/3 — identidade

Identidade conceitual:

`ciclo + professor + ano/série + disciplina`

Escola e turma NÃO fazem parte da identidade.

---

# 57. Regra de não duplicação do 1/3

Mesmo Professor + mesmo ano/série + mesma disciplina + mesmo ciclo → um único preenchimento.

Mesmo que trabalhe em várias turmas, escolas ou turnos.

Exemplo:
- Escola A / 6M1
- Escola A / 6M2
- Escola B / 6M1

Matemática 6º ano → 1 formulário.

---

# 58. O que gera outro Formulário 1/3

- disciplina diferente;
- ano/série diferente;
- ciclo diferente.

Exemplos:
- Matemática 6º → 1
- Ciências 6º → outro
- Matemática 7º → outro
- Matemática 6º em outro ciclo → outro

---

# 59. Campos desnecessários no 1/3

Não pedir ao Professor:
- nome;
- e-mail;
- unidade escolar;
- turno;
- segundo cargo.

Esses dados já existem no sistema.

Tela pode apenas mostrar contexto.

---

# 60. Estrutura do 1/3

Formulário em etapas.

Semanas geradas automaticamente:
- Semana 1
- Semana 2
- Semana 3
- Semana 4
- etc.

Cada semana possui campo `Conteúdos ensinados`.

Navegação:
- Voltar
- Próximo
- Salvar progresso
- Concluir

`Próximo` nunca conclui.

---

# 61. Datas do 1/3

Secretaria configura:
- ano;
- trimestre;
- título/ciclo;
- abertura;
- prazo final;
- quantidade de semanas;
- início/fim de cada semana.

As datas não são fixas.

---

# 62. Relação 1/3 com trimestre global

Usar `PeriodoTrimestre`.

Não criar calendário paralelo.

Todas as datas precisam ficar dentro do trimestre correspondente:
- abertura;
- prazo final;
- semana 1;
- semana 2;
- etc.

---

# 63. Prazo do 1/3

Professor pode editar enquanto prazo estiver aberto, mesmo depois de clicar em Concluir.

Após prazo: somente leitura.

Secretaria pode reabrir.

---

# 64. Reabertura do 1/3

Somente Secretaria.

Reabertura:
- início/fim;
- não altera prazo original;
- libera edição;
- histórico/auditoria;
- não pode sobrepor outra reabertura incompatível.

---

# 65. Cobertura do 1/3

Tabela de cobertura registra vínculos abrangidos.

Um único preenchimento pode valer para várias escolas e turmas.

Não duplicar conteúdo.

Não duplicar entrega.

---

# 66. Novo vínculo equivalente

Se Professor já tem Matemática / 6º / ciclo X e ganha outra turma Matemática / 6º durante a janela:

→ novo vínculo entra na cobertura da mesma entrega.

Não criar nova entrega.

---

# 67. Vínculo encerrado

Se vínculo termina:
- histórico permanece;
- cobertura recebe fim;
- entrega não desaparece;
- obrigação histórica não some retroativamente.

---

# 68. Quem conta como “esperado” no painel do 1/3

Regra definitiva:

> Conta como esperado quem teve vínculo elegível em algum momento dentro da janela daquele ciclo.

Exemplo:

Ciclo aberto de 10/03 a 20/03.

Professor tinha vínculo elegível em algum momento desse intervalo → esperado.

Se vínculo só começou depois de 20/03 → não entra retroativamente.

---

# 69. Múltiplos ciclos no mesmo trimestre

REGRA DEFINITIVA.

Pode haver mais de um Formulário 1/3 no mesmo trimestre.

Exemplo válido:
- ciclo A: 05/03–15/03
- ciclo B: 20/03–30/03

---

# 70. Sobreposição de ciclos 1/3

O que NÃO pode acontecer:

dois ciclos com janelas de preenchimento sobrepostas.

Exemplo inválido:
- A: 05/03–20/03
- B: 15/03–25/03

Backend deve bloquear.

Validação precisa ser concorrente/segura.

Não depender só do frontend.

---

# 71. Regra antiga de “1 ciclo por trimestre” está ERRADA

Foi decisão tomada indevidamente durante implementação inicial.

Deve ser removida.

Se existir índice/constraint impedindo vários ciclos no mesmo trimestre, criar migration complementar mínima e segura.

---

# 72. EscolaModulo no 1/3

Implementação inicial fez o 1/3 depender de `FORMULARIO_UM_TERCO` em `EscolaModulo`.

Isso foi considerado errado.

Regra definitiva:

**Formulário 1/3 é global para todas as escolas oficiais ativas com vínculos/turmas elegíveis.**

Não usar:
- ativação manual por escola;
- script para ligar módulo;
- lista fixa de IDs.

Remover dependência de `EscolaModulo` dessa feature.

---

# 73. Educação Infantil e 1/3

CMEI/Creche não devem gerar entrega se não houver turma/ano elegível.

Não precisa blacklist por escola.

A elegibilidade deve vir da estrutura da turma/ano.

---

# 74. Ano/série no 1/3

Não inferir `6º ano` apenas de texto como `6M1`.

Auditar se existe campo estruturado confiável.

Se não existir: parar e perguntar.

Não inventar parser de nome de turma.

---

# 75. Professor no 1/3

Lista do Professor mostra um card por:
- ano/série;
- disciplina;
- ciclo.

Pode mostrar `Válido para:` com escolas/turmas abrangidas.

---

# 76. Rascunho do 1/3

Relatado na implementação:
- IndexedDB a cada digitação;
- envio ao servidor ao trocar etapa;
- debounce de 2 segundos;
- botão Salvar progresso.

---

# 77. Conclusão do 1/3

Só botão final conclui.

Relatado:
- todas as semanas obrigatórias para concluir;
- exige conexão;
- pode editar depois de concluir enquanto prazo aberto.

---

# 78. Concorrência do 1/3

Implementação relatada:
- índice único pela identidade;
- `pg_advisory_xact_lock`;
- conflito por `updatedAt`;
- 409 em stale update.

Tela oferece opções equivalentes a:
- Usar versão salva
- Manter meu texto

Nada deve ser sobrescrito silenciosamente.

---

# 79. Histórico do 1/3

Relatado:
- começou;
- salvou;
- concluiu;
- mudanças de cobertura.

Implementação inicial agrupa salvamentos repetidos do mesmo Professor em menos de 10 minutos em um evento.

Essa regra técnica pode ser mantida desde que não comprometa auditoria.

> **Nota (09/11/2026):** a Decisão 5 da seção 101-A (proposta, não aprovada) prevê exclusão definitiva de ciclo **sem** preservar este histórico. Se aprovada, é exceção a esta seção.

---

# 80. Painel Secretaria do 1/3

Mostrar:
- esperado;
- concluído;
- em andamento;
- não iniciado;
- percentual.

Filtros:
- escola;
- ano/série;
- disciplina;
- Professor;
- status.

Contagem principal: cada entrega conta uma vez.

Cobertura por escola: separada.

Não somar a mesma entrega várias vezes por escola/turma.

---

# 81. Permissões do 1/3

## Secretaria
- cria ciclo;
- configura;
- acompanha;
- reabre;
- consulta tudo.

## Professor
- vê apenas suas entregas elegíveis;
- preenche;
- salva;
- conclui;
- consulta histórico próprio.

Outros perfis: não inventar.

Implementação inicial removeu menu do Gestor e redirecionou outros perfis ao dashboard.

Se for preciso consulta por Diretora/Gestor, perguntar antes.

---

# 82. Aplicabilidade global do 1/3

Não usar `EscolaModulo`.

Uma escola entra se:
- é oficial;
- está ativa;
- possui turma elegível;
- possui vínculo elegível.

---

# 83. Migration 1/3 já aplicada

Relatado:

migration `20261103120000_formulario_um_terco` já foi aplicada no Neon.

Criou as 7 tabelas.

Não rollbackar sem necessidade.

Foi relatado que as tabelas estavam vazias depois da limpeza dos testes.

---

# 84. Teste parcial do 1/3 já executado

Antes da correção das regras:
- 19 casos passaram;
- 1 falhou por bug do script de teste;
- falha: tentativa de criar vínculo já existente;
- não foi considerado bug da feature.

O processo foi interrompido antes de prazo, reabertura e painel.

Dados de teste foram removidos.

Prefixo usado: `ZZTESTE-UT`

Relatado após limpeza:
- 0 resíduos;
- 12 escolas oficiais intactas.

---

# 85. Testes unitários/de regra do 1/3

Antes de banco:
20 testes de regras passaram.

Cobriram:
- datas dentro/fora do trimestre;
- semana inválida;
- prazo inválido;
- fuso Brasília;
- edição antes/depois do prazo;
- reabertura.

---

# 86. Builds do 1/3

Relatado:
- backend `tsc` passa;
- `prisma validate` passa;
- `vite build` passa.

---

# 87. Estado atual do 1/3 — IMPORTANTE

A implementação inicial existe.

Migration foi aplicada.

Porém, as regras definitivas de:
- vários ciclos no mesmo trimestre;
- bloqueio apenas por sobreposição;
- “esperado” por vínculo dentro da janela;
- remoção de `EscolaModulo`;

foram definidas DEPOIS.

Foi enviado um prompt para corrigir isso.

**Não assumir que essas correções já foram implementadas sem verificar o código atual.**

> **ATUALIZAÇÃO (03/11/2026, Claude):** essas correções **já foram implementadas no código** e testadas no banco (bateria 50 ok / 0 falhas). Detalhes na seção 102. Continuam **sem commit** até o usuário pedir.

---

# 88. Correção solicitada no 1/3

> **CONCLUÍDA em 03/11/2026** (itens 1 a 10 abaixo implementados e testados; ver seção 102).

A correção mais recente deve:

1. remover trava de 1 ciclo por trimestre;
2. permitir vários ciclos no mesmo trimestre;
3. bloquear apenas sobreposição de janelas;
4. manter datas dentro do trimestre;
5. definir esperado por vínculo dentro da janela;
6. remover dependência de `EscolaModulo`;
7. manter identidade `ciclo + professor + ano/série + disciplina`;
8. manter cobertura por escola/turma;
9. testar tudo novamente;
10. limpar dados artificiais.

---

# 89. Mock antigo do 1/3

Arquivo antigo `FormularioUmTerco.jsx` com dados de exemplo foi relatado como ainda existente, mas não usado pelas novas rotas.

Pode ser removido futuramente se confirmado morto.

Não apagar sem auditar referências.

---

# 90. Módulos por escola

Existe tabela/API `EscolaModulo`.

Historicamente foi criada para substituir lista fixa de IDs.

Mas:
- PDI não depende dela;
- Mensagens ainda tinham lógica antiga no frontend por IDs;
- Formulário 1/3 não deve depender dela.

Não expandir uso sem decisão explícita.

---

# 91. Lista fixa de IDs

Existe/Existiu lógica em `src/utils/aplicabilidade.js`.

Isso já causou bug quando escola nova teve ID maior.

Regra:

evitar autorização/aplicabilidade por faixas fixas de IDs.

Preferir relações reais e status.

---

# 92. Indicadores e dashboard

PDI foi considerado estabilizado.

Nova evolução visual deve evitar alterar arquitetura pedagógica.

Foco:
- indicadores;
- gráficos;
- dashboard;
- experiência.

---

# 93. Deploy / produção

Render publica backend.

GitHub Pages publica frontend.

Antes de afirmar que algo está online:
- verificar commit no GitHub;
- verificar Render `Live`;
- verificar frontend publicado;
- verificar migrations.

Não assumir.

---

# 94. Credenciais

Connection strings e JWT são segredos.

Foi discutida rotação antes de dados reais sensíveis.

Se credenciais antigas apareceram em notebook perdido/conversa:
- trocar senha Neon;
- trocar `JWT_SECRET`;
- atualizar Render.

Isso invalida sessões.

---

# 95. VAPID / push

Notificações internas existiam.

Push depende de chaves VAPID.

Foi identificado que VAPID talvez não estivesse configurado em produção.

Não afirmar que push funciona sem verificar variáveis e teste real.

---

# 96. Backup / restauração Neon

Foi recomendado verificar:
- point-in-time restore;
- retenção;
- branches;
- janela disponível no plano.

Não inventar disponibilidade.

Consultar Neon/painel.

---

# 97. Regras de segurança para scripts

Scripts de uso único devem ser idempotentes quando possível ou claramente protegidos.

Script antigo `_add-habilidades-crmg.ts`:
- não idempotente;
- foi apagado;
- nunca entrou no Git;
- havia backup temporário em `scratchpad/backup-local/`.

Não recriar esse script sem necessidade.

---

# 98. Regra sobre scripts de dados

Antes de rodar:
- dry-run;
- mostrar alterações;
- identificar banco;
- proteger produção;
- limpar teste depois.

Não rodar script destrutivo sem autorização.

---

# 99. Regras de teste

Quando usar produção:
- smoke tests seguros;
- sem carga agressiva;
- sem apagar dados reais;
- prefixo claro para teste;
- limpeza ao final;
- contagem antes/depois.

---

# 100. Regra final para novas sessões do Claude

Antes de implementar qualquer coisa:

1. leia este arquivo;
2. leia `CLAUDE.md`;
3. confira Git;
4. confira schema;
5. confira migrations;
6. confira banco quando necessário;
7. confira se a feature já existe;
8. só então proponha alteração.

Se houver dúvida: **PERGUNTE**.

Não tome decisão de negócio sozinho.

Não confunda:
- padrão com compartilhado;
- Aplicação com Ficha;
- escola com identidade de preenchimento;
- vínculo vivo com snapshot histórico;
- trimestre global com ciclo 1/3;
- cobertura com duplicação de conteúdo.

---

# 101. Estado de confiança deste documento

Este documento reúne tudo que foi relatado e decidido nesta conversa até 03/11/2026.

Ele é abrangente, mas não substitui auditoria do repositório e banco.

Algumas alterações recentes podem estar:
- só locais;
- sem commit;
- sem push;
- com migration já aplicada;
- ainda aguardando correção.

Por isso, antes de executar qualquer mudança sensível, confirmar o estado real atual.

---

# 101-A. Decisões de negócio (homologação de 04/11/2026, seção 15 do relatório)

> Numerada como 101-A para não renumerar o "Registro de alterações" (seção 102), que é citado em vários pontos. Cada decisão indica o **status**: *decisão técnica nossa* (usuário + Claude) ou *depende de aprovação da Secretaria*. **Nada aqui está implementado** até que o Registro de alterações diga o contrário.
> Não existe documento de especificação funcional separado no repositório (só `README.md` da raiz, desatualizado/protótipo, e `backend/README.md`, que é técnico). Por isso as decisões ficam registradas só aqui.
> **Atualização 09/11/2026:** agora existe **`REGRAS_DE_NEGOCIO_NEXO.md`** (raiz) — referência funcional consolidada (todas as regras com ID, status, origem, testes; auditoria de coerência; riscos; plano de implementação). Esta seção 101-A continua sendo o registro detalhado de cada decisão; em caso de dúvida sobre o estado consolidado, ler o documento de regras.

## Quadro geral (atualizado em 09/11/2026)

| # | Tema | Situação |
|---|---|---|
| 1 | Vínculo docente encerrado na janela (DEF-09) | Proposta técnica registrada — pendente Secretaria |
| 2 | Desativar turma/professor/escola durante o ciclo (QUE-01) | Proposta técnica registrada — pendente Secretaria |
| 3 | Abertura de ciclo no passado | Proposta técnica revisada registrada — pendente Secretaria |
| 4 | Reabertura durante outro ciclo / outro trimestre | Proposta técnica provisória registrada — pendente Secretaria |
| 5 | Exclusão de ciclo | Proposta técnica revisada (exclusão definitiva) registrada — pendente Secretaria |
| 6 | Data de início do vínculo editável (histórico real; DEF-03) | Proposta simplificada registrada (mantém data do cadastro) — pendente Secretaria |
| 7 | App abrir sem rede (cachear shell do PWA; LIM-01) | Proposta registrada (alternativa A: exige internet para abrir; corrigir DEF-07 e DEF-06/13 depois) — pendente Secretaria |
| 8 | Duração mínima/máxima da janela do ciclo (+ antecipar prazo para o passado, vindo da Decisão 3) | Proposta registrada (duração: mantém atual; prazo: F ajustada + "Encerrar agora") — pendente Secretaria |
| 9 | Aluno transferido no meio da Aplicação do PDI (+ professor que sai no meio da Aplicação, vindo da Decisão 1) | **Orientação conceitual definida pelo usuário** ("o PDI acompanha o aluno", 8 princípios); testes concluídos; detalhes operacionais (TRF-03 a 08 em `REGRAS_DE_NEGOCIO_NEXO.md`) pendentes da Secretaria |

## Método de trabalho combinado com o usuário (09/11/2026) — seguir nas próximas sessões

- **Uma decisão por vez**, na ordem da seção 15 do relatório de homologação. Nunca apresentar várias de uma vez.
- Cada decisão é apresentada com: (1) situação concreta com exemplo escolar; (2) regra implementada hoje (com arquivo/linha); (3) problema/ambiguidade; (4) alternativas e consequências; (5) recomendação técnica justificada; (6) impactos em PDI, Formulário 1/3, histórico, permissões e indicadores.
- **Durante a discussão: não modificar código, não criar migration, não fazer commit, não alterar regras existentes.**
- **Antes de propor mudança de código:** investigar o que já existe e pode ser aproveitado; evitar novas estruturas, estados e fluxos desnecessários; **não criar campos novos automaticamente**.
- Depois que o usuário decide, **registrar a decisão nesta seção (101-A)** deixando claro o status: *proposta técnica nossa, pendente de aprovação da Secretaria* ou *regra aprovada*. Também documentar riscos técnicos, efeitos colaterais e testes necessários. Quando o usuário revisa uma decisão, **substituir** a proposta anterior e anotar que ela foi descartada.
- Toda decisão, revisão ou achado entra também no **Registro de alterações (seção 102)** no mesmo dia.
- Ao concluir uma decisão, apresentar a próxima.
- Preferências do usuário observadas nas decisões: soluções **simples e mínimas** (ex.: cancelamento em lote em vez de individual; não criar cancelamento de reabertura nem reabertura individual por enquanto); nunca apagar histórico (**exceção explícita: exclusão definitiva de ciclo do 1/3, Decisão 5**); nada sumir sem registro; coerência entre 1/3 e PDI.

## Consolidação e auditoria (09/11/2026)

- **Documento de regras:** `REGRAS_DE_NEGOCIO_NEXO.md` (raiz). ~90 regras com ID (PER, VIN, CAL, UT, PDI, TRF, PRZ, CAN, EXC, OFF, IND), status (Implementada / Definida pelo usuário / Proposta pendente Secretaria / Pendente / Divergência), exemplo, origem, módulos, dependências e testes. **Nenhuma regra tem aprovação formal registrada da Secretaria.**
- **Contradições encontradas (seção 17 do documento, CT1–CT9):** CT1 data de fim retroativa (Dec. 1) × sem retroatividade (Dec. 6) → mais simples: fim = data do registro; CT2 exclusão definitiva (Dec. 5) × preservação → exceção limitada; CT3 reabertura sobre outro ciclo × regra 70 → regra 70 vale para janelas originais; CT4 abertura atual (Dec. 3) + tudo no trimestre (regra 62) → últimas semanas registradas até o último dia do trimestre (decisão da Secretaria); CT5 princípio 8 da Dec. 9 × regra 37 (edição após concluir por quem for responsável agora) → concluída por outro = somente leitura; CT6 regra 25 × DEF-14 (defeito); CT7 esperado estável (Dec. 2) × código que ignora inativos só durante o ciclo (confirmar com teste); CT8 Dec. 1 "Secretaria" × Diretora também encerra vínculos/desativa professores; CT9 princípio 7 × DEF-17 (defeito).
- **Simplificações recomendadas (S1–S8):** encerrar vínculo sem data e sem colunas novas (motivo só no lote); um único fluxo de lote para os 5 caminhos; lote sem tabela (status `CANCELADA` + eventos); "Encerrar agora" sem estado; Decisões 6, 7 e duração da 8 sem código; avaliar tirar "Inativar" quando houver "Excluir"; leitura de histórico do PDI reaproveitando Correções e Ficha Anual; nada de auditoria genérica/aprovação/configuração.
- **Offline × operações administrativas:** fila de ciclo excluído **não recria dados** (gravação exige o ciclo; ids não se repetem), mas fica repetindo erro para sempre; entrega cancelada poderia ser editada por sincronização atrasada (a gravação não olha o status) → proposta CAN-04 (recusar) e OFF-05 (parar de repetir e avisar).
- **Riscos priorizados:** seção 18 do documento (R1 perda do texto comum do PDI; R2 perda prática offline; R3 PDI inacessível após transferência + DEF-17; R4 alteração de concluídos; R5 indicadores mudando para trás; R6 exclusão irreversível; R7 sincronização atrasada; R9 três caminhos de encerramento sem checar pendências; R10 divergências interface × servidor).
- **Plano de implementação:** seção 19 do documento (Grupo A defeitos, B decisões, C testes, D organização), com prioridade, dependências, risco, complexidade e testes. **Nada iniciado.** Ordem sugerida: D6 (confirmar push/deploy) e D1 (node_modules) → A1 (DEF-14), A2 (DEF-17), A3 (DEF-07) → C8 (confirmar CT7) e C1 (perfis) → A4–A6 → D7 (levar à Secretaria) → B1/B2 → B3/B4 → B5–B7 → restante.

## Próximos passos (depois das 9 decisões) — ordem sugerida, nada iniciado
> **Substituído em 09/11/2026** pelo plano da seção 19 de `REGRAS_DE_NEGOCIO_NEXO.md` (mais completo). A lista abaixo fica como registro.

1. Levar as propostas 1–9 para aprovação da Secretaria (nenhuma está aprovada).
2. Corrigir defeitos médios da homologação que não dependem de decisão: DEF-01 (troca de semana com rede lenta), DEF-06/DEF-13 (aviso offline cobre botões), DEF-07 (fila offline não enviada ao abrir o app), DEF-08 (conflito da fila sem opção de resolução). Depois os baixos (DEF-02, 10, 11, 12) e o achado de acessibilidade do login (labels sem `htmlFor`).
3. Implementar as decisões só depois de aprovadas (DEF-09 depende das Decisões 1 e 2).
4. Limpeza do Git em commit separado: tirar `node_modules/` (3.331 arquivos rastreados), `dist/` e `.vite/` do versionamento (proposta descrita no registro de 04/11/2026).
5. Decidir o que da pasta `homologacao/` entra no Git (scripts e relatórios sim; `pgdata/`, `node_modules/`, `.senhas.json` e possivelmente as ~12 MB de evidências não).
6. Commitar `CLAUDE_CONTEXT.md` + `RELATORIO_HOMOLOGACAO_NEXO_PDI_1_3.md` **somente quando o usuário pedir**.
7. Itens não executados na homologação (seção 16 do relatório): viradas de dia/mês/trimestre/ano, perfis Diretora/Gestor/Auxiliar, celular físico etc.

## Decisão 1 — Encerramento de vínculo docente e pendências (DEF-09)

**Status:** PROPOSTA TÉCNICA (usuário + Claude, 09/11/2026). **Ainda NÃO aprovada pela Secretaria. NÃO implementar** até aprovação explícita.

**Problema (DEF-09):** professor cujo vínculo Professor×Turma×Disciplina é encerrado dentro da janela de um ciclo do 1/3 continua contando como "esperado" no painel (regra 68), mas não vê o formulário e não pode gravar (exige vínculo ATIVO). A obrigação fica "Não iniciada"/"Em andamento" para sempre e derruba o % de entrega.

**Proposta:**
- A Secretaria pode encerrar manualmente um vínculo docente informando **data** e **motivo**.
- Antes de confirmar, o sistema identifica e mostra as **pendências afetadas** (Formulário 1/3 e, se aplicável, PDI), para a Secretaria decidir como tratá-las.
- **Cancelamento EM LOTE (simplificação aprovada pelo usuário em 09/11/2026):** a Secretaria tem só duas opções, numa única ação:
  - **"Cancelar todas as pendências afetadas"** — uma única justificativa (obrigatória) para o lote inteiro;
  - **"Manter pendências"** — nada é cancelado; as pendências continuam no painel.
  - **Não há seleção nem cancelamento individual** de formulários neste fluxo.
- **O sistema exclui automaticamente do lote:** formulários **concluídos** e obrigações **ainda válidas por outro vínculo** (no 1/3: o professor continua com vínculo ATIVO no mesmo ano/série + disciplina; ver regra 66). Esses nem aparecem como canceláveis.
- **Registro do lote:** responsável, data/hora, justificativa e **quantidade de cancelamentos**.

**Regras propostas:**
1. Não apagar vínculos, formulários ou históricos.
2. Preservar formulários já concluídos (continuam contando como entregues; nunca entram no lote).
3. Preservar rascunhos: o conteúdo de rascunho cancelado continua guardado e legível (não editável).
4. Cancelamento não conta como entrega.
5. Cancelamentos aparecem separados nos indicadores (fora do denominador do %; contador próprio).
6. Não cancelar obrigação compartilhada enquanto houver outro vínculo elegível (excluída automaticamente do lote).
7. Registrar responsável, data, justificativa e quantidade de cancelamentos de toda decisão administrativa.

**Registro do lote sem tabela nova (sugestão, a confirmar na implementação):** cada entrega cancelada recebe um evento `CANCELADA` em `HistoricoEntregaUmTerco` (`pessoaId` = responsável, `quando` = data) com `detalhe` = `{ loteId, justificativa, origem (encerramento de vínculo / desativação de turma, professor ou escola), quantidadeNoLote }`. A quantidade e a lista do lote saem da contagem dos eventos com o mesmo `loteId`. Só criar uma tabela de lotes se for preciso listar lotes vazios ou consultá-los fora do 1/3 (ex.: PDI).

**O que JÁ existe e pode ser aproveitado (investigado em 09/11/2026):**
- **Encerramento manual de vínculo docente já existe:** `POST /professor-turma-disciplina/:id/encerrar` (`backend/src/api/routes/professorTurmaDisciplina.ts`), botão "Encerrar" em `src/pages/GestaoPessoas.jsx` (modal "Turmas e disciplinas"). Hoje: **sem data escolhida** (`dataFim = hoje`), **sem motivo**, **sem registro de quem encerrou**, **sem confirmação** e **sem checar pendências**. Permitido a **Secretaria e Diretora** (`exigirSecretariaOuDiretora`, Diretora restrita à própria escola).
- **Status e datas do vínculo:** `ProfessorTurmaDisciplina.status` (ATIVO/ENCERRADO) + `dataFim` — nada novo é necessário para o encerramento em si.
- **Histórico da entrega 1/3:** `HistoricoEntregaUmTerco` (tipo + `pessoaId` + `quando` + `detalhe Json`) — serve para registrar o cancelamento (quem, quando, justificativa no `detalhe`) sem tabela nova.
- **Cobertura:** `CoberturaEntregaUmTerco.ate` já recebe o fim do vínculo (`sincronizarCobertura`); evento `COBERTURA_ENCERRADA` já existe.
- **Padrão de motivo + autor:** `ReaberturaUmTerco` (`motivo`, `createdBy`) e `PessoaEvento` (log append-only com `autorId` e `detalhe`) — modelos a imitar, não necessariamente a reutilizar.
- **Cálculo de pendências:** `vinculosElegiveis()` + a montagem do painel (`formularioUmTerco.ts`) já sabem, por professor+ano/série+disciplina, quem é esperado e qual o status — dá para reaproveitar para listar "pendências afetadas" antes do encerramento.

**Mínimo de estrutura nova que seria necessário (estimativa, não implementado):**
- `StatusEntregaUmTerco` ganha `CANCELADA` e `TipoEventoEntregaUmTerco` ganha `CANCELADA` (migration aditiva de enum). Obrigação **não iniciada** não tem linha em `EntregaUmTerco` (o "esperado" é derivado dos vínculos); para cancelá-la seria preciso criar a entrega já como `CANCELADA` (sem respostas) — aproveita a unicidade `ciclo+professor+anoSerie+disciplina` em vez de tabela nova.
- Motivo e autor do encerramento do vínculo: duas colunas opcionais em `ProfessorTurmaDisciplina` (`motivoEncerramento`, `encerradoPorId`) **ou** um evento no `PessoaEvento` (exigiria novo valor de enum e `detalhe` tem só 200 caracteres). Preferência: colunas opcionais (aditivo, consultável).
- Nenhuma tela nova obrigatória: o modal de encerramento em `GestaoPessoas.jsx` ganharia data, motivo e a lista de pendências; o painel do 1/3 ganharia o status/contador "Cancelada".

**Riscos técnicos e efeitos colaterais:**
- **Há outros dois caminhos que encerram vínculo docente sem passar por esse fluxo:** (a) criar vínculo para outro professor na mesma turma+disciplina encerra o anterior automaticamente (`professorTurmaDisciplina.ts`, substituição); (b) encerrar o **vínculo escolar** encerra em cascata todos os vínculos docentes daquela escola (`vinculosEscolares.ts`). Se só o botão "Encerrar" checar pendências, o DEF-09 continua por esses caminhos. Precisam chamar a mesma checagem, ou o painel precisa permitir "Cancelar administrativamente" **depois** (recomendado ter os dois: no encerramento e no painel, para casos legados e cascatas).
- **Data informada pela Secretaria:** data **retroativa** pode cair antes de gravações já feitas pelo professor (cobertura/histórico ficam incoerentes) ou antes do `dataInicio`; data **futura** exigiria vínculo "a encerrar" (hoje o status muda na hora; não há agendador). Proposta: aceitar só `dataInicio ≤ data ≤ hoje`; regra exata a definir.
- **Diretora:** hoje a Diretora também encerra vínculo. A proposta fala em "Secretaria". Definir se a Diretora mantém o encerramento simples e só a Secretaria cancela pendências (risco de a Diretora encerrar e deixar DEF-09 sem tratamento).
- **Recalcular passado:** o painel é derivado; um cancelamento em ciclo já encerrado muda o % daquele ciclo. Definir se cancelamento é permitido após o prazo.
- **Reativação/novo vínculo depois do cancelamento:** se o professor volta à mesma série+disciplina dentro da janela, a entrega `CANCELADA` bloqueia (unicidade) a criação de uma nova. Precisa regra: "descancelar" (voltar a EM_ANDAMENTO, com evento) ou manter cancelada.
- **Offline:** professor com edição na fila offline quando o vínculo é encerrado recebe 403 ao sincronizar; não foi verificado como a fila trata 403 (risco de ficar presa ou de mostrar "Salvo"; relacionado a DEF-07/DEF-08).
- **Concorrência:** professor salvando no mesmo instante do cancelamento — precisa da mesma trava/`updatedAt` do 1/3 para não "ressuscitar" a entrega.
- **PDI:** a ficha é de Aplicação+aluno+disciplina e o responsável é quem tem o vínculo ATIVO da turma+disciplina (sucessor assume). Logo, no PDI a obrigação normalmente **não deve ser cancelada** quando há substituto; cancelamento lá só faria sentido se a turma ficar sem professor. Proposta: na 1ª fase, o fluxo **lista** as fichas PDI afetadas mas só oferece cancelamento para o 1/3. Não verificado ainda como o PDI conta pendências sem professor.

**Testes necessários para implementação segura:**
- Domínio: encerrar com/sem vínculo equivalente ativo (regra 6); entrega concluída preservada; rascunho cancelado mantém respostas e fica só leitura; não iniciada cancelada cria entrega CANCELADA sem respostas; cancelamento fora do % e no contador próprio.
- Servidor: permissões (Secretaria sim; Diretora conforme regra; Professor/Gestor 403); justificativa obrigatória; data fora do intervalo recusada; cancelar duas vezes (idempotência/409); professor tenta gravar entrega cancelada (recusado); corrida salvar × cancelar.
- Caminhos indiretos: substituição de professor e encerramento de vínculo escolar em cascata geram a lista de pendências / não deixam obrigação órfã.
- Reativação ou novo vínculo equivalente após cancelamento (comportamento definido).
- Painel/indicadores: esperado, concluído, em andamento, não iniciado, cancelado e % batendo com contagem manual (repetir P08 da homologação: 21 → 20 esperados + 1 cancelada).
- Histórico: evento CANCELADA com pessoa, data e justificativa; nada apagado (contagens de tabelas antes/depois).
- Offline: fila com edição pendente quando o vínculo é encerrado.
- Navegador real: modal de encerramento (desktop e celular), mensagens claras.
- Regressão: bateria `testar-integracao.ts` (50 casos) e scripts de homologação 13/14.
- Lote: só concluídas e cobertas por outro vínculo → lote vazio (não cancelar nada, não registrar lote com 0 ou registrar e informar 0, a definir); "Manter pendências" não grava nada; quantidade registrada = quantidade efetivamente cancelada; dois lotes simultâneos não cancelam a mesma entrega duas vezes.

## Decisão 2 — Desativar turma, professor ou escola durante o ciclo (QUE-01)

**Status:** PROPOSTA TÉCNICA (usuário + Claude, 09/11/2026). **Ainda NÃO aprovada pela Secretaria. NÃO implementar.**

**Comportamento atual (lido no código; parte testada na homologação):**
- Desativar turma/professor/escola só muda o `status`; os vínculos `ProfessorTurmaDisciplina` continuam ATIVOS (professor desativado também tem a sessão derrubada).
- `vinculosElegiveis()` (`formularioUmTerco.ts`): **com ciclo em curso**, vínculo de turma/professor/escola inativa é ignorado → obrigação **não iniciada some** do painel e da tela do professor (P15: 21 → 20, testado). Obrigação iniciada/concluída permanece (P11, testado). Reativar restaura (testado).
- **Depois do prazo** esse filtro não é aplicado → pelo código, a obrigação que sumiu **volta** como "Não iniciada" e o % do ciclo muda depois de encerrado. **Dedução da leitura do código, NÃO testada.**
- Rascunho de professor desativado fica "Em andamento" para sempre (mesmo problema do DEF-09).

**Proposta:** reaproveitar o fluxo da Decisão 1, **sem encerrar vínculos**:
- Ao desativar turma, professor ou escola **com janela de ciclo aberta**, o sistema mostra as pendências afetadas e a Secretaria escolhe, em lote: **"Cancelar todas as pendências afetadas"** (uma justificativa) ou **"Manter pendências"** (para situação temporária, ex.: licença).
- "Manter": a obrigação continua contando e aparece no painel marcada (professor inativo / turma inativa / escola inativa).
- O cálculo de "esperado" passa a ser o **mesmo durante e depois do ciclo**: nenhuma obrigação some ou volta sozinha; só sai do % por cancelamento explícito.
- Mesmas exclusões automáticas e mesmo registro do lote da Decisão 1.
- Desativar continua diferente de encerrar vínculo: reativar devolve tudo (licença temporária continua funcionando).

**Custo aceito:** turma criada por engano exige que a Secretaria cancele as pendências (antes sumiam sozinhas).

**Impactos:** backend (cálculo do esperado; rotas de desativar turma/professor/escola devolvem pendências antes de confirmar); frontend (etapa de confirmação nas telas de Turmas, Pessoas e Escolas; marcação "inativo" no painel do 1/3); banco: nada além do previsto na Decisão 1. **A verificar antes de implementar:** quais perfis podem desativar professor (`mudarStatusProfessor`); como o PDI trata turma/professor inativo nas pendências.

**Testes necessários (além dos da Decisão 1):** confirmar primeiro, no banco local, que a obrigação volta depois do prazo (comportamento atual); desativar e reativar com "Manter"; desativar com "Cancelar"; esperado idêntico durante e depois do ciclo; escola desativada com várias turmas (um único lote); professor com vínculos em duas escolas e só uma desativada (a outra continua válida e fica fora do lote).

## Decisão 3 — Abertura de ciclos do 1/3 no passado (revisada em 09/11/2026)

**Status:** PROPOSTA TÉCNICA (usuário + Claude). **Ainda NÃO aprovada pela Secretaria. NÃO implementar.**

**Substitui a proposta anterior:** a alternativa B apresentada antes ("bloquear só ciclo cujo prazo já passou, aceitando abertura no passado") **foi descartada pelo usuário**.

**Comportamento atual:** a criação/edição de ciclo (`validarCiclo` em `backend/src/domain/umTerco.ts`) não compara com a data de hoje; ciclo com janela inteira no passado é aceito (homologação UT-T-S10/S12). O PDI, ao contrário, já exige Aplicação com início ≥ hoje (`pdiAplicacoes.ts`).

**Proposta revisada:**
- A **abertura** de um **novo** ciclo deve ser **atual ou futura**, nunca retroativa.
- O **prazo** deve ser posterior à abertura, dentro do trimestre (regra 62) e sem sobreposição com outro ciclo (regra 70) — regras já existentes, mantidas.
- O **período pedagógico de referência** (as semanas do ciclo) **pode ser anterior à abertura**. Não confundir período de referência com janela de disponibilidade.
- Fica alinhado ao PDI (início ≥ hoje).

**Essa distinção JÁ EXISTE no modelo atual (verificado, nenhum campo novo necessário):**
- **Janela de disponibilidade** = `CicloUmTerco.abreEm` / `prazoEm` (quando o professor pode preencher).
- **Período de referência** = `SemanaUmTerco.dataInicio` / `dataFim` (as semanas sobre as quais o professor registra "Conteúdos ensinados").
- Hoje as semanas **não são comparadas** com a abertura/prazo; só precisam estar dentro do trimestre. Ou seja, semanas anteriores à abertura **já são aceitas**. A proposta não exige mudar isso.
- **Compatibilidade com a especificação:** a regra 62 exige que **todas** as datas (abertura, prazo e semanas) fiquem dentro do **mesmo** trimestre. Logo, o período de referência pode ser anterior à abertura **somente dentro do mesmo trimestre**.

**Impactos e pontos a decidir (Secretaria):**
- **Conflito potencial com a regra 62:** com abertura ≥ hoje e abertura dentro do trimestre, **não dá para criar ciclo sobre um trimestre já encerrado**, e as **últimas semanas de um trimestre** só podem ter janela até o último dia desse trimestre (ex.: 3º tri termina 18/12; conteúdos da semana 14–18/12 precisariam ser registrados até 18/12). Se a Secretaria quiser janela **depois** do fim do trimestre, a regra 62 teria de mudar para abertura/prazo (as semanas continuariam presas ao trimestre). Não decidido.
- **"Atual":** sugestão de tolerância = data de abertura ≥ **hoje** (fuso America/Sao_Paulo), qualquer horário do dia, para não recusar quem preenche o formulário devagar. A confirmar.
- **Edição:** a regra vale para a abertura **só quando ela é alterada**; ciclo já aberto continua editável (título, prazo, datas das semanas) sem ser recusado por ter abertura no passado. Mover a abertura de ciclo já aberto e com entregas para o futuro deixaria o ciclo "agendado" com entregas existentes — sugestão: não permitir alterar a abertura depois que o ciclo abriu. A confirmar.
- **Prazo movido para antes de agora na edição** (antecipar/encerrar o ciclo): não coberto por esta revisão; tratar junto com a Decisão 8.
- Backend: `validarCiclo` passa a receber "agora" (para testes). Frontend: limite mínimo no campo de abertura e **mensagem própria** (não o balão nativo do navegador, lição do DEF-11). Banco: nenhuma alteração. Ciclos já existentes não são afetados.

**Testes necessários (Decisão 3):** abertura ontem (recusada), hoje em horário já passado (aceita, se a tolerância for aprovada), futura (aceita); semanas anteriores à abertura no mesmo trimestre (aceitas); semanas em outro trimestre (recusadas, como hoje); edição de ciclo aberto sem mudar a abertura (aceita); tentativa de mudar a abertura de ciclo com entregas; prazo ≤ abertura (recusado); regressão `testar-dominio.ts`/`testar-integracao.ts` (usam 2099; não devem quebrar); scripts de homologação UT-T-S10/S12 passam a esperar recusa (ciclos no passado só por ajuste direto no banco local).

## Decisão 4 — Reabertura do 1/3 durante outro ciclo ou em outro trimestre

**Status:** PROPOSTA TÉCNICA PROVISÓRIA (usuário + Claude, 09/11/2026), versão simplificada da alternativa C. **Ainda NÃO aprovada pela Secretaria. NÃO implementar.**

**Comportamento atual:** `validarReabertura` (`backend/src/domain/umTerco.ts`) só exige fim > início e nenhuma sobreposição com outra reabertura **do mesmo ciclo**. Aceita reabertura no passado, dentro da janela original, coincidindo com outro ciclo (UT-REA-03) e em outro ano (UT-REA-05). Motivo opcional. Reabertura vale para o ciclo inteiro, não altera o prazo original e **não pode ser editada nem excluída** (não há rota).

**Regras propostas:**
1. Reabertura **pode** coincidir com a janela de outro ciclo, **excepcionalmente** (interpretação: a regra 70 vale para as janelas originais dos ciclos; reabertura é exceção corretiva). Recomendado: aviso à Secretaria ao criar.
2. Reabertura **pode** cair em outro trimestre, **somente dentro do mesmo ano letivo** do ciclo (limite sugerido: fim do 3º trimestre daquele ano em `PeriodoTrimestre`; se o 3º trimestre não estiver configurado, recusar — a confirmar).
3. Início **atual ou futuro** (mesma lógica da Decisão 3) e término **posterior** ao início.
4. **Justificativa obrigatória** (hoje `motivo` é opcional; pode ser exigido só na validação, sem migration).
5. Janela e prazo originais preservados (já é assim).
6. O professor deve ver claramente que o ciclo está **reaberto**, incluindo o **período pedagógico de referência** (semanas). Hoje a lista do professor (`GET /minhas`) devolve título, trimestre, abertura, prazo e status, mas **não** as semanas nem um indicador de reabertura — seria preciso acrescentar esses campos à resposta (mudança aditiva de contrato) e ao cartão no frontend.
7. **Fora de escopo por enquanto:** cancelar/editar reabertura e reabertura individual (por professor).

**Investigação 1 — reabertura permite modificar formulário já concluído? SIM (comportamento atual, NÃO alterar sem decisão específica):**
- `exigirEditavel` só checa ciclo ativo, janela (original **ou** reabertura) e vínculo ativo; **não olha o status da entrega**. Durante a reabertura, o professor edita entregas CONCLUÍDAS normalmente (coerente com a regra 63, que permite editar após concluir enquanto a janela está aberta).
- A entrega continua `CONCLUIDA` e `concluidaEm` **não muda**; a edição só aparece no histórico (evento `SALVA` com data posterior ao prazo). O painel não distingue "concluída e alterada depois do prazo".
- **Achado lateral (não testado):** a gravação não exige que uma entrega já concluída continue com todas as semanas preenchidas; apagar o texto de uma semana deixa a entrega `CONCLUIDA` com semana vazia (vale também dentro da janela original). Registrado, não corrigido.

**Investigação 2 — restrição de vínculos históricos em reabertura de outro trimestre (leitura de código, NÃO testado):**
- Para preencher, o professor precisa de vínculo **ATIVO** entre os elegíveis do ciclo: vínculo com início ≤ prazo original, (ATIVO ou fim ≥ abertura), turma do Fundamental do **mesmo ano letivo**.
- Consequências numa reabertura posterior (ex.: ciclo do 2º tri reaberto no 3º tri):
  - professor que **mantém o mesmo vínculo** → preenche normalmente;
  - professor cujo vínculo **foi encerrado** depois (mudou de turma, saiu) → **não preenche** (mesmo caso do DEF-09; tratamento = Decisão 1);
  - **substituto** cujo vínculo começou **depois do prazo original** → não é elegível, não vê o formulário (correto: não era responsável);
  - professor que trocou de turma mas **continua** no mesmo ano/série + disciplina com vínculo **novo** (início depois do prazo) → o antigo está encerrado e o novo não é elegível → **não preenche**. Ponto a decidir.
  - **Inconsistência:** durante a janela original, vínculo de turma/professor/escola **inativa** é ignorado; depois do prazo (portanto durante qualquer reabertura) esse filtro **não é aplicado** (`cicloEmCurso` falso). Professor com vínculo ATIVO numa **turma inativa** pode conseguir preencher na reabertura, mas não conseguia na janela original. Relacionado à Decisão 2.
- Em resumo: reabertura em outro trimestre só serve a quem ainda tem o mesmo vínculo; obrigações de quem saiu continuam impossíveis e devem ser tratadas pelo cancelamento em lote (Decisões 1 e 2).

**Riscos:** professor escrever no ciclo errado quando há dois abertos (mesmo ano/série + disciplina) — mitigado pela regra 6; reabertura criada com erro não pode ser desfeita (fora de escopo por decisão); edição de concluída após o prazo sem marca no painel; casos de vínculo acima.

**Impactos:** backend (validação da reabertura recebe "agora" e o fim do ano letivo; justificativa obrigatória; aviso de coincidência com outro ciclo; campos novos em `GET /minhas`); frontend (form de reabertura com aviso e mensagens próprias; cartão do professor com "Reaberto" e período de referência); banco: nenhuma alteração; permissões: só Secretaria (inalterado); indicadores: sem impacto direto. **PDI:** existe `ReaberturaPdi`; suas validações **não foram verificadas** — conferir antes de implementar, por coerência.

**Testes necessários:** reabertura com início no passado (recusada), atual e futura (aceitas); fim ≤ início (recusada); no próximo ano letivo (recusada); em outro trimestre do mesmo ano (aceita); coincidindo com outro ciclo (aceita, com aviso); sem justificativa (recusada); prazo original inalterado; professor edita concluída durante a reabertura (status e `concluidaEm` mantidos — comportamento atual preservado); cenários de vínculo da Investigação 2 (incluindo turma inativa); cartão do professor mostra "Reaberto" e semanas; regressão das baterias existentes.

## Decisão 5 — Exclusão definitiva de ciclo do 1/3 (revisada em 09/11/2026)

**Status:** PROPOSTA TÉCNICA (usuário + Claude). **Ainda NÃO aprovada pela Secretaria. NÃO implementar.**

**Substitui a proposta anterior:** a recomendação "A — não criar exclusão; inativar só sem entregas" (com C/D como opções) **foi descartada pelo usuário**.

**ATENÇÃO — exceção consciente a princípios do projeto:** esta decisão é uma exceção explícita, restrita ao ciclo do Formulário 1/3, ao princípio "nunca apagar histórico/formulários" (regra 1 das Decisões 1 e 2; seção 79 "Histórico do 1/3"). Fora deste fluxo, o princípio continua valendo.

**Regras propostas:**
1. Exclusão **exclusiva da Secretaria** (validada no servidor, não só na tela).
2. Confirmação explícita informando que **todos os formulários, respostas e preenchimentos** do ciclo serão **apagados permanentemente**.
3. Informar que a operação é **irreversível**.
4. Exigir confirmação antes de executar.
5. Excluir o ciclo e os dependentes numa **única transação atômica**, sem registros órfãos.
6. Depois da exclusão, o ciclo não aparece em listagens nem indicadores.
7. **Não preservar** histórico dos preenchimentos excluídos.
8. Não afetar outros ciclos, vínculos docentes, turmas, professores, escolas, disciplinas, calendário ou dados do PDI.
9. Permitida mesmo com preenchimentos (inclusive concluídos).

**Dependências do ciclo examinadas no `schema.prisma` (09/11/2026):**

| Tabela | Ligação | `onDelete` hoje | Na exclusão |
|---|---|---|---|
| `historico_entrega_um_terco` | → entrega | Cascade | **apagar** (eventos das entregas do ciclo) |
| `cobertura_entrega_um_terco` | → entrega (Cascade); → vínculo, turma, escola (Restrict) | Cascade pela entrega | **apagar** só as linhas; vínculo, turma e escola **intactos** |
| `respostas_semana_um_terco` | → entrega (Cascade); → semana (**Restrict**) | misto | **apagar** antes das semanas (senão o Restrict bloqueia) |
| `entregas_um_terco` | → ciclo (**Restrict**); → professor, disciplina (Restrict) | Restrict | **apagar** (professor e disciplina intactos) |
| `reaberturas_um_terco` | → ciclo (**Restrict**) | Restrict | **apagar** |
| `semanas_um_terco` | → ciclo (Cascade) | Cascade | **apagar** depois das respostas |
| `ciclos_um_terco` | — | — | **apagar** por último |

- Nenhuma outra tabela referencia essas sete (conferido no schema; no backend só `formularioUmTerco.ts`, `umTerco.ts` e `app.ts` usam o módulo; o PDI não referencia nada do 1/3).
- **Sem cascata indiscriminada:** apagar **explicitamente, nesta ordem**, com `deleteMany` filtrado por `cicloId` / `entrega.cicloId`: histórico → cobertura → respostas → entregas → reaberturas → semanas → ciclo. **Não alterar** os `onDelete` atuais (sem migration). Os `Restrict` existentes ficam como rede de segurança: se algo for esquecido, a transação falha em vez de deixar órfão.
- **Nunca removidos:** `professor_turma_disciplinas`, `turmas`, `escolas`, `pessoas`, `disciplinas`, `periodos_trimestre`, tabelas do PDI, outros ciclos.
- A confirmação deve mostrar as **quantidades** que serão apagadas (entregas, concluídas, em andamento, respostas, reaberturas), contadas na hora.

**Riscos técnicos e efeitos colaterais:**
- **Gravação simultânea:** o professor salvando cria entrega que referencia o ciclo. A exclusão deve travar o ciclo (`SELECT ... FOR UPDATE`); a gravação concorrente falhará por chave estrangeira depois do commit — precisa virar resposta clara ("ciclo excluído", 404), não erro 500.
- **Offline:** item na fila (IndexedDB) de ciclo excluído recebe erro ao sincronizar; pela leitura de `src/offline/syncQueue.js`, erro de negócio fica com status `error` e é **tentado de novo a cada sincronização**, indefinidamente; o **rascunho local** do professor continua no aparelho. Precisa tratar "ciclo excluído" descartando o item da fila e o rascunho. Não testado.
- **Tela aberta:** professor com o formulário aberto recebe erro ao salvar; mensagem precisa ser clara.
- **Auditoria do ato:** a regra 7 manda não preservar o histórico **dos preenchimentos**. **Não está decidido** se o próprio ato (quem, quando, qual ciclo, quantos registros) deve ficar registrado em algum lugar; hoje não há tabela de auditoria genérica (só `PessoaEvento`). **Ponto a decidir.**
- **Recuperação:** irreversível no sistema; só restauração de backup do Neon (seção 96). Avisar a Secretaria.
- Indicadores já divulgados daquele ciclo deixam de existir.
- `inativar`/`reativar` continuam existindo; excluir é ação adicional.

**Impactos:** backend (rota nova de exclusão, só Secretaria, transação com ordem explícita; rota de contagem para a confirmação); frontend (botão "Excluir" na tela de ciclos da Secretaria, modal com quantidades, aviso de irreversível e confirmação explícita; tratar "ciclo excluído" no preenchimento e na fila offline); banco: **nenhuma migration**; PDI: nenhum; permissões: só Secretaria.

**Testes necessários:** exclusão sem entregas, com rascunhos e com concluídas; contagem das 7 tabelas antes/depois (somem só as linhas do ciclo; outro ciclo intacto); vínculos, turmas, pessoas, escolas, disciplinas, calendário e PDI com contagens idênticas; Professor/Diretora/Gestor recebem 403; ciclo inexistente 404; falha no meio desfaz tudo (atomicidade); exclusão × gravação simultânea (sem 500, sem órfão); fila offline e rascunho local; ciclo some de `GET /ciclos`, `GET /minhas` e do painel; janela liberada pode ser usada por outro ciclo; regressão das baterias existentes.

## Decisão 6 — Data de início do vínculo docente (DEF-03) (simplificada em 09/11/2026)

**Status:** PROPOSTA TÉCNICA (usuário + Claude). **Ainda NÃO aprovada pela Secretaria.** Na prática **mantém o comportamento atual** — nada a implementar.

**Substitui a proposta anterior:** a alternativa B (informar data de início retroativa no cadastro, com limites e aviso de obrigação retroativa) **foi descartada pelo usuário**.

**Regra proposta:**
1. Para o Formulário 1/3, o professor participa **a partir da data em que o vínculo é cadastrado no Nexo**, independentemente de quando começou a trabalhar na escola na realidade.
2. **Não** criar obrigações retroativas.
3. **Não** permitir informar nem editar retroativamente a data de início.
4. **Não** recalcular ciclos anteriores por causa de cadastro atrasado.
5. Manter o comportamento atual: `dataInicio` = data do cadastro (`professorTurmaDisciplina.ts`, criação e substituição).

**Situação atual confirmada (09/11/2026):**
- Todo vínculo nasce com `dataInicio = hoje`; não há campo na tela nem rota de edição.
- A data de início só é usada pelo **1/3** (elegibilidade "início ≤ prazo do ciclo" e `CoberturaEntregaUmTerco.desde`). O **PDI não usa datas de vínculo** (todas as consultas do PDI usam só `status: 'ATIVO'`).
- Consequência aceita: professor cadastrado depois do prazo de um ciclo não participa desse ciclo, mesmo que tenha lecionado no período. Com a Decisão 3 (abertura atual/futura), ciclos novos não são afetados pelo cadastro inicial em massa na implantação.
- DEF-03 (homologação) fica **encerrado como "não será feito"** por decisão. Vínculos com datas históricas continuam possíveis só por ajuste direto no banco **de teste** (como P07–P15 na homologação).

**Ponto de coerência a decidir (não decidido):** a Decisão 1 propõe que a Secretaria informe a **data de encerramento** do vínculo, aceitando `dataInicio ≤ data ≤ hoje` — ou seja, **fim retroativo**, que pode alterar quem era esperado em ciclos já passados. Pelo espírito desta Decisão 6 ("não recalcular ciclos anteriores"), talvez o fim também deva ser sempre a data do registro. A confirmar quando a Decisão 1 for implementada.

**Impactos:** nenhum código, banco, permissão ou indicador muda. **Testes:** nenhum novo; manter a regressão atual (vínculo criado hoje não entra em ciclo com prazo passado).

## Decisão 7 — App abrir sem internet (LIM-01) (09/11/2026)

**Status:** PROPOSTA TÉCNICA (usuário + Claude), alternativa A. **Ainda NÃO aprovada pela Secretaria.** Mantém o comportamento atual; as correções relacionadas ficam para depois.

**Regra proposta:**
1. O Nexo **continua exigindo internet para abrir e carregar** os formulários.
2. Se a conexão cair **durante** o preenchimento, o trabalho continua sendo salvo localmente pelos recursos offline já existentes (`src/offline/`: rascunho + fila, seções 44–48), e é enviado quando a conexão volta.
3. **Não** implementar cache completo do aplicativo (shell HTML/JS/CSS) nem cache dos dados dos formulários. `public/sw.js` continua guardando só manifest, favicon e ícones (decisão original: nunca cache de dado autenticado/API; nunca servir app desatualizado).

**Correções a priorizar depois (registradas, NÃO feitas):**
- **DEF-07:** ao **reabrir** o Nexo com internet, sincronizar automaticamente a fila offline pendente, respeitando **autenticação** (só com sessão válida; fila de outro usuário não é enviada), **permissões** (o servidor continua validando vínculo/prazo em cada envio) e **prevenção de conflitos** (token `updatedAt`, 409 `CONFLITO_VERSAO`, nunca last-write-wins). Hoje a fila só é enviada ao enfileirar com rede ou ao detectar reconexão.
- **DEF-06 / DEF-13:** o aviso offline (`z-40`) encobre os botões Próximo/Salvar/Concluir do 1/3 e Salvar do PDI — corrigir.
- Relacionado: DEF-08 (conflito vindo da fila sem opção de resolução) continua na lista.

**Cuidados obrigatórios na correção:**
- **Preservar os rascunhos locais até confirmar que foram sincronizados** (só remover após resposta 2xx — já é a regra da seção 45; manter).
- **Computadores compartilhados:** nunca expor dados de um professor a outro. Situação atual (lida no código): fila e rascunhos ficam no IndexedDB com chave que inclui o `userId` (e-mail); `flushTudo(userId)` só lê e envia itens do usuário logado; no logout **nada é apagado** (só deixa de ser lido). Ou seja: pela interface um professor não vê o rascunho de outro, mas os dados continuam **fisicamente** no navegador até o dono voltar e sincronizar. A correção do DEF-07 **não pode** enviar nem exibir itens de outro usuário. Avaliar com a Secretaria se rascunho de outro usuário parado no aparelho é aceitável (alternativa seria expiração), sem apagar trabalho não sincronizado.

**Futuro (não agora):** offline completo (alternativa C: cache do app + dados dos formulários abertos) só se a Secretaria indicar escolas com conectividade muito ruim; seria um projeto próprio.

**Pendente da Secretaria:** confirmar a realidade de conectividade das escolas e a orientação de uso aos professores ("abrir o formulário com internet; se cair, continuar digitando").

**Impactos:** nenhum código agora. Comunicação: orientação curta aos professores. **Testes das correções futuras:** digitar offline → fechar → reabrir com internet → fila enviada sem abrir o formulário; dois professores no mesmo navegador (a fila de A não é enviada nem mostrada com B logado; quando A volta, a dele é enviada); rascunho só removido após 2xx; sessão expirada com fila pendente; conflito na fila ao abrir; botões clicáveis com aviso offline (desktop e celular).

## Decisão 8 — Duração da janela e alteração do prazo do ciclo (09/11/2026)

**Status:** PROPOSTA TÉCNICA (usuário + Claude). **Ainda NÃO aprovada pela Secretaria. NÃO implementar.**

**Duração — alternativa A (mantém o atual):**
- Não criar duração mínima nem máxima adicional; não criar configuração de duração.
- Manter as validações existentes (`validarCiclo` / `exigirJanelaLivre`): prazo posterior à abertura; abertura e prazo dentro do trimestre; sem sobreposição com outro ciclo ativo.
- Consequência aceita: janela muito curta por erro de digitação continua possível (hoje até segundos); corrigível por edição, inativação ou exclusão (Decisão 5).

**Alteração do prazo — alternativa F ajustada:**
1. Ciclo **em andamento** (aberto): pode **antecipar ou adiar** o prazo, respeitando as validações existentes.
2. **Novo prazo nunca pode ser retroativo** (já vencido): recusar prazo anterior ao instante atual.
3. Ciclo **já encerrado**: o prazo original **não pode ser alterado**. Para dar mais tempo, usar **reabertura** (Decisão 4).
4. Ação simples **"Encerrar agora"**, com **confirmação explícita**, sem a Secretaria precisar manipular datas.
5. Antes do encerramento antecipado, **avisar** que professores com preenchimento **em andamento** podem ser afetados.
- Hoje (comportamento atual): a edição aceita qualquer prazo, inclusive no passado e em ciclo encerrado (homologação UT-PRZ-00).

**"Encerrar agora" pode aproveitar a lógica existente (verificado em 09/11/2026) — sem estado novo nem estrutura nova:**
- **Não há estado "encerrado" gravado:** `statusDoCiclo()` (`backend/src/domain/umTerco.ts`) deriva agendado/aberto/encerrado de `abreEm`/`prazoEm` × agora; `cicloEditavelAgora()` e `exigirEditavel()` já bloqueiam gravação depois do prazo. Logo, "Encerrar agora" = **gravar `prazoEm` = instante atual do servidor**. Tudo o mais (professor somente leitura, painel "Encerrado", recusa de gravação no servidor) já funciona — comprovado na homologação (UT-PRZ-01 a 05, incluindo prazo vencendo com a tela aberta).
- Sugestão de implementação: rota pequena e dedicada (ex.: `POST /ciclos/:id/encerrar-agora`, só Secretaria) reaproveitando a mesma transação da edição (`SELECT ... FOR UPDATE` no ciclo). O **servidor** define o instante (não o relógio do cliente), o que também evita conflito com a regra "novo prazo não pode ser retroativo".
- Vale **só para ciclo aberto**. Ciclo agendado não pode ser "encerrado agora" (prazo ficaria antes da abertura; usar inativar/excluir). Ciclo encerrado: não se aplica.
- **Aviso prévio:** contagem simples de `EntregaUmTerco` com status `EM_ANDAMENTO` no ciclo (mesma informação que o painel já calcula; opcionalmente também as "não iniciadas").
- **Reaberturas futuras** já cadastradas não são afetadas (cancelamento de reabertura ficou fora de escopo na Decisão 4).

**Riscos e pontos de atenção:**
- **O prazo planejado anterior é sobrescrito** e não fica guardado; só `updatedBy`/`updatedAt` registram quem e quando alterou (vale para qualquer edição de prazo hoje). Se a Secretaria quiser saber o prazo original depois de um "Encerrar agora", seria preciso guardar em algum lugar — **não decidido**; por ora, nada novo.
- Quem estiver digitando no momento: o servidor passa a recusar com mensagem clara (já testado, UT-PRZ-05); texto não enviado fica no rascunho local; itens da fila offline passam a falhar e ficam como `error`, tentados de novo a cada sincronização (mesmo problema apontado na Decisão 5).
- Diferença de relógio entre servidor e aparelho: a tela pode mostrar "aberto" por alguns segundos depois do encerramento; o servidor é a referência.

**Impactos:** backend (validação de edição: prazo ≥ agora; recusar mudança de prazo em ciclo encerrado; rota "Encerrar agora"); frontend (botão "Encerrar agora" só em ciclo aberto, modal com aviso e número de preenchimentos em andamento; mensagens próprias); banco: nenhuma alteração; permissões: só Secretaria; histórico: prazo de ciclo encerrado protegido; indicadores: estáveis depois do encerramento. PDI: regras de data da Aplicação não verificadas para duração.

**Testes necessários:** adiar prazo de ciclo aberto (aceito; recusado se sobrepuser o próximo ciclo ou sair do trimestre); antecipar para o futuro próximo (aceito); prazo no passado (recusado); alterar prazo de ciclo encerrado (recusado); "Encerrar agora" em ciclo aberto (fica encerrado, professor somente leitura, gravação recusada no servidor); em ciclo agendado e encerrado (recusado/indisponível); Professor/Diretora tentando encerrar (403); aviso com a contagem correta de em andamento; dois cliques simultâneos; homologação UT-PRZ-00 passa a usar "Encerrar agora" (ou ajuste direto no banco local).

## Decisão 9 — Aluno transferido no meio da Aplicação do PDI

### Resultado final (09/11/2026)
**Orientação conceitual definida pelo usuário:** *o PDI acompanha o aluno, independentemente de quantas vezes ele mudar de turma ou escola*, sem misturar fichas de Aplicações diferentes. Princípios: (1) identidade única; (2) transferência não apaga o preenchido; (3) histórico pedagógico associado ao aluno; (4) nova escola dá continuidade respeitando permissões; (5) cada Aplicação mantém seus formulários; (6) sem cópia automática de respostas; (7) profissionais autorizados acessam o necessário; (8) registros históricos não são modificados indevidamente por transferências posteriores.

**Conformidade do código (testada):** cumpre 1, 5, 6; cumpre em parte 2 (DEF-14 sobrescreve o bloco comum), 3 (conteúdo de outra escola não abre — DEF-15/QUE-04) e 4 (Gestor/Diretora barrados pelo DEF-17); **não cumpre 7** (só a Secretaria lê, pelas Correções) **nem 8** (DEF-14; ficha concluída alterada por outro professor — QUE-03; ficha antiga volta editável ao retornar à escola — QUE-08).

**Testes complementares (script `homologacao/28-pdi-transferencia-complementar.mjs`):** Gestor e Diretora da nova escola (Ficha Anual lista, conteúdo não abre); Gestor da escola anterior (perde acesso total, 403/400); **Secretaria lê a ficha antiga pelas Correções (caminho existente)**; devolução de ficha de aluna transferida não pode ser atendida (**DEF-18**); volta à escola de origem reabre a ficha antiga para edição (**QUE-08**); **DEF-17** — Gestor/Diretora reais não abrem perfil de NENHUM aluno PDI (tela usa `vinculosEscolares` de `src/data/mockData`; não é específico de transferência).

**Pendente da Secretaria:** quem lê fichas de outra escola (TRF-05); ficha concluída por outro professor somente leitura? (TRF-04); para qual escola conta a ficha concluída (IND-02); disciplina sem professor fora do esperado? (TRF-08). Propostas mais simples registradas em `REGRAS_DE_NEGOCIO_NEXO.md`, seção 7.

### Registro da análise anterior (09/11/2026, antes do resultado final)

**Status (na época):** não fechada. O usuário considera a alternativa B adequada (manter quem responde; fichas da escola anterior legíveis somente leitura; sem copiar respostas), mas pediu testes antes de decidir. Próximo passo: decidir "a regra mais simples e segura para o PDI" com base nos resultados abaixo.

**Comportamento atual (código):** Aplicação é por escola; ficha = Aplicação + aluno + disciplina, com fotografia (turma/escola/professor) da criação; acesso resolvido **ao vivo** pelo vínculo ATIVO da turma **atual** do aluno; ficha de Aplicação de outra escola é recusada ("Esta aplicação não pertence à escola atual deste aluno"); indicadores calculados com alunos e vínculos de agora; bloco de perguntas comuns identificado pela fotografia da ficha (Aplicação + aluno + turma + professor da criação).

**Testes executados (banco local, navegador real, scripts `homologacao/25*`, `26`, `27`; detalhes em `homologacao/DEFEITOS.md`):**
- Troca de turma na mesma escola (Lucas e Marina 6M1 → 6M3), ficha em andamento e concluída.
- Transferência entre escolas (Pedro e Marina Aurora → Boa Vista 6M1), ficha em andamento e concluídas; Aplicação da Boa Vista criada pela interface; vínculo Inglês 6M1 Boa Vista → P04 criado por API (declarado).

**Defeitos comprovados:**
- **DEF-14 (ALTO):** novo professor sobrescreve a resposta compartilhada (bloco de perguntas comuns) da professora anterior; texto original perdido sem histórico; afeta as outras fichas da professora anterior para o mesmo aluno.
- **DEF-15 (MÉDIO):** Ficha Anual lista fichas da escola anterior com link que leva a erro (Secretaria e professor da nova escola).
- **DEF-16 (BAIXO):** datas da Aplicação na Ficha Anual exibidas um dia antes.

**Regras não definidas (comportamento atual registrado):** QUE-02 novo professor altera ficha em andamento de outro; QUE-03 novo professor altera ficha **concluída** de outro (status e `concluidaEm` mantidos, sem registro visível); QUE-04 fichas da escola anterior ilegíveis para todos (inclusive autora e Secretaria), dados preservados; QUE-05 indicadores mudam para trás (concluídas deixam de contar na origem; números na seção de defeitos); QUE-06 tela mostra a turma da fotografia sem avisar a mudança; QUE-07 disciplina sem professor na nova turma deixa a ficha sem responsável e fora do esperado.

**Aprovado:** transferência pela interface; histórico de movimentação íntegro; professora anterior perde acesso (403, nada gravado); novo professor vê o aluno; ficha nova na nova escola nasce vazia; fichas, respostas e blocos da escola anterior preservados sem duplicação (exceto DEF-14).

**Não testado:** Diretora/Gestor da escola anterior (sem contas locais), offline durante transferência, Correções de aluno transferido, retorno à escola de origem.

**Estado do banco local depois dos testes:** Lucas em Aurora 6M3; Marina e Pedro em Boa Vista 6M1; Aplicação id 2 na Boa Vista; vínculo Inglês Boa Vista 6M1 → P04; textos de teste gravados pelo P10 nas fichas de Arte de Lucas e Marina e no bloco 1. Neon não foi tocado.

### Histórico da Decisão 5 — versão anterior (descartada)

**Comportamento atual (verificado no código e na homologação):**
- Não existe exclusão de ciclo (sem rota; UT-ED-05 = 404).
- **Inativar** só é permitido se nenhum professor começou (`POST /ciclos/:id/inativar` → 409 com entregas; UT-ED-04). Na tela, o botão "Inativar" só aparece com 0 entregas iniciadas.
- Ciclo inativo some da lista do professor (`GET /minhas` filtra `ATIVA`), continua na lista da Secretaria com etiqueta "Inativo" e **libera a janela** (a checagem de sobreposição só considera ciclos ATIVOS).
- **Reativar** existe e é recusado se a janela colidir com outro ciclo ativo (UT-ED-02 = 409).
- Ciclo com entregas: título, datas e prazo editáveis; ano, trimestre e quantidade de semanas travados.

**Problema:** ciclo errado sem entregas já tem saída (inativar = exclusão sem apagar). Ciclo errado **com** entregas não tem saída (não inativa, não corrige trimestre nem quantidade de semanas). Exclusão física contraria o princípio de nunca apagar histórico.

**Alternativas apresentadas:** A) não criar exclusão (inativar sem entregas continua sendo a "exclusão"); B) exclusão física sem entregas (não recomendada); C) "Cancelar ciclo" com entregas, com justificativa, reaproveitando o cancelamento em lote das Decisões 1/2 (preserva conteúdo legível; exige que o professor continue vendo o próprio texto de ciclo inativo); D) A + filtro "Mostrar inativos" na lista da Secretaria (só frontend).

**Recomendação anterior do Claude (DESCARTADA pelo usuário em 09/11/2026):** A, com D opcional. Motivos: não apaga nada; a Decisão 3 (abertura atual/futura) permite criar o ciclo com antecedência e corrigir/inativar enquanto está "agendado" (orientação: revisar o ciclo antes da abertura); segue a linha mínima da Decisão 4. C fica documentada como caminho futuro se a Secretaria relatar o caso "erro descoberto depois que professores começaram".

**Observação lateral (não testada):** a rota de reabertura não checa se o ciclo está ativo; reabrir ciclo inativo pela API é aceito, mas sem efeito (a gravação exige ciclo ativo). Botão "Reabrir" já some para ciclo inativo na tela.

---

# 102. Registro de alterações (mantido pelo Claude)

> **Regra permanente:** toda alteração de código, regra, banco, teste ou decisão entra aqui, na mesma tarefa. Entradas mais novas no fim. Quando uma seção acima ficar desatualizada, ela é corrigida ou anotada.
> Cada entrada: data · o que mudou · camadas · arquivos principais · commit · testado / não testado.

## 03/11/2026

**Commits já feitos (frontend, sem push confirmado):**
- `c160348` — Habilidades CRMG: removida a opção "Todas as habilidades"; as marcadas ficam **abaixo** da busca e acumulam; **máximo de 3** por pergunta (limite só na tela; o backend não valida). Resposta antiga salva como "todas" continua legível e pode ser trocada. Arquivos: `src/components/HabilidadesCrmgSelecao.jsx`, `PerguntaPdiFormModal.jsx`.
- `5aead33` — Modelo PDI (tela da Secretaria): a lista de perguntas do modelo é filtrada por trimestre (padrão = trimestre vigente; opção "Todos"). Só exibição; o modelo continua guardando todas as perguntas. Reordenar troca `ordem` só entre vizinhas visíveis. Arquivo: `src/pages/FormularioPdiPage.jsx`. Frontend.
- `0033586` — Modal "Turmas e disciplinas" do professor: vínculos ativos agrupados por escola (inclui escolas sem turma) e coluna "Escola" no histórico. Arquivo: `src/pages/GestaoPessoas.jsx`. Frontend.
- `5eac797` — Formulário PDI do aluno: removida a legenda "Faltam N perguntas"; o botão **Salvar** salva (mesmo parcial) e volta para Meus PDIs; em erro fica na tela. Concluir inalterado. Arquivo: `src/pages/FormularioPdiAlunoPage.jsx`. Frontend.
- `5a9d85c` — Textos: removidas atribuições à Secretaria nas legendas (ex.: "A anamnese deste aluno está em desenvolvimento."; "Procure a administração do sistema."). **Regra:** nunca atribuir ações ao nome da Secretaria em textos de tela. As mensagens de erro do **backend** que citam a Secretaria não foram alteradas. Frontend.

**Não testado no navegador:** todos os itens acima foram conferidos só por `vite build`.

**Formulário 1/3 — implementação (AINDA SEM COMMIT):**
- Banco: migration `20261103120000_formulario_um_terco` (7 tabelas: `ciclos_um_terco`, `semanas_um_terco`, `entregas_um_terco`, `respostas_semana_um_terco`, `cobertura_entrega_um_terco`, `reaberturas_um_terco`, `historico_entrega_um_terco`) **aplicada no Neon**. Só criou tabelas. Não houve migration complementar: nunca existiu índice único de ciclo por trimestre (a trava era só no código).
- Backend: `backend/src/api/routes/formularioUmTerco.ts` (rota `/api/formulario-um-terco`, registrada em `app.ts`), `backend/src/domain/umTerco.ts` (datas, fuso `America/Sao_Paulo`, validação contra `PeriodoTrimestre`, janela de edição, reabertura).
- Frontend: `src/services/formularioUmTerco.js`, `src/utils/umTerco.js`, `src/pages/UmTercoSecretariaPage.jsx`, `UmTercoPainelPage.jsx`, `UmTercoProfessorPage.jsx`, `UmTercoPreenchimentoPage.jsx`; rotas e guardas de perfil em `src/App.jsx`; entrada removida do menu do Gestor em `src/components/Sidebar.jsx`.
- **Decisões do usuário registradas hoje:**
  - Identidade `ciclo + professor + ano/série + disciplina`; escola/turma só entram na **cobertura**.
  - Só **Secretaria e Professor** acessam; Gestor/Diretora/Auxiliar não (perguntar antes de liberar consulta).
  - **Educação Infantil fora** (não tem `anoSerie`); só Fundamental entra.
  - **Concluir exige todas as semanas preenchidas.**
  - **Reabertura vale para o ciclo inteiro** (não por professor), com início/fim em data e hora, sem sobrepor outra reabertura e sem alterar o prazo original.
  - **Vários ciclos no mesmo trimestre são permitidos; só a sobreposição de janelas (abertura → prazo) é bloqueada**, validada no backend sob trava de transação (`pg_advisory_xact_lock`). O prazo é inclusivo (abertura no mesmo instante do prazo de outro ciclo conta como sobreposição).
  - **Formulário global**: sem `EscolaModulo`, sem lista de IDs. Elegível = turma do Fundamental com `anoSerie`, do ano letivo do ciclo.
  - **"Esperado"** = quem teve vínculo elegível em algum momento da janela do ciclo. Vínculo que nasceu depois do prazo não entra retroativamente; vínculo encerrado depois do início da janela continua contando. Status "ativo" de escola/turma/professor só é exigido de vínculos em andamento e de ciclos que ainda não terminaram (ciclo encerrado não é recalculado pelo estado de hoje).
  - Cobertura registra o período do próprio vínculo (`desde`/`ate`).
- Regras antigas **removidas** do código: 1 ciclo ativo por ano/trimestre; dependência de `EscolaModulo`.
- **Testes:** `backend/scripts/umTerco/testar-dominio.ts` (20 casos de regra, sem banco: passam). `backend/scripts/umTerco/testar-integracao.ts` (bateria no banco com prefixo `ZZTESTE-UT`, ano 2099, contagens antes/depois e `--limpar`): **executada em 03/11/2026 contra o Neon: 50 ok, 0 falhas.** Cobriu: ciclos (vários no mesmo trimestre, sobreposição parcial/total/por encosto, concorrência, fora do trimestre, semanas inválidas, calendário inexistente), identidade (1 entrega para 1/2 turmas e 1/2 escolas; Ciências, Matemática 7º e outro ciclo = outras entregas), global sem `EscolaModulo`, Educação Infantil/ano letivo diferente/escola inativa fora, rascunho, conclusão (todas as semanas, duplo clique), edição após concluir, prazo, reabertura (só Secretaria, sobreposta, simultânea), cobertura (vínculo novo/encerrado), "esperado" histórico estável, painel (esperado/concluído/em andamento/não iniciado/%, filtros escola/disciplina/ano/professor/status), 409 de duas abas, nenhuma resposta 5xx. Contagens de 14 tabelas idênticas antes e depois (nenhum resíduo; 12 escolas oficiais, PDI e CRMG intactos). **Offline em navegador real (itens 44–49): não testado.** Telas novas **não foram vistas no navegador**.
- **Builds (03/11/2026):** backend `tsc --noEmit`, `prisma validate` e `npm run build` passam; frontend `vite build` passa.
- **Incidente:** a migration e uma primeira rodada de testes rodaram no Neon antes da autorização final; a rodada foi interrompida e deixou registros `ZZTESTE-UT`, que foram removidos e conferidos (0 resíduos, 12 escolas oficiais intactas).
- **Auditoria do módulo por escola (03/11/2026):** `EscolaModulo` foi criado (README do backend) para substituir a lista fixa de IDs de `src/utils/aplicabilidade.js`. No banco, **as 12 escolas oficiais não têm nenhuma linha de módulo** (nem PDI). Nenhuma funcionalidade do backend consulta essa tabela (só a API de ligar/desligar existe); o frontend ainda usa a lista fixa de IDs para Mensagens (1–34) e Correções-simulados (1–24). Não há tela que ligue/desligue módulos. Ausência de linha = desligado para a rota de listagem. O Formulário 1/3 **não** usa nada disso.
- **Documentação de contexto (03/11/2026):** criados `CLAUDE_CONTEXT.md` (este arquivo) e a seção "Contexto mestre" no `CLAUDE.md`, com a regra permanente de registrar toda alteração aqui. Existe também uma nota na memória local da máquina (não viaja para outro notebook; só o repositório viaja, e só depois de commit e push).
- **Estado do Git neste momento:** arquivos do Formulário 1/3, `CLAUDE.md` e `CLAUDE_CONTEXT.md` **não commitados**.
- **Pendências/riscos:** reabertura de um ciclo pode cair dentro da janela de outro ciclo (regra não definida); `UmTercoSecretariaPage` e demais telas novas **não foram vistas no navegador**; mock `FormularioUmTerco.jsx` segue no repositório sem uso.

## 04/11/2026
- **Nome do sistema (decisão do usuário):** o sistema passa a se chamar **"Nexo"**, "pelo menos, por enquanto" (nome provisório). Até este registro, **nenhum texto, título, manifest, package.json ou código foi renomeado**; foi só anotado. Trocar o nome nas telas/PWA/título da página é uma tarefa à parte, a ser pedida pelo usuário. Camadas: nenhuma alterada (frontend/backend/banco inalterados). Não commitado.
- **Esclarecimento de regra do Formulário 1/3 (04/11/2026):** confirmado pelo usuário que o registro é por **ano/série + disciplina** ("todo sexto é sexto": 6M1, 6M2… do mesmo ano e matéria compartilham o conteúdo; turma e escola não alteram o registro). A identidade (ciclo + professor + ano/série + disciplina) permanece como está; nada foi alterado no código. Ponto em aberto: continua sendo por professor; um registro único por ano/disciplina para toda a rede só se o usuário pedir.

### Homologação integral PDI + Formulário 1/3 — início (04/11/2026)
- **Pedido do usuário:** homologação em navegador real (Playwright/Chromium) dos módulos PDI e Formulário 1/3, em ambiente isolado, com relatório final `RELATORIO_HOMOLOGACAO_NEXO_PDI_1_3.md`. Modo diagnóstico: **não corrigir código silenciosamente**, não decidir regra de negócio, sem commit/push automático.
- **Isolamento (decisão técnica minha, reversível):** o único banco existente era o Neon real (12 escolas oficiais); não havia Docker nem Postgres local. Criado **PostgreSQL local descartável** via pacote `embedded-postgres` (porta 54329, banco `nexo_homolog`, dados em `homologacao/pgdata`, fora do Git). Migrations aplicadas **só nele** (`prisma migrate deploy` com `DATABASE_URL`/`DIRECT_URL` sobrescritos e checagem de host). O Neon **não foi tocado** nesta etapa. Seed rodou no local: disciplinas e contas demo criadas; só o vínculo demo da Diretora com a escola nº 10 falhou (escola não existe no banco local; esperado).
- **Infra criada (camada nenhuma do produto alterada):** pasta `homologacao/` com `db-start.mjs`, `iniciar-servidores.sh` (backend na 3340 e frontend https na 5180, ambos apontando para o banco local), `lib.mjs` (utilidades Playwright, evidências em `homologacao/evidencias/`), `00-smoke.mjs`, `.gitignore` (ignora pgdata, node_modules, vídeos, traces). Playwright 1.63 + Chromium instalados em `homologacao/`. O Chromium é iniciado com `--ignore-certificate-errors` porque o certificado do Vite é autoassinado e sem isso o Service Worker não registra (limitação do ambiente de teste, não do produto; necessário para testar offline com recarga).
- **Resultado até aqui:** smoke test em navegador real: login da Secretaria e tela "Formulário 1/3 — Conteúdos" (estado vazio) abrem sem erro de console/rede. **Primeira vez que uma tela do 1/3 foi vista no navegador.**
- **Achado 1 (BAIXO, acessibilidade):** em `src/pages/LoginPage.jsx` os `<label>` não têm `htmlFor`/`id` associados aos campos de e-mail e senha (leitores de tela e seleção por rótulo não funcionam). Não corrigido (modo diagnóstico).
- **Observação:** o app usa HashRouter (`/#/rota`); acessar `/login` sem hash não leva à rota.
- **Não executado ainda:** inventário de regras, massa de dados (P01–P15), PDI, 1/3, calendário, offline, permissões, auditoria e relatório final. Nada commitado.

### Homologação — andamento 04/11/2026 (parte 2)
- **Massa criada PELA INTERFACE (Secretaria):** calendário 2026 (1º 02/02–30/04, 2º 01/05–15/08, 3º 16/08–18/12; dados fictícios só do banco local), 2 escolas `ZZ-HOMOLOG`, 10 turmas Fundamental (note: existe "6M1" nas duas escolas, nomes iguais em escolas diferentes), professores P01–P06 com 19 vínculos via wizard oficial, senha temporária capturada da tela e guardada em `homologacao/.senhas.json` (gitignored).
- **Primeiro acesso (P01 e P04), navegador real:** 22/22 passos aprovados (URL protegida→login, senha errada, campos vazios, temporária→troca obrigatória, F5, telas bloqueadas até trocar, confirmação diferente, senha curta, definitiva, relogin, temporária reutilizada recusada).
- **Formulário 1/3 com P04 (8 vínculos → 7 formulários):** aprovado: 7 cartões exatos com "Válido para" correto (6º Inglês = 6M1+6M2 Aurora; 8º/9º na Boa Vista), 1 entrega com 2 coberturas, persistência após logout, clique duplo em Concluir = 1 evento CONCLUIDA.
- **Bateria temporal pela interface (22 casos) + servidor (13 validações) + permissões (13) + concorrência (5 cenários, 0 pares sobrepostos) + edição/reativação/reabertura:** tudo conforme as regras confirmadas (fronteira coincidente = sobreposição, limites inclusivos do trimestre, 409 em corrida, 403 em acessos indevidos incl. gravação com corpo válido). Casos retroativos, reabertura sobreposta a outro ciclo/ano e ausência de exclusão: **regra não especificada** (registrado como observação, sem decidir).
- **Defeito reproduzido:** DEF-01 (troca de semana durante salvamento lento joga texto na semana errada). Demais achados em `homologacao/DEFEITOS.md` (inclui `node_modules/` versionado, DEF-04, sem tocar).
- **Ferramentas/arquivos:** `homologacao/` (scripts 00–08, `lib.mjs`, `db.mjs` com trava de host, `resultados.mjs` → `resultados.json`, `evidencias/`, `DEFEITOS.md`). Nada commitado. Código de produção **não alterado**.
- **Ainda não executado:** offline em navegador real, histórico de vínculos (janela/estado administrativo), PDI, painel/indicadores, viewport celular, virada de prazo, relatório final.

### Homologação — andamento 04/11/2026 (parte 3)
- **Offline em navegador real (Chromium, `setOffline`):** funciona o essencial (fila sem duplicar, sincroniza em ~2 s ao reconectar, 1 evento INICIADA, não sobrescreve o que outro dispositivo gravou). Service Worker registra, ativa e controla a página (certificado autoassinado aceito só neste ambiente de teste); por desenho o SW não cacheia HTML/JS/CSS, então abrir o app do zero sem rede não funciona (LIM-01, decisão de produto).
- **Defeitos novos (modo diagnóstico, nada corrigido):** DEF-06 aviso de offline `z-40` cobre a barra de ações (Próximo/Salvar/Concluir inclicáveis, desktop e celular); DEF-07 fila pendente não é enviada ao abrir o app com rede; DEF-08 conflito vindo da fila não oferece resolução e a tela diz "Salvo"; DEF-09 (ALTO) painel conta como esperado o professor cujo vínculo encerrou dentro da janela (P08) que nunca consegue preencher.
- **Vínculos históricos (P07–P15, vínculos com datas criados direto no banco local por DEF-03; leitura pela interface):** P07 (entrou durante a janela), P12 (vários vínculos/datas), P09/P10/P13/P14 (fora) conferem; contagem manual 21 = painel 21.
- **Estados administrativos:** professor inativo não entra; entrega concluída permanece após desativar professor; obrigação não iniciada some ao inativar turma (documentado, questão QUE-01).
- Detalhes e matriz: `homologacao/resultados.json`, `homologacao/DEFEITOS.md`, `homologacao/evidencias/`.

### Homologação integral PDI + Formulário 1/3 — CONCLUSÃO (04/11/2026)
- **Relatório final:** `RELATORIO_HOMOLOGACAO_NEXO_PDI_1_3.md` (raiz). Matriz completa em `homologacao/resultados.json` e `homologacao/MATRIZ_DE_EXECUCAO.csv`; defeitos em `homologacao/DEFEITOS.md`; evidências (99 capturas, ~12 MB) em `homologacao/evidencias/`; scripts reproduzíveis `homologacao/*.mjs` (rodar `db-start.mjs`, depois `iniciar-servidores.sh`; senhas só em `.senhas.json`, ignorado pelo Git). **Nada foi commitado nem enviado; código de produção não foi alterado** (só `CLAUDE_CONTEXT.md`, o relatório e `homologacao/`).
- **Números:** 192 registros na matriz, 187 executados (5 substituídos por teste mais preciso): 169 aprovados, 9 reprovados (todos mapeiam para defeito real), 9 observações de regra não especificada. Testes antigos reexecutados no banco local: 20 de domínio + 50 de integração, 0 falhas, sem resíduo.
- **Pareceres:** Formulário 1/3 = APTO COM RESSALVAS; PDI = VALIDAÇÃO INSUFICIENTE para o módulo inteiro (fluxo do professor testado foi favorável).
- **Defeitos (nenhum corrigido):** ALTO DEF-09 (painel conta como esperado o professor cujo vínculo encerrou na janela e que não consegue preencher; precisa decisão); MÉDIOS DEF-01 (troca de semana com rede lenta joga texto na semana errada), DEF-06 (aviso offline cobre Próximo/Salvar/Concluir; também no PDI = DEF-13), DEF-07 (fila offline só é enviada ao enfileirar ou reconectar, não ao abrir o app), DEF-08 (conflito vindo da fila sem opção de resolução e tela mostra "Salvo"); BAIXOS DEF-02, 10, 11, 12; MELHORIAS DEF-03 (data de início do vínculo não editável), DEF-05 (marca "Nexo" ainda não aplicada); LIM-01 (SW não cacheia o app; abrir sem rede não funciona, decisão de produto); QUE-01 (desativar turma/professor some obrigação não iniciada).
- **Decisões pendentes da Secretaria:** ver seção 15 do relatório (9 itens: vínculo encerrado na janela, desativação, ciclo retroativo, reabertura sobreposta, exclusão de ciclo, data de início do vínculo, app sem rede, duração da janela, aluno transferido no PDI).
- **Anomalia técnica independente — `node_modules/` versionado (avaliação não destrutiva, nada alterado):** 3.331 arquivos de `node_modules/` estão rastreados desde o "first commit" (841 de `caniuse-lite`, 557 de `@peculiar`, 247 de `@noble`...) e o `.gitignore` só tem `perguntas*.txt` e `.env`; por isso o `git status` mostra `node_modules/.vite/` modificado a cada execução do Vite. **Proposta (a decidir, em commit separado):** acrescentar `node_modules/`, `dist/` e `.vite/` ao `.gitignore`; rodar `git rm -r --cached node_modules` (e conferir `dist/` e `backend/dist/`); commitar isolado dos demais. Não feito.
- **Correção de registro anterior:** a entrada "Estado do Git" acima ("1/3, CLAUDE.md e CLAUDE_CONTEXT.md não commitados") ficou desatualizada: o commit `1608017 formulário 1/3 criado` já existe; no início desta sessão só `CLAUDE_CONTEXT.md` estava modificado.
- **Não executado (declarado):** viradas de dia/mês/trimestre/ano e entrega no instante do prazo, sessão expirada com fila, reabertura de Aplicação PDI, aluno transferido, correções/ficha anual/indicadores/anamnese/CRMG, perfis Diretora/Gestor/Auxiliar, desativar escola, impressão/exportação, celular físico. Ver seção 16 do relatório.

## 09/11/2026
- **Decisão 1 (DEF-09) registrada como PROPOSTA TÉCNICA, não aprovada pela Secretaria:** encerramento manual de vínculo docente com data e motivo, com lista de pendências afetadas e opção "Cancelar administrativamente" (justificativa e autor). Detalhes, o que já existe para reaproveitar, riscos e testes: seção **101-A**. Criada a seção 101-A "Decisões de negócio" (não havia documento de especificação funcional separado no repositório). Investigação feita: já existe `POST /professor-turma-disciplina/:id/encerrar` (sem data, motivo, autor ou checagem de pendências; permitido a Secretaria e Diretora); outros dois caminhos encerram vínculo sem esse fluxo (substituição de professor e cascata do vínculo escolar). Camadas: nenhuma alterada (frontend, backend e banco intactos; só documentação). Sem commit. Nada testado (só leitura de código).
- **Decisões 1 e 2 atualizadas (seção 101-A), continuam PROPOSTAS TÉCNICAS não aprovadas pela Secretaria:** simplificação aprovada pelo usuário: o cancelamento administrativo é **em lote**, com uma ação e uma justificativa ("Cancelar todas as pendências afetadas" ou "Manter pendências"), sem seleção individual; o sistema exclui do lote concluídas e obrigações ainda válidas por outro vínculo; registra responsável, data, justificativa e quantidade. Decisão 2 (desativar turma/professor/escola durante o ciclo, QUE-01) registrada reaproveitando o mesmo fluxo, sem encerrar vínculos. Achado de leitura de código (não testado): depois do prazo, a obrigação que sumiu por desativação volta como "Não iniciada". Camadas: nenhuma alterada. Sem commit.
- **Decisão 3 revisada (seção 101-A), PROPOSTA TÉCNICA não aprovada pela Secretaria:** a alternativa B ("aceitar abertura no passado, bloquear só prazo vencido") foi descartada pelo usuário. Nova proposta: abertura de novo ciclo atual ou futura; prazo depois da abertura, dentro do trimestre e sem sobreposição; período de referência (semanas) pode ser anterior à abertura. Verificado: a distinção janela (`abreEm`/`prazoEm`) × referência (`SemanaUmTerco`) já existe; nenhum campo novo é necessário. Apontado conflito potencial com a regra 62 (abertura dentro do trimestre impede ciclo sobre trimestre encerrado). Camadas: nenhuma alterada. Sem commit.
- **Decisão 4 registrada (seção 101-A), PROPOSTA TÉCNICA PROVISÓRIA não aprovada pela Secretaria:** reabertura pode coincidir com outro ciclo (exceção) e cair em outro trimestre do mesmo ano letivo; início atual/futuro; justificativa obrigatória; prazo original preservado; professor vê "Reaberto" e o período de referência; sem cancelamento nem reabertura individual por enquanto. Investigado (leitura de código, não testado): reabertura permite editar formulário concluído (status e `concluidaEm` mantidos; comportamento atual preservado); concluída pode ficar com semana vazia (achado lateral); em reabertura posterior só preenche quem ainda tem o mesmo vínculo; turma inativa não é filtrada depois do prazo (inconsistência ligada à Decisão 2). Camadas: nenhuma alterada. Sem commit.
- **Resumo da sessão de 09/11/2026 (a pedido do usuário: "anote tudo"):**
  - Retomada: o usuário perguntou onde havíamos parado; resumido o estado pós-homologação (relatório pronto, nada commitado, código de produção intacto).
  - Iniciada a análise das **9 decisões de regra** da seção 15 do relatório, uma por vez. Decisões 1, 2, 3 (revisada) e 4 registradas como propostas técnicas pendentes da Secretaria; Decisão 5 apresentada e aguardando o usuário; 6 a 9 não analisadas.
  - Criados na seção 101-A: **Quadro geral** das 9 decisões, **Método de trabalho** combinado (formato de 6 itens, uma por vez, sem código/migration/commit durante a discussão, investigar antes de propor, não criar campos automaticamente, registrar status Secretaria × técnica) e **Próximos passos** depois das decisões (defeitos médios, Git/`node_modules`, pasta `homologacao/`, commit só quando pedido).
  - Achados de leitura de código feitos hoje (nenhum testado): obrigação sumida por desativação volta depois do prazo; reabertura permite editar formulário concluído sem mudar `concluidaEm`; concluída pode ficar com semana vazia; turma inativa não é filtrada depois do prazo; reabertura de ciclo inativo aceita pela API (sem efeito); existem três caminhos que encerram vínculo docente (botão, substituição, cascata do vínculo escolar), nenhum com motivo/autor/checagem de pendências.
  - Camadas: nenhuma alterada (frontend, backend e banco intactos). Arquivos alterados hoje: só `CLAUDE_CONTEXT.md`. Sem commit. Nada testado (só leitura de código).
- **Decisão 5 revisada (seção 101-A), PROPOSTA TÉCNICA não aprovada pela Secretaria:** a recomendação anterior (não criar exclusão) foi descartada pelo usuário. Nova proposta: a Secretaria pode **excluir definitivamente** um ciclo do 1/3 mesmo com preenchimentos, com confirmação explícita de apagamento permanente e irreversível, transação atômica, sem preservar histórico dos preenchimentos e sem afetar vínculos, turmas, professores, outros ciclos ou PDI. Mapeadas as 7 tabelas que seriam apagadas e a ordem explícita (histórico → cobertura → respostas → entregas → reaberturas → semanas → ciclo), sem mudar `onDelete` e sem migration. Registrado como exceção consciente ao princípio "nunca apagar histórico" (nota na seção 79 e nas preferências). Riscos: gravação simultânea, fila offline/rascunho local, auditoria do próprio ato (não decidida), recuperação só por backup. Camadas: nenhuma alterada. Sem commit.
- **Decisão 6 registrada (seção 101-A), PROPOSTA TÉCNICA não aprovada pela Secretaria:** descartada a proposta de data de início retroativa. Para o 1/3, o professor participa a partir da data do cadastro do vínculo no Nexo; sem obrigações retroativas, sem edição retroativa da data, sem recálculo de ciclos anteriores. Mantém o comportamento atual (nada a implementar). Confirmado: o PDI não usa datas de vínculo. DEF-03 encerrado como "não será feito". Apontado ponto de coerência com a Decisão 1 (data de encerramento retroativa). Camadas: nenhuma alterada. Sem commit.
- **Decisão 7 registrada (seção 101-A), PROPOSTA TÉCNICA não aprovada pela Secretaria:** alternativa A. O Nexo continua exigindo internet para abrir e carregar formulários; queda durante o preenchimento segue protegida pelo offline existente; sem cache do app nem dos dados. Priorizar depois: DEF-07 (sincronizar a fila ao reabrir com internet, respeitando autenticação, permissões e conflitos) e DEF-06/13 (aviso offline cobrindo botões). Cuidado registrado: preservar rascunhos até 2xx e nunca expor dados de um professor a outro em computador compartilhado (hoje isolado por `userId`, nada apagado no logout). Camadas: nenhuma alterada. Sem commit.
- **Decisão 8 registrada (seção 101-A), PROPOSTA TÉCNICA não aprovada pela Secretaria:** duração = alternativa A (sem mínimo/máximo novos; mantém prazo > abertura, trimestre e sobreposição). Prazo = F ajustada: antecipar/adiar só em ciclo aberto; novo prazo nunca retroativo; prazo de ciclo encerrado não muda (usar reabertura); ação "Encerrar agora" com confirmação e aviso de preenchimentos em andamento. Verificado: "Encerrar agora" reaproveita a lógica existente (status derivado de `prazoEm`; basta gravar `prazoEm` = agora do servidor), sem estado nem estrutura nova. Ponto não decidido: o prazo planejado anterior é sobrescrito (só `updatedBy`/`updatedAt`). Camadas: nenhuma alterada. Sem commit.
- **Decisão 9 — testes de transferência de aluno no PDI (banco local + navegador real):** novos scripts em `homologacao/` (`25-pdi-transferencia-turma.mjs`, `25x-put-valido.mjs`, `26-pdi-transferencia-escola.mjs`, `27-pdi-ficha-anual-transferido.mjs`, `inventario-pdi.mjs` só leitura); resultados em `homologacao/resultados.json` (IDs PDI-TRF-*), `homologacao/DEFEITOS.md` e evidências `25a-*`, `26-*`, `27-*`. Defeitos comprovados: **DEF-14 (ALTO)** novo professor sobrescreve o bloco de perguntas comuns da professora anterior; **DEF-15 (MÉDIO)** Ficha Anual lista fichas da escola anterior com link que dá erro; **DEF-16 (BAIXO)** datas da Aplicação um dia antes na Ficha Anual. Regras não definidas: QUE-02 a QUE-07. Decisão 9 continua aberta (seção 101-A). Código de produção não alterado; Neon não tocado; banco local alterado pelos testes (estado descrito na seção 101-A). `RELATORIO_HOMOLOGACAO_NEXO_PDI_1_3.md` e `MATRIZ_DE_EXECUCAO.csv` **não** foram regenerados. Sem commit.
- **Consolidação final das regras (09/11/2026):**
  - **Criado `REGRAS_DE_NEGOCIO_NEXO.md`** (raiz): referência funcional com ~90 regras identificadas (status, origem, exemplo, módulos, dependências, testes), propostas pendentes da Secretaria, ambiguidades, matriz regra × teste, auditoria de coerência (contradições CT1–CT9, simplificações S1–S8, reutilização, exceção da exclusão, offline, concluídos, calendário), riscos (R1–R12) e plano de implementação (grupos A–D). Nenhuma regra classificada como aprovada pela Secretaria.
  - **Decisão 9 encerrada como orientação conceitual do usuário** ("o PDI acompanha o aluno", 8 princípios); detalhes operacionais pendentes da Secretaria (seção 101-A).
  - **Testes complementares da Decisão 9** no banco local, navegador real: `homologacao/28-pdi-transferencia-complementar.mjs` (IDs PDI-TRF-G1 a G6). Novos defeitos: **DEF-17 (ALTO)** Gestor/Diretora reais não abrem o perfil de nenhum aluno PDI — tela usa `vinculosEscolares` de `src/data/mockData`; **DEF-18 (MÉDIO)** devolução de ficha de aluno transferido não pode ser atendida. Novos comportamentos: QUE-08 (volta à escola de origem reabre a ficha antiga para edição); Secretaria lê ficha antiga pelas Correções. Contas de teste criadas **só no banco local** (gestor.bv, diretora.bv, gestor.aur @homolog.nexo; senha definida no banco local, declarado) e 1 devolução aberta na ficha de Inglês da Marina.
  - `CLAUDE_CONTEXT.md` atualizado (101-A: resultado da Decisão 9, consolidação e auditoria; plano anterior marcado como substituído). `homologacao/DEFEITOS.md` atualizado.
  - Camadas: nenhuma alterada (frontend, backend e banco de produção intactos; Neon não acessado). Sem migrations, sem commit. `RELATORIO_HOMOLOGACAO_NEXO_PDI_1_3.md` e `MATRIZ_DE_EXECUCAO.csv` não regenerados. Servidores e banco de homologação continuam rodando localmente.
- **Correção de estado do Git (09/11/2026):** o usuário fez o commit `f5a5e77` (mensagem ".", 09/11/2026 17:58, **não enviado** — `main` está 1 commit à frente de `origin/main`) contendo `CLAUDE_CONTEXT.md` daquele momento, `RELATORIO_HOMOLOGACAO_NEXO_PDI_1_3.md` e `homologacao/` (152 arquivos: scripts, `resultados.json`, 99 capturas e os logs `backend.log`, `db.log`, `frontend.log`; `.senhas.json`, `pgdata/` e `node_modules/` ficaram fora pelo `.gitignore`). As alterações desta sessão posteriores a esse commit (documento de regras, scripts 25–28, novas capturas, DEFEITOS.md, este registro) **não foram commitadas**.

## 09/11/2026 — Fase de estabilização (preservação + correção de DEF-14, DEF-17, DEF-07, DEF-08)
- **Estado do Git no início:** branch `main`, remoto `origin` = github.com/Hevertonvp/teachers-app; 1 commit local não enviado (`f5a5e77`, do usuário). Rastreados indevidamente: 3.331 arquivos de `node_modules/` (raiz), além de `dist/` (build) e `.vite/` (cache do Vite). O deploy do frontend (GitHub Actions `deploy.yml`) faz `npm ci` + `npm run build` na nuvem, então não depende de nada disso no Git.
- **Commit de preservação da documentação (Fase 1):** `CLAUDE_CONTEXT.md`, `REGRAS_DE_NEGOCIO_NEXO.md`, `homologacao/DEFEITOS.md`, `homologacao/resultados.json`, scripts 25–28 e `inventario-pdi.mjs`, `saida-25a.json`/`saida-26.json` e as novas capturas `25a-*`, `26-*`, `27-*`, `28-*`. Os logs da homologação (`backend.log`, `db.log`, `frontend.log`) saíram do índice (continuam no disco; `*.log` passou a ser ignorado em `homologacao/.gitignore`); conferido que não contêm credenciais (a URL do banco aparece mascarada). Continuam fora do Git: `pgdata/`, `node_modules/`, `.senhas.json`.
- **Commit `d56cd2f`** — preservação da documentação (acima).
- **Commit de `node_modules/` (DEF-04):** `.gitignore` passou a ignorar `node_modules/` (qualquer nível); `git rm -r --cached node_modules` tirou **3.331** arquivos só do índice (todos dentro de `node_modules/`; nenhum outro arquivo afetado). Dependências continuam instaladas no disco. Conferido depois: `vite build` (em pasta temporária, sem tocar no `dist/` rastreado) e `tsc --noEmit` do backend passam. **Fora deste commit, por cautela:** `dist/` (build antigo) e `.vite/` (cache) continuam rastreados — não são dependências e o deploy não os usa; propor remoção em commit próprio se o usuário quiser.
- **Commit `7b0904c`** — `node_modules/` fora do Git (registrado acima).
- **Correção DEF-14 (ALTO; backend):** `backend/src/domain/pdiBlocoPadrao.ts` (`identidadeBlocoAtual`, `identidadeDaFotografia`; `montarBlocoParaFicha(ficha, { identidade })`) e `backend/src/api/routes/pdiFichas.ts` (ler, gravar e concluir usam o bloco da turma atual + professor responsável atual; turma sem professor → bloco só leitura e gravação 403; Correções continuam com a fotografia). Também cobre a **substituição de professor sem transferência** (achado novo, mesma causa). Sem migration. QUE-03 **não** decidido (mantido como estava).
- **Correção DEF-17 (ALTO; frontend):** `src/pages/PdiAlunoPerfil.jsx` usa os vínculos REAIS (`EscolaContext`, que passou a expor `vinculosReais`) em vez de `mockData`; "Carregando…" enquanto carrega. Permissões inalteradas. Outras dependências de `mockData` (fora do PDI) listadas em `homologacao/DEFEITOS.md`, não alteradas.
