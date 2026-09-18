import { CaseId } from './telemetry';

export interface CaseMetrics {
  case_id: CaseId;
  case_name: string;
  total_tests: number;
  correct_detections: number;
  detection_rate: number;
  false_positives: number;
  false_negatives: number;
  average_latency_ms: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
}

export interface Trial {
  id: number;
  case_id: CaseId;
  timestamp: string;
  ground_truth: boolean;
  detected_presence: boolean;
  is_correct: boolean;
  latency_ms: number;
  score?: number;
  notes?: string;
}

export interface ComparisonTableEntry {
  metric: string;
  unit: string;
  pir: string | number;
  csi_router: string | number;
  csi_dedicated: string | number;
}

export interface SystemComparison {
  metrics: CaseMetrics[];
  table: ComparisonTableEntry[];
  last_updated: string;
}
