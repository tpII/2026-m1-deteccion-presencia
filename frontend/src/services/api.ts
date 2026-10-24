import { ENV } from '../config/env';
import type { PirReading, PirUsbRecord } from '../types/pirSerial';
import type { CaseId } from '../types/telemetry';
import type { CaseMetrics, SystemComparison, Trial, TrialInput } from '../types/metrics';
import type { HealthStatus } from '../types/health';

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
  getPirUsbHistory: (signal?: AbortSignal) => request<PirUsbRecord[]>('/pir-usb/readings', { signal }),
  savePirUsbReadings: (readings: PirReading[]) => post<{ saved_count: number }>('/pir-usb/readings', {
    readings: readings.map((reading) => ({
      received_at: new Date(reading.receivedAt).toISOString(),
      motion: reading.motion,
    })),
  }),
};
