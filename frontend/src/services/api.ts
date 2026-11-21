import { ENV } from '../config/env';
import type { CalibrationInfo, CaseId } from '../types/telemetry';
import type { CaseMetrics, LiveTrialCase, SystemComparison, Trial, TrialInput } from '../types/metrics';
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
  getSystemComparison: (signal?: AbortSignal) => request<SystemComparison>('/metrics/comparison', { signal }),
  recordTrial: (trial: TrialInput) => post<Trial>('/metrics/trial', trial),
  recordObservation: (observation: ObservationInput) => post<Observation>('/observations', observation),
  getObservationReport: (caseId: LiveTrialCase, environment: string, signal?: AbortSignal) =>
    request<ObservationReport>(`/observations/${caseId}?environment=${encodeURIComponent(environment)}`, { signal }),
  startCsiCalibration: (caseId: Exclude<CaseId, 'pir'>, environment: string) =>
    post<CalibrationInfo>(`/csi/${caseId}/calibration`, { environment }),
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
