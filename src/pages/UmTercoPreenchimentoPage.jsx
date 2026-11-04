import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BackButton, Badge, Button, Card, LoadingBlock } from '../components/Common';
import { SavingIndicator } from '../components/SavingIndicator';
import { MainLayout } from '../layouts/Layouts';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { apagarDraft, lerDraft, salvarDraft } from '../offline/db';
import { enfileirar } from '../offline/syncQueue';
import { concluirFormularioUmTerco, caminhoRespostasUmTerco, obterFormularioUmTerco, salvarRespostasUmTerco } from '../services/formularioUmTerco';
import { inputClass } from '../utils/display';
import { agruparPorEscola, formatarDataHora, formatarPeriodo } from '../utils/umTerco';

const AUTOSAVE_MS = 2000;
const eRede = (error) => !error.codigo && /conectar ao servidor/.test(error.message || '');

// Preenchimento em etapas (uma semana por vez). Rascunho local (IndexedDB) a cada digitação, envio
// ao servidor ao avançar/voltar de etapa, por debounce e em "Salvar progresso". Falha de REDE vai
// para a fila offline (nada se perde); conflito (outra aba/dispositivo) nunca sobrescreve em
// silêncio. "Próximo" nunca conclui — só o botão final "Concluir" (exige conexão e todas as semanas).
export const UmTercoPreenchimentoPage = () => {
  const { cicloId, anoSerie, disciplinaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { online } = useNetworkStatus();
  const userId = user?.email?.toLowerCase();
  const resourceId = `${cicloId}-${anoSerie}-${disciplinaId}`;
  const draftKey = `${userId}::um-terco-resposta::${resourceId}`;

  const [dados, setDados] = useState(null);
  const [erroCarga, setErroCarga] = useState('');
  const [textos, setTextos] = useState({}); // semanaId -> texto
  const [sujo, setSujo] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const [estado, setEstado] = useState('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [conflito, setConflito] = useState(null); // detalhe atual do servidor
  const [concluindo, setConcluindo] = useState(false);
  const baseRef = useRef(null); // updatedAt que o servidor tem, na última sincronização
  const salvandoRef = useRef(false);
  const textosRef = useRef({});
  const sujoRef = useRef(false);

  const aplicarServidor = useCallback((detalhe) => {
    baseRef.current = detalhe.updatedAt;
    setDados(detalhe);
    setTextos(Object.fromEntries(detalhe.semanas.map(s => [s.id, s.texto])));
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const detalhe = await obterFormularioUmTerco(cicloId, anoSerie, disciplinaId);
        if (!ativo) return;
        aplicarServidor(detalhe);
        const rascunho = detalhe.editavelAgora ? await lerDraft(draftKey) : null;
        if (!ativo) return;
        if (rascunho?.textos) {
          setTextos(prev => ({ ...prev, ...rascunho.textos }));
          setSujo(true);
          setAviso('Recuperamos o que você tinha digitado e ainda não foi enviado.');
        }
      } catch (error) {
        if (ativo) setErroCarga(error.message);
      }
    })();
    return () => { ativo = false; };
  }, [cicloId, anoSerie, disciplinaId, draftKey, aplicarServidor]);

  useEffect(() => { textosRef.current = textos; sujoRef.current = sujo; }, [textos, sujo]);

  // Rascunho local protegido a cada alteração (sobrevive a reload/fechamento do navegador).
  useEffect(() => {
    if (!sujo || !userId) return;
    salvarDraft(draftKey, { userId, textos, savedAt: Date.now() });
  }, [textos, sujo, draftKey, userId]);

  const editavel = !!dados?.editavelAgora;

  // Sempre manda TODAS as semanas (instantâneo completo): idempotente na fila offline e no servidor.
  const salvarAgora = useCallback(async () => {
    if (!dados || !dados.editavelAgora || !sujoRef.current || salvandoRef.current) return { ok: true };
    salvandoRef.current = true;
    setEstado('saving');
    setMensagemErro('');
    const respostas = dados.semanas.map(s => ({ semanaId: s.id, texto: textosRef.current[s.id] ?? '' }));
    try {
      const novo = await salvarRespostasUmTerco(cicloId, anoSerie, disciplinaId, respostas, baseRef.current);
      baseRef.current = novo.updatedAt;
      setDados(prev => ({ ...prev, updatedAt: novo.updatedAt, status: novo.status, entregaId: novo.entregaId, validoPara: novo.validoPara, historico: novo.historico }));
      setSujo(false);
      apagarDraft(draftKey);
      setEstado('saved');
      return { ok: true, updatedAt: novo.updatedAt };
    } catch (error) {
      if (error.codigo === 'CONFLITO_VERSAO') {
        setConflito(error.dadosAtuais || null);
        setEstado('idle');
        return { ok: false, conflito: true };
      }
      if (eRede(error)) {
        await enfileirar({
          userId, resourceType: 'um-terco-resposta', resourceId, operation: 'respostas',
          endpoint: caminhoRespostasUmTerco(cicloId, anoSerie, disciplinaId), method: 'PUT',
          payload: { respostas }, baseTokenField: 'baseUpdatedAt', baseToken: baseRef.current,
        });
        setEstado('saved');
        setAviso('Sem conexão: suas respostas foram guardadas neste aparelho e serão enviadas quando a internet voltar.');
        return { ok: true, queued: true };
      }
      setEstado('idle');
      setMensagemErro(error.message);
      return { ok: false };
    } finally {
      salvandoRef.current = false;
    }
  }, [dados, cicloId, anoSerie, disciplinaId, draftKey, userId, resourceId]);

  // Debounce: depois de parar de digitar, envia sem o professor precisar fazer nada.
  useEffect(() => {
    if (!sujo || !editavel || conflito) return undefined;
    const timer = setTimeout(() => { salvarAgora(); }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [textos, sujo, editavel, conflito, salvarAgora]);

  const alterarTexto = (semanaId, valor) => {
    setTextos(prev => ({ ...prev, [semanaId]: valor }));
    setSujo(true);
    setEstado('idle');
  };

  const irParaEtapa = async (nova) => {
    if (editavel && sujoRef.current) await salvarAgora();
    setEtapa(nova);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sair = async () => {
    if (editavel && sujoRef.current) {
      const r = await salvarAgora();
      if (!r.ok) return; // nunca perde: fica na tela
    }
    navigate('/formulario-um-terco');
  };

  const concluir = async () => {
    if (concluindo) return;
    setMensagemErro('');
    if (!online) {
      await salvarAgora();
      setMensagemErro('Conecte-se à internet para concluir. O que você escreveu foi guardado.');
      return;
    }
    setConcluindo(true);
    const salvo = sujoRef.current ? await salvarAgora() : { ok: true };
    if (!salvo.ok) { setConcluindo(false); return; }
    try {
      await concluirFormularioUmTerco(cicloId, anoSerie, disciplinaId, baseRef.current);
      navigate('/formulario-um-terco', { state: { sucesso: 'Formulário 1/3 concluído. Você ainda pode editar até o fim do prazo.' } });
    } catch (error) {
      if (error.codigo === 'CONFLITO_VERSAO') setConflito(error.dadosAtuais || null);
      else setMensagemErro(error.message);
    } finally {
      setConcluindo(false);
    }
  };

  const usarVersaoDoServidor = () => {
    if (conflito) aplicarServidor(conflito);
    apagarDraft(draftKey);
    setSujo(false);
    setConflito(null);
  };
  const manterMeuTexto = () => {
    if (conflito) {
      baseRef.current = conflito.updatedAt;
      setDados(prev => ({ ...prev, updatedAt: conflito.updatedAt, status: conflito.status }));
    }
    setSujo(true);
    setConflito(null);
  };

  if (erroCarga) {
    return <MainLayout><Card className="py-12 text-center"><p className="font-semibold text-slate-800">{erroCarga}</p><Button className="mt-4" onClick={() => navigate('/formulario-um-terco')}>Voltar</Button></Card></MainLayout>;
  }
  if (!dados) return <MainLayout><LoadingBlock text="Carregando formulário..." /></MainLayout>;

  const total = dados.semanas.length;
  const semana = dados.semanas[etapa];
  const ultima = etapa === total - 1;
  const escolas = agruparPorEscola(dados.validoPara);
  const concluida = dados.status === 'concluida';

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl space-y-5 pb-24">
        <BackButton />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{dados.ciclo.titulo} · {dados.ciclo.trimestre}º trimestre</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">{dados.rotulo}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge variant={concluida ? 'green' : 'blue'}>{concluida ? 'Concluído' : 'Em preenchimento'}</Badge>
            <span>Prazo: {formatarDataHora(dados.ciclo.prazoEm)}</span>
          </div>
        </div>

        <Card>
          <p className="text-sm font-semibold text-slate-800">Válido para:</p>
          {escolas.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">Nenhuma turma ativa no momento.</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
              {escolas.map(e => <li key={e.escolaId}><span className="font-semibold">{e.escolaNome}</span> — {e.turmas.join(', ')}</li>)}
            </ul>
          )}
        </Card>

        {!editavel && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Somente leitura. {dados.ciclo.statusPrazo === 'encerrado' ? 'O prazo terminou — peça uma reabertura se precisar alterar.' : dados.ciclo.statusPrazo === 'agendado' ? `O preenchimento abre em ${formatarDataHora(dados.ciclo.abreEm)}.` : 'Você não tem vínculo ativo com esta disciplina neste ano/série.'}
          </div>
        )}
        {aviso && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{aviso}</div>}
        {mensagemErro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{mensagemErro}</div>}
        {conflito && (
          <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Este formulário foi alterado em outra aba ou dispositivo. O que você digitou foi guardado e nada foi sobrescrito.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={usarVersaoDoServidor}>Usar a versão salva</Button>
              <Button size="sm" onClick={manterMeuTexto}>Manter o meu texto</Button>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
            <span>Etapa {etapa + 1} de {total}</span>
            <SavingIndicator estado={estado} />
          </div>
          <div className="mt-2 flex gap-1.5" role="tablist" aria-label="Etapas">
            {dados.semanas.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === etapa}
                aria-label={s.rotulo}
                onClick={() => irParaEtapa(i)}
                className={`h-2.5 flex-1 rounded-full transition ${i === etapa ? 'bg-teal-600' : (textos[s.id] || '').trim() ? 'bg-teal-300' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-bold text-slate-950">{semana.rotulo}</h2>
            <span className="text-sm font-semibold text-slate-500">{formatarPeriodo(semana.dataInicio, semana.dataFim)}</span>
          </div>
          <label htmlFor="conteudos-semana" className="mt-4 block text-sm font-semibold text-slate-700">Conteúdos ensinados</label>
          <textarea
            id="conteudos-semana"
            className={`${inputClass} mt-2 min-h-56 text-base`}
            value={textos[semana.id] ?? ''}
            onChange={event => alterarTexto(semana.id, event.target.value)}
            disabled={!editavel || !!conflito}
            maxLength={10000}
            placeholder={editavel ? 'Descreva o que você ensinou nesta semana…' : ''}
          />
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" className="min-h-12 flex-1 sm:flex-none" onClick={() => (etapa === 0 ? sair() : irParaEtapa(etapa - 1))}>{etapa === 0 ? 'Sair' : 'Voltar'}</Button>
          {editavel && <Button variant="outline" className="min-h-12 flex-1 sm:flex-none" onClick={salvarAgora} disabled={!sujo || !!conflito}>Salvar progresso</Button>}
          {ultima ? (
            editavel
              ? <Button className="min-h-12 flex-1 sm:flex-none" onClick={concluir} loading={concluindo} disabled={!!conflito}>{concluindo ? 'Concluindo...' : concluida ? 'Salvar e concluir' : 'Concluir'}</Button>
              : <Button className="min-h-12 flex-1 sm:flex-none" onClick={sair}>Fechar</Button>
          ) : (
            <Button className="min-h-12 flex-1 sm:flex-none" onClick={() => irParaEtapa(etapa + 1)}>Próximo</Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
