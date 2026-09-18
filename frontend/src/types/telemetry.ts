export type CaseId = 'pir' | 'csi_router' | 'csi_dedicated';

export interface SignalPoint {
  timestamp: number;
  value: number;
}

export interface FilterMetadata {
  name: string;
  window_size: number;
  threshold?: number;
  parameters: Record<string, any>;
}

export interface FeatureMetrics {
  variance: number;
  energy: number;
  detection_score: number;
  threshold_applied: number;
}

export interface CaseCurrentStatus {
  case_id: CaseId;
  name: string;
  is_connected: boolean;
  presence: boolean;
  current_latency_ms: number;
  last_updated: string;
  total_samples: number;
}

export interface CaseTelemetryPayload {
  case_id: string;
  presence: boolean;
  latency_ms: number;
  raw_points: SignalPoint[];
  filtered_points?: SignalPoint[];
  filter_metadata?: FilterMetadata;
  features?: FeatureMetrics;
  current_score?: number;
  ground_truth?: boolean;
}

export type ConnectionState = 'LIVE' | 'RECONNECTING' | 'OFFLINE';

export interface WebSocketMessage {
  type: 'initial_state' | 'telemetry_batch' | 'heartbeat';
  timestamp: string;
  data: {
    statuses: CaseCurrentStatus[];
    cases: Record<string, CaseTelemetryPayload>;
  };
}
