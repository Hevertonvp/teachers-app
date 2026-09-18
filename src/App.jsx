import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { EscolaProvider } from './context/EscolaContext';
import { ThemeProvider } from './context/ThemeContext';
import { isAuxiliar, isDiretora, isGestor, isProfessor, isSecretaria } from './utils/roles';
import { FormAvailabilityGate } from './components/FormAvailabilityGate';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardProfessor } from './pages/DashboardProfessor';
import { DashboardGestor } from './pages/DashboardGestor';
import { DashboardSecretaria } from './pages/DashboardSecretaria';
import { DashboardDiretora } from './pages/DashboardDiretora';
import { ListaPlanejamentos } from './pages/ListaPlanejamentos';
import { ListaPlanejamentosGestor } from './pages/ListaPlanejamentosGestor';
import { NovoPlanejamento } from './pages/NovoPlanejamento';
import { VisualizarPlanejamento } from './pages/VisualizarPlanejamento';
import { CalendarioPedagogico } from './pages/CalendarioPedagogico';
import { ListaProfessores } from './pages/ListaProfessores';
import { GestaoEscolas } from './pages/GestaoEscolas';
import { GestaoPessoas } from './pages/GestaoPessoas';
import { AcompanhamentoEscolar } from './pages/AcompanhamentoEscolar';
import { CriarFormularioUmTerco, FormularioUmTerco } from './pages/FormularioUmTerco';
import { PdiHomePage } from './pages/PdiHomePage';
import { FormularioPdiPage } from './pages/FormularioPdiPage';
import { FormularioPdiProfessor } from './pages/FormularioPdiProfessor';
import { PdiPage } from './pages/PdiPage';
import { PdiAlunoPerfil } from './pages/PdiAlunoPerfil';
import { AcompanhamentoPdiPage } from './pages/AcompanhamentoPdiPage';
import { AnamnesePage } from './pages/AnamnesePage';
import { MeusAlunosAuxiliarPage } from './pages/MeusAlunosAuxiliarPage';
import { AuxiliarAlunoPerfilPage } from './pages/AuxiliarAlunoPerfilPage';
import { CorrecoesSimulados } from './pages/CorrecoesSimulados';
import { Pendencias } from './pages/Pendencias';
import { PerfilPage } from './pages/PerfilPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { EventosPage } from './pages/EventosPage';
import { NoticiasPage } from './pages/NoticiasPage';
import { MensagensPage } from './pages/MensagensPage';

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

const AppRoutes = () => <Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
  <Route path="/formulario-um-terco" element={<ProtectedRoute><FormAvailabilityGate formId="formulario_um_terco"><FormularioUmTerco /></FormAvailabilityGate></ProtectedRoute>} />
  <Route path="/formulario-um-terco/criar" element={<ProtectedRoute><CriarFormularioUmTerco /></ProtectedRoute>} />
  <Route path="/pdi" element={<ProtectedRoute><PdiHomePage /></ProtectedRoute>} />
  <Route path="/pdi/formulario" element={<ProtectedRoute><FormularioPdiPage /></ProtectedRoute>} />
  <Route path="/pdi/alunos" element={<ProtectedRoute><PdiPage /></ProtectedRoute>} />
  <Route path="/pdi/acompanhamento" element={<ProtectedRoute><AcompanhamentoPdiPage /></ProtectedRoute>} />
  <Route path="/pdi/alunos/:id" element={<ProtectedRoute><PdiAlunoPerfil /></ProtectedRoute>} />
  <Route path="/pdi/alunos/:id/formulario" element={<ProtectedRoute><FormularioPdiProfessor /></ProtectedRoute>} />
  <Route path="/pdi/alunos/:id/anamnese" element={<ProtectedRoute><AnamnesePage /></ProtectedRoute>} />
  <Route path="/meus-alunos" element={<ProtectedRoute><MeusAlunosAuxiliarPage /></ProtectedRoute>} />
  <Route path="/meus-alunos/:id" element={<ProtectedRoute><AuxiliarAlunoPerfilPage /></ProtectedRoute>} />
  <Route path="/correcoes-simulados" element={<ProtectedRoute><FormAvailabilityGate formId="correcoes_simulados"><CorrecoesSimulados /></FormAvailabilityGate></ProtectedRoute>} />
  <Route path="/pendencias" element={<ProtectedRoute><Pendencias /></ProtectedRoute>} />
  <Route path="/eventos" element={<ProtectedRoute><EventosPage /></ProtectedRoute>} />
  <Route path="/noticias" element={<ProtectedRoute><NoticiasPage /></ProtectedRoute>} />
  <Route path="/mensagens" element={<ProtectedRoute><MensagensPage /></ProtectedRoute>} />
  <Route path="/planejamentos" element={<ProtectedRoute><ListaPlanejamentos /></ProtectedRoute>} />
  <Route path="/planejamentos-gestor" element={<ProtectedRoute><ListaPlanejamentosGestor /></ProtectedRoute>} />
  <Route path="/novo-planejamento" element={<ProtectedRoute><NovoPlanejamento /></ProtectedRoute>} />
  <Route path="/planejamento/:id" element={<ProtectedRoute><VisualizarPlanejamento /></ProtectedRoute>} />
  <Route path="/calendario" element={<ProtectedRoute><CalendarioPedagogico /></ProtectedRoute>} />
  <Route path="/gestao-professores" element={<ProtectedRoute><ListaProfessores /></ProtectedRoute>} />
  <Route path="/escolas" element={<ProtectedRoute><GestaoEscolas /></ProtectedRoute>} />
  <Route path="/pessoas" element={<ProtectedRoute><GestaoPessoas /></ProtectedRoute>} />
  <Route path="/acompanhamento-escolar" element={<ProtectedRoute><AcompanhamentoEscolar /></ProtectedRoute>} />
  <Route path="/notificacoes-atraso" element={<ProtectedRoute><Pendencias /></ProtectedRoute>} />
  <Route path="/perfil" element={<ProtectedRoute><PerfilPage /></ProtectedRoute>} />
  <Route path="/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>;

const App = () => <Router><ThemeProvider><AuthProvider><DataProvider><EscolaProvider><AppRoutes /></EscolaProvider></DataProvider></AuthProvider></ThemeProvider></Router>;

export default App;
