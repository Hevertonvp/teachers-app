import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, EmptyState, FormField } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { inputClass, turmaName } from '../utils/display';
import { filterByEscola } from '../utils/escolas';
import { trimestres } from '../utils/trimestres';
import { PDI_INDICADORES_ESTRUTURADOS, evolucaoIndicador } from '../utils/pdiIndicadores';
import { canManagePedagogico } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

const GRID = '#e2e8f0';
const AXIS = '#94a3b8';
const MUTED = '#64748b';
const INK = '#334155';
const TEAL = '#0f766e';

const perguntaLabel = (pergunta) => (pergunta.pergunta.length > 60 ? `${pergunta.pergunta.slice(0, 60)}…` : pergunta.pergunta);

const respostaResumo = (pergunta, registro) => {
  if (!registro) return null;
  if (pergunta.tipoResposta === 'marcacao') return registro.resposta ? 'Marcado' : 'Não marcado';
  if (pergunta.tipoResposta === 'selecao') return registro.complementarTexto ? `${registro.resposta} · ${registro.complementarTexto}` : registro.resposta;
  return registro.resposta;
};

// Valor "estruturado" (comparável objetivamente) de uma resposta. Texto não entra aqui — texto
// é sempre comparado lado a lado, nunca reduzido a um valor. Usado só para as perguntas FORA da
// Análise de Desenvolvimento (habilidade/personalizada) — as 9 estruturadas têm seu próprio
// gráfico por indicador (ver IndicadorEvolucao mais abaixo).
const respostaEstruturadaValor = (pergunta, registro) => {
  if (!registro) return undefined;
  if (pergunta.tipoResposta === 'marcacao') return registro.resposta ? 'Marcado' : 'Não marcado';
  if (pergunta.tipoResposta === 'selecao') return registro.resposta;
  return undefined;
};

// Compara as respostas de cada pergunta (fora da análise oficial) entre dois trimestres. Não
// infere nem pontua nada — só aponta o que mudou (estruturado) ou apresenta o texto lado a lado.
const buildComparacao = (perguntas, respostasAluno, trimestreA, trimestreB) => perguntas.map(pergunta => {
  const registroA = respostasAluno.find(item => item.perguntaId === pergunta.id && item.trimestre === trimestreA);
  const registroB = respostasAluno.find(item => item.perguntaId === pergunta.id && item.trimestre === trimestreB);

  if (pergunta.tipoResposta === 'texto') {
    if (!registroA?.resposta && !registroB?.resposta) return null;
    return {
      pergunta,
      tipo: 'texto',
      valorA: registroA?.resposta || null,
      valorB: registroB?.resposta || null,
      igual: !!registroA?.resposta && !!registroB?.resposta && registroA.resposta === registroB.resposta,
    };
  }

  const valorA = respostaEstruturadaValor(pergunta, registroA);
  const valorB = respostaEstruturadaValor(pergunta, registroB);
  if (valorA === undefined || valorB === undefined) return null;
  return { pergunta, tipo: pergunta.tipoResposta, valorA, valorB, mudou: valorA !== valorB };
}).filter(Boolean);

