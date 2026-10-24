export type CaseId = 'pir' | 'csi_router' | 'csi_dedicated';

export interface SignalPoint {
  timestamp: number;
  value: number;
}

export interface FilterMetadata {
  name: string;
  window_size: number;
  threshold?: number;
  parameters: {
    hampel_window?: number;
    hampel_sigmas?: string;
    moving_average_window?: number;
    variance_threshold?: number;
  };
}

export interface FeatureMetrics {
  variance: number;
  energy: number;
  detection_score: number;
  threshold_applied: number;
  periodicity_ratio?: number;
  target_type?: string | null;
}

export interface CaseCurrentStatus {
  case_id: CaseId;
  name: string;
  is_connected: boolean;
  presence: boolean;
  current_latency_ms: number;
  last_updated: string;
  total_samples: number;
  target_type?: string | null;
}

export interface CaseTelemetryPayload {
  case_id: CaseId;
  presence: boolean;
  latency_ms: number;
  raw_points: SignalPoint[];
  filtered_points?: SignalPoint[] | null;
  filter_metadata?: FilterMetadata | null;
  features?: FeatureMetrics | null;
  current_score?: number | null;
  ground_truth?: boolean | null;
  target_type?: string | null;
}

export type ConnectionState = 'LIVE' | 'RECONNECTING' | 'OFFLINE';

export interface WebSocketMessage {
  type: 'initial_state' | 'telemetry_batch';
  timestamp: string;
  data: {
    statuses: CaseCurrentStatus[];
    cases: Partial<Record<CaseId, CaseTelemetryPayload>>;
  };
}
