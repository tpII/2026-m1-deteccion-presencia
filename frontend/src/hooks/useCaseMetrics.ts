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
  const query = useApiQuery(load);
  return { ...query, metrics: query.data?.metrics ?? null, trials: query.data?.trials ?? [] };
}