// Gráfico de evolução de UM indicador estruturado. Ordinal (opções fixas, ex.: nível de
// suporte) plota a posição da opção na escala; numérico (rendimento) plota o valor real. Nunca
// inventa ponto: só os trimestres com resposta real registrada entram no gráfico.
const IndicadorChart = ({ pontos, opcoes }) => {
  const width = 480;
  const height = 190;
  const padLeft = 108;
  const padRight = 16;
  const padTop = 16;
  const plotH = height - padTop - 32;
  const isOrdinal = opcoes.length > 0;
  const valores = pontos.map(ponto => (isOrdinal ? opcoes.indexOf(ponto.valor) : Number(ponto.valor)));
  const minV = isOrdinal ? 0 : Math.min(...valores);
  const maxV = isOrdinal ? Math.max(1, opcoes.length - 1) : Math.max(...valores);
  const range = maxV - minV || 1;
  const plotW = width - padLeft - padRight;
  const x = (index) => padLeft + (pontos.length === 1 ? plotW / 2 : (plotW * index) / (pontos.length - 1));
  const y = (valor) => padTop + plotH - ((valor - minV) / range) * plotH;
  const coords = valores.map((valor, index) => ({ x: x(index), y: y(valor) }));
  const path = coords.map((ponto, index) => `${index === 0 ? 'M' : 'L'} ${ponto.x} ${ponto.y}`).join(' ');
  const ticks = isOrdinal ? opcoes.map((label, index) => ({ label, valor: index })) : [minV, (minV + maxV) / 2, maxV].map(valor => ({ label: Math.round(valor * 10) / 10, valor }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label="Evolução do indicador por trimestre">
      {ticks.map(tick => (
        <g key={tick.label}>
          <line x1={padLeft} x2={width - padRight} y1={y(tick.valor)} y2={y(tick.valor)} stroke={GRID} strokeWidth="1" />
          <text x={padLeft - 8} y={y(tick.valor) + 4} textAnchor="end" fill={MUTED} fontSize="10" fontWeight="700">{tick.label}</text>
        </g>
      ))}
      <line x1={padLeft} x2={padLeft} y1={padTop} y2={padTop + plotH} stroke={AXIS} strokeWidth="1.5" />
      <line x1={padLeft} x2={width - padRight} y1={padTop + plotH} y2={padTop + plotH} stroke={AXIS} strokeWidth="1.5" />
      {coords.length > 1 && <path d={path} fill="none" stroke={TEAL} strokeWidth="2" />}
      {coords.map((ponto, index) => (
        <g key={pontos[index].trimestre}>
          <circle cx={ponto.x} cy={ponto.y} r="5" fill={TEAL} />
          <text x={ponto.x} y={height - 6} textAnchor="middle" fill={INK} fontSize="11" fontWeight="700">{pontos[index].trimestre}</text>
        </g>
      ))}
    </svg>
  );
};

// Um indicador estruturado: comparação textual entre trimestres consecutivos + gráfico (quando
// houver >=2 pontos). Com 0 pontos, não aparece nada (a seção mostra "dados insuficientes" à
// parte se NENHUM indicador tiver dado). Com 1 ponto, mostra só o valor, sem gráfico/tendência.
const IndicadorEvolucao = ({ definicao, evolucao }) => {
  const { pontos } = evolucao;
  if (pontos.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-bold text-slate-900">{definicao.pergunta}</p>
      {pontos.length === 1 ? (
        <p className="mt-2 text-sm text-slate-600">{pontos[0].trimestre}: <strong>{pontos[0].valor}</strong>{pontos[0].complementarTexto && ` — ${pontos[0].complementarTexto}`}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">{pontos.map((ponto, index) => (
            <span key={ponto.trimestre}>{index > 0 && ' → '}{ponto.trimestre}: <strong>{ponto.valor}</strong></span>
          ))}</p>
          <div className="mt-3">
            <IndicadorChart pontos={pontos} opcoes={definicao.tipoResposta === 'numero' ? [] : definicao.opcoes} />
          </div>
        </>
      )}
    </div>
  );
};

