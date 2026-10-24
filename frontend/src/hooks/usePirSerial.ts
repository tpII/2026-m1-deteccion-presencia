import { useEffect, useRef, useState } from 'react';
import { getPirSerialSupportError, PirSerialConnection } from '../services/pirSerial';
import type { PirReading, PirSerialState } from '../types/pirSerial';

export function usePirSerial() {
  const [connectionState, setConnectionState] = useState<PirSerialState>('disconnected');
  const [readings, setReadings] = useState<PirReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<PirSerialConnection | null>(null);
  const supportError = getPirSerialSupportError();

  useEffect(() => {
    let mounted = true;
    const connection = new PirSerialConnection({
      onReading: (reading) => {
        if (mounted) setReadings((previous) => [...previous.slice(-49), reading]);
      },
      onStateChange: (state) => {
        if (mounted) setConnectionState(state);
      },
      onError: (message) => {
        if (mounted) setError(message);
      },
    });
    connectionRef.current = connection;

    return () => {
      mounted = false;
      connectionRef.current = null;
      void connection.disconnect().catch((err) => console.error('Error cerrando la conexión PIR USB:', err));
    };
  }, []);

  const connect = () => {
    if (supportError || connectionState !== 'disconnected') return;
    setError(null);
    setReadings([]);
    connectionRef.current?.connect();
  };

  const disconnect = async () => {
    try {
      await connectionRef.current?.disconnect();
    } catch (err) {
      setError(`No se pudo desconectar: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return { connectionState, readings, error, supportError, connect, disconnect };
}
