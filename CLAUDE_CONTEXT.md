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

> **MUDOU em 10/11/2026:** fluxo completo de correções para professores (PDI e 1/3). A janela de 3 dias continua, mas vencida não bloqueia mais o professor; salvar não envia mais a correção do bloco; há mensagem automática e conferência da Secretaria. Ver o Registro de alterações (10/11/2026) e REGRAS_DE_NEGOCIO_NEXO.md, seção 23.

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

> **MUDOU em 12/11/2026 (decisão do usuário): o 1/3 é POR CARGO.** Identidade: `ciclo + professor + cargo` (cargos idênticos naquele ciclo dividem uma folha). Ano/série, disciplina e turma deixaram de ser identidade, e o 1/3 vale para TODOS os Professores (não só Fundamental). As seções 56, 57 e as regras antigas que falam em "ano/série + disciplina" ou "só Fundamental" ficaram como histórico. A regra atual está no Registro de alterações ("12/11/2026: 1/3 POR CARGO — IMPLEMENTADO").

Identidade conceitual (ANTIGA, até 12/11/2026):

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

> **MUDOU em 10/11/2026 (decisão do usuário):** o 1/3 deixou de ser global. Cada ciclo atende as escolas escolhidas pela Secretaria, ou "Todas as escolas". Continua sem `EscolaModulo`, sem script e sem lista fixa. Ver o Registro de alterações (10/11/2026) e UT-01 em REGRAS_DE_NEGOCIO_NEXO.md.

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

> **MUDOU em 10/11/2026:** além das condições abaixo, a escola precisa estar entre as escolas do ciclo (ou o ciclo ser "Todas as escolas"). Ver seção 72.

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
- **Correção DEF-07 (frontend):** `src/offline/syncQueue.js` (`sincronizarAoEntrar`; item preso em "enviando" é reenviado; 401/senha temporária/5xx voltam a "pendente"; recusa de negócio não é reenviada automaticamente), `src/context/AuthContext.jsx` (chama ao abrir/logar com sessão válida), `src/services/api.js` (erro com `status`).
- **Correção DEF-08 (frontend):** `src/components/SavingIndicator.jsx` ("Sincronizado" × "Salvo só neste aparelho"); `src/pages/UmTercoPreenchimentoPage.jsx` (rascunho guarda a versão de referência; conflito da fila ou servidor alterado depois → opções e nada é enviado até a escolha, inclusive ao trocar de semana; falso conflito resolvido quando o texto é igual; fila limpa após sucesso); mensagens honestas de fila em `FormularioPdiAlunoPage.jsx`, `FormularioPdiProfessor.jsx`, `AnamnesePage.jsx`, `CorrecoesPdiDetalhePage.jsx`.
- **Novo achado (não corrigido): DEF-19 (MÉDIO, a confirmar)** — o formulário do PDI recupera rascunho sem versão de referência e pode sobrescrever alteração mais recente de outro aparelho; conflito do PDI sem opções.
- **Testes (todos no banco LOCAL; antes de testar, conferido que backend e scripts enxergam só as 2 escolas fictícias):** roteiros ANTES × DEPOIS em navegador real — DEF-14 (`30`, `30b`): antes 6/12 reprovados, depois 12/12 + 3/3; DEF-17 (`31`): antes 5/11 reprovados, depois 11/11; DEF-07/08 (`32`): antes 10 reprovados, depois 14/14 (a primeira rodada depois achou um furo — trocar de semana com conflito aberto ainda sobrescrevia — corrigido e retestado); regressão (`33`): 13/13; repetição final DEF-14 e DEF-17 aprovada. Baterias de API: 1/3 regras 20/20, 1/3 integração 50/50 (sem resíduo), PDI formulário único 35/35, PDI indicadores 29/29, calendário 92/92; CRMG não executado (catálogo ausente no banco local). Builds: `vite build` e `tsc --noEmit` do backend passam. Não testado: celular físico, build de produção, Gestor em escola inativa.
- **Ferramenta nova:** `homologacao/reiniciar-backend.sh` (reinicia só o backend da homologação apontando para o banco local).
- **Banco local alterado pelos testes:** alunos fictícios "DEF14 Ana/Bruno …" (vários), contas `diretora.aur@homolog.nexo`, entregas e textos de teste nos cartões da P04 do ciclo 1, vínculo Ciências 6M2 trocado para P12 e devolvido ao P06 (fica no histórico).
- **Git:** as correções e os novos scripts/evidências **não foram commitados** (o pedido só autorizou os commits de preservação e de `node_modules`); nada foi enviado (push).

## 09/11/2026 — Consolidação: commits por defeito + DEF-19, DEF-06/13, DEF-01, build de produção
- **Commits por defeito (pedido do usuário):** `c66ceac` DEF-14, `7405c5d` DEF-17, `8ecfcb2` DEF-07, `06e3954` DEF-08 (código + roteiro + capturas + a parte correspondente de DEFEITOS.md, CLAUDE_CONTEXT.md e seção 20 das regras, montadas em versões intermediárias para cada commit levar só a sua documentação), `e108aea` regressão (33), `reiniciar-backend.sh` e `resultados.json`. Isso **corrige** a nota anterior "as correções não foram commitadas". Nada enviado (push).
- **DEF-19 confirmado e corrigido (formulário único do professor e ficha única do Gestor):** rascunho do PDI guarda a versão de referência; se o servidor mudou depois, não mistura, mostra a versão salva e o texto deste aparelho com "Usar a versão salva" / "Restaurar o meu texto"; parte pendente travada e nunca enviada nem dada como salva. Arquivos: `src/utils/pdiFicha.js`, `src/pages/FormularioPdiAlunoPage.jsx`, `src/pages/FormularioPdiProfessor.jsx`. Testes em navegador real (dois contextos): `34-def19-pdi-sobrescrita.mjs` antes 4/6 reprovados, depois 8/8; `34b-def19-gestor.mjs` antes 2/2 reprovados, depois 2/2. Nenhuma regra de negócio nova.
- **DEF-06/13 corrigido:** `SyncStatusBanner.jsx` (só a caixa recebe cliques; sobe acima de barra fixa marcada com `data-barra-acoes-fixa`; espaço no fim da página enquanto visível) + marcação na barra do 1/3. Roteiro 35 (desktop e celular, elemento no centro do botão): antes 4/4 reprovados, depois 4/4.
- **DEF-01 corrigido:** `UmTercoPreenchimentoPage.jsx` — troca de semana na hora com salvamento em segundo plano; texto digitado durante um envio não é marcado como salvo nem tem o rascunho apagado; salvamento pedido com outro em andamento espera e envia o resto (Sair/Concluir nunca seguem sem o último texto). Roteiro 35 (atraso de 2,5 s): antes 2 reprovados (inclusive **perda do texto digitado durante o salvamento**), depois 3/3. A primeira rodada do DEF01-c tinha erro do teste (clicou no Sair do cabeçalho) e foi descartada.
- **Regressão final (09/11/2026, depois de todos os commits), banco LOCAL:**
  - **Navegador real:** `homologacao/rodar-regressao.sh final` roda 33, 30, 30b, 31, 32, 34, 34b e 35 em sequência. Resultado: **78 aprovados, 0 reprovados**.
  - **Integridade do banco** (`36-integridade.mjs`), antes e depois da suíte: **8/8**. Não há entrega, ficha, bloco ou resposta duplicados, nem resposta de semana de outro ciclo ou de pergunta de outra disciplina.
  - **Baterias automáticas:** 1/3 regras 20/20, 1/3 integração 50/50 (sem resíduo), PDI formulário único 35/35, PDI indicadores 29/29, calendário 92/92. CRMG não executado (catálogo ausente no banco local).
