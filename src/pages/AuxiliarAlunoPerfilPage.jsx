import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatFullDate } from '../utils/formAvailability';
import { isAuxiliar } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

const STATUS_VISUAL_LABEL = { nao_iniciado: 'Não iniciado', em_andamento: 'Em preenchimento', concluido: 'Concluído', prazo_encerrado: 'Prazo encerrado' };
const STATUS_VISUAL_VARIANT = { nao_iniciado: 'gray', em_andamento: 'blue', concluido: 'green', prazo_encerrado: 'gray' };
// A listagem de Fichas (GET /api/pdi-fichas) devolve o status bruto da Ficha, não o status visual
// combinado com editabilidade que /meus-pdis já calcula — aqui já existe Ficha, então só as duas
// primeiras faixas de statusVisualItem (concluido/em_andamento) importam; sem Ficha nem entra aqui.
const statusVisualDaFicha = (statusApi) => (statusApi === 'concluida' ? 'concluido' : statusApi === 'em_andamento' ? 'em_andamento' : 'nao_iniciado');

// Consulta simples e somente leitura — o Auxiliar não edita cadastro, não preenche PDI e não cria
// Ficha nenhuma. Acesso escopado no backend por VinculoEscolar + AuxiliarTurma ATIVOS da turma
// ATUAL do aluno (GET /api/pdi-alunos/:id) — se o aluno mudar de turma ou o vínculo do Auxiliar
// terminar, o acesso muda/some imediatamente, mesmo sem nada mudar aqui no frontend.
export const AuxiliarAlunoPerfilPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { obterPdiAlunoReal, pdiAplicacoesReais, loadPdiAplicacoesReais, listarFichasPdi } = useData();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aluno, setAluno] = useState(null);
  const [fichas, setFichas] = useState([]);
  const [carregandoPdi, setCarregandoPdi] = useState(true);

  useEffect(() => {
    if (!isAuxiliar(user)) return;
    (async () => {
      setCarregando(true);
      const resultado = await obterPdiAlunoReal(id);
      setCarregando(false);
      if (!resultado.ok) { setErro(resultado.error); return; }
      setAluno(resultado.aluno);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { if (isAuxiliar(user)) loadPdiAplicacoesReais(); }, [user, loadPdiAplicacoesReais]);

  useEffect(() => {
    if (!aluno) return;
    (async () => {
      setCarregandoPdi(true);
      const resultado = await listarFichasPdi({ alunoId: aluno.id });
      setCarregandoPdi(false);
      if (resultado.ok) setFichas(resultado.fichas);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluno]);

  if (!isAuxiliar(user)) {
    return (
      <MainLayout>
        <Card className="py-12 text-center">
          <p className="font-semibold text-slate-800">Você não tem acesso a esta página</p>
          <Button className="mt-4" onClick={() => navigate('/dashboard')}>Voltar</Button>
        </Card>
      </MainLayout>
    );
  }

  if (carregando) {
    return <MainLayout><Card className="py-12 text-center"><p className="text-slate-500">Carregando...</p></Card></MainLayout>;
  }

  if (erro || !aluno) {
    return (
      <MainLayout>
        <Card className="py-12 text-center">
          <p className="font-semibold text-slate-800">{erro || 'Você não tem acesso a este aluno'}</p>
          <Button className="mt-4" onClick={() => navigate('/meus-alunos')}>Voltar para meus alunos</Button>
        </Card>
      </MainLayout>
    );
  }

  // PDI por disciplina disponível para este aluno: toda Aplicação da escola atual dele × cada
  // disciplina com Modelo no snapshot — com ou sem Ficha ainda criada (seção 19 do pedido: se não
  // existir Ficha, o Auxiliar NUNCA cria uma só de olhar, mostra "Não iniciado").
  const itensPdi = pdiAplicacoesReais
    .filter(aplicacao => aplicacao.escolaId === aluno.escolaId)
    .flatMap(aplicacao => aplicacao.modelos.map(modelo => {
      const ficha = fichas.find(item => item.aplicacaoId === aplicacao.id && item.disciplinaId === modelo.disciplinaId);
      return {
        aplicacaoId: aplicacao.id,
        dataInicio: aplicacao.dataInicio,
        dataFim: aplicacao.dataFim,
        disciplinaId: modelo.disciplinaId,
        disciplinaNome: modelo.disciplinaNome,
        ficha,
      };
    }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <Link to="/meus-alunos" className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para meus alunos</Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">{aluno.nome}</h1>
            <p className="mt-2 text-slate-600">{aluno.turmaNome} · {aluno.escolaNome}</p>
          </div>
          <Link to={`/pdi/alunos/${aluno.id}/anamnese`}><Button variant="outline">Anamnese</Button></Link>
        </div>

        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Dados do aluno</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <p><strong>Responsável legal:</strong> {aluno.responsavelNome || 'Não informado'}</p>
            <p><strong>Telefone do responsável:</strong> {aluno.responsavelTelefone || 'Não informado'}</p>
            <p><strong>Status:</strong> {aluno.status === 'arquivado' ? 'Arquivado' : 'Ativo'}</p>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">PDI por disciplina</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Consulta</h2>
          <p className="mt-1 text-sm text-slate-600">Somente consulta — abrir uma Ficha aqui nunca cria um registro novo.</p>
          {carregandoPdi ? (
            <p className="mt-4 text-sm text-slate-500">Carregando...</p>
          ) : itensPdi.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhuma aplicação PDI disponível para a escola atual deste aluno.</p>
          ) : (
            <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {itensPdi.map(item => (
                <div key={`${item.aplicacaoId}-${item.disciplinaId}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{item.disciplinaNome}</p>
                    <p className="text-sm text-slate-600">{formatFullDate(item.dataInicio)} a {formatFullDate(item.dataFim)}</p>
                  </div>
                  {item.ficha ? (
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VISUAL_VARIANT[statusVisualDaFicha(item.ficha.status)]}>{STATUS_VISUAL_LABEL[statusVisualDaFicha(item.ficha.status)]}</Badge>
                      <Link to={`/pdi/fichas/${item.aplicacaoId}/${item.disciplinaId}/${aluno.id}`}><Button size="sm" variant="outline">Consultar</Button></Link>
                    </div>
                  ) : (
                    <Badge variant="gray">PDI ainda não iniciado nesta disciplina/aplicação</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
};
