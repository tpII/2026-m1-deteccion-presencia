import { ENDPOINTS } from './endpoints';
import type { PirReading, PirUsbRecord } from '../types/pirSerial';
import { CaseCurrentStatus, CaseTelemetryPayload, FilterMetadata } from '../types/telemetry';
import { CaseMetrics, SystemComparison, Trial } from '../types/metrics';
import { CaseStudyDetail } from '../types/cases';

import { SystemNodesConfig, CHeaderResponse } from '../types/config';

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

  // Prueba PIR USB
  async savePirUsbReadings(readings: PirReading[]): Promise<{ saved_count: number }> {
    return this.post(ENDPOINTS.PIR_USB_READINGS, {
      readings: readings.map((reading) => ({
        received_at: new Date(reading.receivedAt).toISOString(),
        motion: reading.motion,
      })),
    });
  }

  async getPirUsbHistory(): Promise<PirUsbRecord[]> {
    return this.get(ENDPOINTS.PIR_USB_READINGS);
  }

  // Health
  async getHealth() {
    return this.get<{ status: string; version: string; data_source: string; mqtt_connected: boolean | null; active_ws_clients: number }>(ENDPOINTS.HEALTH);
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

  // Configuración de Nodos ESP32
  async getNodesConfig(): Promise<SystemNodesConfig> {
    return this.get<SystemNodesConfig>(ENDPOINTS.CONFIG_NODES);
  }

  async updateNodesConfig(config: SystemNodesConfig): Promise<{ status: string; config: SystemNodesConfig }> {
    return this.post<{ status: string; config: SystemNodesConfig }>(ENDPOINTS.CONFIG_NODES, config);
  }

  async getNodeHeader(nodeId: string): Promise<CHeaderResponse> {
    return this.get<CHeaderResponse>(ENDPOINTS.CONFIG_HEADER(nodeId));
  }

}

export const api = new ApiService();
