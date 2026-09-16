# 📚 Gestão Pedagógica - Protótipo de Demonstração

Plataforma web para gestão de planejamento pedagógico de uma rede municipal de ensino (São João Nepomuceno/MG, dados fictícios).

## 🎯 Status Atual

Protótipo **funcional e navegável**, com 4 papéis de usuário e vários módulos pedagógicos em produção. Todos os dados são **simulados/mockados** (sem backend), e o estado é perdido ao recarregar a página (exceto login e tema).

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ instalado
- npm ou yarn

### Instalação e Execução

```bash
# Instalar dependências (se não feito ainda)
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

O aplicativo abrirá em **http://localhost:5174/** (ou próxima porta livre).

### Build para Produção

```bash
npm run build
npm run preview
```

---

## 👤 Contas de Demonstração

Todas as contas usam a senha `123456`.

| Papel | E-mail | Acesso |
|---|---|---|
| Professor | `professor@escola.gov.br` | Preenchimento de instrumentos pedagógicos, PDI dos seus alunos, mensagens |
| Gestor/Supervisor | `gestor@escola.gov.br` | Gestão pedagógica das escolas vinculadas, acompanhamento de professores |
| Diretora | `diretora@escola.gov.br` | Dashboard da própria escola, mensagens (acesso mais restrito) |
| Secretaria | `secretaria@escola.gov.br` | Gestão de escolas, pessoas e visão consolidada de toda a rede |

---

## 📋 Módulos e Funcionalidades

### Autenticação e navegação
- Login mockado com botões de preenchimento rápido por perfil, sessão persistida em `localStorage`
- Cada usuário só acessa escolas com vínculo ativo (`vinculosEscolares`); Secretaria vê todas, inclusive inativas
- Modo claro/escuro (tema persistido)

### Instrumentos pedagógicos monitorados
- **Formulário 1/3** — professor registra atividades planejadas em 4 períodos sequenciais; gestor/secretaria define vigência geral e os períodos, por escola (individual ou em lote)
- **PDI (Plano de Desenvolvimento Individual)** — cadastro de alunos com necessidades específicas, avaliação inicial por área, metas de desenvolvimento, acompanhamentos históricos com gráfico de tendência e formulário trimestral respondido pelo professor
- **Correções de Simulados** — CRUD de correções por turma/simulado

### Gestão e acompanhamento
- **Pendências** — lista consolidada de atrasos dos três instrumentos acima
- **Acompanhamento Escolar** — indicadores de uma escola específica, com detalhamento de quem preencheu/está pendente
- **Gestão de Professores** — painel do gestor com filtros e tarefas por professor
- **Gestão de Escolas** (Secretaria) — CRUD de escolas e de vínculos de professores/gestores por escola
- **Gestão de Pessoas** (Secretaria) — CRUD de professores, supervisores e diretores, com vínculos por escola
- **Eventos Pedagógicos** — agenda de reuniões, sábados letivos, formações, conselhos e simulados (consulta por todos; criação/edição restrita a Gestor/Secretaria)
- **Mensagens internas** — troca de mensagens respeitando a hierarquia entre papéis (Secretaria ↔ Diretora ↔ Gestor ↔ Professor)
- **Dashboards** dedicados por papel (Professor, Gestor, Diretora, Secretaria), com indicadores e atalhos próprios

### Telas de apoio
- Perfil do usuário logado
- Configurações (tela ainda decorativa, sem integrações)

---

## 🏗️ Arquitetura do Projeto

```
src/
├── components/              # Componentes reutilizáveis
│   ├── Common.jsx           # Card, Button, Badge, StatCard, Modal, DataTable, etc.
│   ├── InstrumentManager.jsx# CRUD genérico (busca, filtros, tabela, modais)
│   ├── Header.jsx           # Topbar: seletor de escola, tema, logout
│   ├── Sidebar.jsx          # Navegação lateral (menu varia por papel)
│   ├── EscolaSelector.jsx   # Troca da escola ativa / visão agregada
│   ├── ProfessorName.jsx    # Resolve nome/disciplinas de um professor
│   ├── PdiControls.jsx      # Controles específicos do módulo PDI
│   └── FormAvailabilityGate.jsx # Bloqueia preenchimento fora da vigência
│
├── pages/                   # Páginas da aplicação (uma por rota)
│
├── layouts/                 # MainLayout, AuthLayout
│
├── context/                 # Context API
│   ├── AuthContext.jsx      # Autenticação mockada
│   ├── DataContext.jsx      # "Backend fake" em memória (CRUD genérico + indicadores)
│   ├── EscolaContext.jsx    # Multi-escola: vínculos, escola ativa, visão agregada
│   └── ThemeContext.jsx     # Tema claro/escuro
│
├── routes/
│   └── ProtectedRoute.jsx   # Exige apenas autenticação; autorização por papel é feita em cada página
│
├── data/                    # Dados mockados
│   ├── mockData.js          # Pessoas, escolas, turmas, instrumentos, calendário
│   └── pdiData.js           # Módulo PDI completo (alunos, avaliações, metas, histórico)
│
├── utils/                   # Regras de negócio
│   ├── roles.js              # Papéis e capacidades (quem pode o quê)
│   ├── escolas.js             # Filtros/agregações escopadas por escola
│   ├── aplicabilidade.js      # Quais escolas têm cada recurso habilitado
│   ├── formAvailability.js    # Vigência de formulários (data "hoje" simulada: CURRENT_DATE)
│   ├── pdi.js                 # Áreas, níveis e tendência do PDI
│   ├── mensagens.js           # Quem pode enviar mensagem para quem
│   └── display.js             # Lookups de nome por id, filtro de texto
│
├── styles/
│   └── index.css            # Tailwind CSS
│
└── App.jsx                  # Rotas (HashRouter) e providers
```

---

## 🔐 Papéis e Permissões

Definidos em `src/utils/roles.js`, de forma explícita (nenhuma permissão é herdada implicitamente):

- **Professor** — preenche os instrumentos pedagógicos das suas turmas
- **Gestor** (hoje representa também o papel de "Supervisor", ainda não implementado separadamente) — gerencia instrumentos pedagógicos e acompanha professores das escolas vinculadas
- **Diretora** — acesso mais restrito (dashboard e mensagens da própria escola)
- **Secretaria** — gerencia escolas, pessoas e vínculos; visão consolidada de toda a rede

Multi-escola: cada usuário só opera nas escolas com vínculo ativo em `vinculosEscolares`; desvincular/inativar uma escola bloqueia o acesso operacional sem apagar o histórico.

---

## 📊 Dados Mockados

Todos os dados estão em `src/data/mockData.js` e `src/data/pdiData.js`, prontos para serem substituídos por chamadas de API:

- **34 escolas** reais de São João Nepomuceno/MG (urbanas e rurais, ativas/inativas)
- **15 professores**, **2 gestores**, **6 diretores**, **1 secretaria**
- **10 turmas** e **5 disciplinas**
- **30 registros** de Formulário 1/3, **20 registros** de acompanhamento PDI (indicadores), **25 correções de simulados**
- **12 alunos PDI** com avaliações, metas e histórico mensal de acompanhamento

---

## ⚙️ Stack Tecnológico

| Tecnologia | Versão | Propósito |
|-----------|--------|----------|
| React | 19.2.x | Framework UI |
| Vite | 8.2.x | Build tool |
| React Router | 7.x | Navegação (HashRouter) |
| Tailwind CSS | 4.x | Estilização |
| oxlint | 1.x | Lint |
| JavaScript | ES6+ | Linguagem (sem TypeScript — os pacotes `typescript`/`@types/*` estão instalados mas não há nenhum arquivo `.ts/.tsx` no projeto) |

---

## 🔒 Autenticação

- Simulada com Context API (`AuthContext.jsx`)
- Usuários e senhas armazenados em `mockData.js`
- Sessão persistida no `localStorage` (sem JWT/expiração/refresh)
- Logout limpa a sessão

---

## ⚠️ Inconsistências e limitações conhecidas

Pontos identificados no código atual, úteis para quem for continuar o desenvolvimento:

1. **Persistência zero** — todo o estado vive em `useState` (`DataContext`); qualquer F5 depois do login descarta as edições da sessão.
2. **PDI tem duas modelagens que não se conversam** — o array `pdis` (em `mockData.js`, usado para indicadores/pendências como "instrumento monitorado") é um rastreador de prazo simplificado, desacoplado dos dados reais e detalhados do módulo PDI (`pdiData.js`: alunos, avaliações, metas, respostas). Um professor pode aparecer "em dia" no indicador de PDI sem ter respondido o formulário real do módulo, e vice-versa.
3. **Formulário 1/3 tem dois formatos de registro coexistindo** — o formato legado (`conteudo`/`objetivo`/`metodologia`, usado pelas telas antigas de "Planejamentos") e o formato atual (`formularioUmTerco: true` + `atividadesPlanejadas`, usado por `FormularioUmTerco.jsx`). O status gravado no envio do formulário atual é `'enviado'`, que não é reconhecido como "concluído" pelos indicadores gerais do `DataContext` (que só contam `'concluido'`/`'concluído'`).
4. **Telas legadas ainda roteadas, mas fora do menu** — `NovoPlanejamento`, `VisualizarPlanejamento`, `ListaPlanejamentos`, `ListaPlanejamentosGestor` e `CalendarioPedagogico` (rotas `/novo-planejamento`, `/planejamento/:id`, `/planejamentos`, `/planejamentos-gestor`, `/calendario`) foram substituídas por Formulário 1/3 + PDI + Correções + Eventos, mas o código não foi removido, só desconectado da navegação. `NovoPlanejamento` não persiste nada (`alert` apenas).
5. **`ConfiguracoesPage`** é puramente decorativa, sem nenhuma configuração real ainda.
6. **`'supervisor'`** está documentado em `roles.js` como papel futuro reservado — hoje `'gestor'` cumpre esse papel.

---

## 🚦 Próximos Passos Recomendados

### Fase 2 - Expansão de Funcionalidades

1. **Backend Real**
   - Substituir dados mockados por API REST/GraphQL
   - Implementar autenticação real (JWT, OAuth)
   - Criar banco de dados (PostgreSQL, MongoDB, etc)
   - Persistir de fato as edições feitas na sessão

2. **Resolver dívidas técnicas listadas acima**
   - Unificar as duas modelagens de PDI (compliance vs. conteúdo)
   - Unificar o status `'enviado'` do Formulário 1/3 com os indicadores gerais
   - Remover ou versionar oficialmente as telas legadas de Planejamentos/Calendário
   - Implementar o papel "Supervisor" como tipo de usuário próprio, se for o caso

3. **Melhorias UX**
   - Relatórios e gráficos mais avançados
   - Exportação em PDF
   - Impressão otimizada
   - Mensagens de erro mais amigáveis

4. **Segurança**
   - Validação robusta de dados
   - Proteção contra CSRF
   - Rate limiting
   - Sanitização de inputs
   - Auditoria de ações

5. **Infraestrutura**
   - Deploy CI/CD
   - Testes automatizados
   - Monitoramento e logging

---

## 🐛 Troubleshooting

### Porta 5173 em uso?
Se a porta 5173 está em uso, Vite automaticamente usa a próxima porta disponível (ex: 5174).

### Problemas com Build?
```bash
# Limpar cache e reinstalar
rm -rf node_modules
rm package-lock.json
npm install
```

### Sessão expirada após fechar o navegador?
Dados são salvos no localStorage. Limpe o cache do navegador e faça login novamente.

---

## 📝 Notas Importantes

- ⚠️ **Este é um protótipo de demonstração** - não use em produção sem adicionar segurança real
- 🔐 Senhas e dados de autenticação são fictícios
- 📱 Responsivo, mas otimizado para desktop
- 🎯 Foco em UX e navegação clara
- ♻️ Código modular para fácil manutenção e expansão

---

**Desenvolvido com ❤️ para gestão pedagógica municipal**
