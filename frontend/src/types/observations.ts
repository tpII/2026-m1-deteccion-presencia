import type { LiveTrialCase, TrialScenario } from './metrics';

export interface ObservationInput {
  case_id: LiveTrialCase;
  environment: string;
  scenario: TrialScenario | null;
  observed_at: string;
}

export interface Observation extends ObservationInput {
  id: number;
  received_at: string;
}

export interface ObservationReport {
  marks: Observation[];
  samples: {
    id: number;
    timestamp: string;
    detected_presence: boolean;
    observation_id: number;
    scenario: TrialScenario;
    result: 'correct' | 'false_positive' | 'false_negative';
  }[];
  calibrations: {
    id: number;
    started_at: string;
    finished_at: string | null;
    outcome: string;
    sample_count: number | null;
    evaluated: number;
    false_positives: number;
    false_negatives: number;
  }[];
}
