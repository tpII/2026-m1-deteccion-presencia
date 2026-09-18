import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { CaseMetrics, SystemComparison, Trial } from '../types/metrics';

export function useMetrics(caseId?: string) {
  const [metrics, setMetrics] = useState<CaseMetrics | null>(null);
  const [comparison, setComparison] = useState<SystemComparison | null>(null);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (caseId) {
        const [m, t] = await Promise.all([
          api.getCaseMetrics(caseId),
          api.getCaseTrials(caseId),
        ]);
        setMetrics(m);
        setTrials(t);
      } else {
        const comp = await api.getSystemComparison();
        setComparison(comp);
      }
    } catch (err: any) {
      setError(err.message || 'Error cargando métricas');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recordTrial = async (groundTruth: boolean, detectedPresence: boolean, latencyMs: number, notes?: string) => {
    if (!caseId) return;
    try {
      const newTrial = await api.recordTrial({
        case_id: caseId,
        ground_truth: groundTruth,
        detected_presence: detectedPresence,
        latency_ms: latencyMs,
        notes,
      });
      setTrials((prev) => [newTrial, ...prev]);
      // Refrescar métricas acumuladas
      const updatedMetrics = await api.getCaseMetrics(caseId);
      setMetrics(updatedMetrics);
      return newTrial;
    } catch (err: any) {
      console.error('Error registrando ensayo:', err);
      throw err;
    }
  };

  return {
    metrics,
    comparison,
    trials,
    loading,
    error,
    refresh: loadData,
    recordTrial,
  };
}
