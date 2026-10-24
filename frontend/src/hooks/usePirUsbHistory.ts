import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { PirReading } from '../types/pirSerial';
import { useApiQuery } from './useApiQuery';

export function usePirUsbHistory() {
  const query = useApiQuery(api.getPirUsbHistory);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = () => {
    setSaveError(null);
    query.refresh();
  };

  const save = async (readings: PirReading[]) => {
    if (pending.current || readings.length === 0) return;
    pending.current = true;
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const { saved_count } = await api.savePirUsbReadings(readings);
      if (!mounted.current) return;
      setNotice(saved_count > 0 ? `${saved_count} lecturas nuevas guardadas.` : 'Estas lecturas ya estaban guardadas.');
      query.refresh();
    } catch {
      if (mounted.current) setSaveError('No se confirmó el guardado. Comprobá el backend y reintentá; las lecturas repetidas no se duplican.');
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return { history: query.data ?? [], loading: query.loading, saving, error: saveError ?? query.error, notice, refresh, save };
}
