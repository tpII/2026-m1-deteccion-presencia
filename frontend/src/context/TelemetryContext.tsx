import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { wsClient } from '../services/websocket';
import type { ConnectionState, WebSocketMessage } from '../types/telemetry';

interface TelemetryContextValue {
  data: WebSocketMessage['data'] | null;
  connectionState: ConnectionState;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WebSocketMessage['data'] | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(wsClient.getState());

  useEffect(() => {
    const unsubscribeMessages = wsClient.subscribe((message) => setData(message.data));
    const unsubscribeState = wsClient.onStateChange(setConnectionState);
    wsClient.connect();
    return () => {
      unsubscribeMessages();
      unsubscribeState();
      wsClient.disconnect();
    };
  }, []);

  return <TelemetryContext.Provider value={{ data, connectionState }}>{children}</TelemetryContext.Provider>;
}

export function useTelemetryContext() {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error('La telemetría requiere TelemetryProvider');
  return context;
}
