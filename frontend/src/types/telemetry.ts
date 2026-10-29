export type CaseId = 'pir' | 'csi_router' | 'csi_dedicated';

export interface SignalPoint {
  timestamp: number;
  value: number;
}

/** Indicadores del detector CSI (backend/app/signal_processing/presence_detector.py). */
export interface FeatureMetrics {
  movement_index: number | null;
  movement_threshold: number | null;
  shape_index: number | null;
  shape_threshold: number | null;
  /** Indicador / umbral del más alto de los dos; >= 1 significa presencia. */
  detection_ratio: number;
}

export type CalibrationState = 'sin_calibrar' | 'esperando' | 'calibrando' | 'calibrado';

export interface CalibrationInfo {
  state: CalibrationState;
  message: string;
  progress: number;
  seconds_remaining: number;
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
  movement_points?: SignalPoint[] | null;
  shape_points?: SignalPoint[] | null;
  features?: FeatureMetrics | null;
  calibration?: CalibrationInfo | null;
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
