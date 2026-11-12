import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { PDI_ATIVO, PDI_EM_DESENVOLVIMENTO } from './config/modulos';
import { PdiDesenvolvimentoPage } from './components/PdiDesenvolvimento';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { EscolaProvider } from './context/EscolaContext';
import { ThemeProvider } from './context/ThemeContext';
import { isAuxiliar, isDiretora, isGestor, isProfessor, isSecretaria, isSuporteSistema } from './utils/roles';
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
import { MeusPdisPage } from './pages/MeusPdisPage';
import { UmTercoSecretariaPage } from './pages/UmTercoSecretariaPage';
import { UmTercoPainelPage } from './pages/UmTercoPainelPage';
import { UmTercoProfessorPage } from './pages/UmTercoProfessorPage';
import { UmTercoPreenchimentoPage } from './pages/UmTercoPreenchimentoPage';
import { FormularioPdiPage } from './pages/FormularioPdiPage';
import { FormularioPdiProfessor } from './pages/FormularioPdiProfessor';
import { FormularioPdiAlunoPage } from './pages/FormularioPdiAlunoPage';
import { PdiPage } from './pages/PdiPage';
import { PdiAlunoPerfil } from './pages/PdiAlunoPerfil';
import { FichaAnualPdiPage } from './pages/FichaAnualPdiPage';
import { CorrecoesHomePage } from './pages/CorrecoesHomePage';
import { CorrecoesPdiListaPage } from './pages/CorrecoesPdiListaPage';
import { CorrecoesPdiDetalhePage } from './pages/CorrecoesPdiDetalhePage';
import { AnamnesePage } from './pages/AnamnesePage';
import { AnamneseModeloPage } from './pages/AnamneseModeloPage';
import { AnamnesesPendentesPage } from './pages/AnamnesesPendentesPage';
import { MeusAlunosAuxiliarPage } from './pages/MeusAlunosAuxiliarPage';
import { AuxiliarAlunoPerfilPage } from './pages/AuxiliarAlunoPerfilPage';
import { PerfilPage } from './pages/PerfilPage';
import { EmConstrucaoPage } from './pages/EmConstrucaoPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { MensagensPage } from './pages/MensagensPage';
import { FeedbackSistemaPage } from './pages/FeedbackSistemaPage';
import { FeedbackSistemaDetalhePage } from './pages/FeedbackSistemaDetalhePage';
import { FeedbacksSistemaListaPage } from './pages/FeedbacksSistemaListaPage';
import { AcompanhamentoEscolarPage } from './pages/AcompanhamentoEscolarPage';

// PDI (src/config/modulos.js): ativo → a tela normal; em desenvolvimento → aviso "PDI em desenvolvimento";
// oculto → volta ao Dashboard. Vale também para links diretos (mensagens, notificações, favoritos).
const SoComPdi = ({ children }) => {
  if (PDI_ATIVO) return children;
  if (PDI_EM_DESENVOLVIMENTO) return <ProtectedRoute><PdiDesenvolvimentoPage /></ProtectedRoute>;
  return <Navigate to="/dashboard" replace />;
};

const DashboardRouter = () => {
  const { user } = useAuth();
  if (isProfessor(user)) return <DashboardProfessor />;
  if (isDiretora(user)) return <DashboardDiretora />;
  if (isGestor(user)) return <DashboardGestor />;
  if (isSecretaria(user)) return <DashboardSecretaria />;
  // Auxiliar ainda não tem um Dashboard próprio nesta etapa — "Meus alunos" é a tela inicial.
  if (isAuxiliar(user)) return <Navigate to="/meus-alunos" replace />;
  // Suporte do Sistema está fora da hierarquia pedagógica — a própria caixa de feedbacks já é a
  // tela inicial (seção 2/23 do pedido de Feedback do Sistema), nunca um Dashboard pedagógico.
  if (isSuporteSistema(user)) return <Navigate to="/feedback-sistema" replace />;
  return <Navigate to="/login" />;
};

// Formulário 1/3: tela inicial depende do perfil; os demais perfis não têm acesso.
const UmTercoEntrada = () => {
  const { user } = useAuth();
  if (isSecretaria(user)) return <UmTercoSecretariaPage />;
  if (isProfessor(user)) return <UmTercoProfessorPage />;
  return <Navigate to="/dashboard" replace />;
};
const UmTercoSomenteSecretaria = ({ children }) => {
  const { user } = useAuth();
  return isSecretaria(user) ? children : <Navigate to="/dashboard" replace />;
};
const UmTercoSomenteProfessor = ({ children }) => {
  const { user } = useAuth();
  return isProfessor(user) ? children : <Navigate to="/dashboard" replace />;
};

