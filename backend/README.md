# Backend — Gestão Pedagógica (núcleo do domínio)

API isolada do frontend React (`../src`), pensada para a stack mais barata e estável para ~500
perfis / ~100 acessos simultâneos: **Node.js + Express + Prisma + PostgreSQL (Neon)**, deploy
alvo em **Render/Fly.io** (instância fixa, não serverless) + **Vercel/GitHub Pages** para o React.

Esta primeira etapa cobre só o núcleo do domínio (Escola, Turma, Disciplina, Pessoa e vínculos).
PDI completo (Modelo/Aplicação/Ficha/Resposta), autenticação real (JWT) e Anamnese ficam para
etapas futuras — ver seção "Não implementado ainda".

## Stack

- Node.js 22 (LTS) + TypeScript
- Express 5
- Prisma 6.19.3 (ORM) + PostgreSQL (Neon)
- Zod (validação de request)

## Estrutura

```
backend/
├── prisma/
│   ├── schema.prisma       # modelo de dados
│   ├── seed.ts             # seed estrutural (só disciplinas)
│   └── migrations/
├── src/
│   ├── domain/              # regras de negócio puras (sem Express, sem Prisma)
│   │   ├── turma.ts          # geração de nome + identidadeChave + validações
│   │   └── errors.ts
│   ├── lib/
│   │   └── prisma.ts         # instância única do PrismaClient
│   └── api/
│       ├── app.ts            # Express app, CORS, middleware de erro
│       ├── server.ts         # entry point
│       └── routes/
│           ├── escolas.ts
│           ├── escolaModulos.ts
│           ├── disciplinas.ts
│           └── turmas.ts
├── .env.example
└── package.json
```

Sem Clean Architecture/CQRS/camadas desnecessárias — só a separação mínima que já paga a pena
(regra de negócio isolada de HTTP e de banco, para poder testá-la sem subir servidor nem banco).

## Configuração da connection string (Neon)

**Nunca** coloque a connection string real em nenhum arquivo commitado. Copie `.env.example`
para `.env` (já ignorado pelo Git) e preencha com as duas URLs do painel do Neon:

- `DATABASE_URL`: a que tem `-pooler` no host (usada pela aplicação em runtime — evita esgotar
  conexões do Postgres sob carga).
- `DIRECT_URL`: a mesma, sem `-pooler` (usada só pelo Prisma para aplicar migrations).

## Comandos

```bash
npm install                     # instalar dependências
npm run prisma:generate         # gerar o Prisma Client a partir do schema
npm run prisma:migrate          # criar e aplicar uma nova migration (dev)
npm run prisma:deploy           # aplicar migrations pendentes (produção/CI)
npm run prisma:seed             # popular disciplinas
npm run dev                     # subir a API em modo desenvolvimento (porta 3333)
npm run build && npm start      # compilar e rodar em modo produção
npm run prisma:studio           # abrir o Prisma Studio (explorar o banco visualmente)
```

Depois de `npm run dev`, testar em:
- `http://localhost:3333/health`
- `http://localhost:3333/api/disciplinas`
- `http://localhost:3333/api/escolas`
- `http://localhost:3333/api/turmas`

Não há Swagger nesta etapa (poucos endpoints; adicionar depois se o número crescer — sugestão:
`zod-to-openapi` ou `@asteasolutions/zod-to-openapi`, já que as rotas já validam com Zod).

## Decisões de modelagem e por quê

### Pessoa única (TPH) em vez de 5 tabelas
Um único model `Pessoa` com `perfil` (SECRETARIA/GESTOR/DIRETORA/PROFESSOR/AUXILIAR) em vez de
tabelas separadas por papel — evita duplicar Nome/Email/Status cinco vezes e dá um único espaço
de identidade para `VinculoEscolar`, exatamente como pedido. "Matéria(s) que leciona"
(qualificação do professor, distinta da atribuição por turma) não foi modelada — não estava no
escopo desta etapa.

### Turma: unicidade com campos que variam por etapa
`anoSerie` só existe no Fundamental; `segmento`/`nivel` só na Educação Infantil — os outros
ficam `null`. Um índice único direto sobre colunas nullable não garante unicidade de forma
confiável (NULL nunca é igual a outro NULL). Por isso `Turma` guarda uma `identidadeChave`
string não-nula, calculada em `src/domain/turma.ts`, com um prefixo por etapa (`F|...` ou
`I|...`) para nunca colidir entre Fundamental e Infantil. O banco só precisa de um índice único
simples sobre essa coluna. **Testado**: recriar uma turma inativa é bloqueado orientando
reativação; a mesma combinação em outro ano letivo é permitida.

