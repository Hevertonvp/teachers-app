import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { escolaName, turmaName } from '../utils/display';
import { vinculoAtivoDoAluno } from '../utils/auxiliares';
import { formatDate, parentescoOptions } from '../utils/pdi';
import { isAuxiliar } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

// Consulta simples e somente leitura — o Auxiliar não edita cadastro, Anamnese, PDI, metas,
// avaliações ou professores nesta etapa. O guard abaixo é feito na ROTA (não só escondendo
// botão): só abre se houver vínculo ATIVO do aluno com o Auxiliar logado.
export const AuxiliarAlunoPerfilPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pdiAlunos, pdiAuxiliaresVinculos, escolas, turmas } = useData();

  const aluno = pdiAlunos.find(item => item.id === Number(id));
  const vinculoAtivo = aluno ? vinculoAtivoDoAluno(pdiAuxiliaresVinculos, aluno.id) : null;
  const podeAcessar = isAuxiliar(user) && !!vinculoAtivo && vinculoAtivo.auxiliarId === user.id;

  if (!podeAcessar) {
    return (
      <MainLayout>
        <Card className="py-12 text-center">
          <p className="font-semibold text-slate-800">{aluno ? 'Você não tem acesso a este aluno' : 'Aluno não encontrado'}</p>
          <Button className="mt-4" onClick={() => navigate('/meus-alunos')}>Voltar para meus alunos</Button>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to="/meus-alunos" className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para meus alunos</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">{aluno.nome}</h1>
          <p className="mt-2 text-slate-600">{turmaName(turmas, aluno.turmaId)} · {escolaName(escolas, aluno.escolaId)}</p>
        </div>

        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Dados do aluno</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <p><strong>Data de nascimento:</strong> {formatDate(aluno.dataNascimento)}</p>
            <p><strong>Condição informada:</strong> {aluno.condicaoInformada || 'Não informada'}</p>
            <p><strong>Status do acompanhamento:</strong> {aluno.status === 'arquivado' ? 'Arquivado' : 'Ativo'}</p>
            <p><strong>Acompanhamento comigo desde:</strong> {formatDate(vinculoAtivo.dataInicio)}</p>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Responsável legal</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <p><strong>Nome:</strong> {aluno.responsavelNome || 'Não informado'}</p>
            <p><strong>Parentesco:</strong> {parentescoOptions.find(item => item.value === aluno.responsavelParentesco)?.label || 'Não informado'}</p>
            <p><strong>Telefone principal:</strong> {aluno.responsavelTelefone1 || 'Não informado'}</p>
            {aluno.responsavelTelefone2 && <p><strong>Telefone secundário:</strong> {aluno.responsavelTelefone2}</p>}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};
