import { ENDPOINTS } from './endpoints';
import { CaseCurrentStatus, CaseTelemetryPayload, FilterMetadata } from '../types/telemetry';
import { CaseMetrics, SystemComparison, Trial } from '../types/metrics';
import { CaseStudyDetail } from '../types/cases';

class ApiService {
  private async get<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} en GET ${url}`);
    }
    return response.json();
  }

  private async post<T>(url: string, body: any): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} en POST ${url}`);
    }
    return response.json();
  }

  // Health
  async getHealth() {
    return this.get<{ status: string; data_source: string; active_ws_clients: number }>(ENDPOINTS.HEALTH);
  }

  // Telemetry
  async getTelemetryStatuses(): Promise<CaseCurrentStatus[]> {
    return this.get<CaseCurrentStatus[]>(ENDPOINTS.TELEMETRY_STATUS);
  }

  async getCaseTelemetry(caseId: string): Promise<CaseTelemetryPayload> {
    return this.get<CaseTelemetryPayload>(ENDPOINTS.TELEMETRY_CASE(caseId));
  }

  async getCasePipeline(caseId: string): Promise<FilterMetadata> {
    return this.get<FilterMetadata>(ENDPOINTS.TELEMETRY_PIPELINE(caseId));
  }

  // Metrics & Comparison
  async getCaseMetrics(caseId: string): Promise<CaseMetrics> {
    return this.get<CaseMetrics>(ENDPOINTS.METRICS_CASE(caseId));
  }

  async getSystemComparison(): Promise<SystemComparison> {
    return this.get<SystemComparison>(ENDPOINTS.METRICS_COMPARISON);
  }

  async getCaseTrials(caseId: string, limit: number = 50): Promise<Trial[]> {
    return this.get<Trial[]>(`${ENDPOINTS.METRICS_TRIALS(caseId)}?limit=${limit}`);
  }

  async recordTrial(payload: {
    case_id: string;
    ground_truth: boolean;
    detected_presence: boolean;
    latency_ms: number;
    score?: number;
    notes?: string;
  }): Promise<Trial> {
    return this.post<Trial>(ENDPOINTS.RECORD_TRIAL, payload);
  }

  // Cases info
  async getCases(): Promise<CaseStudyDetail[]> {
    return this.get<CaseStudyDetail[]>(ENDPOINTS.CASES_LIST);
  }

  async getCaseDetail(caseId: string): Promise<CaseStudyDetail> {
    return this.get<CaseStudyDetail>(ENDPOINTS.CASE_DETAIL(caseId));
  }

  // Control de Simulación
  async toggleSimulation(): Promise<{ paused: boolean }> {
    return this.post<{ paused: boolean }>(ENDPOINTS.SIMULATION_TOGGLE, {});
  }

  async getSimulationStatus(): Promise<{ paused: boolean }> {
    return this.get<{ paused: boolean }>(ENDPOINTS.SIMULATION_STATUS);
  }
}

export const api = new ApiService();
