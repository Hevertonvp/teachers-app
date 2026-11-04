import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, EmptyState, FormField, LoadingBlock, Modal } from '../components/Common';
import { MainLayout } from '../layouts/Layouts';
import { useData } from '../context/DataContext';
import {
  atualizarCicloUmTerco, criarCicloUmTerco, criarReaberturaUmTerco, inativarCicloUmTerco, listarCiclosUmTerco, reativarCicloUmTerco,
} from '../services/formularioUmTerco';
import { inputClass } from '../utils/display';
import { trimestres } from '../utils/trimestres';
import { formatarDataHora, formatarDiaMes, formatarPeriodo, paraInputDataHora, STATUS_PRAZO } from '../utils/umTerco';

const SEMANA_VAZIA = { dataInicio: '', dataFim: '' };
const anoAtual = () => new Date().getFullYear();

const dataFmt = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const fracao = (iso, ini, fim) => {
  const total = Date.parse(fim) - Date.parse(ini);
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, (Date.parse(iso) - Date.parse(ini)) / total));
};

// Faixa visual do trimestre com cada semana posicionada — vermelho = fora da janela global.
const LinhaDoTempo = ({ janela, semanas }) => {
  if (!janela) return null;
  return (
    <div>
      <div className="relative h-8 rounded-lg bg-slate-100">
        {semanas.map((semana, indice) => {
          if (!semana.dataInicio || !semana.dataFim || semana.dataFim < semana.dataInicio) return null;
          const fora = semana.dataInicio < janela.startDate || semana.dataFim > janela.endDate;
          const esquerda = fracao(semana.dataInicio, janela.startDate, janela.endDate) * 100;
          const largura = Math.max(1.5, (fracao(semana.dataFim, janela.startDate, janela.endDate) - fracao(semana.dataInicio, janela.startDate, janela.endDate)) * 100);
          return (
            <div
              key={indice}
              className={`absolute top-1 bottom-1 grid place-items-center rounded text-[10px] font-bold text-white ${fora ? 'bg-red-500' : 'bg-teal-600'}`}
              style={{ left: `${esquerda}%`, width: `${largura}%` }}
              title={`Semana ${indice + 1}: ${formatarPeriodo(semana.dataInicio, semana.dataFim)}`}
            >
              {indice + 1}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500"><span>{dataFmt(janela.startDate)}</span><span>{dataFmt(janela.endDate)}</span></div>
    </div>
  );
};

const CicloFormModal = ({ ciclo, janelas, onClose, onSalvo }) => {
  const editando = !!ciclo;
  const travado = editando && ciclo.entregasIniciadas > 0;
  const [anoLetivo, setAnoLetivo] = useState(ciclo?.anoLetivo ?? anoAtual());
  const [trimestre, setTrimestre] = useState(ciclo?.trimestre ?? 1);
  const [titulo, setTitulo] = useState(ciclo?.titulo ?? 'Formulário 1/3');
  const [abreEm, setAbreEm] = useState(paraInputDataHora(ciclo?.abreEm));
  const [prazoEm, setPrazoEm] = useState(paraInputDataHora(ciclo?.prazoEm));
  const [semanas, setSemanas] = useState(ciclo ? ciclo.semanas.map(s => ({ dataInicio: s.dataInicio, dataFim: s.dataFim })) : [{ ...SEMANA_VAZIA }, { ...SEMANA_VAZIA }, { ...SEMANA_VAZIA }, { ...SEMANA_VAZIA }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const janela = janelas.find(p => p.ano === Number(anoLetivo) && p.trimestre === trimestres[trimestre - 1]) ?? null;

  const mudarQuantidade = (valor) => {
    const n = Math.max(1, Math.min(30, Number(valor) || 1));
    setSemanas(prev => Array.from({ length: n }, (_, i) => prev[i] ?? { ...SEMANA_VAZIA }));
  };
  const mudarSemana = (indice, campo, valor) => setSemanas(prev => prev.map((s, i) => (i === indice ? { ...s, [campo]: valor } : s)));

  const salvar = async (event) => {
    event.preventDefault();
    setErro('');
    setSalvando(true);
    const corpo = { anoLetivo: Number(anoLetivo), trimestre: Number(trimestre), titulo, abreEm, prazoEm, semanas };
    try {
      if (editando) await atualizarCicloUmTerco(ciclo.id, corpo);
      else await criarCicloUmTerco(corpo);
      onSalvo();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal title={editando ? 'Editar Formulário 1/3' : 'Novo Formulário 1/3'} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-4">
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {travado && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Já há Professores preenchendo: ano, trimestre e quantidade de semanas não podem mudar. Datas e prazo continuam editáveis.</p>}

        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Ano letivo"><input type="number" className={inputClass} value={anoLetivo} onChange={e => setAnoLetivo(e.target.value)} disabled={travado} required /></FormField>
          <FormField label="Trimestre">
            <select className={inputClass} value={trimestre} onChange={e => setTrimestre(Number(e.target.value))} disabled={travado}>
              {trimestres.map((rotulo, i) => <option key={rotulo} value={i + 1}>{rotulo}</option>)}
            </select>
          </FormField>
          <FormField label="Quantidade de semanas"><input type="number" min={1} max={30} className={inputClass} value={semanas.length} onChange={e => mudarQuantidade(e.target.value)} disabled={travado} /></FormField>
        </div>

        {janela
          ? <p className="text-xs font-semibold text-slate-600">Janela do {trimestre}º trimestre: {dataFmt(janela.startDate)} a {dataFmt(janela.endDate)}. Todas as datas precisam estar dentro dela.</p>
          : <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">O {trimestre}º trimestre de {anoLetivo} não está no calendário. Configure em Configurações › Trimestres.</p>}

        <FormField label="Título"><input className={inputClass} value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={200} /></FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Abertura (data e hora)"><input type="datetime-local" className={inputClass} value={abreEm} onChange={e => setAbreEm(e.target.value)} required /></FormField>
          <FormField label="Prazo de entrega (data e hora)"><input type="datetime-local" className={inputClass} value={prazoEm} onChange={e => setPrazoEm(e.target.value)} required /></FormField>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Semanas</p>
          <LinhaDoTempo janela={janela} semanas={semanas} />
          <div className="mt-3 space-y-2">
            {semanas.map((semana, indice) => (
              <div key={indice} className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-2">
                <span className="text-sm font-bold text-slate-800">Semana {indice + 1}</span>
                <input type="date" aria-label={`Semana ${indice + 1}: início`} className={inputClass} value={semana.dataInicio} min={janela?.startDate} max={janela?.endDate} onChange={e => mudarSemana(indice, 'dataInicio', e.target.value)} required />
                <input type="date" aria-label={`Semana ${indice + 1}: fim`} className={inputClass} value={semana.dataFim} min={janela?.startDate} max={janela?.endDate} onChange={e => mudarSemana(indice, 'dataFim', e.target.value)} required />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={salvando} disabled={!janela}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  );
};

const ReaberturaModal = ({ ciclo, onClose, onSalvo }) => {
  const [inicioEm, setInicioEm] = useState('');
  const [fimEm, setFimEm] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = async (event) => {
    event.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await criarReaberturaUmTerco(ciclo.id, { inicioEm, fimEm, motivo });
      onSalvo();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal title={`Reabrir — ${ciclo.titulo} (${ciclo.trimestre}º tri)`} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-slate-600">A reabertura libera a edição para todos os Professores deste ciclo no período abaixo. O prazo original não é alterado e a reabertura fica registrada.</p>
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {ciclo.reaberturas.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {ciclo.reaberturas.map(r => <li key={r.id}>{formatarDataHora(r.inicioEm)} → {formatarDataHora(r.fimEm)}{r.motivo ? ` — ${r.motivo}` : ''}</li>)}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Início"><input type="datetime-local" className={inputClass} value={inicioEm} onChange={e => setInicioEm(e.target.value)} required /></FormField>
          <FormField label="Fim"><input type="datetime-local" className={inputClass} value={fimEm} onChange={e => setFimEm(e.target.value)} required /></FormField>
        </div>
        <FormField label="Motivo (opcional)"><input className={inputClass} value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} /></FormField>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={salvando}>{salvando ? 'Salvando...' : 'Reabrir'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export const UmTercoSecretariaPage = () => {
  const navigate = useNavigate();
  const { trimestrePeriods } = useData();
  const [ciclos, setCiclos] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [formAberto, setFormAberto] = useState(null); // null | 'novo' | ciclo
  const [reabrindo, setReabrindo] = useState(null);
  const [inativando, setInativando] = useState(null);

  const carregar = () => {
    setErro('');
    listarCiclosUmTerco().then(setCiclos).catch(e => setErro(e.message));
  };
  useEffect(carregar, []);

  const janelas = useMemo(() => trimestrePeriods ?? [], [trimestrePeriods]);

  const acao = async (fn, sucesso) => {
    setMensagem('');
    try {
      await fn();
      setMensagem(sucesso);
      carregar();
    } catch (error) {
      setMensagem(error.message);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Formulário 1/3 — Conteúdos</h1>
            <p className="mt-2 text-slate-600">Crie o ciclo do trimestre, defina as semanas e o prazo, e acompanhe as entregas.</p>
          </div>
          <Button onClick={() => setFormAberto('novo')}>+ Novo ciclo</Button>
        </div>

        {mensagem && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">{mensagem}</div>}
        {erro && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar: {erro}</span>
            <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
          </div>
        )}
        {ciclos === null && !erro && <LoadingBlock text="Carregando ciclos..." />}
        {ciclos && ciclos.length === 0 && (
          <EmptyState title="Nenhum ciclo criado" description="Crie o primeiro Formulário 1/3 escolhendo o trimestre e as semanas.">
            <Button size="sm" onClick={() => setFormAberto('novo')}>+ Novo ciclo</Button>
          </EmptyState>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {(ciclos || []).map(ciclo => {
            const prazo = STATUS_PRAZO[ciclo.statusPrazo];
            const inativo = ciclo.statusRegistro === 'inativa';
            return (
              <Card key={ciclo.id} className={inativo ? 'opacity-70' : ''}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={prazo.variant}>{prazo.label}</Badge>
                  {inativo && <Badge variant="gray">Inativo</Badge>}
                  {ciclo.editavelAgora && ciclo.statusPrazo === 'encerrado' && <Badge variant="blue">Reaberto</Badge>}
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-950">{ciclo.titulo} — {ciclo.trimestre}º trimestre de {ciclo.anoLetivo}</h2>
                <p className="mt-1 text-sm text-slate-600">Abre {formatarDataHora(ciclo.abreEm)} · prazo {formatarDataHora(ciclo.prazoEm)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ciclo.semanas.map(s => <span key={s.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{s.rotulo}: {formatarDiaMes(s.dataInicio)}–{formatarDiaMes(s.dataFim)}</span>)}
                </div>
                <p className="mt-3 text-xs text-slate-500">{ciclo.entregasIniciadas} preenchimento(s) iniciado(s) · {ciclo.reaberturas.length} reabertura(s)</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => navigate(`/formulario-um-terco/ciclos/${ciclo.id}`)}>Painel de entregas</Button>
                  {!inativo && <Button size="sm" variant="outline" onClick={() => setFormAberto(ciclo)}>Editar</Button>}
                  {!inativo && <Button size="sm" variant="outline" onClick={() => setReabrindo(ciclo)}>Reabrir</Button>}
                  {!inativo && ciclo.entregasIniciadas === 0 && <Button size="sm" variant="danger" onClick={() => setInativando(ciclo)}>Inativar</Button>}
                  {inativo && <Button size="sm" variant="outline" onClick={() => acao(() => reativarCicloUmTerco(ciclo.id), 'Ciclo reativado.')}>Reativar</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {formAberto && (
        <CicloFormModal
          ciclo={formAberto === 'novo' ? null : formAberto}
          janelas={janelas}
          onClose={() => setFormAberto(null)}
          onSalvo={() => { setFormAberto(null); setMensagem('Ciclo salvo.'); carregar(); }}
        />
      )}
      {reabrindo && <ReaberturaModal ciclo={reabrindo} onClose={() => setReabrindo(null)} onSalvo={() => { setReabrindo(null); setMensagem('Reabertura registrada.'); carregar(); }} />}
      {inativando && (
        <ConfirmDialog
          title="Inativar ciclo"
          message={`Inativar "${inativando.titulo}" do ${inativando.trimestre}º trimestre? Nenhum Professor começou a preencher, então nada se perde; dá para reativar depois.`}
          confirmLabel="Inativar"
          onCancel={() => setInativando(null)}
          onConfirm={() => { const alvo = inativando; setInativando(null); acao(() => inativarCicloUmTerco(alvo.id), 'Ciclo inativado.'); }}
        />
      )}
    </MainLayout>
  );
};
