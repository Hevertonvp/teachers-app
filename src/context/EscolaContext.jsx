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
    return escolas.filter((escola) => ids.has(escola.id));
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
