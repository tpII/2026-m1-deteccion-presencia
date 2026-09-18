import { useEffect, useState } from 'react';
import { wsClient } from '../services/websocket';
import { ConnectionState } from '../types/telemetry';

export function useWebSocket() {
  const [state, setState] = useState<ConnectionState>(wsClient.getState());

  useEffect(() => {
    wsClient.connect();
    const unsubscribe = wsClient.onStateChange((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    connectionState: state,
    reconnect: () => wsClient.connect(),
  };
}
