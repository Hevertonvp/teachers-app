import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
import { getUserEscolaIds } from '../utils/escolas';
import { isSecretaria } from '../utils/roles';

const EscolaContext = createContext();

export const EscolaProvider = ({ children }) => {
  const { user } = useAuth();
  const { escolas, vinculosEscolares } = useData();
  const [activeEscolaId, setActiveEscolaId] = useState(null);
  const [isExplicitBatchSelection, setIsExplicitBatchSelection] = useState(false);

  // Escolas que o usuário pode selecionar. Secretaria vê todas (inclusive inativas, para
  // consulta histórica); Professor/Supervisor só as escolas com vínculo ativo.
  const userEscolas = useMemo(() => {
    if (isSecretaria(user)) return escolas;
    const ids = getUserEscolaIds(user, vinculosEscolares) || [];
    return escolas.filter(escola => ids.includes(escola.id));
  }, [user, escolas, vinculosEscolares]);

  // 1 escola -> seleciona automaticamente. 2+ -> exige seleção (via EscolaSelector).
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