- **Build de produção** (`vite build` em pasta temporária + `vite preview` em https://localhost:5181, com backend extra na porta 3341, ambos no banco local; `dist/` versionado não tocado): `37-build-producao.mjs` **6/6**.
  - carga sem erro de console nem arquivo 404;
  - Service Worker registrado, ativo e controlando a página;
  - 7 cartões do professor e gravação online "Sincronizado";
  - offline com "Salvo só neste aparelho" e botão livre;
  - fila enviada ao reabrir;
  - Gestor abre o perfil do aluno.
  
  Os servidores extras foram desligados depois.
- **Não testado:** celular físico; produção real (Render/GitHub Pages/Neon); notificações push (VAPID nunca confirmado).
- **Preparação para a apresentação de 10/11/2026 (usuário):** o usuário vai assinar o plano básico do Render e pretende levar Render e Neon para a mesma região.
  - **Recomendação registrada:** assinar o plano hoje e **não mudar região na véspera**. Pelo que se sabe, nenhum dos dois troca de região no lugar (exige projeto ou serviço novo, cópia de dados, nova URL da API no `deploy.yml` e ajuste de `FRONTEND_ORIGIN`). A confirmar no painel de cada um.
  - **Pendências antes da apresentação:**
    - push dos commits locais (`f5a5e77` até o último), que **depende de autorização do usuário**;
    - conferência das variáveis do Render;
    - teste de fumaça na produção e em celular real;
    - dados fictícios de demonstração no Neon;
    - ensaio do plano B com o ambiente local de homologação;
    - congelamento com tag do commit publicado.
  - **Evitar na demonstração:** DEF-15, DEF-16 e DEF-18; abrir o app sem internet; notificação push. A marca "Nexo" ainda não está nas telas (DEF-05).
- **Push (09/11/2026):** os commits até `e053d71` foram enviados ao GitHub por outra pessoa ou outra sessão desta máquina (o reflog registra "update by push"; não foi o Claude). Depois, com autorização do usuário ("pode fazer"), o Claude enviou o `fe10a64` (`e053d71..fe10a64`).
- **Produção conferida só lendo:**
  - o arquivo publicado no GitHub Pages (`assets/index-BV9mazxN.js`) contém as correções DEF-08, DEF-19 e DEF-06 e aponta para `teachers-app-xokm.onrender.com`;
  - o Render responde `/health` com 200.
  
  **Não confirmado:** qual commit o backend do Render está rodando (conferir no painel; o DEF-14 está no `c66ceac`).
- **Novo roteiro `homologacao/38-producao-somente-leitura.mjs`:** verificação da produção real em que **toda requisição não GET à API é bloqueada no navegador** (exceto o login), então nada é gravado. As senhas entram por variável de ambiente (`NEXO_SECRETARIA`, `NEXO_PROFESSOR`, `NEXO_GESTOR`, `NEXO_DIRETORA` = `email|senha`) e nunca ficam em arquivo. Cobre infraestrutura, login de cada perfil, telas principais e o perfil do aluno para Gestor e Diretora (DEF-17).
  - **Validado no ambiente local:** 16 aprovados; a única falha é a INFRA-2, que só se aplica ao build publicado.
  - **Contra a produção, sem senhas:** INFRA-1 e INFRA-2 aprovados.
  - **Falta:** rodar com as contas reais.
- **DEF-10 corrigido (branch `fix/filtro-turma-alunos-pdi`, a pedido do usuário):** filtro Escola + Turma em PDI > Alunos, com coluna Escola (`src/pages/PdiPage.jsx`). Teste 39: 4/4. **Não publicado** até autorização. A exportação para Excel (branch `feature/exportacao-excel`) foi pausada antes de qualquer alteração.
- **Exclusão autorizada na PRODUÇÃO (Neon `ep-little-voice-b53ix6xw`, 09/11/2026 ~23:04, pedido do usuário: "apague todos alunos PDI, exceto os criados hoje"; confirmação explícita "sim"):**
  - **O que foi apagado:** os 13 alunos de teste #642–#654 (`*_ia` de 25/10 e `*_criado_por_ia` de 03/11, todos arquivados), com 4 fichas, 8 respostas, 1 bloco de perguntas comuns, 3 respostas desse bloco e 13 movimentações. Não havia anamnese, ficha anual nem correção.
  - **Como foi feito:**
    - levantamento prévio só de leitura;
    - cópia de segurança em JSON em `C:\Users\hevertonvp\Desktop\backup-nexo-2026-11-09\` (fora do repositório);
    - exclusão por lista de IDs numa única transação, abortando se as quantidades diferissem do levantamento.
  - **Resultado:** restam os 6 alunos criados em 09/11 (#655–#660, "escola teste"); 0 registros órfãos.
  - **Camadas:** só dados de produção; nenhum código.
- **Publicação do DEF-10:** a branch `fix/filtro-turma-alunos-pdi` foi juntada à `main` e enviada com autorização do usuário ("sim para ambos"). Só frontend; o backend não mudou.
- **Ajustes de tela pedidos pelo usuário (perfil Secretaria; branch `fix/ajustes-telas-secretaria`; só frontend):**
  - **PDI:** saíram do topo os botões "Gerenciar formulário" e "Ver alunos", que ficam só nos cartões (`PdiHomePage.jsx`).
  - **Modal "Turmas e disciplinas":**
    - saiu a seção "Histórico" de vínculos encerrados (o usuário quer isso em outro lugar no futuro);
    - o aviso de substituição mostra o **nome** do professor substituído, que já vinha da API como `professorNome` (`GestaoPessoas.jsx`).
  - **Assistente de vínculos do cadastro de professor:**
    - lista de vínculos adicionados com rolagem própria;
    - a turma já adicionada **com a disciplina escolhida** some do seletor e volta para outra disciplina. Escolha técnica para não contrariar a regra "várias disciplinas na mesma turma"; o usuário pediu "turmas já selecionadas devem desaparecer";
    - o botão Adicionar fica desabilitado sem turma.
  - **Todos os modais (`Modal` em `Common.jsx`):**
    - não fecham mais por clique fora **nem pela tecla Esc**; só pelo "×" ou pelos botões do conteúdo;
    - altura limitada à tela (`max-h: 100dvh - 4rem`), com rolagem interna no conteúdo e o overlay rolável como reserva.
  - **Teste:** `homologacao/40-ajustes-telas-secretaria.mjs`, navegador real, desktop e celular, banco local: **13/13**. Inclui confirmação no banco de que fechar sem confirmar não altera vínculos e de que os vínculos criados pelo assistente não duplicam.
- **Assistente de vínculos corrigido conforme o usuário explicou (branch `fix/assistente-disciplinas-por-turma`):** o pedido "turmas já selecionadas devem desaparecer" era, na verdade, que as **disciplinas já escolhidas para aquela turma** sumissem (ex.: depois de 6M1 + História, História some para a 6M1). A turma continua na lista e a disciplina continua disponível para as outras turmas. Substitui a lógica anterior, que escondia a turma. O botão Adicionar fica desabilitado sem turma ou disciplina. Teste `42-assistente-disciplinas-por-turma.mjs`: **8/8** (desktop e celular, conferido no banco, sem duplicar). O roteiro 40 foi ajustado (a parte 4 agora escolhe turma e disciplina a cada vínculo, para não substituir professores no banco local): 9/9; os resultados antigos UI-SEC-4a/4b saíram da matriz.
- **Exportação para Excel (.xlsx) — 09/11/2026, branch `feature/exportacao-excel` (criada da `main` 621b002). Sem push e sem deploy.**
  - **Pedido do usuário:** botão "Exportar para Excel" dentro de cada área (ex.: o do PDI na página principal do PDI). A exportação deve respeitar os filtros e o controle de acesso, proteger contra fórmulas e não inventar indicadores.
  - **Biblioteca:** ExcelJS 4.4.0 (gratuita, MIT), só no frontend. É carregada **só no clique** (import dinâmico): fica num pedaço separado de ~930 kB e o carregamento do app não cresceu.
  - **Utilitário comum `src/utils/exportarExcel.js`:**
    - aba "Filtros" com quem exportou, quando (horário de São Paulo), os filtros aplicados e o total de linhas de cada aba;
    - cabeçalho em negrito, primeira linha congelada, filtro automático e larguras ajustadas;
    - valores gravados só como texto, número ou data, **nunca como fórmula**: texto começando com "=" fica como texto;
    - datas só-dia pelas partes UTC (lição do DEF-16), formato dd/mm/aaaa; data e hora convertidas para São Paulo;
    - campos vazios ficam com a célula vazia;
    - nome do arquivo: `nexo-<área>-AAAA-MM-DD.xlsx`.
  - **Botão comum `src/components/BotaoExportarExcel.jsx`:** mostra "Gerando planilha..." e o erro, se houver, e não exporta duas vezes em paralelo.
  - **Telas e conteúdo:**
    - **PDI, página principal (`PdiHomePage.jsx`; Secretaria, Gestor e Diretora; respeita a escola do topo):**
      - "Entrega por escola": os mesmos números do painel, de `/api/pdi-aplicacoes/indicadores`;
      - "Fichas": escola e turma da Ficha, aluno, disciplina, professor, Aplicação, trimestre, início, fim, status, concluída em, última alteração, **escola e turma atuais do aluno**;
      - "Respostas": seção, subseção, código, pergunta, resposta, complemento;
      - "Perguntas comuns".
    - **Formulário 1/3:** botão em cada ciclo da lista (`UmTercoSecretariaPage.jsx`, sem filtros) e no Painel de entregas (`UmTercoPainelPage.jsx`, **com os filtros da tela**). Só Secretaria. Abas:
      - "Resumo" (os mesmos números do painel);
      - "Cobertura por escola";
      - "Entregas" (professor, ano/série, disciplina, escolas, turmas, status, semanas, concluída em, última alteração);
      - "Conteúdos" (o texto de cada semana, com início e fim).
    - **Gestão de Pessoas > Professores (`GestaoPessoas.jsx`):**
      - "Professores": nome, e-mail, escolas, status, quantidade de vínculos ativos;
      - "Vínculos": um por linha, professor × escola × turma × disciplina, desde.
    - **Turmas (`GestaoTurmas.jsx`):**
      - "Turmas": todas as do filtro, não só a página;
      - "Professores e disciplinas": vínculos ativos **reais** da API, nunca os contadores de demonstração da tela.
    - **PDI > Alunos (`PdiPage.jsx`):** todos os alunos dos filtros (busca, escola, turma, status), com responsável legal, parentesco, telefone e data de cadastro.
  - **Backend (somente leitura; nenhuma migration; nenhuma regra alterada):**
    - **`GET /api/pdi-fichas/exportacao`:**
      - **permissões:** Secretaria, Gestor e Diretora; Professor e Auxiliar recebem 403;
      - **escopo:** extraído da listagem `GET /api/pdi-fichas` para a função `escopoFichas`, sem mudar o comportamento da listagem;
      - **filtros:** `escolaId` (sempre em AND, nunca substitui o escopo) e `aplicacaoId`;
      - **respostas por extenso:** CRMG → "Todas as habilidades" ou "código — descrição; ..."; Marcação → Sim/Não; Número → número; ORIENTAÇÃO fica de fora.
    - **`GET /api/formulario-um-terco/ciclos/:id/exportacao`:**
      - **permissão:** só Secretaria;
      - **cálculo:** reaproveita `montarPainel` (extraído da rota do painel), ou seja, mesmos números e mesmos filtros;
      - **conteúdo extra:** o texto de cada semana.
  - **Achado documentado, não alterado:** o escopo de Fichas, já existente, segue a escola **atual** do aluno. Um aluno transferido leva a Ficha antiga para a escola nova; ex.: a Diretora da Aurora vê a Ficha feita na Boa Vista do Pedro, transferido. Por isso a planilha mostra "Escola" (da Ficha) e "Escola atual do aluno". Se a Secretaria quiser outra regra, é decisão de negócio.
  - **Testes (navegador real + banco LOCAL; as planilhas baixadas foram abertas com ExcelJS e conferidas contra o banco):**
    - `homologacao/43-exportacao-excel.mjs`: **20/20**. Cobre:
      - quantidades sem omissão nem duplicação: 59 Fichas, 63 respostas, 48 comuns, 43 entregas, 32 conteúdos, 32 professores, 44 vínculos, 7 turmas, 18 alunos;
      - concluídas, em andamento e não iniciadas;
      - professor com 9 vínculos;
      - filtro "Concluído" no painel do 1/3;
      - filtro de escola em Turmas;
      - status "Todos" em Alunos;
      - texto "=1+1 História" e "=HYPERLINK(...) Ação" gravados como texto (alterados temporariamente e **restaurados** no fim);
      - datas iguais ao banco;
      - nenhuma célula "undefined", "null" ou com fórmula;
      - Professor recebe 403 e não vê o botão;
      - Diretora só recebe Fichas de alunos das escolas dela, e o 1/3 dá 403 para ela.
    - `43b-exportacao-celular.mjs`: 6/6 (botão inteiro, sem rolagem horizontal a 390 px).
    - **Regressão completa depois da mudança** (`rodar-regressao.sh exportacao` + roteiros 39, 40 e 42): **99 aprovados, 0 reprovados**. A listagem de Fichas e o painel do 1/3, que agora usam as funções extraídas, continuam iguais.
    - **Não testado:** abrir os arquivos no Microsoft Excel ou no LibreOffice de verdade (a leitura foi feita pelo ExcelJS).
  - **Correção de infraestrutura de teste:** `homologacao/reiniciar-backend.sh` agora derruba o processo que estiver na porta 3340 antes de subir. Antes, o antigo continuava respondendo com código velho (a rota nova dava 404).
  - **Limitações:**
    - Fichas nunca abertas não existem no banco, por isso não aparecem na aba "Fichas"; o total esperado está em "Entrega por escola";
    - a exportação de Escolas e de indicadores do Dashboard não foi feita;
    - a planilha de Alunos contém o telefone do responsável (dado pessoal: o arquivo deve ser tratado como sigiloso);
    - esta branch saiu da `main` antes do filtro de escola sempre visível (`fix/filtro-escola-sempre-visivel`); pode haver um conflito simples em `PdiPage.jsx` ao juntar.
- **10/11/2026: ordem das abas na exportação para Excel (branch `feature/exportacao-excel`, só frontend).**
  - **Reclamação do usuário:** a planilha de Alunos PDI "veio inútil". Na verdade, os dados estavam na 2ª aba e o arquivo abria na aba "Filtros".
  - **Correções:**
    - a aba "Filtros" passou a ser a **última**, e o arquivo abre na primeira aba de dados (`src/utils/exportarExcel.js`);
    - as listas detalhadas vêm primeiro: no PDI, Fichas → Respostas → Perguntas comuns → Entrega por escola; no 1/3, Entregas → Conteúdos → Cobertura por escola → Resumo;
    - Professores, Turmas e Alunos já começavam pela lista.
  - **Teste:** `43-exportacao-excel.mjs` ganhou o EXP-G1 (toda exportação abre numa aba de dados com linhas; "Filtros" é a última): **21/21**.
- **10/11/2026: modal "Novo Formulário 1/3" simplificado (pedido do usuário; branch `feature/modal-ciclo-um-terco`, criada a partir da `feature/exportacao-excel`; só frontend).**
  - **Respostas do usuário às perguntas de regra:**
    - ano e trimestre são identificados **pelas datas** (a abertura), não pela data de hoje: dá o mesmo resultado que "o vigente" no dia a dia e permite preparar o próximo trimestre com antecedência;
    - "início e fim" são a **abertura e o prazo**;
    - semanas: **4 por padrão**, quantidade ainda alterável (1 a 30).
  - **Mudanças (`src/pages/UmTercoSecretariaPage.jsx`):**
    - saíram os campos Ano letivo, Trimestre e Título;
    - o título é sempre "Formulário 1/3"; ciclos antigos mantêm o título que já têm;
    - o trimestre aparece só como informação; abertura fora de qualquer trimestre mostra aviso e desabilita Salvar.
  - **Divisão automática:**
    - **ciclo novo:** ao escolher abertura e prazo ou ao mudar a quantidade, as semanas são divididas por igual e de forma contínua dentro da janela (ex.: 01/12–18/12 em 4 → 01–04, 05–09, 10–13, 14–18). Continuam editáveis. Se o período tiver menos dias que semanas, aparece um aviso e nada é inventado;
    - **ciclo existente:** mudar abertura ou prazo **não** redivide sozinho, porque os professores podem já estar preenchendo; há o botão "Redividir pelo período".
  - **Celular:** as linhas das semanas passaram a ter o rótulo em cima; antes, a data de fim saía cortada para fora do modal (defeito antigo).
  - **Backend:** nada mudou; continua recebendo ano, trimestre, título e semanas e validando tudo (CAL-05, UT-04).
  - **Teste:** `homologacao/44-modal-novo-ciclo-um-terco.mjs`, desktop e celular, banco local: **10/10**. O ciclo criado pelo teste é inativado no fim.
  - **Ajustes de teste:**
    - o helper `criarCiclo` (`lib.mjs`) foi adaptado: os parâmetros `ano`, `tri` e `titulo` ficaram sem efeito;
    - os roteiros antigos 04 e 06, que identificavam ciclos pelo título, não foram executados de novo.
- **10/11/2026: abertura e prazo do 1/3 só por data, sem hora (pedido do usuário; branch `feature/modal-ciclo-um-terco`; só frontend).**
  - **Modal:** campos "Abertura" e "Prazo de entrega" do tipo data. O sistema envia a abertura às **00:00** e o prazo às **23:59** (horário de São Paulo): o professor pode preencher até o fim do dia do prazo.
  - **Ciclo antigo com hora própria** (ex.: o #1 local, prazo 20/11 às 18:00): editar e salvar **sem mudar a data** mantém a hora original, para não mudar o prazo sem querer. Mudando a data, passa a valer 00:00/23:59.
  - **Cartão do ciclo:** mostra só a data quando a hora é a padrão ("Abre 01/12/2026 · prazo 18/12/2026"); ciclos antigos com hora própria continuam mostrando a hora. As outras telas (painel, tela do professor) não mudaram e continuam mostrando a hora (ex.: "prazo 18/12/2026, 23:59").
  - **Efeito na regra UT-04 (sem sobreposição):** dois ciclos não podem compartilhar o mesmo dia (um termina 23:59, o seguinte abre 00:00 do dia seguinte).
  - **Backend:** nada mudou.
  - **Teste:** `44-modal-novo-ciclo-um-terco.mjs`: **14/14**. Novos casos: campos do tipo data, banco com 00:00 → 23:59, cartão sem hora, ciclo antigo mantém a hora ao salvar sem mudar a data. O helper `criarCiclo` passou a usar só a data.
- **10/11/2026: Dashboard da Secretaria com a entrega do PDI e do Formulário 1/3, em gráficos (pedido do usuário; branch `feature/dashboard-entregas`, criada a partir da `feature/modal-ciclo-um-terco`; só frontend).**
  - **Dashboard (`DashboardSecretaria.jsx`):** os três números soltos do PDI (esperadas, concluídas, %) viraram dois painéis lado a lado (empilhados no celular), cada um com:
    - percentual concluído;
    - barra parte do todo (concluídas, em preenchimento, não iniciadas) com legenda numérica;
    - as 5 escolas com **menor** entrega primeiro;
    - atalho "Abrir PDI" / "Abrir 1/3".
    
    Os painéis respeitam a escola escolhida no topo.
  - **Números:** os mesmos das telas de cada módulo, sem cálculo novo:
    - **PDI:** `/api/pdi-aplicacoes/indicadores`, mesmo cálculo da página do PDI;
    - **1/3:** resumo do Painel de entregas (`/ciclos/:id/painel`) do ciclo escolhido. Ordem de escolha: o aberto agora; senão um reaberto; senão o último encerrado; senão o próximo agendado;
    - **por escola no 1/3:** uma entrega aparece em cada escola que atinge, mesma regra da "Cobertura por escola"; isso está escrito no rodapé.
  - **Refatoração sem mudança visual:**
    - o painel de entrega da página do PDI foi extraído para `src/components/PainelEntrega.jsx` (com variante `compacto`) e `src/components/EntregaPdiGestao.jsx`;
    - novo `src/components/EntregaUmTercoGestao.jsx`.
  - **Cores:** a mesma rampa ordinal azul do PDI (`vizTema.js`), conferida com o validador do skill de dataviz. Para rampa ordinal vale a progressão de claridade, que está correta. O aviso de contraste da cor mais clara é compensado pela legenda com números e pelos 2 px entre segmentos.
  - **Fora do escopo, por regra de acesso:** o Gestor e a Diretora não veem o 1/3, porque o painel do 1/3 é só da Secretaria (PER-09). O Dashboard deles não mudou.
  - **Backend:** nada mudou.
  - **Teste:** `homologacao/45-dashboard-entregas.mjs`, desktop e celular, banco local: **8/8**. Compara com as APIs com todas as escolas e com a Aurora selecionada; verifica a página do PDI com os mesmos números e a ausência de rolagem horizontal.
- **10/11/2026: validação das datas do Formulário 1/3; divisão automática das semanas removida (decisões do usuário; branch `feature/validacao-datas-um-terco`, a partir da `feature/dashboard-entregas`; frontend e backend).**
  - **Decisão do usuário:** "esquece esse negócio de dividir as datas dentro da janela": as semanas (período de referência) e a abertura/prazo (janela de preenchimento) são independentes (UT-05). A divisão automática e o botão "Redividir" saíram; as semanas voltam a ser preenchidas à mão (4 em branco por padrão).
  - **Respostas às perguntas de regra:**
    - semana de tamanho livre;
    - buracos entre semanas permitidos;
    - semana depois do prazo **bloqueada**;
    - abertura "só no futuro": aplicado como **hoje ou depois**; trocar para "a partir de amanhã" é uma linha.
  - **Backend:**
    - `validarCiclo` (`domain/umTerco.ts`) recusa semanas fora de ordem ou sobrepostas e semana terminando depois do prazo;
    - nova `exigirAberturaNaoPassada`: vale sempre na criação e, na edição, só se a data da abertura mudar (`routes/formularioUmTerco.ts`);
    - nenhuma migration.
  - **Frontend (`UmTercoSecretariaPage.jsx`):**
    - as mesmas regras são conferidas **na hora**, com borda vermelha e mensagem embaixo do campo;
    - Salvar fica bloqueado enquanto houver erro;
    - os calendários já limitam as datas possíveis (mínimo e máximo).
  - **Achado:** o ciclo #1 do banco local tem a Semana 4 (23–27/11) depois do prazo (20/11). Com a regra nova, ele é acusado no modal e só salva depois de corrigido. **Antes de publicar, conferir se há ciclos assim na produção**: neles, editar exigirá ajustar o prazo ou a semana. Reaberturas não são afetadas.
  - **Testes:**
    - `scripts/umTerco/testar-dominio.ts` 20/20; `testar-integracao.ts` 50/50 (banco local, sem resíduo);
    - `44-modal-novo-ciclo-um-terco.mjs` **21/21** (corrigido em 10/11: antes registrado por engano como 24/24), desktop e celular. Cobre cada regra na tela, um caso válido com buraco, semana anterior à abertura e tamanhos 5/10/1/1, a gravação exata no banco, o ciclo antigo e a API recusando (400) as mesmas 4 situações;
    - resultados obsoletos do roteiro 44 (divisão automática) foram removidos da matriz;
    - `REGRAS_DE_NEGOCIO_NEXO.md` atualizado (UT-05, UT-06).
- **10/11/2026: Formulário 1/3 com ESCOLAS escolhidas por ciclo (pedido do usuário; branch `feature/um-terco-escolas`, a partir da `feature/validacao-datas-um-terco`; banco, backend e frontend).**
  - **Pedido:** "para abrir um novo formulário 1/3, devemos escolher as escolas que ele vai atender, assim como no PDI. E também temos opção de marcar todas de uma vez".
  - **Conflito apontado antes de implementar:** a regra "1/3 global" (§72/§82, marcada como definitiva). O usuário confirmou que a mudança a **substitui**. As seções 72 e 82 foram anotadas.
  - **Decisões do usuário:**
    1. "Todas as escolas" inclui escolas criadas depois;
    2. ciclos de escolas diferentes podem ter janelas sobrepostas; ciclos com escola em comum (ou "todas") não podem.
  - **Proposta técnica aplicada:**
    - escola com preenchimento iniciado no ciclo não pode ser retirada (409);
    - acrescentar escola pode;
    - escola inativa não pode ser escolhida, salvo se já estava no ciclo.
  - **Banco:** migration aditiva `20261110120000_um_terco_escolas_do_ciclo`:
    - `ciclos_um_terco.todasEscolas` (padrão true: **ciclos existentes ficam "todas", sem mudança de comportamento**);
    - tabela `ciclos_um_terco_escolas` (cicloId, escolaId).

    Aplicada **só no banco local**, com diff schema × banco vazio. **Na produção (Neon) precisa ser aplicada com `prisma migrate deploy` antes de publicar o backend**: o build do Render não aplica migrations.
  - **Backend (`routes/formularioUmTerco.ts`):**
    - **ciclo na API:** ganhou `todasEscolas` e `escolas[]` na resposta e `todasEscolas`/`escolaIds` na criação e edição. Sem os campos, a API trata como "todas" na criação e mantém as escolas na edição, então clientes antigos não quebram;
    - **elegibilidade:** `vinculosElegiveis` filtra as turmas pelas escolas do ciclo. Por isso painel, "Meus formulários" do professor, cobertura, exportação e dashboard respeitam as escolas automaticamente;
    - **sobreposição:** `exigirJanelaLivre` só recusa quando há escola em comum.
  - **Frontend (`UmTercoSecretariaPage.jsx`):**
    - "Escolas atendidas" no topo do modal: "Todas as escolas" marcado por padrão; ao desmarcar, aparece a lista com busca (mais de 6 escolas) e a contagem; nenhuma escolhida mostra aviso e bloqueia Salvar;
    - o cartão do ciclo mostra "Todas as escolas" ou "N escolas: A, B, C e mais X";
    - no celular, os nomes longos são cortados com "…".
  - **Testes (banco local):**
    - `testar-dominio` 20/20; `testar-integracao` 50/50 (ciclos "todas" = comportamento antigo);
    - **`homologacao/46-um-terco-escolas-do-ciclo.mjs` 8/8:**
      - modal (padrão "todas", aviso sem escola, gravação no banco, cartão);
      - painel só com turmas da Aurora;
      - professor só da Aurora vê o ciclo e o só da Boa Vista não;
      - sobreposição (só BV 201, com Aurora 409, todas 409);
      - API sem escola 400;
      - retirar a Aurora do ciclo #1 com preenchimentos 409, sem gravar nada;
      - edição pelo modal com a Aurora marcada e conflito mostrado;
    - regressão: 44 (21/21), 45 (8/8), 43 (21/21).
  - **Correção de registro:** o roteiro 44 tem **21** casos, não 24 como registrado antes por erro de contagem.
  - **Infra de teste:** havia 3 processos antigos do backend local (de 09/11) travando o motor do Prisma; foram encerrados. O `reiniciar-backend.sh` atual já derruba o processo da porta 3340.
- **10/11/2026: estado de publicação conferido (corrige os "sem push" das entradas anteriores).**
  - **Já está na `main`:** o usuário juntou a `feature/dashboard-entregas` (PRs **#5** e **#6**, 00:42–00:44 de 10/11) e, com ela, exportação para Excel, modal do 1/3 v1 (sem ano/trimestre/título, só data, **com a divisão automática das semanas**) e dashboard. O frontend é publicado pelo GitHub Actions a cada push na `main`, então essas telas estão no ar.
  - **Commit "." (`0d3cd5c`, do usuário, dentro do PR #6):** levou para a `main` a parte de **backend** das validações de datas, ainda em andamento naquele momento (`domain/umTerco.ts`: semanas em ordem, nenhuma depois do prazo, `exigirAberturaNaoPassada`; rota usando essas regras). Se o Render publicou a `main`, a produção já aplica essas regras no backend. A divisão automática do frontend publicado gera semanas compatíveis com elas.
  - **Ainda não está na `main`:**
    - `feature/validacao-datas-um-terco`: frontend com semanas manuais e avisos na hora; remove a divisão automática;
    - `feature/um-terco-escolas`: escolas por ciclo, **com migration**.
  - **Ordem obrigatória para publicar as escolas:**
    1. `prisma migrate deploy` no Neon (aditiva; ciclos atuais ficam "todas");
    2. juntar à `main`.
    
    Juntar antes da migration faz o backend consultar colunas inexistentes e derruba o 1/3.
  - **Não conferido:** qual commit o Render está rodando.
- **10/11/2026: Formulário 1/3: ciclos inativos em tela separada (pedido do usuário; branch `fix/um-terco-inativos-separados`, criada da `main` fb332b8 para poder ser publicada sem a migration das escolas; só frontend).**
  - **Contexto:** o usuário pediu para "remover o único formulário 1/3 aberto" na produção. O levantamento mostrou que o único ciclo da produção (#8, abertura 11/11, prazo 16/12) **já estava inativo**, então nada foi apagado: a trava "exatamente 1 ciclo aberto" abortou a exclusão. O usuário esclareceu que não queria apagar, e sim **tirar os inativos da tela principal** ("se cada inativo ficar ali vai virar uma bagunça"). O script de exclusão foi descartado sem uso.
  - **Mudança (`UmTercoSecretariaPage.jsx`):**
    - a lista principal mostra só os ciclos ativos;
    - abaixo do título fica o link **"Ver inativos (N) →"**;
    - a lista de inativos abre na mesma página, com endereço próprio (`#/formulario-um-terco?ver=inativos`), para o Voltar do navegador funcionar. Ela tem o título "Formulário 1/3 — Inativos", "← Voltar aos ciclos ativos", Reativar em cada ciclo e não tem "+ Novo ciclo";
    - as mensagens de inativar e reativar dizem onde o ciclo foi parar.
  - **Backend:** nada mudou. O dashboard e a exportação já usavam só os ciclos ativos.
  - **Teste:** `homologacao/47-um-terco-inativos-separados.mjs`, desktop e celular, banco local: **8/8**. Cobre:
    - contagens iguais às do banco (1 ativo, 31 inativos);
    - nenhum selo "Inativo" na lista principal;
    - endereço próprio e Voltar;
    - ciclo de teste inativado pela tela saindo da lista e aparecendo em inativos, depois reativado e voltando.
    
    O ciclo do teste ficou inativo no fim.
- **10/11/2026: migration das escolas do 1/3 confirmada na produção.**
  - **Situação:** o usuário juntou a `feature/um-terco-escolas` à `main` pelo GitHub (PR **#7**, `906e234`) e depois rodou `npx prisma migrate status` no Neon (`ep-little-voice-b53ix6xw`): "23 migrations found… Database schema is up to date!". São 23 também na pasta `prisma/migrations`, então `20261110120000_um_terco_escolas_do_ciclo` está aplicada. O ciclo #8 da produção ficou "todas as escolas".
  - **Não confirmado por mim:** se a migration foi aplicada antes ou depois do deploy do PR #7 no Render, ou seja, se houve um intervalo com o 1/3 fora do ar. Também não testei o app publicado.
  - **Branches:** o usuário reclamou do excesso. Regra nova: uma branch de trabalho por lote de publicação (memória `feedback_poucas_branches`). A única mudança ainda não publicada é a dos inativos separados (`fix/um-terco-inativos-separados`, também no topo da `feature/um-terco-escolas`). As outras 7 branches já estão inteiras na `main` e aguardam autorização para serem apagadas.
- **10/11/2026: limpeza de branches (autorizada pelo usuário: "pode, para ambos").**
  - **Apagadas:**
    - no computador: as 7 branches já inteiras na `main` (`feature/dashboard-entregas`, `exportacao-excel`, `modal-ciclo-um-terco`, `validacao-datas-um-terco`, `fix/ajustes-telas-secretaria`, `assistente-disciplinas-por-turma`, `filtro-turma-alunos-pdi`), cada uma conferida com 0 commits fora da `main`;
    - no GitHub: as 5 dessas que existiam lá.
  - **Publicação dos inativos separados:** pela `feature/um-terco-escolas`, que é a base da `main` atual e entra sem conflito: PR `main...feature/um-terco-escolas`, aberto pelo usuário no GitHub (o `gh` não está instalado). A `fix/um-terco-inativos-separados` tem a mesma mudança, mas saiu da `main` antiga (daria conflito); ficou redundante.
  - **Achado:** `fix/filtro-escola-sempre-visivel` (`53fc076`, "PDI > Alunos: filtro Escola sempre visível") **nunca entrou na `main`**, então o filtro de escola publicado continua aparecendo só com "Todas as escolas" no topo.
- **10/11/2026: "Reabrir" só depois do prazo, no 1/3 e na Aplicação PDI (pedido do usuário; branch `fix/reabrir-so-apos-prazo`; frontend e backend).**
  - **Antes:** o botão aparecia em qualquer ciclo/Aplicação não inativo, inclusive aberto ou agendado, onde não tem efeito. O backend aceitava a reabertura.
  - **Agora:**
    - o botão só aparece com o prazo encerrado (1/3: `statusPrazo === 'encerrado'`; PDI: `status === 'expired'`);
    - o backend responde 409 antes disso, com a mensagem "use Editar" ou "Editar vigência" para estender o prazo.
    
    O resto da validação de reabertura não mudou.
  - **Testes:**
    - `testar-integracao` 1/3: 50/50;
    - `homologacao/48-reabrir-so-apos-prazo.mjs` 3/3: tela do 1/3 (aberto sem botão, encerrado com botão), API do 1/3 (409/201), API do PDI com Aplicação vigente (409).
    
    A tela do PDI não foi testada no navegador; a condição é a mesma linha do botão.
- **10/11/2026: modo noturno sem "verde fluorescente" (pedido do usuário; mesma branch `fix/reabrir-so-apos-prazo`; só frontend, estética).**
  - **Causa:** os fundos `bg-teal-50` e `bg-teal-100` e as bordas teal claras não tinham versão noturna (só ciano e esmeralda tinham), então ficavam verde-menta claro no fundo escuro. A bolinha da chave usava `bg-cyan-200`.
  - **Pontos corrigidos:** faixa "Encontrou um problema…", avatar do topo, ícone do item ativo do menu e semanas preenchidas do 1/3.
  - **Mudanças:**
    - `styles/index.css` ganhou as versões noturnas de `bg-teal-50/100/300`, `border-teal-200/300` e `text-teal-900`, no mesmo estilo dos remapeamentos existentes;
    - a bolinha da chave passou a `bg-slate-300` (`Header.jsx`);
    - o contador do menu lateral passou de `bg-teal-400` para `bg-teal-700` com número branco (`Sidebar.jsx`);
    - o topo das barras do logo passou de `#5eead4` para `#7cc2b8` (`Logo.jsx`).
  - **Modo claro:** sem mudança visual, salvo o logo levemente mais suave.
  - **Conferido em captura de tela** (modo noturno e modo claro); sem teste automatizado.
- **10/11/2026: 1/3 do Professor — botão "Editar" depois de concluir.**
  - Na lista do Professor, o botão de um formulário 1/3 já concluído (e ainda editável) passou de "Continuar" para "Editar". Só o texto mudou; o comportamento é o mesmo.
  - Camada: só frontend (`src/pages/UmTercoProfessorPage.jsx`).
  - Testado: build; sem teste automatizado.
- **10/11/2026: PROPOSTA da aba "Acompanhamento Escolar" (só análise; NENHUMA implementação autorizada).**
  - **Documento completo:** `PROPOSTA_ACOMPANHAMENTO_ESCOLAR.md` (raiz do repositório). Nada foi construído: nenhuma tela, endpoint, migration, estilo ou biblioteca.
  - **Decisões de planejamento propostas:**
    - painel só de leitura para a Secretaria (v1), em três camadas: Rede → Prazos → Escola;
    - mesmas unidades das telas atuais: PDI = Ficha (aluno × disciplina, esperado como em `/pdi-aplicacoes/indicadores`); 1/3 = entrega única (professor × ano/série × disciplina, como em `montarPainel`); recorte do 1/3 por escola é cobertura e não soma;
    - sem nomes de alunos ou professores, sem ranking de escolas; linguagem "Entregas que merecem acompanhamento";
    - depois do prazo o item é "não concluído no prazo", não "atrasado" (o professor não consegue preencher sem reabertura);
    - gráficos em SVG próprio, sem biblioteca nova; identidade visual própria (índigo + verde-água sóbrio + areia + terracota), com modo noturno;
    - um endpoint agregado novo, só leitura, em lote, com cache curto; sem migration.
  - **Indicadores analisados:** conclusão do PDI vigente; conclusão do 1/3 por ciclo; prazos próximos; itens que merecem acompanhamento; ritmo de preenchimento (PDI por `concluidaEm`, 1/3 por `HistoricoEntregaUmTerco`); comparativo entre ciclos do 1/3; estrutura da rede. Descartados: ranking, por professor, tempo médio até concluir, total de alunos, percentual de PDI encerrado.
  - **Limitações encontradas:**
    - o esperado do PDI é recalculado com os vínculos de hoje, então o percentual de Aplicações já encerradas não é confiável; a proposta usa números absolutos no histórico do PDI. Uma "fotografia do esperado no prazo" exigiria migration (etapa 7, opcional);
    - o PDI não tem histórico de "em preenchimento" ao longo do tempo;
    - `AlunoPdi` não é o total de matriculados.
    - O esperado do 1/3 usa as datas dos vínculos, então é estável e comparável entre ciclos.
  - **Pendente de decisão do usuário:** limiares de prazo e andamento (§6.2 e §10 do documento), quem acessa, se Correções entram e a paleta.
  - **Arquivos:** `PROPOSTA_ACOMPANHAMENTO_ESCOLAR.md` (novo) e este registro. Camadas: nenhuma (documentação). Não testado (não há código).
- **10/11/2026: Acompanhamento Escolar, decisões do usuário sobre a proposta (implementação ainda NÃO autorizada).**
  - Limiares aprovados: 7 dias, 50%, mínimo de 5 itens, "sem movimento" depois de 7 dias.
  - Acesso: Secretaria vê a rede inteira, com filtros; Diretora vê só a própria escola; mais ninguém, por enquanto.
  - Correções abertas entram só como informação; a aba não cria nem apaga nada.
  - Visual: liberdade criativa, com padrões modernos.
  - Percentual histórico do PDI (etapa 7): o usuário pediu explicação; a decisão está pendente.
  - Documento atualizado: `PROPOSTA_ACOMPANHAMENTO_ESCOLAR.md` (§1 e §10).
- **10/11/2026: Acompanhamento Escolar IMPLEMENTADO (autorizado pelo usuário: "faz isso tudo", inclusive a etapa 7; "se precisar paginar, faça paginação").**
  - **O que é:** aba só de leitura em `/acompanhamento-escolar` (substituiu o "em construção").
    - Secretaria: rede inteira; clicar numa escola (ou escolher no seletor do topo) abre a visão da escola.
    - Diretora: só a própria escola; ganhou o item no menu.
    - Gestor e os demais perfis: 403.
    - Regras ACP-01 a ACP-09 em `REGRAS_DE_NEGOCIO_NEXO.md` (seção 22). Proposta e o que mudou: `PROPOSTA_ACOMPANHAMENTO_ESCOLAR.md` (seção 11).
  - **Backend:**
    - `GET /api/acompanhamento/rede` e `/escola/:id` (`backend/src/api/routes/acompanhamento.ts`), com cache de 60 s; sem nomes de pessoas;
    - regras puras em `backend/src/domain/acompanhamento.ts` (limites 7 dias, 50%, mínimo 5, 7 dias sem movimento, 30 dias de encerrado);
    - contagem de Fichas em lote em `backend/src/lib/contagemFichasPdi.ts` (mesma regra de `/pdi-aplicacoes/indicadores`, que ficou intocado);
    - `montarPainel` do 1/3 passou a ser exportado (sem mudança de comportamento).
  - **Banco: migration ADITIVA `20261111120000_fotografia_aplicacao_pdi`** (tabela `fotografias_aplicacao_pdi`).
    - Job `backend/src/jobs/fotografiaPdiJob.ts`: 08:30 e na subida do servidor; fotografa Aplicações ATIVAS encerradas há 1 a 3 dias; idempotente.
    - **Precisa ser aplicada na produção ANTES de publicar o backend** (o Render não roda migrations). Sem ela, a aba dá erro 500 e o job só registra erro no log.
  - **Frontend:**
    - `src/pages/AcompanhamentoEscolarPage.jsx`, `src/components/acompanhamento/Graficos.jsx` (SVG próprio, sem biblioteca), `src/styles/acompanhamento.css` (tokens próprios sob `.acp`, modo noturno), `src/services/acompanhamento.js`;
    - menu da Diretora em `Sidebar.jsx`; rota em `App.jsx`;
    - paginação: mapa 8, lista 5, prazos 6;
    - filtros (ano, formulário, trimestre ou ciclo) ficam na URL.
  - **Testado (banco local):**
    - `homologacao/50-acompanhamento-escolar.mjs`: 10/10. Inclui:
      - números iguais a `/indicadores` e ao painel do 1/3;
      - permissões;
      - foto do PDI;
      - tela da Secretaria e da Diretora;
      - filtro na URL;
      - modo noturno;
      - celular de 375 px sem rolagem lateral;
      - sem erros no console.
    - Regressão (33–36) e 45–48 do 1/3: 105 aprovados, nenhum reprovado. Build ok.
    - **Não testado:** produção e celular real.
- **10/11/2026: fluxo de correções para professores (PDI e Formulário 1/3).** Branch `feature/correcoes-professor` (criada a pedido do usuário, a partir de `fix/reabrir-so-apos-prazo`); commits locais, SEM push.
  - **Fluxo:**
    - A Secretaria escreve "O que precisa ser corrigido?" (obrigatório) e confirma.
    - O prazo é FIXO de 3 dias corridos (72 h, horário de São Paulo), sem configuração.
    - O professor recebe uma mensagem automática na caixa de mensagens EXISTENTE, com as orientações, o prazo, a identificação e o botão "Abrir formulário".
    - Ele corrige; salvar é rascunho e só "Enviar correção" envia.
    - A Secretaria vê "Correção recebida" e aceita, ou devolve de novo.
  - **Regras:**
    - Devoluções ilimitadas, uma aberta por vez (isso também segura o duplo clique); histórico completo preservado.
    - Prazo vencido: "Prazo de correção encerrado", sem bloquear, sem apagar, sem cobrança; o envio tardio fica marcado "fora do prazo".
    - Libera só aquele formulário, mesmo com a Aplicação ou o ciclo encerrados.
    - Regras COR-01 a COR-10 em `REGRAS_DE_NEGOCIO_NEXO.md`, seção 23; PDI-11 atualizada.
  - **Decisões tomadas na implementação (simples; o usuário pode mudar):**
    - **1/3 não tinha correção nenhuma:** ganhou só a devolução e o aceite. Não foi criada correção direta da Secretaria no 1/3.
    - **Uma devolução aberta por vez:** devolver de novo exige que o professor tenha enviado a anterior.
    - **Quem recebe = quem consegue editar** pela regra de acesso já existente (PDI: professor da turma ATUAL do aluno na disciplina; 1/3: o dono da entrega). Aluno transferido de escola, ou sem professor: a devolução é recusada com explicação, e a Secretaria usa a correção direta. Isso trata o DEF-18.
    - **No PDI, "Enviar correção" é o mesmo botão de concluir.** Ele também envia a correção das perguntas comuns, que ANTES era resolvida só por salvar.
  - **Banco:** migration ADITIVA `20261112120000_correcoes_fluxo_professor`.
    - Colunas novas `conferidaEm`, `conferidaPor` e `conferencia` nas duas tabelas de correção do PDI; `observacao` passou de 500 para 2000 caracteres.
    - Coluna `linkFormulario` em `mensagens`.
    - Tabela nova `correcoes_entrega_um_terco`.
    - **Precisa ser aplicada na produção ANTES de publicar o backend** (o Render não roda migrations).
    - Junto com a do Acompanhamento Escolar, são 25 migrations.
  - **Backend:**
    - `domain/correcoes.ts` (situação, prazo, texto da mensagem) e `lib/mensagemCorrecao.ts` (mensagem na mesma transação; notificação com idempotência);
    - `routes/correcoesPdi.ts`: devolver e devolver-padrao reescritos; aceitar e aceitar-padrao novos; filtro `correcao=em_andamento`; nomes no histórico;
    - `routes/pdiFichas.ts`: correção aberta sem condição de prazo; concluir envia a da Ficha e a do bloco; correção nas respostas; `correcaoSolicitada` em meus-pdis;
    - `domain/pdiBlocoPadrao.ts`: correção do bloco sem condição de prazo;
    - `routes/formularioUmTerco.ts`: devolver e aceitar entrega; edição liberada só da entrega com correção; concluir envia; correção no detalhe, em minhas e no painel; filtro;
    - `routes/mensagens.ts`: devolve `linkFormulario`.
  - **Frontend:**
    - `components/Correcoes.jsx` (selo, formulário ou modal com confirmação, histórico, aviso para o professor);
    - `CorrecoesPdiDetalhePage.jsx` (a correção direta foi mantida; enviar para correção, aceitar e histórico);
    - `CorrecoesPdiListaPage.jsx` (selo e "Só com correção em andamento");
    - `MensagensPage.jsx` (botão "Abrir formulário");
    - `FormularioPdiAlunoPage.jsx` (orientações e "Enviar correção · disciplina") e `MeusPdisPage.jsx` (selo);
    - `UmTercoPainelPage.jsx` (enviar, aceitar, histórico, selo e filtro);
    - `UmTercoProfessorPage.jsx` (selo e botão "Corrigir");
    - `UmTercoPreenchimentoPage.jsx` (orientações e "Enviar correção");
    - services `correcoesPdi.js`, `formularioUmTerco.js` e `pdiFichas.js`.
  - **Testes (banco LOCAL):**
    - `homologacao/51-correcoes-professor.mjs`: 24/24. Inclui:
      - orientação obrigatória;
      - duplo clique;
      - 72 h exatas;
      - mensagem com link;
      - outro professor sem acesso;
      - sem misturar disciplinas;
      - rascunho não envia;
      - envio duplo;
      - recebida, aceita e aceitar duas vezes;
      - prazo vencido sem bloqueio e "fora do prazo";
      - três devoluções com histórico;
      - Aplicação encerrada sem liberar outra Fichas;
      - bloco comum;
      - aluno transferido;
      - 1/3 com duas correções simultâneas e com o ciclo encerrado;
      - telas da Secretaria e do professor (celular 390 px), inclusive recarregar a página;
      - sem erros no console.
    - Preparação direta no banco: os alunos com Fichas concluídas do P04 tinham sido transferidos por testes antigos. As Fichas 10, 11 e 12 foram marcadas como concluídas e voltaram ao status original no fim.
    - Regressão: 115 aprovados (33, 30, 30b, 31, 32, 34, 34b, 35, 36, 45, 46, 47, 48, 50), integridade 8/8. Baterias: 1/3 domínio 20/20 e integração 50/50; PDI formulário único 36/36 (uma checagem antiga foi atualizada para a regra nova do bloco) e indicadores 29/29. Build ok.
  - **Não testado ou limitações:**
    - Envio pelo botão na tela com Ficha incompleta: o botão fica desabilitado até tudo estar respondido, e o teste enviou pela API.
    - Falha de rede no meio do envio: coberta pelos testes offline existentes (32), sem caso novo.
    - Celular físico e produção não testados.
    - A mensagem vai como conversa nova por devolução; o professor pode responder nela.
- **10/11/2026: 1/3, inativar ciclo mesmo com preenchimentos (decisão do usuário, opção 1).**
  - Antes, o botão "Inativar" sumia e o servidor recusava assim que algum professor tinha começado.
  - Agora pode sempre. O modal avisa quantos preenchimentos já foram iniciados e diz que nada é apagado: o ciclo sai da lista do professor e volta inteiro ao reativar.
  - UT-13 atualizada.
  - Camadas: backend (`formularioUmTerco.ts`, POST inativar) e frontend (`UmTercoSecretariaPage.jsx`). Sem migration.
  - Testado (banco local):
    - `homologacao/52-inativar-um-terco-com-preenchimentos.mjs` 3/3: aviso na tela; inativar com 8 entregas e 32 respostas sem perder nada; reativar devolve.
    - 47 (inativos): 9/9.
    - 1/3 integração: 50/50.
- **10/11/2026: PRODUÇÃO, dados de teste montados a pedido do usuário (sem mudança de código).**
  - **Causa do caso da professora Aline Guedes (1M2, E. M. Três Marias, escola 25):** só 5 de 6 Fichas apareciam porque **não existia Modelo PDI de Matemática** (nem de Geografia e História). Uma Aplicação só leva as disciplinas com Modelo ativo no momento da criação.
  - **Feito pela API oficial, como a Secretaria:**
    - Modelos novos: Geografia (87), História (88) e Matemática (89), com as perguntas padrão. Nenhum Modelo existente foi apagado.
    - Aluno de teste "Aluno Teste PDI 1M1" (id 662) na 1M1 (turma 1604), que estava vazia.
    - Professor de teste "Professor Teste Todas as Disciplinas" (id 137), com vínculo nas 10 disciplinas da 1M1. A turma não tinha professor, então nada foi substituído.
    - A Aplicação 176 da escola 25 (0 respostas, só 6 disciplinas) foi apagada de fato e recriada como **Aplicação 177** (10/11 a 13/12/2026) com as 10 disciplinas. A Aline passa a ver Matemática.
  - **Testado na produção:**
    - Pela API: 10/10 Fichas editáveis para o professor de teste.
    - Pelo site, em navegador real: aluno em Meus PDIs; formulário com as 10 disciplinas e "Preenchimento disponível".
  - A senha da conta da Secretaria foi trocada no banco local e na produção, a pedido do usuário. **Senhas nunca vão para arquivos do repositório.**
- **10/11/2026: Gestão de Pessoas: inativos fora da lista principal (pedido do usuário; só frontend).**
  - **Regra nova (vale para o sistema todo):** inativo some da tela principal e vai para uma visão separada, só para consulta e reativação. Nada é apagado.
  - **Feito:** Professores, Auxiliares, Supervisores e Diretoras mostram só os ativos. Acima da tabela fica o link "Ver inativos (N) →"; na visão de inativos há "← Voltar aos ativos" e o botão Reativar continua. Estado local (não usa a URL, porque as abas dessa página também são estado).
  - **Já cumpriam a regra, sem mudança:** Formulário 1/3 (ciclos inativos, entrada de 10/11) e PDI (Modelos inativos em "Histórico de Modelos"; Aplicações removidas em seção própria, `FormularioPdiPage.jsx`).
  - **Fora do escopo, de propósito:** perguntas inativas dentro de um Modelo PDI/Anamnese continuam inline com a etiqueta "Inativa" (a reordenação depende da lista completa); Escolas e Turmas não foram pedidas e não foram alteradas; a exportação Excel de Professores continua com todos e a coluna Status.
  - Camadas: só frontend (`src/pages/GestaoPessoas.jsx`: `ListaPessoas`, `LinkInativos`, `separarInativos`). Backend e banco não mudaram.
  - Testado: `vite build` passa. **Não testado no navegador** (nem em celular).
- **11/11/2026: LANÇAMENTO "Educa São João" — decisões do usuário (plano em andamento).**
  - Lançamento em ~3 dias (até ~14/11/2026). Média de 30 usuários simultâneos, pico possível de 120. **Só o Formulário 1/3 será aberto.** O PDI não foi testado e não será usado.
  - Começa com **uma escola** (ainda a definir). A lista de professores ainda não chegou e é o maior risco do prazo.
  - Nome do sistema: **"Educa São João"** (substitui o provisório "Nexo"). Domínio **`educasaojoao.com.br`**, já comprado pelo usuário no registro.br. O DNS ainda não foi configurado.
  - Infraestrutura mantida para gastar pouco e mudar pouco: GitHub Pages (site, futuro `educasaojoao.com.br`), Render no plano Starter de US$ 7 (API, futuro `api.educasaojoao.com.br`), Neon (banco; o plano e a janela de PITR ainda não foram verificados), UptimeRobot grátis (monitoramento de `/health`, ainda não criado).
  - Decisões: (1) esconder o PDI no frontend e **apagar a Aplicação 177** da produção; (2) **apagar os dados de teste da produção** (professor 137, aluno 662 e o que depender deles), sempre mostrando ao usuário antes o que vai ser apagado; (3) **sem migrations até o fim do preenchimento**, para poder voltar atrás; (4) rate limit no login; (5) trocar a senha do Neon e o `JWT_SECRET` antes da abertura; (6) manter a origem `github.io` no `FRONTEND_ORIGIN` como reserva.
  - Volta atrás: tag `v1.0-lancamento`; revert na `main` (Pages); Rollback do Render; branch `pre-lancamento` no Neon + PITR.
  - Branch única do lote: `lancamento/educa-sao-joao` (criada da `main` f92698c). `fix/filtro-escola-sempre-visivel` fica de fora de propósito (é do PDI). `fix/um-terco-inativos-separados` é redundante (a mudança já está na `main` como 712518a).
- **11/11/2026: nome "Educa São João" na interface (só frontend).**
  - Troca de "Gestão Pedagógica" por "Educa São João": `index.html` (title e apple-mobile-web-app-title), `public/manifest.webmanifest` (name, short_name, description), `Header.jsx`, `Sidebar.jsx`, `LoginPage.jsx` e `Logo.jsx` (aria-label). O subtítulo "Rede Municipal de Ensino" foi mantido.
  - Arquivos Excel exportados: o prefixo `nexo-` virou `educa-sao-joao-` (`GestaoPessoas`, `GestaoTurmas`, `PdiHomePage`, `PdiPage`, `exportarUmTerco`), e o autor da planilha passou de `NEXO` para `Educa São João` (`exportarExcel.js`). Comentários internos com "NEXO" (ex.: `acompanhamento.css`) e nomes de documentos (`REGRAS_DE_NEGOCIO_NEXO.md`) não mudaram.
  - Backend e banco não mudaram.
  - Testado: `vite build` passa. **Não visto no navegador.** Quem já instalou o app no celular (PWA) pode continuar vendo o nome antigo no ícone até reinstalar.
- **11/11/2026: PDI desligado na interface para o lançamento (decisão do usuário; só frontend).**
  - Chave única: `src/config/modulos.js` → `PDI_ATIVO = false`. Para religar, basta trocar para `true` (tudo volta como era).
  - Efeitos com a chave desligada:
    - Menu (`Sidebar.jsx`): somem "PDI" e "Correções" (a tela de Correções hoje só tem o PDI; as correções do 1/3 continuam dentro do próprio 1/3).
    - Rotas (`App.jsx`, guarda `SoComPdi`): `/pdi/*`, `/correcoes`, `/correcoes/pdi/*` e `/correcoes-simulados` redirecionam ao Dashboard, inclusive por link direto ou de mensagem/notificação.
    - Dashboard do Professor: sem o cartão "Formulário PDI" e sem carregar `meus-pdis`. O atalho "Acessar PDI" virou "Abrir Formulário 1/3".
    - Dashboard da Secretaria: sem o cartão de entrega do PDI, sem a coluna "PDI preenchido" e sem carregar os indicadores do PDI.
    - Dashboard do Gestor: sem o cartão do PDI (fica só a saudação).
    - Acompanhamento Escolar: preso no 1/3 (`form = 'umTerco'`), sem o seletor Todos/PDI/1/3, sem o painel "Estrutura da rede" (que só fala de PDI) e, na visão da escola, sem "alunos com PDI" e sem o cartão "Correções do PDI".
  - **Não mudou:** backend, banco e dados do PDI (a API do PDI continua respondendo para quem chamar direto). O perfil Auxiliar ("Meus alunos", que é do PDI) não foi mexido, porque nenhum Auxiliar será cadastrado no lançamento. A Aplicação 177 ainda **não** foi apagada (próximo passo, com dry-run).
  - Testado (banco local, navegador real): `homologacao/53-pdi-desligado.mjs` **46/46** (Professor, Secretaria, Gestor e Diretora, no computador e no celular de 390 px: menu, Dashboard, rotas diretas, Acompanhamento sem PDI e sem rolagem lateral, nenhum erro no console). Regressão do 1/3: 44 (21/21), 46 (8/8), 47 (8/8) e 52 (3/3). Build ok.
  - **Esperado de propósito:** os testes antigos do PDI (16–36, 45, 50) falham enquanto a chave estiver desligada, porque as telas do PDI redirecionam. Para rodá-los, religar a chave localmente.
- **11/11/2026: DNS do `educasaojoao.com.br` — PENDENTE (usuário vai retomar depois).**
  - No registro.br: DNS do próprio Registro.br (mantido). Em "Configurar endereçamento" o usuário clicou em "Modo avançado", e o domínio ficou "em transição" (a ativação leva minutos, às vezes até 1 h).
  - **Falta criar, no modo avançado:** A `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; CNAME `www` → `hevertonvp.github.io`; CNAME `api` → `teachers-app-xokm.onrender.com`. Se já vier alguma entrada pronta, conferir com o print antes de apagar.
  - **Depois:** configurar o domínio no GitHub Pages e no Render, trocar `VITE_API_URL` no `deploy.yml` e incluir as origens novas em `FRONTEND_ORIGIN`. Fazer junto com a publicação, porque o `github.io` passa a redirecionar para o domínio novo.
- **11/11/2026: backup do Neon — decisão do usuário: continuar no plano GRÁTIS.**
  - Verificado no painel (Backup & Restore): plano Free, projeto `gestao-escolar`, branch `production`, **janela de restauração de 6 horas**. Nenhum snapshot criado e sem agendamento (snapshots agendados exigem upgrade).
  - Compensação combinada: (1) snapshot manual ("Create") logo antes da abertura do 1/3, no momento que o Claude indicar; (2) cópia diária do banco salva no notebook do usuário (`pg_dump`), ainda a montar. Nesta máquina não há `pg_dump` (o embedded-postgres da homologação não traz). Será preciso instalar o cliente do PostgreSQL na versão do Neon. A cópia contém dados pessoais e não pode ir para o Git.
  - Risco aceito: um problema percebido mais de 6 h depois só volta até o último snapshot ou a última cópia diária.
- **11/11/2026: proteção do login (rate limit) ADIADA — decisão do usuário.**
  - Proposta apresentada: 5 erros por e-mail+IP em 15 min e 50 por IP, com `trust proxy` no Render. O usuário achou arriscado mexer a 3 dias do lançamento, porque uma configuração errada do proxy poderia bloquear todos.
  - Decisão: fazer **depois da primeira semana** do lançamento, com o sistema estável. Opção de menor risco já levantada para quando for feito: limitar só por e-mail (5 erros → 15 min), sem depender do IP nem do proxy.
  - Continua no plano antes da abertura: trocar a senha do Neon e o `JWT_SECRET`.
- **11/11/2026: DNS do `educasaojoao.com.br` salvo pelo usuário no registro.br (modo avançado).** As 6 entradas foram conferidas pelo Claude antes de salvar: A `educasaojoao.com.br` → 185.199.108/109/110/111.153; CNAME `www` → `hevertonvp.github.io`; CNAME `api` → `teachers-app-xokm.onrender.com`. Servidores: `a.auto.dns.br`/`b.auto.dns.br`. Logo depois de salvar, os registros ainda não respondiam (a publicação da zona leva minutos a algumas horas). Ainda falta: GitHub Pages, Render, `VITE_API_URL` e `FRONTEND_ORIGIN`, tudo na hora da publicação.
- **11/11/2026: limpeza dos dados de teste da PRODUÇÃO — script pronto, ENSAIO feito, execução aguardando confirmação.**
  - Pedido do usuário: apagar todos os professores, todos os alunos do PDI, todos os ciclos do 1/3 (o ciclo 10, que abria em 16/11, "não é real") e a "escola teste" (id 60). As Aplicações do PDI vão junto (dependem dos alunos; a 177 já estava decidida).
  - Script: `backend/scripts/lancamento/limpar-dados-teste.ts`. Por padrão roda como ENSAIO: executa tudo numa transação e desfaz no fim. Só grava com `CONFIRMO=APAGAR-PRODUCAO` + `--executar`. Travas: confere o nome da escola 60, não pode apagar pessoas de outros perfis, Modelos PDI ou disciplinas, e falha se sobrar algo.
  - Ensaio no Neon (produção), 11/11/2026: 8 professores, 9 alunos, 26 Aplicações (30 Fichas, 68 respostas), 3 ciclos (2 entregas), 42 vínculos turma-disciplina, 12 vínculos escolares, 2 conversas, escola 60 com 4 turmas. Ficam a Secretaria (#4), o Administrador/Suporte (#112) e a Diretora Rogério (#138), 12 escolas, 380 turmas, 13 Modelos PDI e 10 disciplinas. Nada foi gravado.
  - Mantidos de propósito: Modelos PDI, perguntas, CRMG, calendário, Modelos de Anamnese e notificações da Secretaria.
- **11/11/2026: limpeza dos dados de teste EXECUTADA na produção (autorizada pelo usuário).**
  - O usuário confirmou apagar também Elisa (#114) e Aline (#136), e **recusou o snapshot manual** ("nada nisso é importante"). Restava só a janela de 6 h do Neon.
  - Resultado gravado, o mesmo do ensaio: escolas 13 → 12, turmas 384 → 380, professores 8 → 0, alunos PDI 9 → 0, Aplicações 26 → 0, Fichas 30 → 0, ciclos 1/3 3 → 0, entregas 2 → 0, conversas 2 → 0. Pessoas mantidas: 3 (Secretaria #4, Suporte #112, Diretor Rogério #138). Modelos PDI 13 e disciplinas 10 sem mudança. Conferido por consulta depois da execução. `/health` da API ok.
  - Rogério é diretor (homem). O perfil continua `DIRETORA` (nome técnico). Na interface, o topo mostra "Diretor(a)", mas telas da Secretaria ainda dizem "Diretora(s)" (`GestaoPessoas.jsx`, `FeedbacksSistemaListaPage.jsx`).
- **11/11/2026: teste de carga na PRODUÇÃO (autorizado; a produção ainda não tinha usuários reais) — EM ANDAMENTO.**
  - Script: `backend/scripts/lancamento/teste-carga.ts` (`--preparar`, `--rodar`, `--pico-login`, `--limpar`). Tudo leva o prefixo `ZZCARGA`: escola #61, 120 professores `zzcarga-N@teste.invalid` e 1 secretaria de teste, 120 turmas, ciclo #11 só para a escola de teste (`todasEscolas=false`, prazo até ~13/11). **Precisa rodar `--limpar` antes do lançamento.** Ensaiado antes no banco local (a limpeza deixou as contagens idênticas).
  - Apoio: `backend/scripts/lancamento/_api-local-sem-cron.ts` sobe só a API, sem scheduler, para testes locais.
  - **Rodada 1 (Render atual, 30 usuários, 3 min, pausa de 3–8 s):** 623 requisições, 0 erros, mas lento: salvar semana p50 5,4 s / p95 7,6 s; abrir formulário p50 2,5 s; login p50 1,1 s.
  - **Causa encontrada:** `pgbouncer=true` no `DATABASE_URL`. Com ele, cada consulta do Prisma faz ~5 idas e voltas ao banco. Medido daqui até o Neon: 0,75 s por consulta com a opção e 0,15 s sem ela (a distância pura é ~0,15 s). Com o sistema parado no Render, a rota simples `/api/vinculos-escolares/me` leva ~0,9 s, contra 0,3 s do `/health`. Isso sugere que o Render está em outra região (provavelmente Oregon, o padrão do Render) e o Neon em us-east-2 (Ohio), a ~60 ms.
  - Teste sem `pgbouncer=true` (API local apontando para o Neon, 30 usuários): **nenhum erro de prepared statement**, então tirar a opção é seguro no pooler do Neon. Mas daqui (Brasil, 150 ms por consulta) o pool do Prisma esgotou ("Unable to start a transaction in the given time", 38 respostas 500). Isso não representa o Render; mostra que o tempo por consulta × consultas por transação é o gargalo.
  - Próximo passo, pendente do usuário: confirmar a região do Render e o final do `DATABASE_URL` configurado lá.
- **11/11/2026: API nova em OHIO e teste de carga aprovado.**
  - O Render antigo (`teachers-app-xokm`) estava em **Oregon**; o Neon fica em us-east-2 (Ohio). O Render não muda a região de um serviço existente, então o usuário criou um serviço novo: **`educa-sao-joao-api` → https://educa-sao-joao-api.onrender.com**, região Ohio, Starter US$ 7, branch `main`, Root `backend`, mesmos comandos do antigo (start: `npx prisma migrate deploy && npm start`).
  - `DATABASE_URL` do serviço novo: pooler **sem `pgbouncer=true`** e com `connection_limit=10`. O `DIRECT_URL` (sem pooler) é obrigatório, porque o primeiro deploy falhou sem ele. As outras variáveis foram copiadas do antigo.
  - **O serviço antigo continua no ar** (o site publicado ainda aponta para ele). Só suspender depois que o site e `api.educasaojoao.com.br` estiverem no novo e conferidos; apagar alguns dias depois. Os crons rodando nos dois ao mesmo tempo não fazem mal: são todos do PDI, que está vazio.
  - **A senha do Neon apareceu na conversa** (o usuário colou o `DATABASE_URL`). A troca da senha antes da abertura passou a ser obrigatória, e precisa ser atualizada nos dois serviços.
  - **Resultados no serviço de Ohio** (dados ZZCARGA, pausa de 3–8 s):
    - 30 usuários, 3 min: 1.064 requisições, **0 erros**. Salvar semana p50 0,24 s / p95 0,37 s (antes 5,4 s / 7,6 s). Abrir formulário p50 0,20 s. Login p50 0,46 s.
    - **120 usuários, 3 min: 3.996 requisições (20,7/s), 0 erros.** Salvar semana p50 0,25 s / p95 0,45 s / p99 0,75 s. Concluir p95 0,35 s.
    - Ponto fraco: **login em massa**. 120 logins espalhados em 10 s → p50 7,5 s / máx 14 s; 120 logins no mesmo instante → todos em ~18 s; login isolado ~0,8 s. Causa: bcrypt (`bcryptjs`, custo 10) com 0,5 CPU. Durante o pico, as outras requisições também esperam (p95 até ~11 s nos primeiros segundos). A sessão dura 12 h (JWT), então cada professor entra ~1 vez por dia. Começando com uma escola, um pico real fica bem abaixo de 120. **Não alterado.** Se for preciso depois: biblioteca `bcrypt` nativa ou instância maior por alguns dias.
  - Os dados ZZCARGA continuam no banco para um teste final pelo domínio novo. **Rodar `npx tsx scripts/lancamento/teste-carga.ts --limpar` antes do lançamento.**
- **11/11/2026: site passa a usar a API de Ohio (pedido do usuário). Etapa 1 de 2 da publicação.**
  - `.github/workflows/deploy.yml`: `VITE_API_URL` → `https://educa-sao-joao-api.onrender.com`. Vale quando a branch `lancamento/educa-sao-joao` entrar na `main`. Nessa publicação também entram o nome "Educa São João" e o PDI desligado.
  - CORS conferido na API nova: `https://hevertonvp.github.io` é aceito. As origens `educasaojoao.com.br`/`www` ainda não (dão 500 no preflight), e precisam entrar em `FRONTEND_ORIGIN` na etapa 2 (domínio).
  - DNS conferido: já publicado (servidores `a/c.sec.dns.br`; `www` → `hevertonvp.github.io`).
  - Para voltar atrás: reverter este commit (ou o merge) na `main`. O site volta a usar o serviço antigo de Oregon, que continua no ar.
- **11/11/2026: PUBLICADO (PR #13, merge 9402229) e etapa 2 (domínio) em andamento.**
  - No ar em `https://hevertonvp.github.io/teachers-app/`: nome "Educa São João", PDI desligado e API de Ohio. Conferido em navegador real com as contas ZZCARGA (`homologacao/54-producao-publicacao.mjs`): 23/24 OK (título, menu sem PDI, 1/3 abre, sem rolagem lateral, todas as chamadas para `educa-sao-joao-api.onrender.com`, sem erros no console, no computador e no celular). A falha foi o menu da Secretaria no computador lido vazio. No celular, com a mesma conta, veio certo; provável leitura cedo demais no teste, a repetir.
  - Decisão: a API fica no endereço `educa-sao-joao-api.onrender.com`. O `api.educasaojoao.com.br` não será usado por enquanto (menos passos). O CNAME `api` no registro.br ainda aponta para o serviço antigo, mas não é usado.
  - Render (novo): `FRONTEND_ORIGIN` ganhou `https://educasaojoao.com.br` e `https://www.educasaojoao.com.br`. CORS conferido para as 3 origens.
  - GitHub Pages: custom domain `educasaojoao.com.br` salvo, "DNS check successful". Aguardando a emissão do certificado para marcar "Enforce HTTPS". Até lá o domínio mostra aviso de https.
- **11/11/2026: DOMÍNIO NO AR — `https://educasaojoao.com.br`.**
  - O certificado do GitHub Pages saiu poucos minutos depois de salvar o custom domain. `https://educasaojoao.com.br` → 200; `www` (http e https) → 301 para `https://educasaojoao.com.br`. `http://educasaojoao.com.br` ainda dava 404 do GitHub na última checagem; o "Enforce HTTPS" foi pedido ao usuário e resolve isso. **Endereço para divulgar: `https://educasaojoao.com.br`.**
  - `homologacao/54-producao-publicacao.mjs` (agora espera o menu carregar antes de ler) **passou inteiro pelo domínio novo**: login de professor e de secretaria de teste, menu sem PDI, 1/3, computador e celular de 390 px, chamadas só para a API de Ohio, sem erros no console.
  - **Pendências do lançamento:** (1) suspender o Render antigo (Oregon) e, dias depois, apagá-lo; (2) trocar a senha do Neon (exposta na conversa) e o `JWT_SECRET`, atualizando o serviço novo (e o antigo, enquanto existir); (3) rodar `teste-carga.ts --limpar` (ZZCARGA); (4) UptimeRobot em `https://educa-sao-joao-api.onrender.com/health`; (5) "Diretora(s)" → "Diretor(a)" nas telas da Secretaria; (6) escola e lista de professores → cadastro (senha temporária vale 48 h); (7) a Secretaria cria o ciclo real do 1/3; (8) snapshot manual no Neon antes da abertura; (9) rate limit do login depois da 1ª semana.
- **11/11/2026: dados do teste de carga (ZZCARGA) APAGADOS da produção, a pedido do usuário.** `teste-carga.ts --limpar`: 0 pessoas, 0 escolas e 0 ciclos ZZCARGA restantes. Contagens idênticas às de antes do teste (pessoas 3, escolas 12, turmas 380, ciclos 0, entregas 0, disciplinas 10). As contas `zzcarga-*` do teste 54 deixaram de existir.
- **11/11/2026: PDI "EM DESENVOLVIMENTO" em vez de oculto (decisão do usuário: esconder assustaria as escolas; "manutenção" soava mal). Só frontend.**
  - `src/config/modulos.js`: `MODO_PDI = 'ativo' | 'desenvolvimento' | 'oculto'` (atual: `'desenvolvimento'`); `PDI_ATIVO`, `PDI_EM_DESENVOLVIMENTO`, `PDI_VISIVEL` e o texto único `AVISO_PDI_DESENVOLVIMENTO` ("O PDI está em desenvolvimento e estará disponível em breve. O Formulário 1/3 funciona normalmente."). Para religar: `'ativo'`.
  - `src/components/PdiDesenvolvimento.jsx`: `SeloDesenvolvimento`, `CartaoPdiDesenvolvimento` e `PdiDesenvolvimentoPage` (página "PDI em desenvolvimento", com botões "Ir para o Formulário 1/3", para Professor/Secretaria, e "Voltar ao Dashboard").
  - Menu: PDI e Correções voltam, com "em desenvolvimento" numa segunda linha. Rotas `/pdi/*` e `/correcoes*` (e `/correcoes-simulados`) mostram a página de aviso, inclusive por link direto.
  - Dashboards: Professor (cartão "Formulário PDI" com o selo, contadores "—" esmaecidos, "Meus PDIs" e "Acessar PDI (em desenvolvimento)" desabilitados; nada do PDI é carregado da API), Secretaria (cartão "Entrega do PDI" com o aviso; coluna "PDI preenchido" = "Em desenvolvimento"), Gestor (cartão PDI com botões desabilitados).
  - Acompanhamento Escolar: seletor Todos/PDI/1/3 visível, com "Todos" e "PDI 🚧" desabilitados; cartão "PDI · Em desenvolvimento" nas visões da rede e da escola; a tela continua presa no 1/3.
  - Testado (banco local, navegador real): `homologacao/55-pdi-em-desenvolvimento.mjs` **44/44** (4 perfis × computador/celular: menu, Dashboard, rotas, Acompanhamento sem rolagem lateral, 1/3 abre, sem erros no console). Regressão do 1/3: 44, 47 e 52 sem falhas. Build ok. O teste 53 (modo oculto) só vale com `MODO_PDI = 'oculto'`.
- **11/11/2026: NOVA REGRA PEDIDA — Formulário 1/3 por CARGO (no máximo 2 cargos ativos por Professor; identidade ciclo + professor + cargo; cargo = escolas → disciplinas, sem turmas; snapshot por ciclo; cargos idênticos → 1 folha compartilhada). DIAGNÓSTICO entregue, NADA implementado; aguardando decisões do usuário.**
  - Auditoria da produção (11/11): 1/3 vazio (0 ciclos, entregas, respostas, coberturas, correções e reaberturas), 0 professores, 0 PTD, 1 vínculo escolar. Migrations do 1/3 aplicadas: `20261103120000_formulario_um_terco` e `20261110120000_um_terco_escolas_do_ciclo`. A última aplicada é `20261112120000_correcoes_fluxo_professor`.
  - Hoje: `EntregaUmTerco` é única por (ciclo, professor, anoSerie, disciplina); a elegibilidade vem do PTD (turmas do Fundamental do ano letivo, escolas do ciclo); a cobertura grava os vínculos PTD; as rotas e as chaves offline usam `/:cicloId/:anoSerie/:disciplinaId`. `Pessoa.cargo` já existe como texto livre (não confundir com o cargo novo).
  - Pontos em aberto, perguntados ao usuário: data do lançamento × tamanho da mudança; cargo cria vínculo escolar automaticamente?; ciclo restrito a escolas × cargo que cobre escolas de fora; escola só de Educação Infantil; Diretora pode editar cargos?; filtros do painel e gráfico "por ano e disciplina" do Acompanhamento; cargo exigido para entrar no 1/3 mesmo sem turmas.
- **12/11/2026: pedido do 1/3 por CARGO reenviado com mais detalhe (seções 1–23). Diagnóstico reconferido; NADA implementado; aguardando decisões.**
  - Sem mudança de schema do 1/3 desde 11/11 (mesmas migrations). A produção não foi reconsultada nesta sessão (acesso às credenciais negado); vale a auditoria de 11/11 (1/3 vazio, 0 professores, 0 PTD).
  - Desenho proposto: tabelas novas `cargos_professor` (id, professor, ativo/encerrado, início, fim) e `cargo_versoes` (composição escola→disciplinas, com "vale desde"), para o ciclo usar a versão vigente na abertura sem depender de job; entrega passa a apontar para o cargo (+ lista de cargos cobertos, para cargos equivalentes) com a foto da composição em JSON; `anoSerie`/`disciplinaId` da entrega viram opcionais (não apagados). Migration complementar, só aditiva.
  - Perguntas novas além das de 11/11: datas de início/fim do cargo (automáticas × digitadas); cargo cadastrado depois da abertura, mas com início anterior; contagem de uma folha com 2 escolas no painel por escola; Professor com turmas e sem cargo.
- **12/11/2026: "PDI em desenvolvimento" NÃO estava no ar.** O código já está na `main` (01c1542, PR #14, merge 1e3abf4), mas a publicação do GitHub Pages (run 43096750395) ficou parada em "queued" desde 11/11 17:33. O site continuava com a versão do PR #13. Solução indicada ao usuário: cancelar esse run e rodar "Deploy to GitHub Pages" à mão (Run workflow, branch `main`). Nenhum código mudou.
- **12/11/2026: modais com campo de escola já abrem com a escola do seletor do topo (pedido do usuário; só frontend).**
  - Regra: ao ABRIR um modal de criação/vínculo, se o topo tem uma escola e ela é uma das opções do modal, ela vem marcada; senão, vale o padrão de antes (1ª da lista ou nada). Topo em "Todas as escolas" = comportamento antigo. Modais de EDIÇÃO não mudam (mantêm a escola do registro). Ajudante único: `useEscolaDoTopo()` em `src/context/EscolaContext.jsx`.
  - Aplicado em: Nova turma (`GestaoTurmas`); Cadastrar professor, auxiliar, supervisor(a) e diretora; "Escolas — pessoa" (vincular escola); "Turmas e disciplinas — professor"; "Turmas — auxiliar" (`GestaoPessoas`); Nova mensagem, quando há mais de uma escola e o rascunho não traz outra (`MensagensPage`); Novo ciclo do 1/3 — com escola no topo vem "só esta escola" em vez de "Todas as escolas" (`UmTercoSecretariaPage`); Nova aplicação PDI (`FormularioPdiPage`). "Novo aluno" do PDI já fazia isso.
  - Backend e banco não mudaram.
  - Testado (banco local, navegador real): `homologacao/56-escola-do-topo-nos-modais.mjs` 12/13 — turma, professor, auxiliar, supervisor(a), diretora, novo ciclo, topo em "Todas" (como antes), celular 390 px sem rolagem lateral, sem erros no console. **Não testado no navegador:** Nova mensagem com 2+ escolas (o p04 só tem 1 escola; a Secretaria não tem esse campo), os três modais de vínculo de pessoa existente e a Nova aplicação PDI. Regressão: 44 (21/21) e 46 (8/8). Build e lint ok.
- **12/11/2026: filtros de escola das telas internas seguem o seletor do topo, num SENTIDO SÓ (decisão do usuário; só frontend).**
  - Regra: o filtro abre com a escola do topo e acompanha o topo quando ele muda; mudar o filtro NÃO muda o topo. Topo em "Todas as escolas" → filtro em "Todas". Se a escola do topo não é uma opção do filtro (ex.: escola fora do ciclo), o filtro fica em "Todas". **Telas do Professor ficam de fora** (visão unificada entre escolas, decisão anterior): Meus PDIs e Correções de simulados não mudaram. Ajudante único: `useFiltroEscolaDoTopo(vazio, opcoes)` em `src/context/EscolaContext.jsx`.
  - Aplicado em: Gestão de Turmas (filtro Escola); Painel do 1/3 (filtro Escola, só se a escola for do ciclo); Correções › PDI e Feedbacks do sistema (filtro Escola; a lista recarrega quando o topo muda); PDI › alunos (filtro Escola).
  - **Acompanhamento Escolar mudou de comportamento:** antes, o select de escola da Diretora, o "Abrir escola →" e o "← Rede" trocavam o seletor do topo; agora só trocam a escola da própria tela. A tela continua abrindo na escola do topo.
  - Fora: Eventos (tela "em construção").
  - Testado (banco local, navegador real): `homologacao/57-filtros-seguem-o-topo.mjs` **11/11** (Turmas: abre com o topo, filtro não muda o topo, topo muda o filtro; Acompanhamento: abre na escola do topo, "← Rede" não muda o topo, topo em "Todas" = Rede; Painel 1/3: "Todas"/escola do ciclo/filtro não muda o topo; celular 390 px sem rolagem lateral; sem erros no console). Regressão: 55 (44/44), 56 (12/13, mesma lacuna de antes), 47 (8/8), 50 (4/5; a falha ACP-5 é o teste do job, que exige `tsx`, e falha igual sem esta mudança). **Não testados no navegador:** Correções › PDI, Feedbacks (perfil Suporte), PDI › alunos (telas do PDI estão "em desenvolvimento") e o select da Diretora com 2+ escolas no Acompanhamento. Build e lint ok.
- **12/11/2026: 1/3 POR CARGO — DECISÕES APROVADAS — IMPLEMENTAÇÃO PENDENTE.** (Nada disto está implementado ainda.)
  - Lançar já com cargo (migration complementar autorizada; o prazo pode mudar). Cargo é do cadastro do Professor (`Professor → Cargo(s) → Escola(s) → Disciplina(s)`), na Gestão de Professores; o 1/3 só consome e congela uma foto. Não espalhar cargo para PDI, Mensagens ou permissões.
  - Até 2 cargos ativos; "Cargo 1/2" é só rótulo (renumera quando sobra 1); identidade = id. Tela simples: Número de cargos 1 ou 2 → Escola → Disciplina, "+ Adicionar disciplina", "+ Adicionar escola"; sem turmas, sem séries, sem IDs, bom no celular. Sem escola repetida no cargo nem disciplina repetida na escola do cargo. Cargo pode ter várias escolas.
  - Escola adicionada a um cargo garante `VinculoEscolar` ativo (reusa, nunca duplica); remover escola do cargo NÃO encerra o vínculo.
  - Vigência: início (sugere hoje, editável) e encerramento (sugere hoje, editável). Só a Secretaria cria, edita e encerra (Diretora não). Cargo nunca é apagado; encerrado sai das telas normais e fica no histórico.
  - Mudança de composição depois de um ciclo abrir só vale no próximo ciclo (versões `cargo_versoes` + foto na entrega). Cargo novo durante ciclo aberto não entra; cargo encerrado durante o ciclo sai do esperado (conteúdo preservado, fora dos percentuais).
  - Identidade do 1/3: ciclo + professor + cargo; uma folha por cargo, um texto por semana, sem bloco por disciplina, sem turmas; cabeçalho "Escola — disciplinas" por escola. Cargos com composição idêntica → uma folha compartilhada com aviso; quase iguais → duas folhas; a entrega liga-se a 1 ou mais cargos (sem contradição entre `cargoId` único e lista de cargos).
  - Ciclo só de algumas escolas: a folha mostra só a parte do cargo nessas escolas.
  - Painel: folha com 2 escolas aparece no filtro de cada escola e conta 1 vez na rede (**regra mantida por enquanto, a discutir com a equipe**). Tirar ano/série e o gráfico por ano/série; manter escola, disciplina, Professor, status, esperado, concluído, em andamento, não iniciado e percentual.
  - Professor sem cargo = inconsistência administrativa para a Secretaria corrigir; sem fallback e sem adivinhar cargo pelo PTD. PTD não é refatorado.
  - **CORREÇÃO: o 1/3 é para TODOS os Professores** (Educação Infantil, Fundamental I e II); remover qualquer filtro de Fundamental. Pré I/II, ano/série e turma NÃO pertencem ao cargo.
  - Auditoria da produção (12/11, só leitura, `backend/scripts/umTerco/auditoria-cargo.ts`): **ciclo #12 real** criado pela Secretaria hoje (3º tri, abre 16/11, prazo 11/12, todas as escolas, 4 semanas), **0 entregas/respostas/coberturas/correções**; pessoas: Secretaria, Diretora, Suporte (0 professores); 1 vínculo escolar; 0 PTD. Disciplinas (10): Arte, Ciências, Educação Física, Ensino Religioso, Geografia, História, Inglês, Língua Portuguesa, Matemática, Redação — **nenhuma da Educação Infantil**. Turmas ativas: 344 do Fundamental e 4 da Educação Infantil (CMEI Ubi Barroso e E. M. Péricles). Última migration: `20261112120000_correcoes_fluxo_professor`.
  - Parado antes da migration, com perguntas ao usuário: ciclo #12 existente; disciplina na Educação Infantil; data de início/encerramento × ciclo aberto; equivalência em ciclo restrito a escolas.
- **12/11/2026: 1/3 POR CARGO — IMPLEMENTADO (backend, banco e frontend). Ainda NÃO publicado e SEM commit.** Substitui a entrada "DECISÕES APROVADAS — IMPLEMENTAÇÃO PENDENTE" acima.
  - **Decisões da rodada (usuário, 12/11):** ciclo #12 da produção era teste → **apagado** (script `backend/scripts/lancamento/remover-ciclo-teste.ts`, ensaio antes; tinha 4 semanas e 0 entregas; produção ficou com 0 ciclos). Educação Infantil: **disciplina opcional por escola** no cargo (nenhuma disciplina inventada). Ciclo × cadastro: **vale o momento do cadastro** (cargo cadastrado depois da abertura não entra, mesmo com início anterior; também precisa de início ≤ dia da abertura); encerramento com data até o prazo tira a obrigação. Equivalência: compara **a parte do cargo que aparece no ciclo** (ciclo só de algumas escolas).
  - **Banco** — migration complementar `20261112180000_cargos_professor_um_terco` (só aditiva, gerada por `prisma migrate diff`, sem db push/reset): enum `StatusCargo`; tabelas `cargos_professor` (professor, ATIVO/ENCERRADO, dataInicio, dataFim, encerradoEm/Por), `cargo_versoes` (composição JSON `[{escolaId, disciplinaIds}]` com `criadaEm`; nunca editada, alteração = nova versão) e `entregas_um_terco_cargos` (entrega ↔ 1 ou 2 cargos); em `entregas_um_terco`: `chaveCargos` (ids ordenados, só para o índice único `cicloId+professorId+chaveCargos`) e `composicao` (foto "escola → disciplinas" com nomes); `anoSerie`/`disciplinaId` viraram opcionais (nada apagado). **Aplicada só no banco local.** Na produção ela roda sozinha no próximo deploy do Render (`prisma migrate deploy` no start). Auditoria da produção antes (só leitura, `scripts/umTerco/auditoria-cargo.ts`): 1/3 vazio depois da remoção do ciclo #12.
  - **Backend:** `domain/cargos.ts` (regras puras: validação, versão na abertura, esperado até o prazo, folhas com cargos iguais juntos, rótulos "Cargo 1/2" só visuais); `lib/cargos.ts` (criar com trava de no máximo 2 ativos, alterar com nova versão e token de conflito, encerrar com data entre início e hoje, garantir VinculoEscolar sem duplicar e sem nunca encerrar); `routes/cargos.ts` em `/api/pessoas/professores/:id/cargos` (GET Secretaria/Diretora no escopo; POST/PUT/encerrar só Secretaria; encerrados só com `?incluirEncerrados=1`); `POST /api/pessoas/professores` aceita `cargos` (só Secretaria; as escolas viram vínculos); `GET /professores` devolve `cargosAtivos`. `routes/formularioUmTerco.ts` reescrito na parte da folha: `folhasDoCiclo` (cargos + entregas existentes casadas por cargo em comum; entrega sem folha esperada = histórico); rotas do Professor `/ciclos/:cicloId/cargos/:cargoId[/respostas|/concluir]`; Secretaria `/ciclos/:cicloId/entregas/:professorId/cargos/:cargoId`; painel por folha (filtros escola, disciplina, professor, status, correção; **sem ano/série**; `foraDoEsperado` para cargo encerrado com texto; folha de 2 escolas conta 1 vez na rede e aparece em cada escola); exportação e devolução para correção com "Escola — disciplinas"; **nenhum filtro por etapa/Fundamental**. Administração de ciclos igual, com UMA regra nova: com preenchimento iniciado, a **data de abertura não muda** (ela define a foto dos cargos). Acompanhamento Escolar: contagem por folha; a matriz "1/3 por ano e disciplina" saiu (backend devolve `matriz: []`).
  - **Frontend:** `components/CargosProfessor.jsx` (editor: Número de cargos 1/2, Cargo 1 aberto, Escola → Disciplina, "+ Adicionar disciplina", "+ Adicionar escola", remover com ×, sem repetir escola/disciplina nas listas, validação no bloco; janela "Cargos" com Alterar, Encerrar com confirmação e data, "Ver cargos encerrados"); `GestaoPessoas.jsx` (cadastro da Secretaria por cargos no lugar de "Escolas de vínculo" — a Diretora continua com escolas de vínculo e não mexe em cargo; coluna "Cargos" com "Sem cargo" em amarelo; botão "Cargos"); `components/ComposicaoCargo.jsx`; 1/3 do Professor (card e folha por cargo, sem turmas, aviso de folha compartilhada, cargo encerrado = só consulta; rota `/formulario-um-terco/:cicloId/cargo/:cargoId`; chave offline `ciclo-cargo-id`); painel (sem ano/série, seção "Fora do esperado"); exportação Excel ("Cargo", "Escolas e disciplinas"); cartão do Dashboard; Acompanhamento sem o painel por ano/série. `services/cargos.js`.
  - **Testado:** `backend/scripts/umTerco/testar-cargos.ts` (só banco local) **29/29**, 0 respostas 5xx, contagens iguais antes/depois — cadastro 1–10, datas manuais, Educação Infantil sem disciplina, Diretora só consulta, remover escola não encerra vínculo, encerramento (datas inválidas, histórico, renumeração 2→1 com o mesmo id), ciclo 11–20 e 24, cargos iguais com um encerrado, painel multiescola sem duplicar, concluir/conflito, folha de outro professor (404), próximo ciclo, cargos que deixam de ser iguais, ciclo de uma escola só. Navegador real `homologacao/58-cargos-e-um-terco-por-cargo.mjs` **20/20** (cadastro com 2 cargos, validação no campo, listas sem repetição, encerrar com confirmação e renumeração, celular 390 px sem rolagem lateral, Professor com folha compartilhada no computador e celular, concluir, painel sem ano/série, sem erros no console). Regressão: 44 (21/21), 47 (8/8), 55 (44/44), 56 (12/13, lacuna antiga), 57 (9/10). `tsc` e `vite build` ok. **O projeto não tem configuração do ESLint** (os "lint ok" das etapas anteriores de hoje não valeram).
  - **Falhas esperadas pela regra nova (testes antigos baseados no PTD, a reescrever com cargos):** 46 (UT-ESC-3/4), 50 (ACP-2), 52 (INA-3), 57 (FILTRO-8), e os antigos 04/05/07/10–15/32/51 do 1/3 (não rodados). `scripts/umTerco/testar-integracao.ts` marcado OBSOLETO (modelo antigo e usa o `.env`, que aponta para a produção).
  - **Não testado:** offline/fila no navegador com a chave nova; devolução para correção com cargo (mensagem/link); exportação Excel aberta; Acompanhamento Escolar visual da escola sem a matriz; Diretora vendo a janela "Cargos".
  - **Pendências:** todos os professores locais aparecem "Sem cargo" (esperado); na produção ainda não há professores — o cadastro já nasce com cargo. Regra "folha de 2 escolas aparece nas duas e conta 1 vez na rede" mantida para discutir com a equipe. Professor cadastrado pela Diretora fica sem cargo até a Secretaria completar.
- **12/11/2026: ATENÇÃO — o 1/3 por cargo JÁ ESTÁ NA PRODUÇÃO.** O PR #15 (commit "." 3c9227c, feito pelo usuário) foi mesclado na `main` às 11:31 (merge b84f015): o site publicou e o Render aplicou a migration `20261112180000_cargos_professor_um_terco` no Neon. Avisado ao usuário, que decidiu **manter no ar e testar** (a produção não tinha nenhum dado do 1/3 nem de cargo).
- **12/11/2026: data de abertura do ciclo — regra APROVADA pelo usuário:** antes de qualquer preenchimento a Secretaria pode mudar a abertura; depois do primeiro preenchimento, não (preserva a foto dos cargos). Já era o comportamento implementado (`PUT /ciclos/:id`).
- **12/11/2026: suíte de homologação do 1/3 reescrita para o modelo por cargo (só testes; banco LOCAL).**
  - `homologacao/cargos-homolog.mjs`: cargos de TESTE declarados (não deduzidos do PTD) para P01–P15, "cadastrados" em 01/11 (antes da abertura do ciclo local #1): P04 2 cargos diferentes; P05 1 cargo em 2 escolas; P07 2 cargos iguais; P12 quase iguais; P14 Educação Infantil (escola sem disciplina); P08/P09/P13 sem cargo. 14 folhas esperadas no ciclo #1. `prepararCargosHomolog()` é idempotente; `resetarFolhas`, `cargosDe`, `folhaDoCargo`.
  - Reescritos: 04, 05, 07 (rotas por cargo; e regras de 10/11: inativar com preenchimentos = 200 + reativa; edição sobreposta numa janela futura; reabertura num ciclo já encerrado), 08, 10, 12, 13 (agora: quem recebe o 1/3 pelos cargos + painel 14), 14 (professor inativado e cargo encerrado durante o ciclo), 15 (prazo antecipado direto no banco local, declarado: a API não aceita prazo antes das semanas desde 10/11; reabertura cobrindo hoje), 24, 32, 33, 35, 36 (integridade por cargo), 37, 45, 46, 50, 52, 57, 58. Partes do PDI nesses testes rodam só com `MODO_PDI = 'ativo'` (hoje "pulado: PDI em desenvolvimento"). A parte do 1/3 saiu do 43 (Excel) e do 51 (correções) e foi para testes novos: **59** (devolução/correção por cargo, com 409), **60** (Educação Infantil), **61** (Excel do 1/3 aberto com ExcelJS). `homologacao/rodar-um-terco.sh` roda tudo.
  - Resultados (banco local, navegador real): 04 7/7; 05 1/1; 07 39 + 3 observações antigas; 08 1/1; 10 9/10 (UT-OFF-10 = DEF-08 antigo: aviso de conflito só ao reabrir o formulário — falhava igual antes; nada é perdido, 10b passa); 12 4/4; 13 14/14; 14 7/7; 15 9/9; 24 5/5; 32 12/12 (+PDI pulado); 33 12/12 (+PDI pulado); 35 5/5 (+PDI pulado); 36 14/14; 44 21/21; 45 6/6 (+PDI pulado); 46 8/8; 47 8/8; 48 3/3; 50 9 + 2 (foto do PDI não roda por node; filtro do PDI pulado); 52 3/3; 55 44/44; 56 12/13 (TOPO-12: o professor de teste só tem 1 escola); 57 11/11; 58 19/19; 59 11/11; 60 5/5; 61 13/13. Backend `scripts/umTerco/testar-cargos.ts` 29/29 (sozinho; contagens iguais). 37 (build de produção em servidores separados 5181/3341) adaptado mas NÃO rodado.
  - Ajuste de produto encontrado no Excel: a coluna "Escolas e disciplinas" da aba Conteúdos usava " · " e a de Entregas "; " — padronizado para "; " (`backend/src/api/routes/formularioUmTerco.ts`, exportação).
- **12/11/2026: banner "Instale o aplicativo" na frente da barra lateral (pedido do usuário; só frontend).** `src/components/InstallBanner.jsx`: `relative z-35` (acima da barra lateral fixa do computador, z-30; abaixo do topo z-40 e do menu aberto no celular z-50). Antes a barra lateral tampava o começo da mensagem. Conferido no navegador com o evento de instalação simulado: mensagem inteira e por cima no computador e no celular, itens do menu clicáveis, sem erros. Efeito: enquanto o banner aparece, ele cobre o bloco "Educa São João / Menu principal" do alto da barra lateral.
- **12/11/2026: contagens da produção (só leitura), depois do merge:** 0 ciclos, 0 entregas/respostas/coberturas/correções do 1/3; 0 cargos, 0 versões, 0 professores; pessoas: Secretaria, Diretora, Suporte; 1 vínculo escolar; última migration aplicada `20261112180000_cargos_professor_um_terco`.
- **12/11/2026: PEDIDO — Correções do Formulário 1/3 (Correções → Formulário 1/3, no padrão do PDI). DIAGNÓSTICO entregue; NADA implementado; aguardando decisões.**
  - Já existe no 1/3 (desde 10/11): `CorrecaoEntregaUmTerco` (ABERTA/RESOLVIDA + conferência ACEITA/DEVOLVIDA, prazo de 3 dias por devolução, devoluções ilimitadas), devolver/aceitar pela Secretaria no painel, mensagem automática na caixa do Professor (`lib/mensagemCorrecao.ts`), edição liberada só da folha devolvida mesmo depois do prazo do ciclo, "Enviar correção" do Professor, 409 por `updatedAt`, offline com fila. Situações calculadas em `domain/correcoes.ts`: solicitada, prazo_encerrado, recebida, aceita, devolvida.
  - Falta: área Correções → 1/3 (lista com filtros e detalhe), correção DIRETA pela Secretaria com valor anterior/novo (o 1/3 só registra "SALVA" com as semanas tocadas, sem os textos), mensagem ao Professor depois da correção direta, mensagem/aviso à Secretaria no reenvio, e a tela "Correções" liberada com o PDI em desenvolvimento (hoje `/correcoes*` mostra a página "em desenvolvimento").
  - Migration provável (aditiva): tabela de histórico de valores do 1/3 (semana, valor anterior/novo, quem, quando, origem), no mesmo desenho de `historico_correcao_resposta` do PDI (reusa o enum `OrigemHistoricoCorrecao`).
  - CONFLITO com regra aprovada em 10/11: hoje, depois dos 3 dias, o Professor NÃO é bloqueado (envia "fora do prazo"), no PDI e no 1/3. O pedido novo diz que expira e volta a somente leitura. Perguntado ao usuário.
  - **Decisões do usuário (12/11/2026):** (1) a correção **expira só no 1/3** — depois dos 3 dias sem reenvio fica "expirada" e a folha volta a somente leitura (o PDI continua sem bloquear); (2) em Correções → 1/3 só entram folhas **concluídas** (como o PDI); (3) folha de **cargo encerrado** = **só consulta** (sem correção direta e sem devolução); (4) o aviso de reenvio vai para **quem devolveu** (mesma conversa da devolução + sininho).
