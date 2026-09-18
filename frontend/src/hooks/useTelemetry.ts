import { useEffect, useState, useRef } from 'react';
import { wsClient } from '../services/websocket';
import { api } from '../services/api';
import { CaseCurrentStatus, CaseTelemetryPayload, WebSocketMessage } from '../types/telemetry';

export function useTelemetry() {
  const [statuses, setStatuses] = useState<CaseCurrentStatus[]>([]);
  const [casesData, setCasesData] = useState<Record<string, CaseTelemetryPayload>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const isInitialized = useRef(false);

  useEffect(() => {
    // 1. Carga inicial vía REST mientras WebSocket se conecta
    async function fetchInitial() {
      try {
        const initialStatuses = await api.getTelemetryStatuses();
        setStatuses(initialStatuses);
      } catch (err) {
        // En caso de que el backend esté arrancando
      } finally {
        setLoading(false);
      }
    }

    if (!isInitialized.current) {
      isInitialized.current = true;
      fetchInitial();
    }

    // 2. Suscribirse a mensajes WebSocket en tiempo real
    const unsubscribe = wsClient.subscribe((msg: WebSocketMessage) => {
      if (msg.type === 'initial_state' || msg.type === 'telemetry_batch') {
        if (msg.data.statuses) {
          setStatuses(msg.data.statuses);
        }
        if (msg.data.cases) {
          setCasesData(msg.data.cases);
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const getCaseStatus = (caseId: string): CaseCurrentStatus | undefined => {
    return statuses.find((s) => s.case_id === caseId);
  };

  const getCaseData = (caseId: string): CaseTelemetryPayload | undefined => {
    return casesData[caseId];
  };

  return {
    statuses,
    casesData,
    loading,
    getCaseStatus,
    getCaseData,
  };
}