### Um professor ativo por turma+disciplina / um Auxiliar ativo por turma
PostgreSQL suporta **índice único parcial** nativamente (diferente do MySQL, usado na tentativa
anterior em C#, que precisou de uma coluna auxiliar como workaround). Usei a feature nativa:

```sql
CREATE UNIQUE INDEX ... ON "professor_turma_disciplinas" ("turmaId", "disciplinaId")
  WHERE "status" = 'ATIVO';
CREATE UNIQUE INDEX ... ON "auxiliar_turmas" ("turmaId")
  WHERE "status" = 'ATIVO';
```

O Prisma ainda não tem sintaxe declarativa para índice parcial no `schema.prisma`, então essa
migration foi gerada vazia (`prisma migrate dev --create-only`) e o SQL escrito à mão — ver
`prisma/migrations/20260922213312_indices_unicos_parciais_vinculos_ativos/migration.sql`.
**Testado** diretamente contra o Neon: um 2º vínculo ativo para a mesma turma+disciplina é
rejeitado pelo banco (erro `P2002`, constraint real); encerrar o 1º e criar um novo funciona
normalmente, preservando as duas linhas no histórico.

### Auxiliar em várias turmas simultâneas
Não restringido — decisão de negócio ainda pendente, como combinado.

### AlunoPdi sem `escolaId` próprio
A escola atual é sempre derivada de `Turma.escolaId`. O mock do frontend guarda um `escolaId`
solto no aluno que pode divergir da escola da turma (inconsistência já identificada na
auditoria) — aqui essa divergência não pode existir, porque não há onde ela morar.

### Módulos (EscolaModulo)
`ModuloSistema` é um enum (`PDI`, `MENSAGENS`, `FORMULARIO_UM_TERCO`, `CORRECOES`), não uma
tabela — um módulo novo no futuro é só um valor de enum a mais (nenhuma migration de dado
necessária). `EscolaModulo` relaciona `Escola` a esse enum genericamente, nunca por range de
IDs de escola (esse era um problema real identificado no frontend atual, em
`utils/aplicabilidade.js`).

### Auditoria e concorrência
Toda entidade "estável" (Escola, Turma, Pessoa, AlunoPdi) tem `createdAt/createdBy/updatedAt/
updatedBy` e um campo `version` (inteiro, incrementado manualmente a cada update) preparado
para concorrência otimista — ainda não usado de forma ativa (nenhuma rota rejeita uma escrita
por versão desatualizada nesta etapa), só a estrutura está pronta. `createdBy`/`updatedBy` são
texto livre porque não existe autenticação real ainda; quando existir, passam a receber o
identificador do usuário autenticado.

## Não implementado ainda (de propósito)

- Autenticação/autorização real (Identity/JWT) — `createdBy`/`updatedBy` continuam texto livre
  até lá.
- Modelo/Pergunta/Aplicação/Ficha/Resposta do PDI — decisões de negócio pendentes (ver
  auditoria anterior: Gestor em PDI, múltiplos modelos por disciplina, snapshot de contexto,
  reabertura pós-prazo).
- Anamnese.
- CRUD completo de Pessoa/VinculoEscolar/ProfessorTurmaDisciplina/AuxiliarTurma/AlunoPdi — as
  entidades e constraints existem no banco, mas não há rota HTTP para elas ainda (fora do
  escopo desta primeira passada, como combinado).
- Swagger/OpenAPI.
- Uso ativo do campo `version` para bloquear escrita concorrente desatualizada.

## Deploy (quando chegar a hora)

- **API**: Render ou Fly.io, instância fixa pequena (não serverless) — dimensionada para o pico
  real de acessos simultâneos, não para a média. Variáveis de ambiente (`DATABASE_URL`,
  `DIRECT_URL`, `FRONTEND_ORIGIN`) configuradas no painel do serviço, nunca no repositório.
  `npm run build && npm run prisma:deploy && npm start` como comando de start.
- **Banco**: já é o Neon real (usado nesta etapa) — nenhuma migração de dado necessária.
- **Frontend**: sem mudança nesta etapa — continua no GitHub Pages/Vercel, sem nenhum `fetch`/
  `axios` novo ainda (isso é a próxima etapa, integração gradual entidade por entidade).
