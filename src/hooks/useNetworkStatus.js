import { useEffect, useState } from 'react';
import { getSnapshot, subscribe } from '../offline/networkStatus';

// Hook fino sobre o estado global de conectividade (nunca um estado próprio por componente).
export function useNetworkStatus() {
  const [snapshot, setSnapshot] = useState(getSnapshot);
  useEffect(() => subscribe(setSnapshot), []);
  return snapshot;
}
