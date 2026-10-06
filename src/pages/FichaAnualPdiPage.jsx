import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { inputClass } from '../utils/display';
import { isSecretaria } from '../utils/roles';
import { obterFichaAnualReal, fecharFichaAnualReal, obterCicloAnualReal, salvarCicloAnualReal } from '../services/pdiFichaAnual';
import { MainLayout } from '../layouts/Layouts';

const STATUS_FICHA_LABEL = { PENDENTE: 'Não iniciado', EM_ANDAMENTO: 'Em preenchimento', CONCLUIDA: 'Concluído' };
const STATUS_FICHA_VARIANT = { PENDENTE: 'gray', EM_ANDAMENTO: 'blue', CONCLUIDA: 'green' };
const INDICADOR_CORRECAO_LABEL = { solicitada: 'Correção solicitada', resolvida: 'Corrigida pela Secretaria' };
const INDICADOR_CORRECAO_VARIANT = { solicitada: 'yellow', resolvida: 'blue' };

const formatarData = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const formatarDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

// Ficha Anual PDI (seção 9-15/18 do pedido de continuidade do aluno): consolidado leve, nunca
// cópia — cada linha de período/disciplina abre a Ficha PDI real já existente
// (/pdi/fichas/:aplicacaoId/:disciplinaId/:alunoId), sem nenhuma tela nova de preenchimento.
export const FichaAnualPdiPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [fechando, setFechando] = useState(false);
  const [ciclo, setCiclo] = useState(null);
  const [dataEncerramentoForm, setDataEncerramentoForm] = useState('');
  const [salvandoCiclo, setSalvandoCiclo] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const carregar = async (anoAlvo) => {
    setCarregando(true);
    setErro('');
    try {
      const resultado = await obterFichaAnualReal(id, anoAlvo);
      setDados(resultado);
    } catch (error) {
      setErro(error.message);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(ano); }, [id, ano]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSecretaria(user)) return;
    obterCicloAnualReal(ano)
      .then((resultado) => { setCiclo(resultado); setDataEncerramentoForm(resultado.dataEncerramento ? resultado.dataEncerramento.slice(0, 10) : ''); })
      .catch(() => setCiclo(null));
  }, [ano, user]);

  const fecharAno = async () => {
    setFechando(true);
    setMensagem('');
    try {
      await fecharFichaAnualReal(id, ano);
      setMensagem('Ficha Anual fechada com sucesso.');
      await carregar(ano);
    } catch (error) {
      setErro(error.message);
    } finally {
      setFechando(false);
    }
  };

  const salvarCiclo = async (event) => {
    event.preventDefault();
    setSalvandoCiclo(true);
    setMensagem('');
    try {
      const atualizado = await salvarCicloAnualReal(ano, dataEncerramentoForm || null);
      setCiclo(atualizado);
      setMensagem(`Encerramento automático do ciclo ${ano} salvo.`);
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvandoCiclo(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to={`/pdi/alunos/${id}`} className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para o aluno</Link>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">Ficha Anual PDI {ano}</h1>
              {dados && <p className="mt-1 text-slate-600">{dados.aluno.nome}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAno((prev) => prev - 1)}>← {ano - 1}</Button>
              <Button variant="outline" size="sm" onClick={() => setAno((prev) => prev + 1)}>{ano + 1} →</Button>
            </div>
          </div>
        </div>

        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}

        {erro && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>{erro}</span>
            <Button size="sm" variant="outline" onClick={() => carregar(ano)}>Tentar novamente</Button>
          </div>
        )}

        {carregando ? (
          <p className="text-center text-slate-500">Carregando...</p>
        ) : dados ? (
          <>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Status do ciclo</p>
                  <Badge variant={dados.fichaAnual.status === 'FECHADA' ? 'gray' : 'green'}>
                    {dados.fichaAnual.status === 'FECHADA' ? 'Fechada' : 'Em andamento'}
                  </Badge>
                  {dados.fichaAnual.status === 'FECHADA' && (
                    <p className="mt-1 text-xs text-slate-500">Fechada em {formatarDataHora(dados.fichaAnual.fechadaEm)}</p>
                  )}
                </div>
                {isSecretaria(user) && dados.fichaAnual.status !== 'FECHADA' && (
                  <Button variant="outline" onClick={fecharAno} disabled={fechando}>{fechando ? 'Fechando...' : 'Fechar Ficha Anual'}</Button>
                )}
              </div>

              {isSecretaria(user) && (
                <form onSubmit={salvarCiclo} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                  <FormField label={`Encerramento automático do ciclo ${ano}`}>
                    <input type="date" className={inputClass} value={dataEncerramentoForm} onChange={(event) => setDataEncerramentoForm(event.target.value)} />
                  </FormField>
                  <Button type="submit" variant="outline" size="sm" disabled={salvandoCiclo}>{salvandoCiclo ? 'Salvando...' : 'Salvar'}</Button>
                  {ciclo?.dataEncerramento && <p className="text-xs text-slate-500">Configurado: {formatarData(ciclo.dataEncerramento)}</p>}
                </form>
              )}
            </Card>

            {dados.periodos.length === 0 ? (
              <EmptyState title={`Nenhuma Ficha PDI em ${ano}`} description="Ainda não existe nenhum formulário PDI deste aluno para este ano, dentro do que você tem acesso a ver." />
            ) : (
              <div className="space-y-4">
                {dados.periodos.map((periodo) => (
                  <Card key={periodo.aplicacaoId}>
                    <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
                      {periodo.aplicacaoNome || 'Aplicação'} · {formatarData(periodo.dataInicio)} a {formatarData(periodo.dataFim)}
                    </p>
                    <div className="mt-3 divide-y divide-slate-100">
                      {periodo.fichas.map((ficha) => (
                        <button
                          key={ficha.fichaId}
                          type="button"
                          onClick={() => navigate(`/pdi/fichas/${periodo.aplicacaoId}/${ficha.disciplinaId}/${id}`)}
                          className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{ficha.disciplinaNome}</p>
                            <p className="text-xs text-slate-500">{ficha.escolaNome} · {ficha.turmaNome} · {ficha.professorNome}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {ficha.indicadorCorrecao !== 'nenhuma' && (
                              <Badge variant={INDICADOR_CORRECAO_VARIANT[ficha.indicadorCorrecao]}>{INDICADOR_CORRECAO_LABEL[ficha.indicadorCorrecao]}</Badge>
                            )}
                            <Badge variant={STATUS_FICHA_VARIANT[ficha.status]}>{STATUS_FICHA_LABEL[ficha.status]}</Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {dados.movimentacoes.length > 1 && (
              <Card>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Histórico de turma/escola do aluno</p>
                <p className="mt-1 text-xs text-slate-500">Mostra todo o histórico do aluno na rede, não só deste ano.</p>
                <ul className="mt-3 space-y-2">
                  {dados.movimentacoes.map((mov, index) => (
                    <li key={index} className="text-sm text-slate-700">
                      <strong>{mov.escolaNome} · {mov.turmaNome}</strong>
                      {' — '}{formatarData(mov.dataInicio)} {mov.dataFim ? `a ${formatarData(mov.dataFim)}` : '(atual)'}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Anamnese</p>
              <p className="mt-1 text-sm text-slate-600">Referência de consulta — não faz parte do conteúdo deste ano.</p>
              <Link to={`/pdi/alunos/${id}/anamnese`} className="mt-2 inline-block text-sm font-semibold text-teal-700 hover:underline">Ver Anamnese →</Link>
            </Card>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
};
