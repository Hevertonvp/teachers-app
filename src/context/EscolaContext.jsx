import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
import { apiFetch, getAuthToken } from '../services/api';
import { isSecretaria } from '../utils/roles';

const EscolaContext = createContext();

export const EscolaProvider = ({ children }) => {
  const { user } = useAuth();
  const { escolas } = useData();
  const [activeEscolaId, setActiveEscolaId] = useState(null);
  const [isExplicitBatchSelection, setIsExplicitBatchSelection] = useState(false);
  // VinculoEscolar REAL do próprio usuário logado (GET /api/vinculos-escolares/me) — substitui o
  // mock `vinculosEscolares` como fonte de escopo. Secretaria nunca precisa disto (ela já enxerga
  // `escolas` inteira, real, direto do DataContext — ver userEscolas abaixo), então nem buscamos.
  const [vinculosReais, setVinculosReais] = useState([]);
  const [vinculosLoading, setVinculosLoading] = useState(true);
  const [vinculosError, setVinculosError] = useState(null);
  // O EscolaProvider nunca é desmontado entre um logout e o login seguinte (é a mesma sessão
  // SPA) — sem essa trava, uma resposta atrasada do fetch da PESSOA anterior pode chegar depois
  // da troca de usuário e sobrescrever os vínculos de quem acabou de logar. `requisicaoAtual`
  // identifica a requisição em andamento (troca a cada novo usuário E a cada reload manual); a
  // resposta só é aplicada se ainda for a mais recente. Mesma trava também resolve, de graça, o
  // duplo-disparo do efeito em StrictMode (dev): a chamada descartada pelo React vira só uma
  // resposta "não é mais a atual" em vez de piscar loading=true de novo.
  const requisicaoAtual = useRef(0);

  const loadVinculosReais = useCallback(async () => {
    const minhaRequisicao = ++requisicaoAtual.current;
    setVinculosLoading(true);
    setVinculosError(null);
    try {
      const dados = await apiFetch('/api/vinculos-escolares/me');
      if (requisicaoAtual.current === minhaRequisicao) setVinculosReais(dados);
    } catch (error) {
      if (requisicaoAtual.current === minhaRequisicao) setVinculosError(error.message);
    } finally {
      if (requisicaoAtual.current === minhaRequisicao) setVinculosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      requisicaoAtual.current += 1; // invalida qualquer fetch em andamento
      setVinculosReais([]);
      setVinculosLoading(false);
      setVinculosError(null);
      return;
    }
    if (isSecretaria(user)) {
      requisicaoAtual.current += 1;
      setVinculosLoading(false);
      return;
    }
    // Com senha temporária pendente o backend recusa (403) tudo que não seja trocar a senha: nem
    // pede agora — o efeito roda de novo sozinho quando `user.senhaTemporaria` virar false.
    if (user.senhaTemporaria) {
      requisicaoAtual.current += 1;
      setVinculosLoading(false);
      return;
    }
    if (getAuthToken()) loadVinculosReais();
  }, [user, loadVinculosReais]);

  // Escolas que o usuário pode selecionar. Secretaria vê todas (inclusive inativas, para
  // consulta histórica); os demais perfis só as escolas com VinculoEscolar ATIVO — igual
  // acontecia com o mock, mas agora a fonte é o Neon. Escola INATIVA continua aparecendo aqui se
  // o vínculo for ATIVO (histórico preservado — quem decide o que fazer com isso, ex. bloquear
  // edição, é cada tela, igual já era antes; ver PdiPage.jsx).
  const userEscolas = useMemo(() => {
    if (isSecretaria(user)) return escolas;
    const ids = new Set(vinculosReais.map((vinculo) => vinculo.escolaId));
    // Operacional exige as DUAS coisas: vínculo ATIVO e escola ATIVA — escola inativa nunca
    // aparece como opção operacional, mesmo com vínculo ativo (histórico fica só no backend,
    // que continua devolvendo o vínculo; quem decide "consulta histórica" administrativa é
    // Secretaria, em telas próprias, não este seletor).
    return escolas.filter((escola) => ids.has(escola.id) && escola.status === 'ativa');
  }, [user, escolas, vinculosReais]);

  // 1 escola -> seleciona automaticamente. 2+ -> exige seleção (via EscolaSelector). Se a escola
  // selecionada deixou de ser válida (vínculo encerrado, ou nunca existiu — ex.: manipulação
  // manual), troca/limpa na hora, nunca confia cegamente no valor anterior.
  // Secretaria começa na visão agregada ("Todas as escolas" = null).
  useEffect(() => {
    if (!user) {
      setActiveEscolaId(null);
      setIsExplicitBatchSelection(false);
      return;
    }

    if (isSecretaria(user)) {
      setActiveEscolaId(prev => (prev !== null && userEscolas.some(escola => escola.id === prev)) ? prev : null);
      if (activeEscolaId === null && !isExplicitBatchSelection) {
        setIsExplicitBatchSelection(false);
      }
      return;
    }

    setActiveEscolaId(prev => {
      if (prev !== null && userEscolas.some(escola => escola.id === prev)) return prev;
      return userEscolas[0]?.id ?? null;
    });
    setIsExplicitBatchSelection(false);
  }, [user, userEscolas]);

  const value = {
    userEscolas,
    // VinculoEscolar ATIVOS reais do usuário (inclui escola inativa) — para telas que precisam
    // da regra "vínculo ativo, mesmo com escola inativa" (consulta histórica do Gestor no PDI).
    vinculosReais,
    activeEscolaId,
    setActiveEscolaId,
    isExplicitBatchSelection,
    setExplicitBatchSelection: setIsExplicitBatchSelection,
    isAggregateView: isSecretaria(user) && activeEscolaId === null,
    vinculosLoading,
    vinculosError,
    reloadVinculos: loadVinculosReais,
  };

  return <EscolaContext.Provider value={value}>{children}</EscolaContext.Provider>;
};

