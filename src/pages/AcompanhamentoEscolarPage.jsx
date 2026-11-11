import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/Layouts';
import { useAuth } from '../context/AuthContext';
import { useEscola } from '../context/EscolaContext';
import { isDiretora, isSecretaria } from '../utils/roles';
import { obterAcompanhamentoEscola, obterAcompanhamentoRede } from '../services/acompanhamento';
import { BarraSituacao, fmt, fmtData, GraficoRitmo, LegendaSituacao, LinhaTempo, Paginacao, pct, usePaginas } from '../components/acompanhamento/Graficos';
import { AVISO_PDI_DESENVOLVIMENTO, PDI_ATIVO, PDI_EM_DESENVOLVIMENTO } from '../config/modulos';
import '../styles/acompanhamento.css';

// Acompanhamento Escolar (decisões do usuário, 10/11/2026; ver PROPOSTA_ACOMPANHAMENTO_ESCOLAR.md).
// Só leitura. Secretaria: rede inteira → escola (pelo mapa ou pelo seletor do topo). Diretora: só a
// própria escola. Sem nomes de alunos/professores e sem ranking; linguagem de apoio, não de cobrança.

const DIA_MS = 86400000;
const MOTIVO = {
  prazo_proximo: 'Prazo se aproximando',
  sem_movimento: 'Ainda sem início de preenchimento',
  encerrado_com_pendencias: 'Período encerrado com entregas em aberto',
};
const SITUACAO = { aberto: 'Aberto', reabertura: 'Em reabertura', encerrado: 'Encerrado', agendado: 'Agendado' };
const FORM = { pdi: 'PDI', umTerco: 'Formulário 1/3' };

// Datas do PDI vêm como "AAAA-MM-DD" (só data); as do 1/3, como instantes.
const fmtQualquer = (s) => (s && s.length === 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : fmtData(s));
const fimInstante = (s) => (s.length === 10 ? new Date(`${s}T23:59:59-03:00`) : new Date(s));

function textoPrazo(periodo) {
  if (periodo.situacao === 'agendado') return `Começa em ${fmtQualquer(periodo.inicio)}`;
  if (periodo.situacao === 'reabertura') return 'Em reabertura';
  if (periodo.situacao === 'encerrado') return `Encerrado em ${fmtQualquer(periodo.fim)}`;
  const dias = Math.ceil((fimInstante(periodo.fim).getTime() - Date.now()) / DIA_MS);
  if (dias <= 0) return 'Prazo hoje';
  return dias === 1 ? 'Prazo amanhã' : `Prazo em ${dias} dias`;
}

// Percentual só a partir do mínimo combinado; abaixo, "x de y".
const valorContagem = (c, minimo) => (c.esperado >= minimo ? `${pct(c.concluidas, c.esperado)}%` : `${fmt(c.concluidas)} de ${fmt(c.esperado)}`);

// ---------------------------------------------------------------------------------------------
const Cartao = ({ rotulo, valor, unidade, sub, nota, barra, tom, atraso = 0 }) => (
  <div className="acp-cartao" data-tom={tom} style={{ animationDelay: `${atraso}ms` }}>
    <span className="acp-cartao-rotulo">{rotulo}</span>
    <span className="acp-cartao-valor acp-num">{valor}{unidade && <small>{unidade}</small>}</span>
    {sub && <span className="acp-cartao-sub">{sub}</span>}
    {barra}
    {nota && <span className="acp-cartao-nota">{nota}</span>}
  </div>
);

const CartaoContagem = ({ rotulo, contagem, unidade, minimo, vazio, nota, atraso }) => {
  if (!contagem || contagem.esperado === null || contagem.esperado === undefined) {
    return <Cartao rotulo={rotulo} valor="—" sub={vazio} nota={nota} atraso={atraso} />;
  }
  return (
    <Cartao
      rotulo={rotulo}
      valor={valorContagem(contagem, minimo)}
      sub={`${fmt(contagem.concluidas)} de ${fmt(contagem.esperado)} ${unidade} concluídas`}
      barra={<BarraSituacao {...contagem} />}
      nota={nota}
      atraso={atraso}
    />
  );
};

