import { useCallback } from 'react';
import { api } from '../services/api';
import type { CaseId } from '../types/telemetry';
import { useApiQuery } from './useApiQuery';

export function useCaseMetrics(caseId: CaseId) {
  const load = useCallback(async (signal: AbortSignal) => {
    const [metrics, trials] = await Promise.all([
      api.getCaseMetrics(caseId, signal),
      api.getCaseTrials(caseId, signal),
    ]);
    return { metrics, trials };
  }, [caseId]);
  const { data, loading, error } = useApiQuery(load);
  return { metrics: data?.metrics ?? null, trials: data?.trials ?? [], loading, error };
}