// Nesta primeira entrega, só o PDI por disciplina (e a infraestrutura da qual ele depende —
// Escolas/Turmas/Pessoas/vínculos) está liberado. Toda rota fora desse escopo continua existindo
// (os links do menu continuam visíveis para todos os perfis), mas aponta para EmConstrucaoPage —
// nunca renderiza a tela/mock antiga por trás dela.
const AppRoutes = () => <Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/primeiro-acesso" element={<PrimeiroAcessoRoute><PrimeiroAcessoPage /></PrimeiroAcessoRoute>} />
  <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
  <Route path="/pdi" element={<SoComPdi><ProtectedRoute><PdiHomePage /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/formulario" element={<SoComPdi><ProtectedRoute><FormularioPdiPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/meus-pdis" element={<SoComPdi><ProtectedRoute><MeusPdisPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/alunos" element={<SoComPdi><ProtectedRoute><PdiPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/alunos/:id" element={<SoComPdi><ProtectedRoute><PdiAlunoPerfil /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/fichas/:aplicacaoId/:disciplinaId/:alunoId" element={<SoComPdi><ProtectedRoute><FormularioPdiProfessor /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/aluno/:aplicacaoId/:alunoId" element={<SoComPdi><ProtectedRoute><FormularioPdiAlunoPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/alunos/:id/anamnese" element={<SoComPdi><ProtectedRoute><AnamnesePage /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/alunos/:id/ficha-anual" element={<SoComPdi><ProtectedRoute><FichaAnualPdiPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/anamnese-modelo" element={<SoComPdi><ProtectedRoute><AnamneseModeloPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/pdi/anamnese/pendentes" element={<SoComPdi><ProtectedRoute><AnamnesesPendentesPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/meus-alunos" element={<ProtectedRoute><MeusAlunosAuxiliarPage /></ProtectedRoute>} />
  <Route path="/meus-alunos/:id" element={<ProtectedRoute><AuxiliarAlunoPerfilPage /></ProtectedRoute>} />
  <Route path="/escolas" element={<ProtectedRoute><GestaoEscolas /></ProtectedRoute>} />
  <Route path="/turmas" element={<ProtectedRoute><GestaoTurmas /></ProtectedRoute>} />
  <Route path="/pessoas" element={<ProtectedRoute><GestaoPessoas /></ProtectedRoute>} />
  <Route path="/perfil" element={<ProtectedRoute><PerfilPage /></ProtectedRoute>} />
  <Route path="/correcoes" element={<SoComPdi><ProtectedRoute><CorrecoesHomePage /></ProtectedRoute></SoComPdi>} />
  {/* Formulário 1/3: só Secretaria (administra) e Professor (preenche) — qualquer outro perfil volta ao dashboard. */}
  <Route path="/formulario-um-terco" element={<ProtectedRoute><UmTercoEntrada /></ProtectedRoute>} />
  <Route path="/formulario-um-terco/ciclos/:cicloId" element={<ProtectedRoute><UmTercoSomenteSecretaria><UmTercoPainelPage /></UmTercoSomenteSecretaria></ProtectedRoute>} />
  <Route path="/formulario-um-terco/:cicloId/cargo/:cargoId" element={<ProtectedRoute><UmTercoSomenteProfessor><UmTercoPreenchimentoPage /></UmTercoSomenteProfessor></ProtectedRoute>} />
  <Route path="/correcoes/pdi" element={<SoComPdi><ProtectedRoute><CorrecoesPdiListaPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/correcoes/pdi/:fichaId" element={<SoComPdi><ProtectedRoute><CorrecoesPdiDetalhePage /></ProtectedRoute></SoComPdi>} />

  {/* Fora do escopo desta entrega (só PDI) — "em construção" para todos os perfis. */}
  <Route path="/pdi/acompanhamento" element={<SoComPdi><ProtectedRoute><EmConstrucaoPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/correcoes-simulados" element={<SoComPdi><ProtectedRoute><EmConstrucaoPage /></ProtectedRoute></SoComPdi>} />
  <Route path="/pendencias" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/eventos" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/noticias" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/mensagens" element={<ProtectedRoute><MensagensPage /></ProtectedRoute>} />
  <Route path="/feedback-sistema/novo" element={<ProtectedRoute><FeedbackSistemaPage /></ProtectedRoute>} />
  <Route path="/feedback-sistema/meus" element={<ProtectedRoute><FeedbackSistemaPage /></ProtectedRoute>} />
  <Route path="/feedback-sistema/meus/:id" element={<ProtectedRoute><FeedbackSistemaDetalhePage /></ProtectedRoute>} />
  <Route path="/feedback-sistema" element={<ProtectedRoute><FeedbacksSistemaListaPage /></ProtectedRoute>} />
  <Route path="/feedback-sistema/:id" element={<ProtectedRoute><FeedbackSistemaDetalhePage /></ProtectedRoute>} />
  <Route path="/planejamentos" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/planejamentos-gestor" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/novo-planejamento" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/planejamento/:id" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/calendario" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/gestao-professores" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  {/* Acompanhamento Escolar: só leitura; Secretaria (rede) e Diretora (própria escola). A página redireciona os demais. */}
  <Route path="/acompanhamento-escolar" element={<ProtectedRoute><AcompanhamentoEscolarPage /></ProtectedRoute>} />
  <Route path="/notificacoes-atraso" element={<ProtectedRoute><EmConstrucaoPage /></ProtectedRoute>} />
  <Route path="/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />

  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>;

// DataProvider precisa envolver o AuthProvider (não o contrário) — o login passou a ler os
// perfis (professores/gestores/diretores) sempre atualizados do DataContext, em vez de uma
// cópia estática do mockData (ver AuthContext.jsx).
const App = () => <Router><ThemeProvider><DataProvider><AuthProvider><EscolaProvider><AppRoutes /></EscolaProvider></AuthProvider></DataProvider></ThemeProvider></Router>;

export default App;
