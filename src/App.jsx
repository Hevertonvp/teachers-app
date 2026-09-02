import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { FormAvailabilityGate } from './components/FormAvailabilityGate';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardProfessor } from './pages/DashboardProfessor';
import { DashboardGestor } from './pages/DashboardGestor';
import { ListaPlanejamentos } from './pages/ListaPlanejamentos';
import { ListaPlanejamentosGestor } from './pages/ListaPlanejamentosGestor';
import { NovoPlanejamento } from './pages/NovoPlanejamento';
import { VisualizarPlanejamento } from './pages/VisualizarPlanejamento';
import { CalendarioPedagogico } from './pages/CalendarioPedagogico';
import { ListaProfessores } from './pages/ListaProfessores';
import { CriarFormularioUmTerco, FormularioUmTerco } from './pages/FormularioUmTerco';
import { PdiHomePage } from './pages/PdiHomePage';
import { FormularioPdiPage } from './pages/FormularioPdiPage';
import { FormularioPdiProfessor } from './pages/FormularioPdiProfessor';
import { PdiPage } from './pages/PdiPage';
import { PdiAlunoPerfil } from './pages/PdiAlunoPerfil';
import { CorrecoesSimulados } from './pages/CorrecoesSimulados';
import { Pendencias } from './pages/Pendencias';
import { PerfilPage } from './pages/PerfilPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { EventosPage } from './pages/EventosPage';

const DashboardRouter = () => {
  const { user } = useAuth();
  if (user?.tipo === 'professor') return <DashboardProfessor />;
  if (user?.tipo === 'gestor') return <DashboardGestor />;
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
  <Route path="/pdi/alunos/:id" element={<ProtectedRoute><PdiAlunoPerfil /></ProtectedRoute>} />
  <Route path="/pdi/alunos/:id/formulario" element={<ProtectedRoute><FormularioPdiProfessor /></ProtectedRoute>} />
  <Route path="/correcoes-simulados" element={<ProtectedRoute><FormAvailabilityGate formId="correcoes_simulados"><CorrecoesSimulados /></FormAvailabilityGate></ProtectedRoute>} />
  <Route path="/pendencias" element={<ProtectedRoute><Pendencias /></ProtectedRoute>} />
  <Route path="/eventos" element={<ProtectedRoute><EventosPage /></ProtectedRoute>} />
  <Route path="/planejamentos" element={<ProtectedRoute><ListaPlanejamentos /></ProtectedRoute>} />
  <Route path="/planejamentos-gestor" element={<ProtectedRoute><ListaPlanejamentosGestor /></ProtectedRoute>} />
  <Route path="/novo-planejamento" element={<ProtectedRoute><NovoPlanejamento /></ProtectedRoute>} />
  <Route path="/planejamento/:id" element={<ProtectedRoute><VisualizarPlanejamento /></ProtectedRoute>} />
  <Route path="/calendario" element={<ProtectedRoute><CalendarioPedagogico /></ProtectedRoute>} />
  <Route path="/gestao-professores" element={<ProtectedRoute><ListaProfessores /></ProtectedRoute>} />
  <Route path="/notificacoes-atraso" element={<ProtectedRoute><Pendencias /></ProtectedRoute>} />
  <Route path="/perfil" element={<ProtectedRoute><PerfilPage /></ProtectedRoute>} />
  <Route path="/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>;

const App = () => <Router><ThemeProvider><AuthProvider><DataProvider><AppRoutes /></DataProvider></AuthProvider></ThemeProvider></Router>;

export default App;
