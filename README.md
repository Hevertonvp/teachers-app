# 📚 Gestão Pedagógica - Protótipo de Demonstração

Plataforma web para gestão de planejamento pedagógico de uma rede municipal de ensino.

## 🎯 Status Atual

Protótipo **funcional e navegável** com estrutura completa para futuras extensões. Todos os dados são **simulados/mockados** para fins de demonstração.

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

O aplicativo abrirá em **http://localhost:5174/**

### Build para Produção

```bash
npm run build
npm run preview
```

---

## 👤 Contas de Demonstração

### Professor
- **Email:** `professor@escola.gov.br`
- **Senha:** `123456`
- **Acesso:** Dashboard de professor, criação de planejamentos, consulta de calendário

### Gestor/Supervisor
- **Email:** `gestor@escola.gov.br`
- **Senha:** `123456`
- **Acesso:** Dashboard administrativo, acompanhamento de planejamentos, visualização de professores

---

## 📋 Funcionalidades Implementadas

### Telas Criadas ✅

1. **Login Simulado**
   - Autenticação com dados mockados
   - Botões de preenchimento rápido para demonstração
   - Persistência de sessão (localStorage)

2. **Dashboard do Professor**
   - Estatísticas: turmas, planejamentos ativos, concluídos, pendentes
   - Lista de próximos planejamentos
   - Visualização de turmas atribuídas

3. **Dashboard do Gestor**
   - Estatísticas gerais da escola
   - Lista de planejamentos de todos os professores
   - Visualização de professores
   - Acompanhamento de preenchimento

4. **Lista de Planejamentos**
   - Filtros por status (pendente, em andamento, concluído)
   - Visualização diferenciada para professor e gestor
   - Cards informativos com detalhes

5. **Novo Planejamento**
   - Formulário completo para criação
   - Seleção de turma e disciplina
   - Preenchimento de objetivos, conteúdos, metodologia e avaliação

6. **Visualizar Planejamento**
   - Exibição detalhada de um planejamento
   - Cards organizados por seção
   - Informações administrativas

7. **Calendário Pedagógico**
   - Visualização mensal de eventos
   - Tipo de eventos: atividades, recessos, feriados
   - Resumo geral do ano letivo

8. **Lista de Professores** (Gestor)
   - Cards com informações de cada professor
   - Turmas e estatísticas de planejamento
   - Design profissional

---

## 🏗️ Arquitetura do Projeto

```
src/
├── components/              # Componentes reutilizáveis
│   ├── Header.jsx          # Cabeçalho com logout
│   ├── Sidebar.jsx         # Navegação lateral
│   └── Common.jsx          # Card, Button, Badge, StatCard
│
├── pages/                   # Páginas da aplicação
│   ├── LoginPage.jsx
│   ├── DashboardProfessor.jsx
│   ├── DashboardGestor.jsx
│   ├── ListaPlanejamentos.jsx
│   ├── ListaPlanejamentosGestor.jsx
│   ├── NovoPlanejamento.jsx
│   ├── VisualizarPlanejamento.jsx
│   ├── CalendarioPedagogico.jsx
│   └── ListaProfessores.jsx
│
├── layouts/                 # Layouts reutilizáveis
│   └── Layouts.jsx         # MainLayout, AuthLayout
│
├── context/                 # Context API
│   └── AuthContext.jsx      # Gerenciamento de autenticação
│
├── routes/                  # Configuração de rotas
│   └── ProtectedRoute.jsx   # Proteção de rotas
│
├── data/                    # Dados mockados
│   └── mockData.js          # Todas as entidades fictícias
│
├── styles/                  # Estilos globais
│   └── index.css           # Tailwind CSS
│
└── App.jsx                  # Configuração de rotas com React Router
```

---

## 🎨 Design & UX

- **Tailwind CSS** para estilização moderna e consistente
- **Cores corporativas:** Azul primário (#0284c7) com variações
- **Componentes reutilizáveis** para manutenção facilitada
- **Responsividade** para desktop e tablets
- **Navegação clara** com sidebar persistente
- **Feedback visual** em interações (hover, active)
- **Badges de status** para rápida identificação

---

## 📊 Dados Mockados

### Entidades Implementadas

- **Professores:** 3 professores com turmas e disciplinas
- **Gestores:** 2 gestores/supervisores
- **Turmas:** 4 turmas de Ensino Fundamental
- **Disciplinas:** 5 disciplinas (Português, Matemática, Ciências, História, Ed. Física)
- **Planejamentos:** 4 planejamentos com diferentes status
- **Calendário:** 14 eventos/recessos/feriados do ano letivo

Todos os dados estão em `src/data/mockData.js` e podem ser facilmente substituídos por chamadas à API.

---

## ⚙️ Stack Tecnológico

| Tecnologia | Versão | Propósito |
|-----------|--------|----------|
| React | 19.2.8 | Framework UI |
| Vite | 8.2.2 | Build tool |
| React Router | 6.x | Navegação |
| Tailwind CSS | Latest | Estilização |
| JavaScript | ES6+ | Linguagem (sem TypeScript) |

---

## 🔒 Autenticação

- Simulada com Context API
- Usuários armazenados em `mockData.js`
- Sessão persistida no localStorage
- Logout limpa sessão

---

## 🚦 Próximos Passos Recomendados

### Fase 2 - Expansão de Funcionalidades

1. **Backend Real**
   - Substituir dados mockados por API REST/GraphQL
   - Implementar autenticação real (JWT, OAuth)
   - Criar banco de dados (PostgreSQL, MongoDB, etc)

2. **Funcionalidades Adicionais**
   - PDI (Plano de Desenvolvimento Individual)
   - Diário Eletrônico
   - Sistema de Avaliações
   - Notificações em tempo real
   - Upload de arquivos
   - Integração com Google Sheets/Calendar

3. **Melhorias UX**
   - Modo dark/light
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

5. **Performance**
   - Lazy loading de componentes
   - Otimização de imagens
   - Cache estratégico
   - Compressão de assets

6. **Infraestrutura**
   - Deploy CI/CD
   - Testes automatizados (Jest, Testing Library)
   - Monitoramento e logging
   - Backup e recuperação

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