export const AcompanhamentoPdiPage = () => {
  const { user } = useAuth();
  const { pdiAlunos, pdiPerguntas, pdiRespostas, turmas } = useData();
  const { activeEscolaId } = useEscola();
  const [search, setSearch] = useState('');
  const [selectedAlunoId, setSelectedAlunoId] = useState(null);

  const alunosDaEscola = filterByEscola(pdiAlunos, activeEscolaId, user).filter(item => item.status === 'ativo');
  const alunosFiltrados = alunosDaEscola.filter(item => item.nome.toLowerCase().includes(search.toLowerCase()));
  const aluno = alunosFiltrados.find(item => item.id === selectedAlunoId) || null;

  const perguntas = useMemo(
    () => [...pdiPerguntas].filter(pergunta => pergunta.status === 'ativa').sort((left, right) => Number(left.ordem) - Number(right.ordem)),
    [pdiPerguntas]
  );
  // Registro pedagógico e demais perguntas fora da Análise de Desenvolvimento (qualitativa,
  // habilidade, personalizada) — comparação bruta, sem indicador oficial.
  const perguntasForaDaAnalise = useMemo(() => perguntas.filter(pergunta => pergunta.origem !== 'estruturada'), [perguntas]);

  const respostasAluno = useMemo(
    () => (aluno ? pdiRespostas.filter(item => item.alunoId === aluno.id) : []),
    [aluno, pdiRespostas]
  );

  const trimestresComDados = useMemo(
    () => trimestres.filter(trimestre => respostasAluno.some(item => item.trimestre === trimestre)),
    [respostasAluno]
  );

  // A Análise de Desenvolvimento usa SOMENTE os 9 indicadores estruturados padrão — nunca
  // texto livre, nunca habilidade/personalizada (ver seção 26 do pedido).
  const evolucoesIndicadores = useMemo(() => (aluno
    ? PDI_INDICADORES_ESTRUTURADOS
      .map(definicao => ({ definicao, evolucao: evolucaoIndicador(perguntas, pdiRespostas, aluno.id, definicao.indicador, trimestres) }))
      .filter(item => item.evolucao && item.evolucao.pontos.length > 0)
    : []), [aluno, perguntas, pdiRespostas]);

  const ultimoTrimestre = trimestresComDados[trimestresComDados.length - 1] || null;
  const respostasUltimoTrimestre = ultimoTrimestre ? respostasAluno.filter(item => item.trimestre === ultimoTrimestre) : [];

  // Gestor e Secretaria administram o PDI e por isso acessam este acompanhamento.
  if (!canManagePedagogico(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Acompanhamento pedagógico</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Análise de Desenvolvimento</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Selecione uma escola no topo da página, depois um aluno, para ver como os indicadores observáveis do aluno mudaram ao longo dos trimestres, a partir das respostas reais registradas no Formulário PDI.</p>
        </div>

        {activeEscolaId === null ? (
          <EmptyState title="Selecione uma escola" description="Escolha uma escola específica no topo da página para consultar os alunos do PDI." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
            <Card className="lg:sticky lg:top-20">
              <FormField label="Buscar aluno"><input className={inputClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome do aluno" /></FormField>
              <div className="mt-4 max-h-[70vh] space-y-1.5 overflow-y-auto">
                {alunosFiltrados.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum aluno ativo encontrado.</p>}
                {alunosFiltrados.map(item => {
                  const trimestresDoItem = trimestres.filter(trimestre => pdiRespostas.some(resposta => resposta.alunoId === item.id && resposta.trimestre === trimestre)).length;
                  const isActive = aluno?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedAlunoId(item.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{item.nome}</span>
                        <span className={`block text-xs ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>{turmaName(turmas, item.turmaId)}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>{trimestresDoItem}/{trimestres.length} tri.</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {!aluno ? (
              <EmptyState title="Nenhum aluno selecionado" description="Escolha um aluno na lista ao lado para ver sua Análise de Desenvolvimento no PDI." />
            ) : (
              <div className="space-y-4">
                <Card>
                  <h2 className="text-xl font-bold text-slate-950">{aluno.nome}</h2>
                  <p className="mt-1 text-sm text-slate-600">{turmaName(turmas, aluno.turmaId)}</p>
                  <p className="mt-1 text-sm text-slate-500">{aluno.condicaoInformada || 'Condição não informada'}</p>
                </Card>

                {trimestresComDados.length === 0 ? (
                  <EmptyState title="Dados insuficientes para apresentar a evolução" description="Este aluno ainda não tem nenhuma resposta registrada no Formulário PDI. Assim que a Professora preencher um trimestre, a Análise de Desenvolvimento aparece aqui automaticamente." />
                ) : (
                  <>
                    {/* 1. Análise de Desenvolvimento — SOMENTE os indicadores estruturados padrão */}
                    <Card>
                      <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Análise de Desenvolvimento</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">Evolução por indicador</h3>
                      <p className="mt-1 text-sm text-slate-600">Cada indicador vem de uma pergunta padrão do Formulário PDI, comparável entre trimestres. Não é nota, score nem ranking do aluno.</p>

                      {evolucoesIndicadores.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-500">Nenhum indicador estruturado respondido ainda para este aluno.</p>
                      ) : (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          {evolucoesIndicadores.map(({ definicao, evolucao }) => (
                            <IndicadorEvolucao key={definicao.indicador} definicao={definicao} evolucao={evolucao} />
                          ))}
                        </div>
                      )}

                      {trimestresComDados.length < 2 && (
                        <p className="mt-4 text-xs font-semibold text-amber-700">Ainda há apenas 1 trimestre preenchido — o gráfico e a tendência aparecem quando houver um segundo trimestre comparável.</p>
                      )}

                      {/* Tabela comparativa indicador × trimestre */}
                      {evolucoesIndicadores.length > 0 && (
                        <div className="mt-6 overflow-x-auto border-t border-slate-200 pt-4">
                          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Indicador</th>
                                {trimestresComDados.map(trimestre => <th key={trimestre} className="px-4 py-3">{trimestre}</th>)}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {evolucoesIndicadores.map(({ definicao, evolucao }) => (
                                <tr key={definicao.indicador}>
                                  <td className="max-w-xs px-4 py-3 align-top font-medium text-slate-800">{perguntaLabel(definicao)}</td>
                                  {trimestresComDados.map(trimestre => {
                                    const ponto = evolucao.pontos.find(item => item.trimestre === trimestre);
                                    return <td key={trimestre} className="px-4 py-3 align-top text-slate-600">{ponto ? ponto.valor : <span className="text-slate-400">Não informado</span>}</td>;
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>

                    {/* 2. Registro pedagógico e demais perguntas — fora da análise oficial */}
                    <Card>
                      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Registro pedagógico</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">Comparação entre trimestres (fora da Análise de Desenvolvimento)</h3>
                      <p className="mt-1 text-sm text-slate-600">Texto livre, habilidades BNCC e perguntas personalizadas — apresentados para leitura, sem gerar indicador ou gráfico.</p>

                      {trimestresComDados.length < 2 ? (
                        <p className="mt-4 text-xs font-semibold text-amber-700">Ainda há apenas 1 trimestre preenchido — a comparação entre períodos aparece quando houver um segundo trimestre.</p>
                      ) : (
                        <div className="mt-4 space-y-4">
                          {trimestresComDados.slice(0, -1).map((trimestreA, index) => {
                            const trimestreB = trimestresComDados[index + 1];
                            const comparacoes = buildComparacao(perguntasForaDaAnalise, respostasAluno, trimestreA, trimestreB);
                            const mudancasEstruturadas = comparacoes.filter(item => item.tipo !== 'texto' && item.mudou);
                            const textos = comparacoes.filter(item => item.tipo === 'texto');
                            return (
                              <div key={`${trimestreA}-${trimestreB}`} className="rounded-xl bg-slate-50 p-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{trimestreA} → {trimestreB}</p>

                                {mudancasEstruturadas.length === 0 && textos.length === 0 && (
                                  <p className="text-sm text-slate-500">Nenhuma resposta comparável entre esses dois trimestres.</p>
                                )}

                                <div className="space-y-3">
                                  {mudancasEstruturadas.map(item => (
                                    <div key={item.pergunta.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                      <p className="text-xs font-semibold text-amber-900">{perguntaLabel(item.pergunta)}</p>
                                      <p className="mt-0.5 text-sm text-amber-800">{trimestreA}: <strong>{item.valorA}</strong> → {trimestreB}: <strong>{item.valorB}</strong></p>
                                    </div>
                                  ))}
                                  {textos.map(item => (
                                    <div key={item.pergunta.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                      <p className="text-xs font-semibold text-slate-700">{perguntaLabel(item.pergunta)}</p>
                                      {item.igual ? (
                                        <p className="mt-1 text-sm text-slate-500">Texto igual nos dois trimestres.</p>
                                      ) : (
                                        <div className="mt-1 grid gap-2 sm:grid-cols-2">
                                          <div><p className="text-[11px] font-semibold uppercase text-slate-400">{trimestreA}</p><p className="text-sm text-slate-700">{item.valorA || <span className="text-slate-400">Não respondida</span>}</p></div>
                                          <div><p className="text-[11px] font-semibold uppercase text-slate-400">{trimestreB}</p><p className="text-sm text-slate-700">{item.valorB || <span className="text-slate-400">Não respondida</span>}</p></div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>

                    {/* 3. Histórico das respostas — todas as perguntas, referência bruta */}
                    <Card>
                      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico das respostas</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">Todas as respostas por trimestre</h3>
                      <p className="mt-1 text-sm text-slate-600">Tabela de referência com a resposta registrada em cada pergunta (padrão e personalizada), trimestre a trimestre.</p>
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Pergunta</th>
                              {trimestresComDados.map(trimestre => <th key={trimestre} className="px-4 py-3">{trimestre}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {perguntas.map(pergunta => (
                              <tr key={pergunta.id}>
                                <td data-label="Pergunta" className="max-w-xs px-4 py-3 align-top font-medium text-slate-800">{pergunta.codigo ? `${pergunta.codigo} — ${pergunta.pergunta}` : pergunta.pergunta}</td>
                                {trimestresComDados.map(trimestre => {
                                  const registro = respostasAluno.find(item => item.perguntaId === pergunta.id && item.trimestre === trimestre);
                                  return <td key={trimestre} data-label={trimestre} className="max-w-xs px-4 py-3 align-top text-slate-600">{respostaResumo(pergunta, registro) || <span className="text-slate-400">Não respondida</span>}</td>;
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    {/* 4. Indicadores administrativos de preenchimento — de propósito discretos */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                      <span className="font-semibold uppercase tracking-wide text-slate-400">Preenchimento do PDI</span>
                      <span>Trimestres preenchidos: <strong className="text-slate-600">{trimestresComDados.length} de {trimestres.length}</strong></span>
                      <span>Perguntas respondidas{ultimoTrimestre ? ` (${ultimoTrimestre})` : ''}: <strong className="text-slate-600">{ultimoTrimestre ? `${respostasUltimoTrimestre.length} de ${perguntas.length}` : '—'}</strong></span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