// Célula do mapa (uma escola × um formulário).
const CelulaPeriodo = ({ periodo, minimo, rotuloMovel, semPeriodo, semEsperado }) => {
  let corpo;
  if (!periodo) corpo = <span className="acp-mapa-texto"><span>{semPeriodo}</span></span>;
  else if (periodo.situacao === 'agendado') corpo = <span className="acp-mapa-texto"><span>{textoPrazo(periodo)}</span></span>;
  else if (periodo.esperado === null) corpo = <span className="acp-mapa-texto"><span><b>{fmt(periodo.concluidas)}</b> concluídas</span><span>sem percentual</span></span>;
  else if (periodo.esperado === 0) corpo = <span className="acp-mapa-texto"><span>{semEsperado}</span></span>;
  else {
    corpo = (
      <>
        <span className="acp-mapa-texto"><span><b className="acp-num">{valorContagem(periodo, minimo)}</b> · {fmt(periodo.concluidas)}/{fmt(periodo.esperado)}</span><span>{textoPrazo(periodo)}</span></span>
        <BarraSituacao {...periodo} fina />
      </>
    );
  }
  return <span className="acp-mapa-celula"><span className="acp-rotulo-movel">{rotuloMovel}</span>{corpo}</span>;
};

// Padrão: escolas com algo a mostrar (esperado > 0 em algum formulário) primeiro, depois as demais;
// alfabética dentro de cada grupo. Não é ranking de desempenho; só tira as "vazias" do topo.
const temDados = (e) => ((e.pdi?.esperado ?? 0) > 0 || (e.pdi?.esperado === null && e.pdi?.concluidas > 0) || (e.umTerco?.esperado ?? 0) > 0 ? 0 : 1);
const ORDENS = {
  nome: { rotulo: 'Com atividade, A–Z', fn: (a, b) => temDados(a) - temDados(b) || a.nome.localeCompare(b.nome) },
  pdi: { rotulo: 'Menor andamento no PDI', fn: (a, b) => andamento(a.pdi) - andamento(b.pdi) || a.nome.localeCompare(b.nome) },
  umTerco: { rotulo: 'Menor andamento no 1/3', fn: (a, b) => andamento(a.umTerco) - andamento(b.umTerco) || a.nome.localeCompare(b.nome) },
};
function andamento(p) { return p && p.esperado ? p.concluidas / p.esperado : 2; } // sem esperado vai para o fim

const MapaRede = ({ escolas, form, minimo, abrirEscola }) => {
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('nome');
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return escolas.filter((e) => !termo || e.nome.toLocaleLowerCase('pt-BR').includes(termo)).sort(ORDENS[ordem].fn);
  }, [escolas, busca, ordem]);
  const { visiveis, pagina, total, setPagina } = usePaginas(filtradas, 8);
  const mostraPdi = form !== 'umTerco';
  const mostraUm = form !== 'pdi';
  return (
    <section className="acp-painel">
      <div className="acp-painel-topo">
        <div>
          <h2>Mapa da rede</h2>
          <p className="acp-painel-desc">Cada escola no período em foco. Clique para ver os detalhes.</p>
        </div>
        <div className="acp-mapa-ferramentas">
          <input className="acp-busca" type="search" placeholder="Buscar escola" aria-label="Buscar escola" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} />
          <select className="acp-ordem" aria-label="Ordenar escolas" value={ordem} onChange={(e) => { setOrdem(e.target.value); setPagina(0); }}>
            {Object.entries(ORDENS).filter(([k]) => k === 'nome' || (k === 'pdi' ? mostraPdi : mostraUm)).map(([k, o]) => <option key={k} value={k}>{o.rotulo}</option>)}
          </select>
        </div>
      </div>
      <div className="acp-mapa" data-colunas={mostraPdi && mostraUm ? 2 : 1}>
        <div className="acp-mapa-cab"><span>Escola</span>{mostraPdi && <span>PDI</span>}{mostraUm && <span>Formulário 1/3</span>}</div>
        {visiveis.map((e) => (
          <button key={e.id} type="button" className="acp-mapa-linha" onClick={() => abrirEscola(e.id)}>
            <span className="acp-mapa-nome" title={e.nome}>{e.nome}</span>
            {mostraPdi && <CelulaPeriodo periodo={e.pdi} minimo={minimo} rotuloMovel="PDI " semPeriodo="Sem Aplicação no período" semEsperado="Sem professor/aluno vinculado" />}
            {mostraUm && <CelulaPeriodo periodo={e.umTerco} minimo={minimo} rotuloMovel="1/3 " semPeriodo="Fora dos ciclos do ano" semEsperado="Sem turma elegível" />}
          </button>
        ))}
        {visiveis.length === 0 && <p className="acp-vazio">Nenhuma escola encontrada.</p>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <LegendaSituacao />
        <Paginacao pagina={pagina} total={total} setPagina={setPagina} rotulo="Páginas do mapa da rede" />
      </div>
    </section>
  );
};

