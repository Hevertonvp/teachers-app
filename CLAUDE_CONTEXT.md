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

---

# 88. Correção solicitada no 1/3

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
- **Pendências/riscos:** reabertura de um ciclo pode cair dentro da janela de outro ciclo (regra não definida); `UmTercoSecretariaPage` e demais telas novas **não foram vistas no navegador**; mock `FormularioUmTerco.jsx` segue no repositório sem uso.