export const useEscola = () => {
  const context = useContext(EscolaContext);
  if (!context) {
    throw new Error('useEscola must be used within EscolaProvider');
  }
  return context;
};

// Escola que vem marcada ao abrir um modal com campo de escola (pedido do usuário, 12/11/2026):
// se o seletor do topo tem uma escola e ela está entre as opções do modal, ela é o padrão; senão,
// vale o padrão que o modal já usava (`padrao`). Só o valor inicial: a pessoa pode trocar à vontade.
export const useEscolaDoTopo = () => {
  const { activeEscolaId } = useEscola();
  return useCallback(
    (opcoes, padrao = '') => (activeEscolaId != null && (opcoes ?? []).some(escola => Number(escola.id) === activeEscolaId) ? activeEscolaId : padrao),
    [activeEscolaId],
  );
};

// Filtro de escola de uma tela interna (pedido do usuário, 12/11/2026): começa com a escola do topo e
// ACOMPANHA o topo quando ele muda; mudar o filtro NÃO muda o topo (sentido único). `vazio` é o valor
// de "Todas" do filtro. `opcoes` (ids), quando dado: se a escola do topo não está entre elas, o filtro
// fica em "Todas". Devolve [valor, setValor], com o id em texto (como num <select>).
// Não usar em telas do Professor: lá a visão é unificada entre escolas (decisão do usuário).
export const useFiltroEscolaDoTopo = (vazio = '', opcoes = null) => {
  const { activeEscolaId } = useEscola();
  const chaveOpcoes = opcoes ? opcoes.map(Number).sort((a, b) => a - b).join(',') : null;
  const doTopo = () => {
    if (activeEscolaId == null) return vazio;
    if (opcoes && !opcoes.some(id => Number(id) === activeEscolaId)) return vazio;
    return String(activeEscolaId);
  };
  const [valor, setValor] = useState(doTopo);
  useEffect(() => { setValor(doTopo()); }, [activeEscolaId, chaveOpcoes]); // eslint-disable-line react-hooks/exhaustive-deps
  return [valor, setValor];
};
