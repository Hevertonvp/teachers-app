import { useEffect, useState } from 'react';
import { Badge, Button } from '../Common';
import { obterIndicadoresAluno } from '../../services/pdiIndicadores';
import { AlternarTabela, BarraEmpilhada, GraficoColunas, GraficoLinha, Legenda, TabelaDados, Variacao } from './Graficos';
import { formatarNumero, tetoRedondo, useVizTema } from './vizTema';

// Indicadores REAIS de desenvolvimento do aluno (substitui o antigo gráfico fictício). Fonte:
// GET /api/pdi-indicadores/alunos/:id. Visão geral = perguntas comuns (média entre os
// professores) + resumo das disciplinas; cada aba de disciplina = nota, CRMG, perguntas comuns
// respondidas pelo professor daquela disciplina e os registros escritos (inclui a pergunta do trimestre).

const STATUS = {
  CONCLUIDA: { rotulo: 'Concluída', variante: 'green' },
  EM_ANDAMENTO: { rotulo: 'Em preenchimento', variante: 'blue' },
  PENDENTE: { rotulo: 'Pendente', variante: 'gray' },
};

const rotuloPeriodo = (a) => ({
  id: a.id,
  rotulo: a.trimestre ? `${a.trimestre}º tri` : new Date(a.dataInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
  subrotulo: String(new Date(a.dataInicio).getUTCFullYear()),
});

const Kpi = ({ rotulo, valor, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-semibold text-slate-500">{rotulo}</p>
    <p className="mt-1 text-2xl font-bold text-slate-950">{valor}</p>
    {children && <div className="mt-2">{children}</div>}
  </div>
);

const Bloco = ({ titulo, descricao, acoes, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h4 className="font-bold text-slate-950">{titulo}</h4>
        {descricao && <p className="mt-0.5 text-xs text-slate-500">{descricao}</p>}
      </div>
      {acoes}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

// Gráfico + alternância de tabela, com legenda opcional acima.
const Figura = ({ legenda, formaLegenda, tabela, children }) => {
  const [emTabela, setEmTabela] = useState(false);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">{legenda && !emTabela && <Legenda itens={legenda} forma={formaLegenda} />}</div>
        <AlternarTabela emTabela={emTabela} onAlternar={() => setEmTabela(v => !v)} />
      </div>
      <div key={emTabela ? 't' : 'g'} className="pdi-chart-fade">{emTabela ? tabela : children}</div>
    </div>
  );
};

const ChavePerguntas = ({ perguntas, cores }) => (
  <ol className="mt-3 space-y-1.5 text-xs text-slate-600">
    {perguntas.map((p, i) => (
      <li key={p.id} className="flex gap-2">
        {cores && <span aria-hidden className="mt-1.5 inline-block h-0.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: cores[i] }} />}
        <span><strong className="text-slate-800">P{i + 1}</strong> — {p.texto}</span>
      </li>
    ))}
  </ol>
);

const VisaoGeral = ({ dados, categorias }) => {
  const tema = useVizTema();
  const { perguntasComuns, visaoGeral, escalaMax, fichas, disciplinas } = dados;
  const cores = tema.series;
  const ticks = Array.from({ length: escalaMax }, (_, i) => ({ valor: i + 1, rotulo: String(i + 1) }));
  const series = perguntasComuns.slice(0, 3).map((p, i) => ({
    id: p.id,
    nome: `P${i + 1}`,
    cor: cores[i],
    valores: visaoGeral.map(v => v.valores[p.id]?.media ?? null),
    detalhes: visaoGeral.map(v => (v.valores[p.id] ? `média de ${v.valores[p.id].professores} ${v.valores[p.id].professores === 1 ? 'professor' : 'professores'}` : null)),
  }));
  const temComuns = series.some(s => s.valores.some(v => v !== null));
  const pct = fichas.total ? Math.round((fichas.concluidas / fichas.total) * 100) : 0;

  const ultimoDe = (valores) => {
    const preenchidos = valores.filter(v => v !== null);
    return { atual: preenchidos[preenchidos.length - 1] ?? null, anterior: preenchidos[preenchidos.length - 2] ?? null };
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Fichas concluídas" valor={`${fichas.concluidas} de ${fichas.total}`}>
          <BarraEmpilhada rotulo="Fichas" altura={8} segmentos={[
            { id: 'c', rotulo: 'Concluídas', valor: fichas.concluidas, cor: tema.ordinal.forte },
            { id: 'a', rotulo: 'Em preenchimento', valor: fichas.emAndamento, cor: tema.ordinal.medio },
            { id: 'p', rotulo: 'Pendentes', valor: fichas.pendentes, cor: tema.ordinal.fraco },
          ]} />
          <p className="mt-1.5 text-xs text-slate-500">{pct}% concluídas</p>
        </Kpi>
        <Kpi rotulo="Períodos acompanhados" valor={categorias.length} />
        <Kpi rotulo="Disciplinas" valor={disciplinas.length} />
        <Kpi rotulo="Último período" valor={categorias.length ? `${categorias[categorias.length - 1].rotulo}` : '—'}>
          {categorias.length > 0 && <p className="text-xs text-slate-500">{categorias[categorias.length - 1].subrotulo}</p>}
        </Kpi>
      </div>

      <Bloco titulo="Perguntas comuns" descricao={`Média entre os professores do aluno · ${escalaMax} = mais autonomia, 1 = mais necessidade de suporte`}>
        {!temComuns ? (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Ainda não há respostas às perguntas comuns para este aluno.</p>
        ) : (
          <>
            <Figura
              legenda={series.map(s => ({ id: s.id, nome: s.nome, cor: s.cor }))}
              tabela={<TabelaDados categorias={categorias} series={series} formatarValor={v => formatarNumero(v, 2)} />}
            >
              <GraficoLinha categorias={categorias} series={series} dominio={{ min: 1, max: escalaMax }} ticks={ticks} formatarValor={v => formatarNumero(v, 2)} rotulo="Evolução das perguntas comuns" />
            </Figura>
            {categorias.length === 1 && <p className="mt-2 text-xs text-slate-500">A linha de evolução aparece a partir do segundo período registrado.</p>}
            <ChavePerguntas perguntas={perguntasComuns.slice(0, 3)} cores={cores} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {series.map((s, i) => {
                const { atual, anterior } = ultimoDe(s.valores);
                return (
                  <div key={s.id} className="rounded-xl bg-slate-50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: s.cor }} />P{i + 1} · último período</p>
                    <p className="mt-1 text-xl font-bold text-slate-950">{atual === null ? '—' : `${formatarNumero(atual, 2)} / ${escalaMax}`}</p>
                    <Variacao atual={atual} anterior={anterior} formatar={v => formatarNumero(v, 2)} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Bloco>

      <Bloco titulo="Notas por disciplina" descricao="Nota registrada no período mais recente de cada disciplina">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Disciplina</th><th className="py-2 pr-4">Nota</th><th className="py-2 pr-4">Variação</th><th className="py-2">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {disciplinas.map(d => {
                const notas = d.pontos.map(p => p.nota).filter(n => n !== null);
                const ultimo = d.pontos[d.pontos.length - 1];
                return (
                  <tr key={d.disciplinaId} className="border-b border-slate-200 last:border-0">
                    <td data-label="Disciplina" className="py-2.5 pr-4 font-medium text-slate-800">{d.nome}</td>
                    <td data-label="Nota" className="py-2.5 pr-4 font-bold tabular-nums text-slate-950">{formatarNumero(notas[notas.length - 1] ?? null)}</td>
                    <td data-label="Variação" className="py-2.5 pr-4"><Variacao atual={notas[notas.length - 1]} anterior={notas[notas.length - 2]} /></td>
                    <td data-label="Ficha" className="py-2.5"><Badge variant={STATUS[ultimo.status].variante}>{STATUS[ultimo.status].rotulo}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Bloco>
    </div>
  );
};

const Disciplina = ({ dados, disciplina, categoriasTodas }) => {
  const tema = useVizTema();
  const pontoPorAplicacao = new Map(disciplina.pontos.map(p => [p.aplicacaoId, p]));
  const categorias = categoriasTodas.filter(c => pontoPorAplicacao.has(c.id));
  const pontos = categorias.map(c => pontoPorAplicacao.get(c.id));
  const ultimo = pontos[pontos.length - 1];
  const notas = pontos.map(p => p.nota);
  const notasValidas = notas.filter(n => n !== null);
  const tetoNota = tetoRedondo(Math.max(10, ...notasValidas));
  const perguntasCrmg = ultimo.crmg.map(c => c.pergunta);
  const seriesCrmg = perguntasCrmg.slice(0, 2).map((pergunta, i) => ({
    id: `crmg-${i}`,
    nome: pergunta,
    cor: tema.series[i],
    valores: pontos.map(p => {
      const item = p.crmg[i];
      return item && item.respondida && !item.todas ? item.quantidade : null;
    }),
    texto: pontos.map(p => {
      const item = p.crmg[i];
      if (!item || !item.respondida) return '—';
      return item.todas ? 'Todas' : undefined;
    }),
  }));
  const temCrmg = pontos.some(p => p.crmg.some(c => c.respondida));
  const { perguntasComuns, escalaMax } = dados;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        <Kpi rotulo={`Nota ·${categorias[categorias.length - 1]?.rotulo ?? ''}`} valor={formatarNumero(ultimo.nota)}>
          <Variacao atual={notasValidas[notasValidas.length - 1]} anterior={notasValidas[notasValidas.length - 2]} />
        </Kpi>
        {ultimo.crmg.slice(0, 2).map((c, i) => (
          <Kpi key={c.pergunta} rotulo={i === 0 ? 'Habilidades (1ª pergunta CRMG)' : 'Habilidades (2ª pergunta CRMG)'} valor={!c.respondida ? '—' : c.todas ? 'Todas' : c.quantidade}>
            <p className="line-clamp-2 text-xs text-slate-500">{c.pergunta}</p>
          </Kpi>
        ))}
        <Kpi rotulo="Ficha do último período" valor={<Badge variant={STATUS[ultimo.status].variante}>{STATUS[ultimo.status].rotulo}</Badge>}>
          <p className="text-xs text-slate-500">Professor(a): {ultimo.professorNome}</p>
        </Kpi>
      </div>

      <Bloco titulo="Nota" descricao={ultimo.perguntaNota || 'Nota registrada pelo professor em cada período'}>
        {notasValidas.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Nenhuma nota registrada ainda.</p>
        ) : (
          <Figura tabela={<TabelaDados categorias={categorias} series={[{ id: 'nota', nome: 'Nota', valores: notas }]} />}>
            <GraficoLinha
              categorias={categorias}
              series={[{ id: 'nota', nome: 'Nota', cor: tema.series[0], valores: notas }]}
              dominio={{ min: 0, max: tetoNota }}
              ticks={[0, tetoNota / 2, tetoNota].map(v => ({ valor: v, rotulo: formatarNumero(v) }))}
              rotulo={`Evolução da nota em ${disciplina.nome}`}
            />
          </Figura>
        )}
      </Bloco>

      {seriesCrmg.length > 0 && (
        <Bloco titulo="Habilidades do CRMG" descricao="Quantidade de habilidades marcadas pelo professor em cada período">
          {!temCrmg ? (
            <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Nenhuma habilidade registrada ainda.</p>
          ) : (
            <Figura
              legenda={seriesCrmg.length > 1 ? seriesCrmg.map(s => ({ id: s.id, nome: s.nome, cor: s.cor })) : null}
              formaLegenda="barra"
              tabela={<TabelaDados categorias={categorias} series={seriesCrmg} />}
            >
              <GraficoColunas categorias={categorias} series={seriesCrmg} rotulo={`Habilidades do CRMG em ${disciplina.nome}`} />
            </Figura>
          )}
        </Bloco>
      )}

      {perguntasComuns.length > 0 && (
        <Bloco titulo="Perguntas comuns — professor desta disciplina" descricao={`Resposta do professor responsável · ${escalaMax} = mais autonomia, 1 = mais suporte`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Pergunta</th>
                  {categorias.map(c => <th key={c.id} className="py-2 pr-4 whitespace-nowrap">{c.rotulo} {c.subrotulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {perguntasComuns.map((p, i) => (
                  <tr key={p.id} className="border-b border-slate-200 align-top last:border-0">
                    <td data-label="Pergunta" className="py-2.5 pr-4 font-semibold text-slate-800" title={p.texto}>P{i + 1}</td>
                    {pontos.map((ponto, pi) => {
                      const r = ponto.comuns[p.id];
                      return (
                        <td key={ponto.fichaId} data-label={`${categorias[pi].rotulo} ${categorias[pi].subrotulo}`} className="min-w-40 py-2.5 pr-4">
                          {r?.nivel ? (
                            <>
                              <p className="font-bold tabular-nums text-slate-950">{r.nivel} / {escalaMax}</p>
                              <p className="text-xs leading-snug text-slate-500">{r.opcao}</p>
                            </>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ChavePerguntas perguntas={perguntasComuns} />
        </Bloco>
      )}

      <Bloco titulo="Registros do professor" descricao="Respostas escritas, incluindo a pergunta do trimestre">
        <div className="space-y-2">
          {[...pontos].reverse().map((ponto, i) => {
            const categoria = categorias[categorias.length - 1 - i];
            const preenchidos = ponto.registros.filter(r => r.texto);
            return (
              <details key={ponto.fichaId} open={i === 0} className="group rounded-xl border border-slate-200 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-800">
                  <span>{categoria.rotulo} {categoria.subrotulo}</span>
                  <span className="text-xs font-medium text-slate-500">{preenchidos.length ? `${preenchidos.length} ${preenchidos.length === 1 ? 'registro' : 'registros'}` : 'sem registros'} <span className="inline-block transition group-open:rotate-180">▾</span></span>
                </summary>
                {preenchidos.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {preenchidos.map(r => (
                      <div key={r.pergunta}>
                        <p className="text-xs font-semibold text-slate-500">{r.pergunta}</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{r.texto}</p>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </Bloco>
    </div>
  );
};

export const IndicadoresAluno = ({ alunoId }) => {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState('geral');

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      setDados(await obterIndicadoresAluno(alunoId));
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, [alunoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cabecalho = (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Desenvolvimento do aluno</p>
      <h3 className="mt-1 text-xl font-bold text-slate-950">Indicadores do PDI</h3>
      <p className="mt-1 text-sm text-slate-500">A partir das Fichas PDI registradas pelos professores em cada período.</p>
    </div>
  );

  if (carregando && !dados) return <div>{cabecalho}<p className="mt-6 text-sm text-slate-500">Carregando indicadores...</p></div>;
  if (erro) {
    return (
      <div>
        {cabecalho}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <span>Não foi possível carregar os indicadores: {erro}</span>
          <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
        </div>
      </div>
    );
  }
  if (!dados || dados.fichas.total === 0) {
    return (
      <div>
        {cabecalho}
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
          <p className="font-semibold text-slate-800">Ainda não há Fichas PDI para este aluno</p>
          <p className="mt-1 text-sm text-slate-500">Os indicadores aparecem assim que os professores começarem a preencher.</p>
        </div>
      </div>
    );
  }

  const categorias = dados.aplicacoes.map(rotuloPeriodo);
  const abas = [{ id: 'geral', nome: 'Visão geral' }, ...dados.disciplinas.map(d => ({ id: d.disciplinaId, nome: d.nome }))];
  const disciplina = dados.disciplinas.find(d => d.disciplinaId === aba);

  return (
    <div>
      {cabecalho}
      <div role="tablist" aria-label="Indicadores por disciplina" className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {abas.map(item => {
          const ativa = item.id === aba;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setAba(item.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${ativa ? 'bg-teal-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
            >
              {item.nome}
            </button>
          );
        })}
      </div>
      <div key={String(aba)} role="tabpanel" className="pdi-chart-fade mt-5">
        {aba === 'geral' || !disciplina
          ? <VisaoGeral dados={dados} categorias={categorias} />
          : <Disciplina dados={dados} disciplina={disciplina} categoriasTodas={categorias} />}
      </div>
    </div>
  );
};
