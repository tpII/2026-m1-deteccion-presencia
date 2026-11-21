import { ENV } from '../config/env';
import type { CalibrationInfo, CaseId, StoredSamplePage } from '../types/telemetry';
import type { CaseMetrics, LiveTrialCase, Trial } from '../types/metrics';
import type { HealthStatus } from '../types/health';
import type { CsiActivity, CsiCapture, CsiCaptureComparison, CsiCapturePreview } from '../types/csiCapture';
import type { Observation, ObservationInput, ObservationReport } from '../types/observations';

const API_URL = `${ENV.API_URL}/api/v1`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) throw new Error(`Error HTTP ${response.status} al consultar ${path}`);
  return response.json();
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const api = {
  getHealth: (signal?: AbortSignal) => request<HealthStatus>('/health', { signal }),
  getCaseMetrics: (caseId: CaseId, signal?: AbortSignal) =>
    request<CaseMetrics>(`/metrics/${caseId}`, { signal }),
  getCaseTrials: (caseId: CaseId, signal?: AbortSignal) =>
    request<Trial[]>(`/metrics/${caseId}/trials`, { signal }),
  getStoredSamples: async (day: string, caseId: CaseId | '', before: number | null, signal: AbortSignal) => {
    const start = new Date(`${day}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const query = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
    if (caseId) query.set('case_id', caseId);
    if (before !== null) query.set('before', String(before));
    return request<StoredSamplePage>(`/telemetry/history?${query}`, { signal });
  },
  recordObservation: (observation: ObservationInput) => post<Observation>('/observations', observation),
  getObservationReport: (caseId: LiveTrialCase, environment: string, signal?: AbortSignal) =>
    request<ObservationReport>(`/observations/${caseId}?environment=${encodeURIComponent(environment)}`, { signal }),
  startCsiCalibration: (environment: string) =>
    post<CalibrationInfo>('/csi/csi_router/calibration', { environment }),
  getCsiCaptures: (environment: string, signal?: AbortSignal) => {
    const query = environment ? `?environment=${encodeURIComponent(environment)}` : '';
    return request<CsiCaptureComparison>(`/csi/captures${query}`, { signal });
  },
  startCsiCapture: (environment: string, activity: CsiActivity) =>
    post<CsiCapture>('/csi/captures', { environment, activity }),
  getCsiCapturePreview: (id: number, signal: AbortSignal) =>
    request<CsiCapturePreview>(`/csi/captures/${id}/preview`, { signal }),
  finishCsiCapture: (id: number) => post<CsiCapture>(`/csi/captures/${id}/finish`, {}),
};
