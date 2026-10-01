import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { EscolaProvider } from './context/EscolaContext';
import { ThemeProvider } from './context/ThemeContext';
import { isAuxiliar, isDiretora, isGestor, isProfessor, isSecretaria } from './utils/roles';
import { ProtectedRoute, PrimeiroAcessoRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { PrimeiroAcessoPage } from './pages/PrimeiroAcessoPage';
import { DashboardProfessor } from './pages/DashboardProfessor';
import { DashboardGestor } from './pages/DashboardGestor';
import { DashboardSecretaria } from './pages/DashboardSecretaria';
import { DashboardDiretora } from './pages/DashboardDiretora';
import { GestaoEscolas } from './pages/GestaoEscolas';
import { GestaoPessoas } from './pages/GestaoPessoas';
import { GestaoTurmas } from './pages/GestaoTurmas';
import { PdiHomePage } from './pages/PdiHomePage';
import { PdiConfiguracoesPage } from './pages/PdiConfiguracoesPage';
import { MeusPdisPage } from './pages/MeusPdisPage';
import { FormularioPdiPage } from './pages/FormularioPdiPage';
import { FormularioPdiProfessor } from './pages/FormularioPdiProfessor';
import { PdiPage } from './pages/PdiPage';
import { PdiAlunoPerfil } from './pages/PdiAlunoPerfil';
import { AnamnesePage } from './pages/AnamnesePage';
import { AnamneseModeloPage } from './pages/AnamneseModeloPage';
import { MeusAlunosAuxiliarPage } from './pages/MeusAlunosAuxiliarPage';
import { AuxiliarAlunoPerfilPage } from './pages/AuxiliarAlunoPerfilPage';
import { PerfilPage } from './pages/PerfilPage';
import { EmConstrucaoPage } from './pages/EmConstrucaoPage';

const DashboardRouter = () => {
  const { user } = useAuth();
  if (isProfessor(user)) return <DashboardProfessor />;
  if (isDiretora(user)) return <DashboardDiretora />;
  if (isGestor(user)) return <DashboardGestor />;
  if (isSecretaria(user)) return <DashboardSecretaria />;
  // Auxiliar ainda não tem um Dashboard próprio nesta etapa — "Meus alunos" é a tela inicial.
  if (isAuxiliar(user)) return <Navigate to="/meus-alunos" replace />;
  return <Navigate to="/login" />;
};

// Nesta primeira entrega, só o PDI por disciplina (e a infraestrutura da qual ele depende —
// Escolas/Turmas/Pessoas/vínculos) está liberado. Toda rota fora desse escopo continua existindo
// (os links do menu continuam visíveis para todos os perfis), mas aponta para EmConstrucaoPage —
// nunca renderiza a tela/mock antiga por trás dela.
const AppRoutes = () => <Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/primeiro-acesso" element={<PrimeiroAcessoRoute><PrimeiroAcessoPage /></PrimeiroAcessoRoute>} />
  <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
  <Route path="/pdi" element={<ProtectedRoute><PdiHomePage /></ProtectedRoute>} />
  <Route path="/pdi/configuracoes" element={<ProtectedRoute><PdiConfiguracoesPage /></ProtectedRoute>} />
  <Route path="/pdi/formulario" element={<ProtectedRoute><FormularioPdiPage /></ProtectedRoute>} />
  <Route path="/pdi/meus-pdis" element={<ProtectedRoute><MeusPdisPage /></ProtectedRoute>} />
  <Route path="/pdi/alunos" element={<ProtectedRoute><PdiPage /></ProtectedRoute>} />
  <Route path="/pdi/alunos/:id" element={<ProtectedRoute><PdiAlunoPerfil /></ProtectedRoute>} />
  <Route path="/pdi/fichas/:aplicacaoId/:disciplinaId/:alunoId" element={<ProtectedRoute><FormularioPdiProfessor /></ProtectedRoute>} />
  <Route path="/pdi/alunos/:id/anamnese" element={<ProtectedRoute><AnamnesePage /></ProtectedRoute>} />
  <Route path="/pdi/anamnese-modelo" element={<ProtectedRoute><AnamneseModeloPage /></ProtectedRoute>} />
  <Route path="/meus-alunos" element={<ProtectedRoute><MeusAlunosAuxiliarPage /></ProtectedRoute>} />
  <Route path="/meus-alunos/:id" element={<ProtectedRoute><AuxiliarAlunoPerfilPage /></ProtectedRoute>} />
  <Route path="/escolas" element={<ProtectedRoute><GestaoEscolas /></ProtectedRoute>} />
  <Route path="/turmas" element={<ProtectedRoute><GestaoTurmas /></ProtectedRoute>} />
  <Route path="/pessoas" element={<ProtectedRoute><GestaoPessoas /></ProtectedRoute>} />
  <Route path="/perfil" element={<ProtectedRoute><PerfilPage /></ProtectedRoute>} />

  {/* Fora do escopo desta entrega (só PDI) — "em construção" para todos os perfis. */}
  <Route path="/formulario-um-terco" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/formulario-um-terco/criar" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/pdi/acompanhamento" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/correcoes-simulados" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/pendencias" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/eventos" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/noticias" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/mensagens" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/planejamentos" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/planejamentos-gestor" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/novo-planejamento" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/planejamento/:id" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/calendario" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/gestao-professores" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/acompanhamento-escolar" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/notificacoes-atraso" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/configuracoes" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />

  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>;

// DataProvider precisa envolver o AuthProvider (não o contrário) — o login passou a ler os
// perfis (professores/gestores/diretores) sempre atualizados do DataContext, em vez de uma
// cópia estática do mockData (ver AuthContext.jsx).
const App = () => <Router><ThemeProvider><DataProvider><AuthProvider><EscolaProvider><AppRoutes /></EscolaProvider></AuthProvider></DataProvider></ThemeProvider></Router>;

export default App;