// "Formulário 1/3 — Nov/2026" já diz o formulário; "PDI · 3º trimestre" também. Só prefixa quando não diz.
const rotuloPeriodo = (i) => (i.titulo.startsWith(FORM[i.formulario]) || i.titulo.startsWith('PDI') ? i.titulo : `${FORM[i.formulario]} · ${i.titulo}`);

const ListaAcompanhamento = ({ itens, form, emEscola, acaoItem, rotuloAcao }) => {
  const lista = itens.filter((i) => form === 'ambos' || i.formulario === form);
  const { visiveis, pagina, total, setPagina } = usePaginas(lista, 5);
  return (
    <section className="acp-painel">
      <div className="acp-painel-topo">
        <div>
          <h2>Entregas que merecem acompanhamento</h2>
          <p className="acp-painel-desc">Situações em que um contato de apoio pode ajudar. Ordenadas pela data do prazo.</p>
        </div>
        {lista.length > 0 && <span className="acp-selo">{lista.length} {lista.length === 1 ? 'situação' : 'situações'}</span>}
      </div>
      {lista.length === 0 ? <p className="acp-vazio">Nenhuma situação pede acompanhamento agora.</p> : (
        <div className="acp-lista">
          {visiveis.map((i) => (
            <div key={`${i.formulario}-${i.periodoId}-${i.escolaId}`} className="acp-item">
              <div>
                <div className="acp-item-titulo">{emEscola ? rotuloPeriodo(i) : i.escolaNome}</div>
                <div className="acp-item-sub">
                  {!emEscola && <>{rotuloPeriodo(i)}<br /></>}
                  {MOTIVO[i.motivo]} · {fmt(i.concluidas)} de {fmt(i.esperado)} concluídas{i.emAndamento ? `, ${fmt(i.emAndamento)} em andamento` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className="acp-selo" data-tom="atencao">{i.motivo === 'encerrado_com_pendencias' ? `Encerrado em ${fmtData(i.fim)}` : textoPrazo({ situacao: 'aberto', fim: i.fim })}</span>
                {acaoItem && <button type="button" className="acp-link" onClick={() => acaoItem(i)}>{rotuloAcao(i)}</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Paginacao pagina={pagina} total={total} setPagina={setPagina} rotulo="Páginas das entregas que merecem acompanhamento" />
    </section>
  );
};

const PainelPrazos = ({ prazos, form }) => {
  const agora = Date.now();
  const de = new Date(agora - 14 * DIA_MS);
  const ate = new Date(agora + 45 * DIA_MS);
  const itens = prazos
    .filter((p) => form === 'ambos' || p.formulario === form)
    .filter((p) => new Date(p.fim).getTime() >= de.getTime() - 0 || p.reaberturas.some((r) => new Date(r.fim).getTime() >= de.getTime()))
    .filter((p) => new Date(p.inicio).getTime() <= ate.getTime())
    .map((p, i) => ({
      chave: `${p.formulario}-${p.id ?? i}-${p.inicio}`,
      titulo: p.titulo,
      situacao: p.situacao,
      inicio: p.inicio,
      fim: p.fim,
      reaberturas: p.reaberturas,
      subtitulo: `${fmtData(p.inicio)} → ${fmtData(p.fim)} · ${p.todasEscolas ? 'todas as escolas' : `${p.escolas} ${p.escolas === 1 ? 'escola' : 'escolas'}`} · ${SITUACAO[p.situacao]}`,
    }));
  const { visiveis, pagina, total, setPagina } = usePaginas(itens, 6);
  return (
    <section className="acp-painel">
      <div className="acp-painel-topo">
        <div>
          <h2>Prazos</h2>
          <p className="acp-painel-desc">Das últimas duas semanas às próximas seis. Reabertura em hachura.</p>
        </div>
      </div>
      {itens.length === 0 ? <p className="acp-vazio">Nenhum prazo neste intervalo.</p> : <LinhaTempo itens={visiveis} de={de} ate={ate} />}
      <Paginacao pagina={pagina} total={total} setPagina={setPagina} rotulo="Páginas dos prazos" />
    </section>
  );
};

const PainelRitmo = ({ ritmo, form }) => {
  const opcoes = [ritmo?.umTerco && form !== 'pdi' && 'umTerco', ritmo?.pdi && form !== 'umTerco' && 'pdi'].filter(Boolean);
  const [qual, setQual] = useState(opcoes[0] ?? null);
  const [comparar, setComparar] = useState(false);
  const atual = opcoes.includes(qual) ? qual : opcoes[0];
  let conteudo = <p className="acp-vazio">Nenhum período aberto para acompanhar o ritmo.</p>;
  let descricao = 'Como o preenchimento evolui dia a dia dentro do período.';
  if (atual === 'umTerco') {
    const u = ritmo.umTerco;
    const emPct = (pontos, esperado) => pontos.map((p) => ({ dia: p.dia, valor: p.valor === null ? null : pct(p.valor, esperado) }));
    const series = [
      { id: 'c', rotulo: 'Concluídas', cor: 'var(--acp-ok)', pontos: emPct(u.concluidas, u.esperado), area: true },
      { id: 'i', rotulo: 'Iniciadas', cor: 'var(--acp-and)', pontos: emPct(u.iniciadas, u.esperado) },
    ];
    if (comparar && u.anterior) series.push({ id: 'a', rotulo: `Concluídas · ${u.anterior.titulo}`, cor: 'var(--acp-muted)', pontos: emPct(u.anterior.concluidas, u.anterior.esperado), tracejada: true });
    descricao = `${u.titulo} · ${fmt(u.esperado)} entregas esperadas · percentual acumulado`;
    conteudo = u.esperado ? (
      <>
        <GraficoRitmo series={series} maximo={100} sufixo="%" />
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          <div className="acp-legenda">
            {series.map((s) => <span key={s.id}><i style={{ background: s.cor }} />{s.rotulo}</span>)}
          </div>
          {u.anterior && <label className="acp-check"><input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} /> Comparar com o ciclo anterior</label>}
        </div>
      </>
    ) : <p className="acp-vazio">Nenhuma entrega esperada neste ciclo.</p>;
  } else if (atual === 'pdi') {
    const p = ritmo.pdi;
    descricao = `Aplicações abertas · ${fmt(p.esperado)} Fichas esperadas · número acumulado`;
    conteudo = p.esperado ? (
      <>
        <GraficoRitmo series={[{ id: 'c', rotulo: 'Fichas concluídas', cor: 'var(--acp-ok)', pontos: p.pontos, area: true }]} maximo={p.esperado} referencia={p.esperado} />
        <div className="acp-legenda" style={{ marginTop: 8 }}>
          <span><i style={{ background: 'var(--acp-ok)' }} />Fichas concluídas</span>
          <span><i style={{ background: 'var(--acp-muted)', height: 2, width: 14 }} />Esperadas ({fmt(p.esperado)})</span>
        </div>
      </>
    ) : <p className="acp-vazio">Nenhuma Ficha esperada nas Aplicações abertas.</p>;
  }
  return (
    <section className="acp-painel">
      <div className="acp-painel-topo">
        <div>
          <h2>Ritmo de preenchimento</h2>
          <p className="acp-painel-desc">{descricao}</p>
        </div>
        {opcoes.length > 1 && (
          <div className="acp-mini-seg" role="group" aria-label="Formulário do gráfico">
            {opcoes.map((o) => <button key={o} type="button" aria-pressed={o === atual} onClick={() => setQual(o)}>{o === 'pdi' ? 'PDI' : '1/3'}</button>)}
          </div>
        )}
      </div>
      {conteudo}
    </section>
  );
};

const EstruturaRede = ({ escolas, totais }) => {
  const comDados = escolas.filter((e) => e.estrutura.turmas || e.correcoesAbertas);
  const { visiveis, pagina, total, setPagina } = usePaginas(comDados, 8);
  return (
    <details className="acp-painel acp-estrutura">
      <summary>
        <div>
          <h2>Estrutura da rede</h2>
          <p className="acp-painel-desc">Turmas, professores e alunos com PDI do ano letivo. Dá o contexto para ler os percentuais.</p>
        </div>
      </summary>
      <div className="acp-numeros" style={{ marginTop: 14 }}>
        <div><b className="acp-num">{fmt(totais.estrutura.turmas)}</b>turmas ativas</div>
        <div><b className="acp-num">{fmt(totais.estrutura.professores)}</b>professores (distintos)</div>
        <div><b className="acp-num">{fmt(totais.estrutura.alunosPdi)}</b>alunos com PDI</div>
        <div><b className="acp-num">{fmt(totais.correcoesAbertas)}</b>correções do PDI em aberto</div>
      </div>
      <table className="acp-tabela">
        <thead><tr><th>Escola</th><th>Turmas</th><th>Professores</th><th>Alunos com PDI</th><th>Correções</th></tr></thead>
        <tbody>
          {visiveis.map((e) => (
            <tr key={e.id}><td>{e.nome}</td><td className="acp-num">{fmt(e.estrutura.turmas)}</td><td className="acp-num">{fmt(e.estrutura.professores)}</td><td className="acp-num">{fmt(e.estrutura.alunosPdi)}</td><td className="acp-num">{fmt(e.correcoesAbertas)}</td></tr>
          ))}
        </tbody>
      </table>
      <Paginacao pagina={pagina} total={total} setPagina={setPagina} rotulo="Páginas da estrutura" />
      <p className="acp-nota">Professor que atua em mais de uma escola conta uma vez no total da rede e uma vez em cada escola. "Alunos com PDI" não é o total de matriculados. Correções aparecem só como informação.</p>
    </details>
  );
};

// ---------------------------------------------------------------------------------------------
const VisaoRede = ({ dados, form, abrirEscola }) => {
  const { totais, limites } = dados;
  const minimo = limites.minimoParaPercentual;
  const itens = dados.acompanhamento.filter((i) => form === 'ambos' || i.formulario === form);
  const cartoes = [];
  if (form !== 'umTerco') cartoes.push(<CartaoContagem key="pdi" rotulo="PDI" contagem={totais.pdi} unidade="Fichas" minimo={minimo} vazio="Nenhuma Aplicação no período" nota={totais.pdi ? `${totais.pdi.escolas} ${totais.pdi.escolas === 1 ? 'escola' : 'escolas'}${totais.pdi.aoVivo ? '' : ' · inclui números do prazo'}` : null} atraso={0} />);
  if (PDI_EM_DESENVOLVIMENTO) cartoes.push(<Cartao key="pdi" rotulo="PDI · Em desenvolvimento" valor="—" sub={AVISO_PDI_DESENVOLVIMENTO} atraso={0} />);
  if (form !== 'pdi') cartoes.push(<CartaoContagem key="um" rotulo="Formulário 1/3" contagem={totais.umTerco} unidade="entregas" minimo={minimo} vazio="Nenhum ciclo no período" nota="Cada entrega conta uma vez, mesmo valendo para várias escolas" atraso={60} />);
  cartoes.push(<Cartao key="prazos" rotulo="Prazos próximos" valor={fmt(totais.prazosProximos)} sub={`períodos abertos que terminam em até ${limites.diasPrazoProximo} dias`} atraso={120} />);
  cartoes.push(<Cartao key="acomp" rotulo="Merecem acompanhamento" valor={fmt(itens.length)} tom={itens.length ? 'atencao' : undefined} sub={itens.length ? 'situações de escola × formulário' : 'nenhuma situação agora'} nota={form !== 'umTerco' && totais.correcoesAbertas ? `${fmt(totais.correcoesAbertas)} correções do PDI em aberto (informativo)` : null} atraso={180} />);
  return (
    <>
      <div className="acp-cartoes">{cartoes}</div>
      <div className="acp-dupla">
        <PainelRitmo ritmo={dados.ritmo} form={form} key={`r-${form}`} />
        <PainelPrazos prazos={dados.prazos} form={form} />
      </div>
      <MapaRede escolas={dados.escolas} form={form} minimo={minimo} abrirEscola={abrirEscola} />
      <ListaAcompanhamento itens={dados.acompanhamento} form={form} acaoItem={(i) => abrirEscola(i.escolaId)} rotuloAcao={() => 'Abrir escola →'} />
      {PDI_ATIVO && <EstruturaRede escolas={dados.escolas} totais={totais} />}
    </>
  );
};

const HBarras = ({ itens, vazio }) => (itens.length === 0 ? <p className="acp-vazio">{vazio}</p> : (
  <div className="acp-hbarras">
    {itens.map((i) => (
      <div key={i.chave} className="acp-hbarra">
        <div className="acp-hbarra-topo"><b>{i.rotulo}</b><span>{i.texto}</span></div>
        {i.barra}
      </div>
    ))}
  </div>
));

const VisaoEscola = ({ dados, form, secretaria }) => {
  const navigate = useNavigate();
  const minimo = dados.limites.minimoParaPercentual;
  const { pdi, umTerco, estrutura } = dados;
  const cartoes = [];
  const contagemDe = (p) => (p && p.situacao !== 'agendado' ? p : null);
  if (form !== 'umTerco') cartoes.push(<CartaoContagem key="pdi" rotulo={pdi ? `PDI · ${SITUACAO[pdi.situacao]}` : 'PDI'} contagem={contagemDe(pdi)} unidade="Fichas" minimo={minimo} vazio={pdi ? (pdi.situacao === 'agendado' ? textoPrazo(pdi) : `${fmt(pdi.concluidas)} Fichas concluídas · sem percentual`) : 'Sem Aplicação no período'} nota={pdi ? `${pdi.titulo} · ${textoPrazo(pdi)}${pdi.fonte === 'foto' ? ' · números do prazo' : ''}` : null} atraso={0} />);
  if (PDI_EM_DESENVOLVIMENTO) cartoes.push(<Cartao key="pdi" rotulo="PDI · Em desenvolvimento" valor="—" sub={AVISO_PDI_DESENVOLVIMENTO} atraso={0} />);
  if (form !== 'pdi') cartoes.push(<CartaoContagem key="um" rotulo={umTerco ? `1/3 · ${SITUACAO[umTerco.situacao]}` : 'Formulário 1/3'} contagem={contagemDe(umTerco)} unidade="entregas" minimo={minimo} vazio={umTerco ? textoPrazo(umTerco) : 'Fora dos ciclos do ano'} nota={umTerco ? `${umTerco.titulo} · ${textoPrazo(umTerco)}` : null} atraso={60} />);
  cartoes.push(<Cartao key="est" rotulo="Estrutura" valor={fmt(estrutura.turmas)} unidade="turmas" sub={PDI_ATIVO ? `${fmt(estrutura.professores)} professores · ${fmt(estrutura.alunosPdi)} alunos com PDI` : `${fmt(estrutura.professores)} professores`} atraso={120} />);
  if (PDI_ATIVO) cartoes.push(<Cartao key="corr" rotulo="Correções do PDI" valor={fmt(dados.correcoesAbertas)} sub="em aberto · informativo" atraso={180} />);

  const disciplinas = dados.porDisciplina.map((d) => ({
    chave: d.disciplinaId, rotulo: d.disciplina,
    texto: d.esperado === null ? `${fmt(d.concluidas)} concluídas` : `${fmt(d.concluidas)} de ${fmt(d.esperado)}`,
    barra: d.esperado === null ? null : <BarraSituacao {...d} />,
  }));
  const series = [...new Set(dados.matriz.map((m) => m.anoSerie))];
  const histUm = dados.historico.umTerco.map((c) => ({
    chave: c.id, rotulo: c.titulo,
    texto: c.esperado ? `${valorContagem(c, minimo)} · ${SITUACAO[c.situacao].toLowerCase()}` : 'sem entregas esperadas',
    barra: c.esperado ? <BarraSituacao {...c} fina /> : null,
  }));
  const maiorPdi = Math.max(1, ...dados.historico.pdi.map((a) => a.esperado ?? a.concluidas));
  const histPdi = dados.historico.pdi.map((a) => ({
    chave: a.id, rotulo: a.titulo,
    texto: a.esperado !== null ? `${fmt(a.concluidas)} de ${fmt(a.esperado)} Fichas${a.fonte === 'foto' ? ' (no prazo)' : ''}` : `${fmt(a.concluidas)} Fichas concluídas`,
    barra: a.esperado !== null ? <BarraSituacao {...a} fina /> : <div className="acp-unica"><span style={{ width: `${(a.concluidas / maiorPdi) * 100}%` }} /></div>,
  }));
  const acao = secretaria ? (i) => navigate(i.formulario === 'umTerco' ? `/formulario-um-terco/ciclos/${i.periodoId}` : '/pdi/formulario') : null;

  return (
    <>
      <div className="acp-cartoes">{cartoes}</div>
      <div className="acp-dupla">
        <PainelRitmo ritmo={dados.ritmo} form={form} key={`r-${form}-${dados.escola.id}`} />
        <PainelPrazos prazos={dados.prazos} form={form} />
      </div>
      <div className="acp-dupla-igual">
        {form !== 'umTerco' && (
          <section className="acp-painel">
            <div className="acp-painel-topo"><div><h2>PDI por disciplina</h2><p className="acp-painel-desc">{pdi ? `${pdi.titulo} · Fichas por disciplina` : 'Sem Aplicação no período'}</p></div></div>
            <HBarras itens={disciplinas} vazio="Nada para mostrar neste período." />
            {disciplinas.length > 0 && <div style={{ marginTop: 12 }}><LegendaSituacao /></div>}
          </section>
        )}
        {form !== 'pdi' && (
          <section className="acp-painel">
            <div className="acp-painel-topo"><div><h2>1/3 por ano e disciplina</h2><p className="acp-painel-desc">{umTerco ? `${umTerco.titulo} · concluídas / esperadas` : 'Fora dos ciclos do ano'}</p></div></div>
            {series.length === 0 ? <p className="acp-vazio">Nenhuma entrega esperada nesta escola.</p> : (
              <div className="acp-matriz">
                {series.map((s) => (
                  <div key={s} className="acp-matriz-linha">
                    <span className="acp-matriz-serie">{s}º ano</span>
                    <div className="acp-chips">
                      {dados.matriz.filter((m) => m.anoSerie === s).map((m) => {
                        const estado = m.concluidas === m.esperado ? 'ok' : m.concluidas + m.emAndamento > 0 ? 'and' : 'nao';
                        return <span key={m.disciplinaId} className="acp-chip" data-s={estado} title={`${m.disciplina}: ${m.concluidas} de ${m.esperado} concluídas, ${m.emAndamento} em andamento`}>{estado === 'ok' ? '✓' : estado === 'and' ? '◐' : '○'} {m.disciplina} <span className="acp-num">{m.concluidas}/{m.esperado}</span></span>;
                      })}
                    </div>
                  </div>
                ))}
                <div className="acp-legenda"><span>✓ todas concluídas</span><span>◐ em andamento</span><span>○ não iniciadas</span></div>
              </div>
            )}
          </section>
        )}
      </div>
      <div className="acp-dupla-igual">
        {form !== 'pdi' && (
          <section className="acp-painel">
            <div className="acp-painel-topo"><div><h2>Histórico do 1/3</h2><p className="acp-painel-desc">Ciclos do ano nesta escola</p></div></div>
            <HBarras itens={histUm} vazio="Nenhum ciclo encerrado ou aberto ainda." />
          </section>
        )}
        {form !== 'umTerco' && (
          <section className="acp-painel">
            <div className="acp-painel-topo"><div><h2>Histórico do PDI</h2><p className="acp-painel-desc">Aplicações do ano nesta escola</p></div></div>
            <HBarras itens={histPdi} vazio="Nenhuma Aplicação encerrada ou aberta ainda." />
            <p className="acp-nota">Períodos encerrados mostram o percentual só quando há a "foto" tirada no prazo. Sem ela, aparece só o número de Fichas concluídas, porque alunos e professores podem ter mudado desde então.</p>
          </section>
        )}
      </div>
      <ListaAcompanhamento itens={dados.acompanhamento} form={form} emEscola acaoItem={acao} rotuloAcao={(i) => (i.formulario === 'umTerco' ? 'Ver painel de entregas →' : 'Ver Aplicações do PDI →')} />
    </>
  );
};

// ---------------------------------------------------------------------------------------------
export const AcompanhamentoEscolarPage = () => {
  const { user } = useAuth();
  const { activeEscolaId, setActiveEscolaId, userEscolas } = useEscola();
  const [params, setParams] = useSearchParams();
  const secretaria = isSecretaria(user);
  const diretora = isDiretora(user);
  const anoAtual = new Date().getFullYear();
  const ano = Number(params.get('ano')) || anoAtual;
  // PDI desligado (src/config/modulos.js): a tela fica presa no 1/3.
  const form = !PDI_ATIVO ? 'umTerco' : ['pdi', 'umTerco'].includes(params.get('form')) ? params.get('form') : 'ambos';
  const trimestre = form === 'pdi' ? params.get('tri') || '' : '';
  const cicloId = form === 'umTerco' ? params.get('ciclo') || '' : '';
  const escolaId = activeEscolaId;
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const definir = (mudancas) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(mudancas)) { if (v === '' || v === null || v === undefined) p.delete(k); else p.set(k, v); }
    setParams(p, { replace: true });
  };

  const carregar = useCallback((atualizar = false) => {
    if (!secretaria && !diretora) return;
    if (!secretaria && !escolaId) { setDados(null); return; }
    setCarregando(true); setErro('');
    const q = { ano, trimestre, cicloId, atualizar: atualizar ? 1 : '' };
    (escolaId ? obterAcompanhamentoEscola(escolaId, q) : obterAcompanhamentoRede(q))
      .then((d) => setDados({ ...d, _visao: escolaId ? 'escola' : 'rede' }))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [secretaria, diretora, escolaId, ano, trimestre, cicloId]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!secretaria && !diretora) return <Navigate to="/dashboard" replace />;

  const visao = escolaId ? 'escola' : 'rede';
  const pronto = dados && dados._visao === visao && (visao === 'rede' || dados.escola?.id === escolaId);
  const nomeEscola = pronto && visao === 'escola' ? dados.escola.nome : userEscolas.find((e) => e.id === escolaId)?.nome;
  const opcoes = dados?.filtrosDisponiveis;

  return (
    <MainLayout>
      <div className="acp">
        <header className="acp-hero">
          <div className="acp-hero-topo">
            <div>
              {secretaria && visao === 'escola' && <button type="button" className="acp-voltar" onClick={() => setActiveEscolaId(null)}>← Rede</button>}
              <h1>{visao === 'escola' ? (nomeEscola || 'Escola') : 'Acompanhamento Escolar'}</h1>
              <p>
                {visao === 'escola' ? 'Acompanhamento Escolar · visão da escola' : 'Rede municipal · visão geral'}
                {pronto && ` · atualizado às ${new Date(dados.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
            <button type="button" className="acp-botao-hero" onClick={() => carregar(true)} disabled={carregando}>{carregando ? 'Atualizando…' : 'Atualizar'}</button>
          </div>
          <div className="acp-filtros">
            <select aria-label="Ano letivo" value={ano} onChange={(e) => definir({ ano: e.target.value, tri: '', ciclo: '' })}>
              {[anoAtual + 1, anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {(PDI_ATIVO || PDI_EM_DESENVOLVIMENTO) && <div className="acp-seg" role="group" aria-label="Formulário">
              {[['ambos', 'Todos'], ['pdi', 'PDI'], ['umTerco', '1/3']].map(([v, r]) => (
                <button key={v} type="button" aria-pressed={form === v} disabled={!PDI_ATIVO && v !== 'umTerco'} title={!PDI_ATIVO && v !== 'umTerco' ? AVISO_PDI_DESENVOLVIMENTO : undefined} onClick={() => definir({ form: v === 'ambos' ? '' : v, tri: '', ciclo: '' })}>{r}{!PDI_ATIVO && v === 'pdi' ? ' 🚧' : ''}</button>
              ))}
            </div>}
            {form === 'pdi' && (
              <select aria-label="Período do PDI" value={trimestre} onChange={(e) => definir({ tri: e.target.value })}>
                <option value="">Período em foco</option>
                {(opcoes?.trimestres ?? []).map((t) => <option key={t} value={t}>{t}º trimestre</option>)}
              </select>
            )}
            {form === 'umTerco' && (
              <select aria-label="Ciclo do 1/3" value={cicloId} onChange={(e) => definir({ ciclo: e.target.value })}>
                <option value="">Ciclo em foco</option>
                {(opcoes?.ciclos ?? []).map((c) => <option key={c.id} value={c.id}>{c.titulo} · {SITUACAO[c.situacao].toLowerCase()}</option>)}
              </select>
            )}
            {diretora && userEscolas.length > 1 && (
              <select aria-label="Escola" value={escolaId ?? ''} onChange={(e) => setActiveEscolaId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Escolha a escola</option>
                {userEscolas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            )}
          </div>
        </header>
        <div className="acp-corpo">
          {erro && (
            <div className="acp-aviso" style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
              <span>{pronto ? `Não foi possível atualizar (${erro}). Mostrando os dados de ${new Date(dados.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.` : `Não foi possível carregar: ${erro}`}</span>
              <button type="button" className="acp-link" onClick={() => carregar(true)}>Tentar novamente</button>
            </div>
          )}
          {!secretaria && !escolaId && <p className="acp-vazio" style={{ marginTop: 20 }}>{userEscolas.length ? 'Escolha a escola para ver o acompanhamento.' : 'Você não tem escola vinculada.'}</p>}
          {!pronto && !erro && (secretaria || escolaId) && (
            <>
              <div className="acp-cartoes">{[0, 1, 2, 3].map((i) => <div key={i} className="acp-esqueleto" style={{ height: 132 }} />)}</div>
              <div className="acp-esqueleto" style={{ height: 280 }} />
            </>
          )}
          {pronto && visao === 'rede' && <VisaoRede dados={dados} form={form} abrirEscola={(id) => { setActiveEscolaId(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
          {pronto && visao === 'escola' && <VisaoEscola dados={dados} form={form} secretaria={secretaria} />}
        </div>
      </div>
    </MainLayout>
  );
};
